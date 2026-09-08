import logging
from dataclasses import dataclass
from datetime import date, timedelta

from pymongo import ReturnDocument

from app.core.config import cfg
from app.core.database import db, q
from app.core.errors import AppError
from app.core.models import utc_now
from app.core.timeutil import fmt_hm, local_datetime, now_local, parse_hm

logger = logging.getLogger("app.scheduling")

ACTIVE_STATUSES = ("NEW", "CONTACTED", "CONFIRMED", "ASSIGNED", "RESCHEDULED")


@dataclass
class Reservation:
    doctor_id: str | None
    needs_manual_assignment: bool


def slot_key(day: str, slot_start: str) -> str:
    return f"{cfg.organization_id}|{day}|{slot_start}"


def day_hours(settings: dict, day: date) -> dict | None:
    if day.isoformat() in {h["date"] for h in settings.get("holidays", [])}:
        return None
    hours = next((w for w in settings["working_hours"] if w["weekday"] == day.weekday()), None)
    return hours if hours and hours.get("is_open") else None


def day_slots(settings: dict, day: date) -> list[tuple[str, str]]:
    hours = day_hours(settings, day)
    if not hours:
        return []
    step = settings["booking"]["slot_minutes"]
    start, end = parse_hm(hours["open"]), parse_hm(hours["close"])
    return [(fmt_hm(s), fmt_hm(min(s + step, end))) for s in range(start, end, step) if s + step <= end]


def doctor_available(doctor: dict, day: date, slot_start: str, slot_end: str) -> bool:
    if not doctor.get("is_active", True):
        return False
    iso = day.isoformat()
    if any(o["start_date"] <= iso <= o["end_date"] for o in doctor.get("time_off", [])):
        return False
    hours = doctor.get("working_hours") or []
    if not hours:
        return True
    s, e = parse_hm(slot_start), parse_hm(slot_end)
    return any(h["weekday"] == day.weekday() and parse_hm(h["start"]) <= s and parse_hm(h["end"]) >= e for h in hours)


def doctor_capacity(doctor: dict, settings: dict) -> int:
    return int(doctor.get("capacity_per_slot") or settings["booking"]["default_doctor_capacity"])


def eligible_doctors(doctors: list[dict], service_id: str | None, day: date, slot_start: str, slot_end: str) -> list[dict]:
    return [d for d in doctors if doctor_available(d, day, slot_start, slot_end) and (not service_id or service_id in (d.get("service_ids") or []))]


def capacity_status(capacity: int, remaining: int, threshold: float) -> str:
    if capacity <= 0 or remaining <= 0:
        return "FULL"
    return "LIMITED" if remaining / capacity <= threshold else "AVAILABLE"


def slot_summary(settings: dict, doctors: list[dict], overrides: dict, reservation: dict | None, service_id: str | None, day: date, slot_start: str, slot_end: str) -> dict:
    eligible = eligible_doctors(doctors, service_id, day, slot_start, slot_end)
    override = overrides.get(slot_start)
    doctor_total = sum(doctor_capacity(d, settings) for d in eligible)
    capacity = int(override["capacity"]) if override else doctor_total
    res = reservation or {}
    per = res.get("per_doctor", {})
    booked = res.get("total", 0) if service_id is None else res.get("unassigned", 0) + sum(per.get(d["_id"], 0) for d in eligible)
    remaining = max(capacity - booked, 0)
    return {
        "slot_start": slot_start,
        "slot_end": slot_end,
        "capacity": capacity,
        "booked": booked,
        "remaining": remaining,
        "status": capacity_status(capacity, remaining, settings["booking"]["limited_threshold"]),
        "eligible_doctor_ids": [d["_id"] for d in eligible],
        "unassigned": res.get("unassigned", 0),
        "per_doctor": per,
        "has_override": bool(override),
    }


async def load_context(days: list[date]) -> dict:
    isos = [d.isoformat() for d in days]
    doctors = await db.doctors.find(q(is_active=True)).to_list(2000)
    overrides = await db.capacity_overrides.find(q(date={"$in": isos})).to_list(5000)
    reservations = await db.slot_reservations.find(q(date={"$in": isos})).to_list(20000)
    return {
        "doctors": doctors,
        "overrides": {(o["date"], o["slot_start"]): o for o in overrides},
        "reservations": {(r["date"], r["slot_start"]): r for r in reservations},
    }


def summarize_day(settings: dict, ctx: dict, day: date, service_id: str | None) -> list[dict]:
    iso = day.isoformat()
    overrides = {s: o for (d, s), o in ctx["overrides"].items() if d == iso}
    return [slot_summary(settings, ctx["doctors"], overrides, ctx["reservations"].get((iso, s)), service_id, day, s, e) for s, e in day_slots(settings, day)]


def is_bookable_time(settings: dict, day: date, slot_start: str) -> bool:
    return local_datetime(settings, day, slot_start) >= now_local(settings) + timedelta(hours=settings["booking"]["min_notice_hours"])


async def availability_for_day(settings: dict, day: date, service_id: str | None, patient_view: bool = True) -> list[dict]:
    ctx = await load_context([day])
    slots = summarize_day(settings, ctx, day, service_id)
    if patient_view:
        slots = [{k: s[k] for k in ("slot_start", "slot_end", "status")} | {"bookable": is_bookable_time(settings, day, s["slot_start"]) and s["status"] != "FULL"} for s in slots]
    return slots


async def availability_calendar(settings: dict, start: date, end: date, service_id: str | None) -> list[dict]:
    days = [start + timedelta(days=i) for i in range((end - start).days + 1)]
    ctx = await load_context(days)
    horizon_end = now_local(settings).date() + timedelta(days=settings["booking"]["max_horizon_days"])
    out = []
    for day in days:
        slots = [s for s in summarize_day(settings, ctx, day, service_id) if is_bookable_time(settings, day, s["slot_start"])]
        if not slots or day > horizon_end:
            out.append({"date": day.isoformat(), "status": "CLOSED", "remaining": 0})
            continue
        capacity = sum(s["capacity"] for s in slots)
        remaining = sum(s["remaining"] for s in slots)
        out.append({"date": day.isoformat(), "status": capacity_status(capacity, remaining, settings["booking"]["limited_threshold"]), "remaining": remaining})
    return out


def validate_window(settings: dict, day: date, slot_start: str, enforce_notice: bool = True) -> tuple[str, str]:
    slot = next((s for s in day_slots(settings, day) if s[0] == slot_start), None)
    if not slot:
        raise AppError(400, "slot_unavailable", "That time is not open for appointments. Please choose another time.")
    now = now_local(settings)
    starts = local_datetime(settings, day, slot_start)
    if starts < now:
        raise AppError(400, "slot_in_past", "That time has already passed. Please choose a later time.")
    if enforce_notice:
        if starts < now + timedelta(hours=settings["booking"]["min_notice_hours"]):
            raise AppError(400, "too_soon", "Please choose a time a little later so our team can prepare for your visit.")
        if day > now.date() + timedelta(days=settings["booking"]["max_horizon_days"]):
            raise AppError(400, "too_far", "Appointments can only be booked within the next %d days." % settings["booking"]["max_horizon_days"])
    return slot


def _ifnull(field: str):
    return {"$ifNull": [f"${field}", 0]}


async def _ensure_slot_doc(day: str, slot_start: str) -> str:
    key = slot_key(day, slot_start)
    await db.slot_reservations.update_one({"_id": key}, {"$setOnInsert": q(date=day, slot_start=slot_start, total=0, unassigned=0, per_doctor={}, created_at=utc_now())}, upsert=True)
    return key


async def reserve(settings: dict, day: date, slot: tuple[str, str], service_id: str | None, assignment_mode: str, prefer_doctor_id: str | None = None) -> Reservation:
    slot_start, slot_end = slot
    iso = day.isoformat()
    ctx = await load_context([day])
    overrides = {s: o for (d, s), o in ctx["overrides"].items() if d == iso}
    summary = slot_summary(settings, ctx["doctors"], overrides, ctx["reservations"].get((iso, slot_start)), service_id, day, slot_start, slot_end)
    if summary["capacity"] <= 0 or summary["remaining"] <= 0:
        raise AppError(409, "slot_full", "This time slot has just filled up. Please choose another time.")
    key = await _ensure_slot_doc(iso, slot_start)
    eligible = [d for d in ctx["doctors"] if d["_id"] in summary["eligible_doctor_ids"]]
    booked_expr = {"$add": [_ifnull("unassigned")] + [_ifnull(f"per_doctor.{d['_id']}") for d in eligible]}
    service_guard = {"$lt": [booked_expr, summary["capacity"]]}
    load = summary["per_doctor"]
    candidates = sorted(eligible, key=lambda d: (load.get(d["_id"], 0), d.get("display_order", 0))) if assignment_mode in ("AUTO", "HYBRID") else []
    if prefer_doctor_id:
        preferred = next((d for d in ctx["doctors"] if d["_id"] == prefer_doctor_id and doctor_available(d, day, slot_start, slot_end)), None)
        if preferred:
            candidates = [preferred] + [d for d in candidates if d["_id"] != prefer_doctor_id]
    for doctor in candidates:
        guard = {"$and": [service_guard, {"$lt": [_ifnull(f"per_doctor.{doctor['_id']}"), doctor_capacity(doctor, settings)]}]}
        res = await db.slot_reservations.find_one_and_update({"_id": key, "$expr": guard}, {"$inc": {"total": 1, f"per_doctor.{doctor['_id']}": 1}, "$set": {"updated_at": utc_now()}}, return_document=ReturnDocument.AFTER)
        if res:
            return Reservation(doctor_id=doctor["_id"], needs_manual_assignment=False)
    res = await db.slot_reservations.find_one_and_update({"_id": key, "$expr": service_guard}, {"$inc": {"total": 1, "unassigned": 1}, "$set": {"updated_at": utc_now()}}, return_document=ReturnDocument.AFTER)
    if res:
        return Reservation(doctor_id=None, needs_manual_assignment=True)
    raise AppError(409, "slot_full", "This time slot has just filled up. Please choose another time.")


async def release(day: str, slot_start: str, doctor_id: str | None) -> None:
    key = slot_key(day, slot_start)
    field = f"per_doctor.{doctor_id}" if doctor_id else "unassigned"
    res = await db.slot_reservations.find_one_and_update({"_id": key, "$expr": {"$gt": [_ifnull(field), 0]}}, {"$inc": {"total": -1, field: -1}, "$set": {"updated_at": utc_now()}})
    if res is None:
        logger.warning("release skipped: no reservation for %s (%s)", key, field)


async def move(day: str, slot_start: str, from_doctor_id: str | None, to_doctor_id: str | None, to_capacity: int, force: bool = False) -> None:
    if from_doctor_id == to_doctor_id:
        return
    key = await _ensure_slot_doc(day, slot_start)
    inc = {(f"per_doctor.{from_doctor_id}" if from_doctor_id else "unassigned"): -1, (f"per_doctor.{to_doctor_id}" if to_doctor_id else "unassigned"): 1}
    filt: dict = {"_id": key}
    if to_doctor_id and not force:
        filt["$expr"] = {"$lt": [_ifnull(f"per_doctor.{to_doctor_id}"), to_capacity]}
    res = await db.slot_reservations.find_one_and_update(filt, {"$inc": inc, "$set": {"updated_at": utc_now()}})
    if res is None:
        raise AppError(409, "doctor_full", "This doctor has no remaining capacity in that time slot. Use override to assign anyway.")
