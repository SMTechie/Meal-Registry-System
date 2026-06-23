from .models import OrganizationSettings


def branding(request):
    return {"branding": OrganizationSettings.singleton()}
