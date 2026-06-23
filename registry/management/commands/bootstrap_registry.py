import os

from django.core.management.base import BaseCommand

from registry.models import MealCategory, Role, User


class Command(BaseCommand):
    help = "Create the initial super administrator and default meal categories."

    def handle(self, *args, **options):
        username = os.getenv("DJANGO_SUPERUSER_USERNAME", "admin")
        email = os.getenv("DJANGO_SUPERUSER_EMAIL", "admin@example.local")
        password = os.getenv("DJANGO_SUPERUSER_PASSWORD", "ChangeMe123!")

        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "role": Role.SUPER_ADMIN,
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Created super administrator {username}."))
        else:
            changed = False
            if user.role != Role.SUPER_ADMIN:
                user.role = Role.SUPER_ADMIN
                changed = True
            if not user.is_staff or not user.is_superuser:
                user.is_staff = True
                user.is_superuser = True
                changed = True
            if changed:
                user.save()
            self.stdout.write(f"Super administrator {username} already exists.")

        defaults = [
            ("Breakfast", "Morning Service", "07:00", "08:30", 1, "#047c78", 10),
            ("First Tea", "First Break", "10:00", "10:45", 1, "#2563eb", 20),
            ("Lunch", "Main Meal", "12:30", "14:00", 1, "#7c3aed", 30),
            ("Second Tea", "Afternoon Service", "15:00", "15:45", 1, "#ca8a04", 40),
        ]
        for name, description, starts_at, ends_at, limit, colour_tag, display_order in defaults:
            MealCategory.objects.get_or_create(
                name=name,
                defaults={
                    "description": description,
                    "starts_at": starts_at,
                    "ends_at": ends_at,
                    "daily_limit_per_user": limit,
                    "colour_tag": colour_tag,
                    "display_order": display_order,
                },
            )
        self.stdout.write(self.style.SUCCESS("Bootstrap complete."))
