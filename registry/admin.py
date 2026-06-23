from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import AuditEvent, EmailConfiguration, MealCategory, MealScan, OrganizationSettings, User


@admin.register(User)
class RegistryUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("Meal Registry", {"fields": ("role", "qr_access_code")}),)
    readonly_fields = ("qr_access_code",)
    list_display = ("username", "email", "first_name", "last_name", "role", "is_active")
    list_filter = ("role", "is_active")


@admin.register(MealCategory)
class MealCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "description", "starts_at", "ends_at", "daily_limit_per_user", "is_active", "display_order")
    list_filter = ("is_active",)


@admin.register(MealScan)
class MealScanAdmin(admin.ModelAdmin):
    list_display = ("user", "category", "status", "scanned_by", "scanned_at", "reason")
    list_filter = ("status", "category", "scan_date")
    readonly_fields = ("user", "category", "scanned_by", "scanned_at", "scan_date", "status", "reason", "raw_code")


admin.site.register(OrganizationSettings)
admin.site.register(EmailConfiguration)
admin.site.register(AuditEvent)
