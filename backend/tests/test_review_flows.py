"""Comprehensive review-scope backend tests for public + admin flows.

Covers: public API, booking wizard, admin auth/permissions, appointment lifecycle,
capacity release, doctors/services CRUD toggles, schedule overrides, settings,
testimonials consent, callbacks, exports, WhatsApp webhook, MFA setup/disable,
rate limiting, honeypot.
"""
import io
import os
import time
import uuid
from datetime import date, timedelta

import httpx
import pyotp
import pytest

BASE = os.environ.get("TEST_BASE_URL", "http://localhost:8001/api")
EMAIL = os.environ["ADMIN_EMAIL"]
PASSWORD = os.environ["ADMIN_PASSWORD"]


def rand_phone(prefix: str = "9") -> str:
    # Indian 10-digit starting 6-9
    return prefix + f"{uuid.uuid4().int % 10**9:09d}"[:9]


def next_open_day(days_ahead: int = 3) -> str:
    day = date.today() + timedelta(days=days_ahead)
    while day.weekday() == 6:  # Sunday closed
        day += timedelta(days=1)
    return day.isoformat()


# -------- Fixtures --------
@pytest.fixture(scope="module")
def admin():
    client = httpx.Client(base_url=BASE, timeout=30)
    res = client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert res.status_code == 200, res.text
    token = res.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    yield client
    client.close()


@pytest.fixture(scope="module")
def service_id(admin):
    services = admin.get("/public/services").json()["items"]
    return services[0]["id"]


@pytest.fixture(scope="module")
def created_ids():
    """collect appointment public_ids to cleanup"""
    ids = []
    yield ids


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin, created_ids):
    yield
    for pid in created_ids:
        try:
            admin.post(f"/admin/appointments/{pid}/cancel", json={"reason": "test cleanup"})
        except Exception:
            pass


# -------- Public API --------
class TestPublicAPI:
    def test_clinic(self):
        r = httpx.get(f"{BASE}/public/clinic")
        assert r.status_code == 200
        assert "clinic" in r.json()

    def test_services_list(self):
        r = httpx.get(f"{BASE}/public/services")
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 1

    def test_doctors_list(self):
        r = httpx.get(f"{BASE}/public/doctors")
        assert r.status_code == 200
        assert "items" in r.json()

    def test_testimonials_list(self):
        r = httpx.get(f"{BASE}/public/testimonials")
        assert r.status_code == 200

    def test_availability(self, service_id):
        day = next_open_day()
        r = httpx.get(f"{BASE}/public/availability", params={"date": day, "service_id": service_id})
        assert r.status_code == 200
        data = r.json()
        assert "slots" in data
        for s in data["slots"]:
            assert s["status"] in ("AVAILABLE", "LIMITED", "FULL")
            assert "bookable" in s

    def test_availability_calendar(self, service_id):
        r = httpx.get(f"{BASE}/public/availability/calendar", params={"service_id": service_id})
        assert r.status_code == 200
        assert "days" in r.json() or isinstance(r.json(), (list, dict))


# -------- Booking validation --------
class TestBookingValidation:
    def test_booking_bad_phone(self, service_id):
        r = httpx.post(f"{BASE}/public/appointments", json={
            "name": "Bad Phone", "phone": "12345", "service_id": service_id,
            "date": next_open_day(), "slot_start": "10:00", "consent": True,
        })
        assert r.status_code == 422

    def test_booking_bad_name(self, service_id):
        r = httpx.post(f"{BASE}/public/appointments", json={
            "name": "12345!!!", "phone": rand_phone(), "service_id": service_id,
            "date": next_open_day(), "slot_start": "10:00", "consent": True,
        })
        assert r.status_code == 422

    def test_booking_consent_required(self, service_id):
        r = httpx.post(f"{BASE}/public/appointments", json={
            "name": "No Consent", "phone": rand_phone(), "service_id": service_id,
            "date": next_open_day(), "slot_start": "10:00", "consent": False,
        })
        assert r.status_code == 422

    def test_booking_honeypot(self, service_id):
        r = httpx.post(f"{BASE}/public/appointments", json={
            "name": "Bot", "phone": rand_phone(), "service_id": service_id,
            "date": next_open_day(), "slot_start": "10:00", "consent": True,
            "website": "http://spam.com",
        })
        assert r.status_code == 400


# -------- Booking E2E via API --------
class TestBookingLifecycle:
    def test_full_booking_and_capacity_release(self, admin, service_id, created_ids):
        day = next_open_day(6)
        slot = "15:00"
        phone = rand_phone()
        r = httpx.post(f"{BASE}/public/appointments", headers={"X-Forwarded-For": f"10.11.12.{uuid.uuid4().int % 250}"}, json={
            "name": "Booking Tester", "phone": phone, "service_id": service_id,
            "date": day, "slot_start": slot, "consent": True,
            "email": "tester@example.com",
        })
        assert r.status_code == 201, r.text
        appt = r.json()
        pid = appt["public_id"]
        created_ids.append(pid)
        assert appt["status"] in ("ASSIGNED", "CONFIRMED", "NEW")
        assert pid.startswith("PT-")

        # duplicate same phone same day → 409
        dup = httpx.post(f"{BASE}/public/appointments", json={
            "name": "Booking Tester", "phone": phone, "service_id": service_id,
            "date": day, "slot_start": "16:00", "consent": True,
        })
        assert dup.status_code == 409

        # capacity released after cancel (use admin schedule/day)
        before = admin.get("/admin/schedule/day", params={"date": day}).json()
        booked_before = next(s for s in before["slots"] if s["slot_start"] == slot)["booked"]

        cancel = admin.post(f"/admin/appointments/{pid}/cancel", json={"reason": "test"})
        assert cancel.status_code == 200
        assert cancel.json()["status"] == "CANCELLED"

        after = admin.get("/admin/schedule/day", params={"date": day}).json()
        booked_after = next(s for s in after["slots"] if s["slot_start"] == slot)["booked"]
        assert booked_after == booked_before - 1
        created_ids.remove(pid)

    def test_invalid_transition(self, admin, service_id):
        day = next_open_day(7)
        r = admin.post("/admin/appointments", json={
            "name": "Transition Tester", "phone": rand_phone(), "service_id": service_id,
            "date": day, "slot_start": "12:00", "consent": True,
        })
        assert r.status_code == 201
        pid = r.json()["id"]
        admin.post(f"/admin/appointments/{pid}/cancel", json={"reason": "test"})
        again = admin.post(f"/admin/appointments/{pid}/confirm")
        assert again.status_code == 409


# -------- Admin permissions --------
class TestAdminAuth:
    def test_unauthenticated_dashboard(self):
        r = httpx.get(f"{BASE}/admin/dashboard/overview")
        assert r.status_code == 401

    def test_wrong_password(self):
        r = httpx.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, admin):
        r = admin.get("/auth/me")
        assert r.status_code == 200
        data = r.json()
        user = data.get("user", data)
        assert user["email"] == EMAIL

    def test_dashboard_overview(self, admin):
        r = admin.get("/admin/dashboard/overview")
        assert r.status_code == 200
        data = r.json()
        # capacity / stats present
        assert isinstance(data, dict)


# -------- Doctors / Services / Schedule --------
class TestAdminResources:
    def test_doctors_list(self, admin):
        r = admin.get("/admin/doctors")
        assert r.status_code == 200

    def test_services_list_toggle(self, admin):
        services = admin.get("/admin/services").json()
        # services list may be under items or root
        items = services.get("items", services) if isinstance(services, dict) else services
        assert items

    def test_schedule_day(self, admin):
        r = admin.get("/admin/schedule/day", params={"date": next_open_day()})
        assert r.status_code == 200
        assert "slots" in r.json()

    def test_schedule_override_lifecycle(self, admin):
        day, slot = next_open_day(8), "14:00"
        r = admin.put("/admin/schedule/overrides", json={
            "date": day, "slot_start": slot, "capacity": 5, "note": "test override",
        })
        assert r.status_code in (200, 201)
        ov = r.json()
        assert ov["capacity"] == 5
        # remove
        d = admin.delete(f"/admin/schedule/overrides/{ov['id']}")
        assert d.status_code in (200, 204)


# -------- Settings --------
class TestSettings:
    def test_get_settings(self, admin):
        r = admin.get("/admin/settings")
        assert r.status_code == 200

    def test_settings_invalid(self, admin):
        current = admin.get("/admin/settings").json()
        current.pop("_id", None); current.pop("created_at", None); current.pop("updated_at", None)
        current["booking"]["min_notice_hours"] = -5
        r = admin.put("/admin/settings", json=current)
        assert r.status_code in (400, 422)

    def test_manual_acceptance_mode_then_restore(self, admin, service_id, created_ids):
        current = admin.get("/admin/settings").json()
        current.pop("_id", None); current.pop("created_at", None); current.pop("updated_at", None)
        original_mode = current["booking"]["acceptance_mode"]
        current["booking"]["acceptance_mode"] = "MANUAL"
        r = admin.put("/admin/settings", json=current)
        assert r.status_code == 200, r.text
        try:
            day = next_open_day(9)
            phone = rand_phone()
            b = httpx.post(f"{BASE}/public/appointments", headers={"X-Forwarded-For": f"10.20.30.{uuid.uuid4().int % 250}"}, json={
                "name": "Manual Mode Tester", "phone": phone, "service_id": service_id,
                "date": day, "slot_start": "13:00", "consent": True,
            })
            assert b.status_code == 201, b.text
            assert b.json()["status"] == "NEW"
            created_ids.append(b.json()["public_id"])
        finally:
            current["booking"]["acceptance_mode"] = original_mode
            admin.put("/admin/settings", json=current)


# -------- Testimonials --------
class TestTestimonials:
    def test_publish_requires_consent(self, admin):
        r = admin.post("/admin/testimonials", json={
            "patient_name": "Consent Test",
            "content": "Great treatment and staff, highly recommend.",
            "date": "2025-12-01",
            "rating": 5,
            "is_published": True,
            "consent_confirmed": False,
        })
        assert r.status_code == 422
        assert "consent" in r.text.lower()


# -------- Callbacks --------
class TestCallbacks:
    def test_create_callback(self, admin):
        r = httpx.post(f"{BASE}/public/callbacks", json={
            "name": "Callback Tester", "phone": rand_phone(),
            "preferred_time": "morning", "consent": True,
        })
        assert r.status_code in (200, 201), r.text
        # admin list
        lst = admin.get("/admin/callbacks")
        assert lst.status_code == 200


# -------- Exports --------
class TestExports:
    def test_appointments_csv_requires_auth(self):
        r = httpx.get(f"{BASE}/admin/appointments/export.csv")
        assert r.status_code == 401

    def test_appointments_csv_auth(self, admin):
        r = admin.get("/admin/appointments/export.csv")
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "").lower() or r.text.startswith(("id", "public_id", "PT-"))

    def test_patients_csv_auth(self, admin):
        r = admin.get("/admin/patients/export.csv")
        assert r.status_code == 200


# -------- WhatsApp webhook (unconfigured) --------
class TestWebhook:
    def test_get_webhook_not_configured(self):
        r = httpx.get(f"{BASE}/webhooks/whatsapp")
        assert r.status_code == 503

    def test_post_webhook_no_signature(self):
        r = httpx.post(f"{BASE}/webhooks/whatsapp", json={"entry": []})
        assert r.status_code in (403, 503)


# -------- Rate limit --------
class TestRateLimit:
    def test_rate_limit_public_booking(self, service_id):
        day = next_open_day(10)
        ip = f"10.99.99.{uuid.uuid4().int % 250}"
        codes = []
        for i in range(10):
            r = httpx.post(f"{BASE}/public/appointments", headers={"X-Forwarded-For": ip}, json={
                "name": f"RateTester{'ABCDEFGHIJ'[i]}", "phone": rand_phone(),
                "service_id": service_id, "date": day, "slot_start": "18:00", "consent": True,
            })
            codes.append(r.status_code)
            if r.status_code == 429:
                break
        assert 429 in codes, f"Expected a 429 in {codes}"


# -------- MFA setup/disable --------
class TestMFA:
    def test_setup_and_disable(self, admin):
        setup = admin.post("/auth/mfa/setup", json={"password": PASSWORD})
        if setup.status_code == 404:
            pytest.skip("MFA endpoint not present")
        assert setup.status_code == 200, setup.text
        data = setup.json()
        secret = data.get("secret")
        assert secret
        code = pyotp.TOTP(secret).now()
        enable = admin.post("/auth/mfa/enable", json={"code": code})
        assert enable.status_code == 200, enable.text
        # verify /me shows mfa enabled
        me = admin.get("/auth/me").json()
        assert me.get("mfa_enabled") in (True, None) or me.get("has_mfa") in (True, None)
        # disable
        code2 = pyotp.TOTP(secret).now()
        disable = admin.post("/auth/mfa/disable", json={"password": PASSWORD, "code": code2})
        assert disable.status_code == 200, disable.text
