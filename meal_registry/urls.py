from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import path

from registry import views


urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("login/", auth_views.LoginView.as_view(template_name="registration/login.html"), name="login"),
    path("logout/", auth_views.LogoutView.as_view(), name="logout"),
    path("", views.dashboard, name="dashboard"),
    path("scan/", views.scan, name="scan"),
    path("scan/claim/", views.claim_scan, name="claim_scan"),
    path("admin-portal/", views.admin_home, name="admin_home"),
    path("admin-portal/users/", views.user_list, name="user_list"),
    path("admin-portal/users/new/", views.user_create, name="user_create"),
    path("admin-portal/users/<int:user_id>/", views.user_detail, name="user_detail"),
    path("admin-portal/users/<int:user_id>/edit/", views.user_edit, name="user_edit"),
    path("admin-portal/users/<int:user_id>/qr.png", views.user_qr_image, name="user_qr_image"),
    path("admin-portal/users/<int:user_id>/reset-password/", views.reset_password, name="reset_password"),
    path("admin-portal/categories/", views.category_list, name="category_list"),
    path("admin-portal/categories/export/", views.category_export, name="category_export"),
    path("admin-portal/categories/new/", views.category_edit, name="category_create"),
    path("admin-portal/categories/<int:category_id>/", views.category_edit, name="category_edit"),
    path("admin-portal/categories/<int:category_id>/duplicate/", views.category_duplicate, name="category_duplicate"),
    path("admin-portal/categories/<int:category_id>/toggle-active/", views.category_toggle_active, name="category_toggle_active"),
    path("admin-portal/categories/<int:category_id>/delete/", views.category_delete, name="category_delete"),
    path("admin-portal/settings/", views.settings_page, name="settings_page"),
    path("admin-portal/settings/branding/", views.branding_settings, name="branding_settings"),
    path("admin-portal/settings/email/", views.email_settings, name="email_settings"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
