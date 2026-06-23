import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class Role(models.TextChoices):
    USER = "USER", "User"
    STAFF = "STAFF", "Staff"
    ADMIN = "ADMIN", "Administrator"
    SUPER_ADMIN = "SUPER_ADMIN", "Super Administrator"


class User(AbstractUser):
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.USER)
    qr_access_code = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    @property
    def is_staff_member(self):
        return self.role in {Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN}

    @property
    def is_admin_member(self):
        return self.role in {Role.ADMIN, Role.SUPER_ADMIN}


class OrganizationSettings(models.Model):
    name = models.CharField(max_length=160, default="Brebner Primary School")
    logo = models.ImageField(upload_to="branding/", blank=True, null=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=40, blank=True)
    address = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, blank=True, null=True)

    class Meta:
        verbose_name_plural = "Organization settings"

    def __str__(self):
        return self.name

    @classmethod
    def singleton(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class EmailConfiguration(models.Model):
    class AuthMode(models.TextChoices):
        SMTP = "SMTP", "SMTP"
        OAUTH = "OAUTH", "OAuth"

    auth_mode = models.CharField(max_length=10, choices=AuthMode.choices, default=AuthMode.SMTP)
    from_email = models.EmailField(default="no-reply@example.local")
    smtp_host = models.CharField(max_length=160, blank=True)
    smtp_port = models.PositiveIntegerField(default=587)
    smtp_username = models.CharField(max_length=160, blank=True)
    smtp_password = models.CharField(max_length=255, blank=True)
    smtp_use_tls = models.BooleanField(default=True)
    oauth_provider = models.CharField(max_length=80, blank=True)
    oauth_tenant_id = models.CharField(max_length=160, blank=True)
    oauth_client_id = models.CharField(max_length=160, blank=True)
    oauth_client_secret = models.CharField(max_length=255, blank=True)
    oauth_refresh_token = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, blank=True, null=True)

    class Meta:
        verbose_name_plural = "Email configuration"

    @classmethod
    def singleton(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f"{self.auth_mode} email configuration"


class MealCategory(models.Model):
    name = models.CharField(max_length=80, unique=True)
    description = models.CharField(max_length=180, blank=True)
    starts_at = models.TimeField()
    ends_at = models.TimeField()
    daily_limit_per_user = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    colour_tag = models.CharField(max_length=7, default="#047c78")
    display_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, blank=True, null=True, related_name="created_categories")
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, blank=True, null=True, related_name="updated_categories")

    class Meta:
        ordering = ["display_order", "starts_at", "name"]

    def __str__(self):
        return self.name

    def contains(self, value):
        if self.starts_at <= self.ends_at:
            return self.starts_at <= value <= self.ends_at
        return value >= self.starts_at or value <= self.ends_at


class MealScan(models.Model):
    class Status(models.TextChoices):
        ACCEPTED = "ACCEPTED", "Accepted"
        DENIED = "DENIED", "Denied"

    user = models.ForeignKey(User, on_delete=models.PROTECT, blank=True, null=True, related_name="meal_scans")
    category = models.ForeignKey(MealCategory, on_delete=models.PROTECT, blank=True, null=True)
    scanned_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="staff_scans")
    scanned_at = models.DateTimeField(default=timezone.now)
    scan_date = models.DateField()
    status = models.CharField(max_length=12, choices=Status.choices)
    reason = models.CharField(max_length=255, blank=True)
    raw_code = models.CharField(max_length=120)

    class Meta:
        indexes = [
            models.Index(fields=["user", "category", "scan_date", "status"]),
            models.Index(fields=["scanned_by", "scanned_at"]),
        ]
        ordering = ["-scanned_at"]

    def __str__(self):
        return f"{self.user} {self.status} {self.scanned_at:%Y-%m-%d %H:%M}"


class AuditEvent(models.Model):
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, blank=True, null=True)
    event_type = models.CharField(max_length=80)
    detail = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["event_type", "created_at"])]

    def __str__(self):
        return f"{self.event_type} at {self.created_at:%Y-%m-%d %H:%M:%S}"
