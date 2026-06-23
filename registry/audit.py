from .models import AuditEvent


def client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def record_event(request, event_type, detail="", actor=None):
    user = actor if actor is not None else getattr(request, "user", None)
    if not getattr(user, "is_authenticated", False):
        user = None
    AuditEvent.objects.create(
        actor=user,
        event_type=event_type,
        detail=detail,
        ip_address=client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", ""),
    )
