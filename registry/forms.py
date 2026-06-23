from django import forms
from django.contrib.auth.forms import UserChangeForm, UserCreationForm

from .models import EmailConfiguration, MealCategory, OrganizationSettings, Role, User


class UserCreateForm(UserCreationForm):
    email = forms.EmailField(required=True, help_text="The QR access code is emailed to this address after creation.")
    role = forms.ChoiceField(
        choices=Role.choices,
        widget=forms.RadioSelect,
        label="Account type",
        help_text="Meal Ticket Users can claim meals. Staff scan tickets. Administrators manage users, categories and settings.",
    )

    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("username", "first_name", "last_name", "email", "role")
        help_texts = {
            "username": "Used for login and audit records.",
            "first_name": "Shown to staff when a QR code is scanned.",
            "last_name": "Shown to staff when a QR code is scanned.",
        }


class UserEditForm(UserChangeForm):
    password = None
    email = forms.EmailField(required=True)
    role = forms.ChoiceField(
        choices=Role.choices,
        widget=forms.RadioSelect,
        label="Account type",
        help_text="Meal Ticket Users can claim meals. Staff scan tickets. Administrators manage users, categories and settings.",
    )

    class Meta:
        model = User
        fields = ("username", "first_name", "last_name", "email", "role", "is_active")
        help_texts = {
            "username": "Used for login and audit records.",
            "first_name": "Shown to staff when a QR code is scanned.",
            "last_name": "Shown to staff when a QR code is scanned.",
            "is_active": "Inactive accounts cannot log in or claim meals.",
        }


class StaffPasswordResetForm(forms.Form):
    new_password = forms.CharField(widget=forms.PasswordInput, min_length=8)


class MealCategoryForm(forms.ModelForm):
    class Meta:
        model = MealCategory
        fields = ("name", "description", "starts_at", "ends_at", "daily_limit_per_user", "is_active", "colour_tag", "display_order")
        widgets = {
            "starts_at": forms.TimeInput(attrs={"type": "time"}),
            "ends_at": forms.TimeInput(attrs={"type": "time"}),
            "colour_tag": forms.TextInput(attrs={"type": "color"}),
        }
        labels = {
            "daily_limit_per_user": "Capacity limit per user",
            "colour_tag": "Colour tag",
            "display_order": "Display order",
            "is_active": "Availability status",
        }
        help_texts = {
            "description": "Short operational label, for example Morning Service or Main Meal.",
            "daily_limit_per_user": "Maximum claims per user for this category per day.",
            "display_order": "Lower numbers appear first in operational views.",
        }


class OrganizationSettingsForm(forms.ModelForm):
    class Meta:
        model = OrganizationSettings
        fields = ("name", "logo", "contact_email", "contact_phone", "address")


class EmailConfigurationForm(forms.ModelForm):
    class Meta:
        model = EmailConfiguration
        fields = (
            "auth_mode",
            "from_email",
            "smtp_host",
            "smtp_port",
            "smtp_username",
            "smtp_password",
            "smtp_use_tls",
            "oauth_provider",
            "oauth_tenant_id",
            "oauth_client_id",
            "oauth_client_secret",
            "oauth_refresh_token",
        )
        widgets = {
            "smtp_password": forms.PasswordInput(render_value=True),
            "oauth_client_secret": forms.PasswordInput(render_value=True),
            "oauth_refresh_token": forms.Textarea(attrs={"rows": 3}),
        }
