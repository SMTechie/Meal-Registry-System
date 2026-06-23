from django.contrib.auth.signals import user_logged_in, user_login_failed, user_logged_out
from django.dispatch import receiver

from .audit import record_event


@receiver(user_logged_in)
def audit_login(sender, request, user, **kwargs):
    record_event(request, "LOGIN_SUCCESS", f"User {user.username} logged in.", actor=user)


@receiver(user_logged_out)
def audit_logout(sender, request, user, **kwargs):
    record_event(request, "LOGOUT", f"User {getattr(user, 'username', 'unknown')} logged out.", actor=user)


@receiver(user_login_failed)
def audit_login_failed(sender, credentials, request, **kwargs):
    username = credentials.get("username", "")
    record_event(request, "LOGIN_FAILED", f"Failed login attempt for {username}.", actor=None)
