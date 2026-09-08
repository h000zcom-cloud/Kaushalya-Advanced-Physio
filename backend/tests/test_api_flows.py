import asyncio
import os
import uuid
from datetime import date, timedelta

import httpx
import pytest

BASE = os.environ.get("TEST_BASE_URL", "http://localhost:8001/api")
EMAIL = os.environ["ADMIN_EMAIL"]
PASSWORD = os.environ["ADMIN_PASSWORD"]


def next_open_day(days_ahead: int = 3) -> str:
    day = date.today() + timedelta(days=days_ahead)
    while day.weekday() == 6:
        day += timedelta(days=1)
    return day.isoformat()


@pytest.fixture(scope="module")
def admin():
    client = httpx.Client(base_url=BASE, timeout=20)
    res = client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert res.status_code == 200, res.text
    client.headers["Authorization"] = f"Bearer {res.json()['access_token']}"
    yield client
    client.post("/auth/logout")
    client.close()


@pytest.fixture(scope="module")
def service_id(admin):
    return admin.get("/public/services").json()["items"][0]["id"]


def test_concurrent_bookings_never_exceed_capacity(admin, service_id):
    day, slot = next_open_day(), "17:00"
    override = admin.put("/admin/schedule/overrides", json={"date": day, "slot_start": slot, "capacity": 3, "note": "concurrency test"}).json()
    created = []
    try:
        async def fire():
            async with httpx.AsyncClient(base_url=BASE, timeout=30) as ac:
                async def one(i):
                    return await ac.post("/public/appointments", headers={"X-Forwarded-For": f"10.9.{i}.{i}"}, json={"name": f"Race Tester {'ABCDEFGHIJKL'[i]}", "phone": f"98{uuid.uuid4().int % 10**8:08d}", "service_id": service_id, "date": day, "slot_start": slot, "consent": True})
                return await asyncio.gather(*[one(i) for i in range(12)])

        responses = asyncio.run(fire())
        codes = [r.status_code for r in responses]
        created = [r.json()["public_id"] for r in responses if r.status_code == 201]
        assert codes.count(201) == 3, codes
        assert all(c in (201, 409) for c in codes), codes
        availability = admin.get("/public/availability", params={"date": day, "service_id": service_id}).json()
        target = next(s for s in availability["slots"] if s["slot_start"] == slot)
        assert target["status"] == "FULL"
    finally:
        for public_id in created:
            admin.post(f"/admin/appointments/{public_id}/cancel", json={"reason": "test cleanup"})
        admin.delete(f"/admin/schedule/overrides/{override['id']}")


def test_duplicate_booking_same_phone_same_day_rejected(admin, service_id):
    day, phone = next_open_day(4), f"97{uuid.uuid4().int % 10**8:08d}"
    payload = {"name": "Dup Tester", "phone": phone, "service_id": service_id, "date": day, "slot_start": "09:00", "consent": True}
    first = admin.post("/public/appointments", json=payload)
    assert first.status_code == 201, first.text
    second = admin.post("/public/appointments", json={**payload, "slot_start": "10:00"})
    assert second.status_code == 409 and second.json()["code"] == "duplicate_booking"
    admin.post(f"/admin/appointments/{first.json()['public_id']}/cancel", json={"reason": "test cleanup"})


def test_admin_requires_auth_and_permissions():
    anon = httpx.get(f"{BASE}/admin/dashboard/overview")
    assert anon.status_code == 401
    bad = httpx.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": "wrong-password"})
    assert bad.status_code == 401


def test_status_workflow_and_release(admin, service_id):
    day = next_open_day(5)
    res = admin.post("/admin/appointments", json={"name": "Flow Tester", "phone": f"96{uuid.uuid4().int % 10**8:08d}", "service_id": service_id, "date": day, "slot_start": "11:00", "consent": True})
    assert res.status_code == 201, res.text
    appt = res.json()
    assert appt["status"] in ("CONFIRMED", "ASSIGNED", "NEW")
    before = admin.get("/admin/schedule/day", params={"date": day}).json()
    booked_before = next(s for s in before["slots"] if s["slot_start"] == "11:00")["booked"]
    cancelled = admin.post(f"/admin/appointments/{appt['id']}/cancel", json={"reason": "test"}).json()
    assert cancelled["status"] == "CANCELLED"
    after = admin.get("/admin/schedule/day", params={"date": day}).json()
    assert next(s for s in after["slots"] if s["slot_start"] == "11:00")["booked"] == booked_before - 1
    again = admin.post(f"/admin/appointments/{appt['id']}/confirm")
    assert again.status_code == 409
