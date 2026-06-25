from django.contrib import messages
import csv
from collections import Counter

from django.contrib.auth.views import redirect_to_login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.hashers import make_password
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import ProtectedError
from django.db.models import Count, Q
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
import datetime
from uuid import UUID
from django.views.decorators.http import require_POST

from .audit import record_event
from .emailing import send_user_qr_email
from .emailing import qr_png_bytes
from .forms import (
    EmailConfigurationForm,
    MealCategoryForm,
    OrganizationSettingsForm,
    StaffPasswordResetForm,
    UserCreateForm,
    UserEditForm,
)
from .models import AuditEvent, EmailConfiguration, MealCategory, MealScan, OrganizationSettings, Role, User


def admin_required(view_func):
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect_to_login(request.get_full_path())
        if not request.user.is_admin_member:
            raise PermissionDenied
        return view_func(request, *args, **kwargs)

    return wrapped


def staff_required(view_func):
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect_to_login(request.get_full_path())
        if not request.user.is_staff_member:
            raise PermissionDenied
        return view_func(request, *args, **kwargs)

    return wrapped


def _format_clock(value):
    return value.strftime("%I:%M %p").lstrip("0")


def _trend_label(current, previous):
    if previous == 0:
        if current == 0:
            return "0% vs yesterday", "neutral"
        return "New vs yesterday", "positive"
    delta = round(((current - previous) / previous) * 100)
    sign = "+" if delta >= 0 else ""
    return f"{sign}{delta}% vs yesterday", "positive" if delta >= 0 else "negative"


@login_required
def dashboard(request):
    if request.user.is_admin_member:
        return redirect("admin_home")
    if request.user.is_staff_member:
        return redirect("scan")
    return render(request, "registry/user_home.html")


@staff_required
def scan(request):
    now = timezone.localtime()
    current_category = next((item for item in MealCategory.objects.filter(is_active=True) if item.contains(now.time())), None)
    scanned_users = MealScan.objects.select_related("user", "category", "scanned_by").filter(
        scan_date=now.date(),
        status=MealScan.Status.ACCEPTED,
    )
    if current_category:
        scanned_users = scanned_users.filter(category=current_category)
    return render(
        request,
        "registry/scan.html",
        {
            "current_category": current_category,
            "scanned_users": scanned_users[:25],
        },
    )


@require_POST
@staff_required
@transaction.atomic
def claim_scan(request):
    code = request.POST.get("code", "").strip()
    now = timezone.localtime()
    today = now.date()

    user = User.objects.filter(qr_access_code=code, is_active=True).first()
    category = next((item for item in MealCategory.objects.filter(is_active=True) if item.contains(now.time())), None)

    status = MealScan.Status.DENIED
    reason = ""
    if not user:
        reason = "Unknown or inactive QR code."
    elif user.role != Role.USER:
        reason = f"{user.get_role_display()} QR codes are login identities, not meal tickets."
    elif not category:
        reason = "No active meal category for this time."
    else:
        used = MealScan.objects.filter(
            user=user,
            category=category,
            scan_date=today,
            status=MealScan.Status.ACCEPTED,
        ).count()
        if used >= category.daily_limit_per_user:
            reason = f"Daily limit reached for {category.name}."
        else:
            status = MealScan.Status.ACCEPTED
            reason = f"{category.name} claim accepted."

    scan_record = MealScan.objects.create(
        user=user,
        category=category,
        scanned_by=request.user,
        scanned_at=now,
        scan_date=today,
        status=status,
        reason=reason,
        raw_code=code[:120],
    )
    detail_user = user.username if user else "unknown"
    record_event(request, "QR_SCAN", f"{status}: {detail_user}; {reason}; scan_id={scan_record.pk}")

    return JsonResponse(
        {
            "status": status,
            "reason": reason,
            "category": category.name if category else None,
            "user": user.get_full_name() or user.username if user else None,
            "scanned_at": now.strftime("%Y-%m-%d %H:%M:%S"),
            "scan_id": scan_record.id,
        }
    )


@admin_required
def admin_home(request):
    now = timezone.localtime()
    today = now.date()
    yesterday = today - datetime.timedelta(days=1)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    range_key = request.GET.get("range", "today").strip()
    search = request.GET.get("q", "").strip()
    category_filter = request.GET.get("category", "").strip()
    status_filter = request.GET.get("status", "").strip()
    staff_filter = request.GET.get("staff", "").strip()
    sort = request.GET.get("sort", "recent").strip()

    categories = list(MealCategory.objects.all())
    staff_users = User.objects.filter(role__in=[Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN]).order_by("first_name", "last_name", "username")

    current_category = next((category for category in categories if category.is_active and category.contains(now.time())), None)
    current_category_count = 0
    current_category_capacity = 0
    current_category_progress = 0
    active_window_label = "No active meal window"
    active_window_time = "Awaiting the next active session"
    active_window_status = "Closed"
    if current_category:
        meal_users = User.objects.filter(role=Role.USER, is_active=True).count()
        current_category_count = MealScan.objects.filter(
            category=current_category,
            scan_date=today,
            status=MealScan.Status.ACCEPTED,
        ).count()
        current_category_capacity = max(meal_users * current_category.daily_limit_per_user, 0)
        current_category_progress = (
            int((current_category_count / current_category_capacity) * 100)
            if current_category_capacity
            else 0
        )
        active_window_label = current_category.name
        active_window_time = f"{_format_clock(current_category.starts_at)} - {_format_clock(current_category.ends_at)}"
        active_window_status = "Open"

    today_scans = list(MealScan.objects.select_related("user", "category", "scanned_by").filter(scan_date=today))
    yesterday_scans = list(MealScan.objects.filter(scan_date=yesterday))

    total_scans_today = len(today_scans)
    approved_today = sum(1 for scan in today_scans if scan.status == MealScan.Status.ACCEPTED)
    denied_today = sum(1 for scan in today_scans if scan.status == MealScan.Status.DENIED)
    total_scans_yesterday = len(yesterday_scans)
    approved_yesterday = sum(1 for scan in yesterday_scans if scan.status == MealScan.Status.ACCEPTED)
    denied_yesterday = sum(1 for scan in yesterday_scans if scan.status == MealScan.Status.DENIED)

    user_count = User.objects.count()
    registered_users = User.objects.filter(role=Role.USER).count()
    category_count = len(categories)

    last_scan = MealScan.objects.select_related("user", "category", "scanned_by").first()
    latest_audit = AuditEvent.objects.select_related("actor").first()
    last_activity_at = last_scan.scanned_at if last_scan else None
    if latest_audit and (last_activity_at is None or latest_audit.created_at > last_activity_at):
        last_activity_at = latest_audit.created_at
    if last_activity_at is None:
        last_activity_at = now

    scan_age = now - last_scan.scanned_at if last_scan else None
    scanner_status = "Online" if scan_age and scan_age <= datetime.timedelta(minutes=10) else "Idle"
    scanner_status_class = "good" if scanner_status == "Online" else "warn"
    system_status = "Healthy" if current_category and total_scans_today else "Monitoring"
    system_status_class = "good" if current_category else "warn"

    scans_today_feed = MealScan.objects.select_related("user", "category", "scanned_by").filter(scan_date=today)
    hour_counts = Counter(scan.scanned_at.hour for scan in today_scans)
    peak_hour = max(hour_counts.values()) if hour_counts else 0
    hourly_scan_bars = []
    for hour in range(24):
        count = hour_counts.get(hour, 0)
        hourly_scan_bars.append(
            {
                "hour": hour,
                "label": f"{hour:02d}:00",
                "count": count,
                "height": 12 if not peak_hour else max(8, round((count / peak_hour) * 100)),
            }
        )

    category_counts = Counter((scan.category.name if scan.category else "Unassigned") for scan in today_scans)
    category_rows = [
        {
            "name": name,
            "count": count,
            "percent": round((count / total_scans_today) * 100) if total_scans_today else 0,
        }
        for name, count in category_counts.most_common(6)
    ]

    staff_counts = Counter()
    staff_names = {}
    repeated_failed_users = Counter()
    for scan in today_scans:
        if scan.scanned_by_id:
            staff_counts[scan.scanned_by_id] += 1
            staff_names[scan.scanned_by_id] = scan.scanned_by.get_full_name() or scan.scanned_by.username
        if scan.status == MealScan.Status.DENIED and scan.user_id:
            repeated_failed_users[scan.user_id] += 1
    top_staff = [
        {
            "name": staff_names.get(user_id, "Staff"),
            "count": count,
        }
        for user_id, count in staff_counts.most_common(5)
    ]

    approval_rate = round((approved_today / total_scans_today) * 100) if total_scans_today else 0
    denial_rate = round((denied_today / total_scans_today) * 100) if total_scans_today else 0
    denied_label, denied_trend_class = _trend_label(denied_today, denied_yesterday)
    approved_label, approved_trend_class = _trend_label(approved_today, approved_yesterday)
    total_label, total_trend_class = _trend_label(total_scans_today, total_scans_yesterday)
    users_label, users_trend_class = _trend_label(user_count, User.objects.filter(date_joined__date=yesterday).count())
    category_label, category_trend_class = _trend_label(category_count, MealCategory.objects.filter(created_at__date=yesterday).count())

    activity_feed = MealScan.objects.select_related("user", "category", "scanned_by")
    range_map = {
        "today": start_of_day,
        "24h": now - datetime.timedelta(hours=24),
        "7d": now - datetime.timedelta(days=7),
        "30d": now - datetime.timedelta(days=30),
        "all": None,
    }
    feed_start = range_map.get(range_key, start_of_day)
    if feed_start:
        activity_feed = activity_feed.filter(scanned_at__gte=feed_start)
    if search:
        activity_feed = activity_feed.filter(
            Q(user__username__icontains=search)
            | Q(user__first_name__icontains=search)
            | Q(user__last_name__icontains=search)
            | Q(category__name__icontains=search)
            | Q(scanned_by__username__icontains=search)
            | Q(scanned_by__first_name__icontains=search)
            | Q(scanned_by__last_name__icontains=search)
            | Q(reason__icontains=search)
            | Q(raw_code__icontains=search)
        )
    if category_filter:
        activity_feed = activity_feed.filter(category_id=category_filter)
    if status_filter == "approved":
        activity_feed = activity_feed.filter(status=MealScan.Status.ACCEPTED)
    elif status_filter == "denied":
        activity_feed = activity_feed.filter(status=MealScan.Status.DENIED)
    if staff_filter:
        activity_feed = activity_feed.filter(scanned_by_id=staff_filter)

    sort_map = {
        "recent": ["-scanned_at"],
        "oldest": ["scanned_at"],
        "user": ["user__username", "-scanned_at"],
        "category": ["category__name", "-scanned_at"],
        "staff": ["scanned_by__username", "-scanned_at"],
        "status": ["status", "-scanned_at"],
    }
    activity_feed = activity_feed.order_by(*sort_map.get(sort, sort_map["recent"]))

    export_query = request.GET.copy()
    export_query["export"] = "1"
    export_url = f"?{export_query.urlencode()}"

    if request.GET.get("export") == "1":
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="meal-operations-dashboard.csv"'
        writer = csv.writer(response)
        writer.writerow(["Time", "User", "Meal Category", "Result", "Processed By", "Location", "Reason"])
        for scan in activity_feed[:500]:
            writer.writerow(
                [
                    timezone.localtime(scan.scanned_at).strftime("%Y-%m-%d %H:%M:%S"),
                    scan.user.get_full_name() or scan.user.username if scan.user else "Unknown",
                    scan.category.name if scan.category else "-",
                    scan.get_status_display(),
                    scan.scanned_by.get_full_name() or scan.scanned_by.username,
                    "Not captured",
                    scan.reason,
                ]
            )
        return response

    alerts = []
    if not current_category:
        alerts.append(
            {
                "severity": "warn",
                "title": "No active meal window",
                "detail": "Scanning is running, but no category is currently scheduled for this time.",
            }
        )
    if total_scans_today and denial_rate >= 20:
        alerts.append(
            {
                "severity": "danger",
                "title": "High denial rate detected",
                "detail": f"{denied_today} denied scans today ({denial_rate}% of activity).",
            }
        )
    if last_scan and scan_age and scan_age > datetime.timedelta(minutes=15):
        alerts.append(
            {
                "severity": "warn",
                "title": "No recent scans",
                "detail": f"Last scan was {timezone.template_localtime(last_scan.scanned_at).strftime('%I:%M %p').lstrip('0')}.",
            }
        )
    if current_category and current_category.ends_at:
        hours_left = int((timezone.make_aware(datetime.datetime.combine(today, current_category.ends_at)) - now).total_seconds() // 60)
        if 0 <= hours_left <= 15:
            alerts.append(
                {
                    "severity": "warn",
                    "title": "Meal window closes soon",
                    "detail": f"{current_category.name} closes in {hours_left} minutes.",
                }
            )
    if repeated_failed_users:
        alerts.append(
            {
                "severity": "warn",
                "title": "Repeated failed scans",
                "detail": f"{sum(1 for count in repeated_failed_users.values() if count > 1)} users have repeated failed attempts today.",
            }
        )
    if not alerts:
        alerts.append(
            {
                "severity": "good",
                "title": "Operational status healthy",
                "detail": "No active alerts. Scans, users and categories are within normal operating thresholds.",
            }
        )

    recent_audit_events = AuditEvent.objects.select_related("actor").order_by("-created_at")[:6]

    scan_window_options = [
        ("today", "Today"),
        ("24h", "Last 24 hours"),
        ("7d", "Last 7 days"),
        ("30d", "Last 30 days"),
        ("all", "All time"),
    ]

    return render(
        request,
        "registry/admin_home.html",
        {
            "user_count": user_count,
            "registered_users": registered_users,
            "scan_count": total_scans_today,
            "approved_today": approved_today,
            "denied_today": denied_today,
            "categories": categories,
            "category_count": category_count,
            "current_category": current_category,
            "current_category_count": current_category_count,
            "current_category_capacity": current_category_capacity,
            "current_category_progress": current_category_progress,
            "active_window_label": active_window_label,
            "active_window_time": active_window_time,
            "active_window_status": active_window_status,
            "scanner_status": scanner_status,
            "scanner_status_class": scanner_status_class,
            "system_status": system_status,
            "system_status_class": system_status_class,
            "last_activity_at": last_activity_at,
            "activity_feed": activity_feed[:12],
            "range_key": range_key,
            "scan_window_options": scan_window_options,
            "search": search,
            "category_filter": category_filter,
            "status_filter": status_filter,
            "staff_filter": staff_filter,
            "sort": sort,
            "staff_users": staff_users,
            "hourly_scan_bars": hourly_scan_bars,
            "category_rows": category_rows,
            "top_staff": top_staff,
            "alerts": alerts,
            "recent_audit_events": recent_audit_events,
            "approval_rate": approval_rate,
            "denial_rate": denial_rate,
            "total_label": total_label,
            "total_trend_class": total_trend_class,
            "approved_label": approved_label,
            "approved_trend_class": approved_trend_class,
            "denied_label": denied_label,
            "denied_trend_class": denied_trend_class,
            "users_label": users_label,
            "users_trend_class": users_trend_class,
            "category_label": category_label,
            "category_trend_class": category_trend_class,
            "export_url": export_url,
        },
    )


@admin_required
def user_list(request):
    qs = User.objects.all()
    now = timezone.localtime()
    admins_count = User.objects.filter(role__in=[Role.ADMIN, Role.SUPER_ADMIN]).count()
    active_count = User.objects.filter(is_active=True).count()
    qr_issued_count = User.objects.exclude(qr_access_code__isnull=True).count()
    recently_added_count = User.objects.filter(date_joined__gte=(now - datetime.timedelta(days=7))).count()
    q = request.GET.get("q", "").strip()
    role = request.GET.get("role", "").strip()
    status = request.GET.get("status", "").strip()
    sort = request.GET.get("sort", "recent").strip()

    if q:
        qs = qs.filter(
            Q(username__icontains=q)
            | Q(first_name__icontains=q)
            | Q(last_name__icontains=q)
            | Q(email__icontains=q)
        )
        try:
            qs = qs.filter(qr_access_code=UUID(q))
        except (ValueError, TypeError):
            pass
    if role in Role.values:
        qs = qs.filter(role=role)
    elif role == "GUEST":
        qs = qs.none()

    if status == "active":
        qs = qs.filter(is_active=True)
    elif status in {"disabled", "suspended", "pending"}:
        qs = qs.filter(is_active=False)

    sort_map = {
        "recent": ["-date_joined"],
        "name": ["first_name", "last_name", "username"],
        "username": ["username"],
        "last_active": ["-last_login"],
        "role": ["role", "username"],
    }
    qs = qs.order_by(*sort_map.get(sort, sort_map["recent"]))

    return render(
        request,
        "registry/user_list.html",
        {
            "users": qs,
            "admins_count": admins_count,
            "active_count": active_count,
            "qr_issued_count": qr_issued_count,
            "recently_added_count": recently_added_count,
            "last_sync": now,
            "q": q,
            "role": role,
            "status": status,
            "sort": sort,
        },
    )


@admin_required
def user_create(request):
    form = UserCreateForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        user = form.save()
        record_event(request, "USER_CREATED", f"Created {user.username} with role {user.role}.")
        if user.email:
            try:
                send_user_qr_email(user)
                record_event(request, "QR_EMAIL_SENT", f"Sent QR email to {user.email}.")
                messages.success(request, "User created and QR email sent.")
            except Exception as exc:
                record_event(request, "QR_EMAIL_FAILED", f"Failed sending QR email to {user.email}: {exc}")
                messages.warning(request, f"User created, but QR email failed: {exc}")
        else:
            messages.success(request, "User created.")
        return redirect("user_detail", user_id=user.id)
    return render(request, "registry/user_form.html", {"form": form, "mode": "create"})


@admin_required
def user_detail(request, user_id):
    target = get_object_or_404(User, pk=user_id)
    return render(request, "registry/user_detail.html", {"target": target})


@admin_required
def user_qr_image(request, user_id):
    target = get_object_or_404(User, pk=user_id)
    return HttpResponse(qr_png_bytes(str(target.qr_access_code)), content_type="image/png")


@admin_required
def user_edit(request, user_id):
    target = get_object_or_404(User, pk=user_id)
    form = UserEditForm(request.POST or None, instance=target)
    if request.method == "POST" and form.is_valid():
        user = form.save()
        record_event(request, "USER_UPDATED", f"Updated {user.username} with role {user.role}.")
        messages.success(request, "User updated.")
        return redirect("user_detail", user_id=user.id)
    return render(request, "registry/user_form.html", {"form": form, "target": target, "mode": "edit"})


@admin_required
def reset_password(request, user_id):
    target = get_object_or_404(User, pk=user_id)
    if target.role != Role.STAFF:
        messages.error(request, "Only staff passwords can be reset here.")
        return redirect("user_list")
    form = StaffPasswordResetForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        target.password = make_password(form.cleaned_data["new_password"])
        target.save(update_fields=["password"])
        record_event(request, "PASSWORD_RESET", f"Password reset for {target.username}.")
        messages.success(request, "Password reset complete.")
        return redirect("user_list")
    return render(request, "registry/form.html", {"form": form, "title": f"Reset password for {target.username}"})


@admin_required
def category_list(request):
    now = timezone.localtime()
    today = now.date()
    categories = MealCategory.objects.annotate(
        accepted_today=Count(
            "mealscan",
            filter=Q(mealscan__scan_date=today, mealscan__status=MealScan.Status.ACCEPTED),
        )
    )

    search = request.GET.get("q", "").strip()
    status = request.GET.get("status", "")
    sort = request.GET.get("sort", "start")

    if search:
        categories = categories.filter(Q(name__icontains=search) | Q(description__icontains=search))
    if status == "active":
        categories = categories.filter(is_active=True)
    elif status == "inactive":
        categories = categories.filter(is_active=False)
    elif status == "upcoming":
        categories = categories.filter(is_active=True, starts_at__gt=now.time())

    sort_map = {
        "name": ["name"],
        "start": ["starts_at", "name"],
        "capacity": ["-daily_limit_per_user", "starts_at"],
        "updated": ["-updated_at"],
    }
    categories = list(categories.order_by(*sort_map.get(sort, sort_map["start"])))

    meal_user_count = User.objects.filter(role=Role.USER, is_active=True).count()
    for category in categories:
        category.today_capacity = category.daily_limit_per_user * meal_user_count
        category.usage_percent = 0
        if category.today_capacity:
            category.usage_percent = min(100, round((category.accepted_today / category.today_capacity) * 100))
        if not category.is_active:
            category.operational_status = "Inactive"
        elif category.contains(now.time()):
            category.operational_status = "Active"
        elif category.starts_at > now.time():
            category.operational_status = "Scheduled"
        else:
            category.operational_status = "Closed"

    all_categories = MealCategory.objects.all()
    active_count = all_categories.filter(is_active=True).count()
    upcoming_count = all_categories.filter(is_active=True, starts_at__gt=now.time()).count()
    today_capacity = sum(category.daily_limit_per_user * meal_user_count for category in all_categories.filter(is_active=True))

    return render(
        request,
        "registry/category_list.html",
        {
            "categories": categories,
            "total_count": all_categories.count(),
            "active_count": active_count,
            "upcoming_count": upcoming_count,
            "today_capacity": today_capacity,
            "search": search,
            "status": status,
            "sort": sort,
            "last_synced": now,
        },
    )


@admin_required
def category_edit(request, category_id=None):
    category = get_object_or_404(MealCategory, pk=category_id) if category_id else None
    form = MealCategoryForm(request.POST or None, instance=category)
    if request.method == "POST" and form.is_valid():
        item = form.save(commit=False)
        if not item.pk:
            item.created_by = request.user
        item.updated_by = request.user
        item.save()
        record_event(request, "MEAL_CATEGORY_SAVED", f"Saved meal category {item.name}.")
        messages.success(request, "Meal category saved.")
        return redirect("category_list")
    return render(request, "registry/category_form.html", {"form": form, "category": category})


@admin_required
def category_export(request):
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="meal-categories.csv"'
    response.write("name,description,starts_at,ends_at,daily_limit_per_user,is_active,updated_at\n")
    for category in MealCategory.objects.all():
        response.write(
            f'"{category.name}","{category.description}",{category.starts_at},{category.ends_at},'
            f"{category.daily_limit_per_user},{category.is_active},{category.updated_at.isoformat()}\n"
        )
    record_event(request, "MEAL_CATEGORY_EXPORTED", "Exported meal categories CSV.")
    return response


@require_POST
@admin_required
def category_duplicate(request, category_id):
    category = get_object_or_404(MealCategory, pk=category_id)
    base_name = f"{category.name} copy"
    duplicate_name = base_name
    suffix = 2
    while MealCategory.objects.filter(name=duplicate_name).exists():
        duplicate_name = f"{base_name} {suffix}"
        suffix += 1
    duplicate = MealCategory.objects.create(
        name=duplicate_name,
        description=category.description,
        starts_at=category.starts_at,
        ends_at=category.ends_at,
        daily_limit_per_user=category.daily_limit_per_user,
        is_active=False,
        colour_tag=category.colour_tag,
        display_order=category.display_order + 1,
        created_by=request.user,
        updated_by=request.user,
    )
    record_event(request, "MEAL_CATEGORY_DUPLICATED", f"Duplicated {category.name} to {duplicate.name}.")
    messages.success(request, "Category duplicated as inactive.")
    return redirect("category_edit", category_id=duplicate.id)


@require_POST
@admin_required
def category_toggle_active(request, category_id):
    category = get_object_or_404(MealCategory, pk=category_id)
    category.is_active = not category.is_active
    category.updated_by = request.user
    category.save(update_fields=["is_active", "updated_by", "updated_at"])
    action = "enabled" if category.is_active else "disabled"
    record_event(request, "MEAL_CATEGORY_STATUS_CHANGED", f"{category.name} {action}.")
    messages.success(request, f"Category {action}.")
    return redirect("category_list")


@require_POST
@admin_required
def category_delete(request, category_id):
    category = get_object_or_404(MealCategory, pk=category_id)
    category_name = category.name
    try:
        category.delete()
    except ProtectedError:
        messages.error(request, "This category has scan history and cannot be deleted. Disable it instead.")
        return redirect("category_list")
    record_event(request, "MEAL_CATEGORY_DELETED", f"Deleted meal category {category_name}.")
    messages.success(request, "Category deleted.")
    return redirect("category_list")


@admin_required
def settings_page(request):
    org_settings = OrganizationSettings.singleton()
    email_config = EmailConfiguration.singleton()
    submitted_section = request.POST.get("section") if request.method == "POST" else None
    branding_form = OrganizationSettingsForm(
        request.POST if submitted_section == "branding" else None,
        request.FILES if submitted_section == "branding" else None,
        instance=org_settings,
        prefix="branding",
    )
    email_form = EmailConfigurationForm(
        request.POST if submitted_section == "email" else None,
        instance=email_config,
        prefix="email",
    )

    if request.method == "POST" and submitted_section == "branding" and branding_form.is_valid():
        item = branding_form.save(commit=False)
        item.updated_by = request.user
        item.save()
        record_event(request, "BRANDING_UPDATED", "Updated branding settings.")
        messages.success(request, "Branding settings saved.")
        return redirect("settings_page")

    if request.method == "POST" and submitted_section == "email" and email_form.is_valid():
        item = email_form.save(commit=False)
        item.updated_by = request.user
        item.save()
        record_event(request, "EMAIL_SETTINGS_UPDATED", f"Email auth mode set to {item.auth_mode}.")
        messages.success(request, "Email configuration saved.")
        return redirect("settings_page")

    return render(
        request,
        "registry/settings.html",
        {
            "branding_form": branding_form,
            "email_form": email_form,
        },
    )

@admin_required
def branding_settings(request):
    return redirect("settings_page")


@admin_required
def email_settings(request):
    return redirect("settings_page")
