from datetime import date

import pytest

from app.core.errors import AppError
from app.core.phone import normalize_phone
from app.domain.appointments.state_machine import can_transition, confirmed_status, ensure_transition
from app.domain.scheduling import engine
from app.domain.settings.defaults import default_settings

SETTINGS = default_settings("org_test")
MON = date(2026, 9, 7)
SUN = date(2026, 9, 13)


def doctor(id_, cap=1, services=("svc-a",), hours=None, off=None, active=True):
    return {"_id": id_, "is_active": active, "capacity_per_slot": cap, "service_ids": list(services), "working_hours": hours or [], "time_off": off or []}


def test_day_slots_follow_clinic_hours_and_holidays():
    assert engine.day_slots(SETTINGS, MON)[0] == ("09:00", "10:00")
    assert len(engine.day_slots(SETTINGS, MON)) == 10
    assert engine.day_slots(SETTINGS, SUN) == []
    holiday_settings = {**SETTINGS, "holidays": [{"date": MON.isoformat(), "label": "Test"}]}
    assert engine.day_slots(holiday_settings, MON) == []


def test_doctor_availability_respects_hours_and_leave():
    part_time = doctor("d1", hours=[{"weekday": 0, "start": "09:00", "end": "13:00"}])
    assert engine.doctor_available(part_time, MON, "09:00", "10:00")
    assert not engine.doctor_available(part_time, MON, "14:00", "15:00")
    on_leave = doctor("d2", off=[{"start_date": "2026-09-01", "end_date": "2026-09-10"}])
    assert not engine.doctor_available(on_leave, MON, "09:00", "10:00")
    assert not engine.doctor_available(doctor("d3", active=False), MON, "09:00", "10:00")


def test_capacity_is_sum_of_eligible_doctors():
    doctors = [doctor("d1"), doctor("d2", cap=2), doctor("d3", services=("svc-b",))]
    summary = engine.slot_summary(SETTINGS, doctors, {}, None, "svc-a", MON, "09:00", "10:00")
    assert summary["capacity"] == 3
    assert summary["status"] == "AVAILABLE"
    total = engine.slot_summary(SETTINGS, doctors, {}, None, None, MON, "09:00", "10:00")
    assert total["capacity"] == 4


def test_booked_counts_and_status_thresholds():
    doctors = [doctor("d1"), doctor("d2"), doctor("d3"), doctor("d4")]
    reservation = {"total": 3, "unassigned": 1, "per_doctor": {"d1": 1, "d2": 1}}
    summary = engine.slot_summary(SETTINGS, doctors, {}, reservation, "svc-a", MON, "09:00", "10:00")
    assert summary["booked"] == 3 and summary["remaining"] == 1
    assert summary["status"] == "LIMITED"
    full = engine.slot_summary(SETTINGS, doctors, {}, {"total": 4, "unassigned": 0, "per_doctor": {"d1": 1, "d2": 1, "d3": 1, "d4": 1}}, "svc-a", MON, "09:00", "10:00")
    assert full["status"] == "FULL" and full["remaining"] == 0


def test_override_replaces_doctor_capacity():
    summary = engine.slot_summary(SETTINGS, [doctor("d1")], {"09:00": {"capacity": 5}}, None, "svc-a", MON, "09:00", "10:00")
    assert summary["capacity"] == 5 and summary["has_override"]


def test_validate_window_rejects_closed_slots():
    with pytest.raises(AppError) as exc:
        engine.validate_window(SETTINGS, SUN, "09:00")
    assert exc.value.code == "slot_unavailable"
    with pytest.raises(AppError):
        engine.validate_window(SETTINGS, MON, "08:00")


def test_state_machine_rules():
    assert can_transition("NEW", "CONFIRMED")
    assert can_transition("CONFIRMED", "RESCHEDULED")
    assert not can_transition("COMPLETED", "CANCELLED")
    assert not can_transition("CANCELLED", "CONFIRMED")
    assert confirmed_status(True) == "ASSIGNED" and confirmed_status(False) == "CONFIRMED"
    with pytest.raises(AppError):
        ensure_transition("NO_SHOW", "COMPLETED")


def test_phone_normalization():
    assert normalize_phone("86900 92409") == "+918690092409"
    assert normalize_phone("+91 86900-92409") == "+918690092409"
    assert normalize_phone("08690092409") == "+918690092409"
    for bad in ("12345", "5690092409", "abc"):
        with pytest.raises(AppError):
            normalize_phone(bad)
