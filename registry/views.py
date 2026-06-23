from django.contrib import messages
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
from .models import EmailConfiguration, MealCategory, MealScan, OrganizationSettings, Role, User


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
    return render(
        request,
        "registry/admin_home.html",
        {
            "user_count": User.objects.count(),
            "scan_count": MealScan.objects.count(),
            "categories": MealCategory.objects.all(),
            "recent_scans": MealScan.objects.select_related("user", "category", "scanned_by")[:10],
        },
    )


@admin_required
def user_list(request):
    qs = User.objects.order_by("username")
    now = timezone.localtime()
    admins_count = User.objects.filter(role__in=[Role.ADMIN, Role.SUPER_ADMIN]).count()
    active_count = User.objects.filter(is_active=True).count()
    qr_issued_count = User.objects.exclude(qr_access_code__isnull=True).exclude(qr_access_code__exact="").count()
    recently_added_count = User.objects.filter(date_joined__gte=(now.date() - datetime.timedelta(days=7))).count()
    q = request.GET.get("q", "").strip()
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
