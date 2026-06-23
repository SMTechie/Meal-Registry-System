from datetime import time

from django.test import TestCase
from django.urls import reverse

from .models import AuditEvent, MealCategory, MealScan, Role, User


class ScanFlowTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username="staff", password="Password123!", role=Role.STAFF)
        self.guest = User.objects.create_user(username="guest", password="Password123!", role=Role.USER)
        self.category = MealCategory.objects.create(
            name="Anytime",
            starts_at=time(0, 0),
            ends_at=time(23, 59),
            daily_limit_per_user=1,
        )

    def test_staff_scan_accepts_once_then_denies_limit(self):
        self.client.login(username="staff", password="Password123!")
        first = self.client.post(reverse("claim_scan"), {"code": str(self.guest.qr_access_code)})
        second = self.client.post(reverse("claim_scan"), {"code": str(self.guest.qr_access_code)})

        self.assertEqual(first.json()["status"], MealScan.Status.ACCEPTED)
        self.assertEqual(second.json()["status"], MealScan.Status.DENIED)
        self.assertEqual(MealScan.objects.filter(user=self.guest, scanned_by=self.staff).count(), 2)
        self.assertEqual(AuditEvent.objects.filter(event_type="QR_SCAN").count(), 2)

    def test_anonymous_scan_is_redirected_to_login(self):
        response = self.client.get(reverse("scan"))
        self.assertRedirects(response, f"{reverse('login')}?next={reverse('scan')}")

    def test_staff_qr_code_is_not_valid_meal_ticket(self):
        other_staff = User.objects.create_user(username="otherstaff", password="Password123!", role=Role.STAFF)
        self.client.login(username="staff", password="Password123!")

        response = self.client.post(reverse("claim_scan"), {"code": str(other_staff.qr_access_code)})

        self.assertEqual(response.json()["status"], MealScan.Status.DENIED)
        self.assertIn("not meal tickets", response.json()["reason"])


class AdminPortalTests(TestCase):
    def test_staff_cannot_open_admin_home(self):
        staff = User.objects.create_user(username="staff", password="Password123!", role=Role.STAFF)
        self.client.login(username=staff.username, password="Password123!")
        response = self.client.get(reverse("admin_home"))
        self.assertEqual(response.status_code, 403)

    def test_admin_can_open_category_list(self):
        admin = User.objects.create_user(username="admin", password="Password123!", role=Role.ADMIN)
        self.client.login(username=admin.username, password="Password123!")
        response = self.client.get(reverse("category_list"))
        self.assertEqual(response.status_code, 200)

    def test_admin_can_view_qr_and_edit_user(self):
        admin = User.objects.create_user(username="admin", password="Password123!", role=Role.ADMIN)
        target = User.objects.create_user(
            username="mealuser",
            password="Password123!",
            email="meal@example.com",
            role=Role.USER,
        )
        self.client.login(username=admin.username, password="Password123!")

        detail = self.client.get(reverse("user_detail", args=[target.id]))
        qr = self.client.get(reverse("user_qr_image", args=[target.id]))
        edit = self.client.post(
            reverse("user_edit", args=[target.id]),
            {
                "username": "mealuser",
                "first_name": "Meal",
                "last_name": "User",
                "email": "updated@example.com",
                "role": Role.USER,
                "is_active": "on",
            },
        )

        self.assertContains(detail, str(target.qr_access_code))
        self.assertEqual(qr["Content-Type"], "image/png")
        self.assertRedirects(edit, reverse("user_detail", args=[target.id]))
        target.refresh_from_db()
        self.assertEqual(target.email, "updated@example.com")
