from datetime import timezone

from pymongo import ReturnDocument

from app.core.config import cfg
from app.core.database import db, q
from app.core.errors import AppError
from app.core.models import new_id, utc_now
from app.core.phone import normalize_phone
from app.core.timeutil import local_datetime, parse_date
from app.domain import audit
from app.domain.appointments.schemas import BookingCreate, RescheduleInput
from app.domain.appointments.state_machine import CONFIRMED_LIKE, TERMINAL, confirmed_status, ensure_transition
from app.domain.automation import engine as automation
from app.domain.patients import service as patients
from app.domain.scheduling import engine
from app.domain.scheduling.engine import ACTIVE_STATUSES
from app.domain.settings.service import get_settings

HIDDEN = ("capacity_doctor_id",)


def serialize(appt: dict | None) -> dict | None:
    if not appt:
        return None
    out = {k: v for k, v in appt.items() if k not in HIDDEN and k != "_id"}
    out["id"] = appt["_id"]
    return out


async def next_public_id() -> str:
    year = utc_now().year
    doc = await db.counters.find_one_and_update({"_id": f"{cfg.organization_id}:appointment:{year}"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER)
    return f"PT-{year}-{doc['seq']:06d}"


def resolve_acceptance(settings: dict, service: dict) -> str:
    mode = settings["booking"]["acceptance_mode"]
    if mode != "PER_SERVICE":
        return mode
    service_mode = service.get("acceptance_mode", "INHERIT")
    return service_mode if service_mode in ("AUTO", "MANUAL") else "AUTO"


async def get_or_404(appointment_id: str) -> dict:
    appt = await db.appointments.find_one({"$or": [{"_id": appointment_id}, {"public_id": appointment_id.upper()}], "organization_id": cfg.organization_id})
    if not appt:
        raise AppError(404, "appointment_not_found", "We could not find that appointment.")
    return appt


async def record_history(appointment_id: str, from_status: str | None, to_status: str, actor: dict | None, reason: str | None = None) -> None:
    await db.appointment_status_history.insert_one(q(_id=new_id(), appointment_id=appointment_id, from_status=from_status, to_status=to_status, actor_name=(actor or {}).get("name") or "Patient (web)", actor_id=(actor or {}).get("id"), reason=reason, created_at=utc_now()))


async def create_booking(data: BookingCreate, *, source: str = "web", actor: dict | None = None, ip: str | None = None, notify: bool = True, doctor_id: str | None = None) -> dict:
    if getattr(data, "website", None):
        raise AppError(400, "spam_detected", "Submission could not be processed.")
    if not data.consent:
        raise AppError(422, "consent_required", "Please accept the privacy notice to continue.", {"field": "consent"})
    settings = await get_settings()
    service = await db.services.find_one(q(_id=data.service_id, is_active=True))
    if not service:
        raise AppError(404, "service_not_found", "Please choose a valid service.")
    day = parse_date(data.date)
    slot = engine.validate_window(settings, day, data.slot_start, enforce_notice=(source == "web"))
    phone = normalize_phone(data.phone, settings["clinic"]["country_code"])
    duplicate = await db.appointments.find_one(q(patient_phone=phone, date=data.date, status={"$in": list(ACTIVE_STATUSES)}))
    if duplicate:
        raise AppError(409, "duplicate_booking", f"An appointment ({duplicate['public_id']}) already exists for this mobile number on this date. Please call us if you need to change it.")
    patient = await patients.find_or_create(data.name, phone, data.email)
    reservation = await engine.reserve(settings, day, slot, service["_id"], settings["booking"]["assignment_mode"], prefer_doctor_id=doctor_id)
    doctor = await db.doctors.find_one({"_id": reservation.doctor_id}) if reservation.doctor_id else None
    now = utc_now()
    appt = q(
        _id=new_id(), public_id=None, patient_id=patient["_id"], patient_name=data.name, patient_phone=phone, patient_email=data.email,
        service_id=service["_id"], service_name=service["name"], service_slug=service["slug"], message=data.message,
        date=data.date, slot_start=slot[0], slot_end=slot[1], starts_at=local_datetime(settings, day, slot[0]).astimezone(timezone.utc),
        doctor_id=doctor["_id"] if doctor else None, doctor_name=doctor["name"] if doctor else None, capacity_doctor_id=reservation.doctor_id,
        needs_manual_assignment=reservation.needs_manual_assignment, acceptance_mode=resolve_acceptance(settings, service), status="NEW", source=source,
        created_by=(actor or {}).get("id"), notes=[], cancellation_reason=None, confirmed_at=None, completed_at=None, cancelled_at=None,
        rescheduled_from=None, reschedule_count=0, is_demo=source == "seed", created_at=now, updated_at=now,
    )
    try:
        appt["public_id"] = await next_public_id()
        await db.appointments.insert_one(appt)
    except Exception:
        await engine.release(data.date, slot[0], reservation.doctor_id)
        raise
    await record_history(appt["_id"], None, "NEW", actor, "Booking created")
    await patients.touch(patient["_id"], appt["starts_at"])
    await audit.log(actor, "appointment_created", "appointment", appt["_id"], {"public_id": appt["public_id"], "source": source}, ip)
    return await automation.handle("appointment_created", appt, settings, actor=actor, notify=notify)


async def transition(appt: dict, to_status: str, actor: dict | None, reason: str | None = None, extra: dict | None = None) -> dict:
    ensure_transition(appt["status"], to_status)
    now = utc_now()
    updates = {"status": to_status, "updated_at": now, **(extra or {})}
    if to_status in CONFIRMED_LIKE and not appt.get("confirmed_at"):
        updates["confirmed_at"] = now
    if to_status == "COMPLETED":
        updates["completed_at"] = now
    if to_status == "CANCELLED":
        updates["cancelled_at"] = now
        updates["cancellation_reason"] = reason
    result = await db.appointments.update_one({"_id": appt["_id"], "status": appt["status"]}, {"$set": updates})
    if result.matched_count == 0:
        raise AppError(409, "stale_appointment", "This appointment was just updated by someone else. Please refresh and try again.")
    await record_history(appt["_id"], appt["status"], to_status, actor, reason)
    return {**appt, **updates}


async def confirm(appt: dict, actor: dict, ip: str | None = None) -> dict:
    settings = await get_settings()
    updated = await transition(appt, confirmed_status(bool(appt.get("doctor_id"))), actor, "Confirmed by clinic")
    await audit.log(actor, "appointment_confirmed", "appointment", appt["_id"], {"public_id": appt["public_id"]}, ip)
    return await automation.handle("appointment_confirmed", updated, settings, actor=actor)


async def mark_contacted(appt: dict, actor: dict, ip: str | None = None) -> dict:
    updated = await transition(appt, "CONTACTED", actor, "Patient contacted")
    await audit.log(actor, "appointment_contacted", "appointment", appt["_id"], {"public_id": appt["public_id"]}, ip)
    return updated


async def complete(appt: dict, actor: dict, ip: str | None = None) -> dict:
    settings = await get_settings()
    updated = await transition(appt, "COMPLETED", actor, "Visit completed")
    await audit.log(actor, "appointment_completed", "appointment", appt["_id"], {"public_id": appt["public_id"]}, ip)
    return await automation.handle("appointment_completed", updated, settings, actor=actor)


async def no_show(appt: dict, actor: dict, ip: str | None = None) -> dict:
    updated = await transition(appt, "NO_SHOW", actor, "Patient did not arrive")
    await engine.release(appt["date"], appt["slot_start"], appt.get("capacity_doctor_id"))
    await audit.log(actor, "appointment_no_show", "appointment", appt["_id"], {"public_id": appt["public_id"]}, ip)
    return updated


async def cancel(appt: dict, actor: dict | None, reason: str | None, ip: str | None = None) -> dict:
    settings = await get_settings()
    updated = await transition(appt, "CANCELLED", actor, reason or "Cancelled by clinic")
    await engine.release(appt["date"], appt["slot_start"], appt.get("capacity_doctor_id"))
    await audit.log(actor, "appointment_cancelled", "appointment", appt["_id"], {"public_id": appt["public_id"], "reason": reason}, ip)
    return await automation.handle("appointment_cancelled", updated, settings, actor=actor)


async def assign_doctor(appt: dict, doctor_id: str | None, actor: dict, force: bool = False, ip: str | None = None) -> dict:
    if appt["status"] in TERMINAL:
        raise AppError(409, "appointment_closed", "This appointment is closed and cannot be reassigned.")
    settings = await get_settings()
    doctor = None
    if doctor_id:
        doctor = await db.doctors.find_one(q(_id=doctor_id, is_active=True))
        if not doctor:
            raise AppError(404, "doctor_not_found", "That doctor is not available.")
    await engine.move(appt["date"], appt["slot_start"], appt.get("capacity_doctor_id"), doctor_id, engine.doctor_capacity(doctor, settings) if doctor else 0, force)
    updates = {"doctor_id": doctor_id, "doctor_name": doctor["name"] if doctor else None, "capacity_doctor_id": doctor_id, "needs_manual_assignment": doctor is None, "updated_at": utc_now()}
    await db.appointments.update_one({"_id": appt["_id"]}, {"$set": updates})
    updated = {**appt, **updates}
    if appt["status"] == "CONFIRMED" and doctor:
        updated = await transition(updated, "ASSIGNED", actor, f"Assigned to {doctor['name']}")
    elif appt["status"] == "ASSIGNED" and not doctor:
        updated = await transition(updated, "CONFIRMED", actor, "Doctor unassigned")
    await audit.log(actor, "doctor_assigned" if doctor else "doctor_unassigned", "appointment", appt["_id"], {"public_id": appt["public_id"], "from_doctor_id": appt.get("doctor_id"), "to_doctor_id": doctor_id, "force": force}, ip)
    return await automation.handle("doctor_assignment_changed", updated, settings, actor=actor)


async def reschedule(appt: dict, data: RescheduleInput, actor: dict, ip: str | None = None) -> dict:
    ensure_transition(appt["status"], "RESCHEDULED")
    if (data.date, data.slot_start) == (appt["date"], appt["slot_start"]):
        raise AppError(400, "same_slot", "Please choose a different date or time.")
    settings = await get_settings()
    day = parse_date(data.date)
    slot = engine.validate_window(settings, day, data.slot_start, enforce_notice=False)
    prefer = appt.get("doctor_id") if data.keep_doctor else None
    reservation = await engine.reserve(settings, day, slot, appt["service_id"], settings["booking"]["assignment_mode"], prefer_doctor_id=prefer)
    await engine.release(appt["date"], appt["slot_start"], appt.get("capacity_doctor_id"))
    doctor = await db.doctors.find_one({"_id": reservation.doctor_id}) if reservation.doctor_id else None
    updates = {
        "date": data.date, "slot_start": slot[0], "slot_end": slot[1], "starts_at": local_datetime(settings, day, slot[0]).astimezone(timezone.utc),
        "doctor_id": doctor["_id"] if doctor else None, "doctor_name": doctor["name"] if doctor else None, "capacity_doctor_id": reservation.doctor_id,
        "needs_manual_assignment": reservation.needs_manual_assignment, "rescheduled_from": {"date": appt["date"], "slot_start": appt["slot_start"], "doctor_id": appt.get("doctor_id")},
        "reschedule_count": appt.get("reschedule_count", 0) + 1, "updated_at": utc_now(),
    }
    await db.appointments.update_one({"_id": appt["_id"]}, {"$set": updates})
    updated = await transition({**appt, **updates}, "RESCHEDULED", actor, data.reason or f"Moved from {appt['date']} {appt['slot_start']}")
    await audit.log(actor, "appointment_rescheduled", "appointment", appt["_id"], {"public_id": appt["public_id"], "from": f"{appt['date']} {appt['slot_start']}", "to": f"{data.date} {slot[0]}"}, ip)
    return await automation.handle("appointment_rescheduled", updated, settings, actor=actor)


async def add_note(appt: dict, text: str, actor: dict, ip: str | None = None) -> dict:
    note = {"id": new_id(), "text": text, "author_name": actor.get("name"), "author_id": actor.get("id"), "created_at": utc_now()}
    await db.appointments.update_one({"_id": appt["_id"]}, {"$push": {"notes": note}, "$set": {"updated_at": utc_now()}})
    await audit.log(actor, "appointment_note_added", "appointment", appt["_id"], {"public_id": appt["public_id"]}, ip)
    return await get_or_404(appt["_id"])
