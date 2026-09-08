import csv
import io
from datetime import timedelta

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from app.core.database import db, q
from app.core.deps import actor_of, require
from app.core.models import to_public
from app.core.phone import normalize_phone
from app.core.ratelimit import client_ip
from app.core.timeutil import now_local, parse_date
from app.domain import audit
from app.domain.appointments import service as appointments
from app.domain.appointments.schemas import AdminBookingCreate, AssignInput, NoteInput, ReasonInput, RescheduleInput
from app.domain.appointments.state_machine import STATUSES
from app.domain.scheduling.engine import ACTIVE_STATUSES
from app.domain.settings.service import get_settings

router = APIRouter(prefix="/admin/appointments", tags=["admin:appointments"])


def _filters(status: str | None, date_from: str | None, date_to: str | None, doctor_id: str | None, service_id: str | None, search: str | None, needs_assignment: bool | None) -> dict:
    filters = q()
    if status:
        statuses = [s for s in status.split(",") if s in STATUSES]
        filters["status"] = {"$in": statuses if statuses else list(ACTIVE_STATUSES)}
    if date_from or date_to:
        filters["date"] = {k: v for k, v in (("$gte", date_from), ("$lte", date_to)) if v}
    if doctor_id:
        filters["doctor_id"] = None if doctor_id == "unassigned" else doctor_id
    if service_id:
        filters["service_id"] = service_id
    if needs_assignment:
        filters["needs_manual_assignment"] = True
        filters.setdefault("status", {"$in": list(ACTIVE_STATUSES)})
    if search:
        term = search.strip()
        ors = [{"public_id": {"$regex": term, "$options": "i"}}, {"patient_name": {"$regex": term, "$options": "i"}}]
        try:
            ors.append({"patient_phone": normalize_phone(term)})
        except Exception:
            digits = "".join(ch for ch in term if ch.isdigit())
            if len(digits) >= 4:
                ors.append({"patient_phone": {"$regex": digits}})
        filters["$or"] = ors
    return filters


@router.get("")
async def list_appointments(
    status: str | None = None, date_from: str | None = None, date_to: str | None = None, doctor_id: str | None = None,
    service_id: str | None = None, search: str | None = None, needs_assignment: bool | None = None,
    page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200), sort: str = "starts_at", user=Depends(require("appointments:read")),
):
    filters = _filters(status, date_from, date_to, doctor_id, service_id, search, needs_assignment)
    total = await db.appointments.count_documents(filters)
    direction = -1 if sort.startswith("-") else 1
    items = await db.appointments.find(filters).sort(sort.lstrip("-"), direction).skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    return {"items": [appointments.serialize(a) for a in items], "total": total, "page": page, "page_size": page_size}


@router.post("", status_code=201)
async def create_appointment(data: AdminBookingCreate, request: Request, user=Depends(require("appointments:write"))):
    appt = await appointments.create_booking(data, source="admin", actor=actor_of(user), ip=client_ip(request), doctor_id=data.doctor_id)
    return appointments.serialize(appt)


@router.get("/export.csv")
async def export_appointments(request: Request, date_from: str | None = None, date_to: str | None = None, status: str | None = None, user=Depends(require("exports"))):
    filters = _filters(status, date_from, date_to, None, None, None, None)
    rows = await db.appointments.find(filters).sort("starts_at", 1).to_list(20000)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Appointment ID", "Date", "Start", "End", "Status", "Patient", "Phone", "Service", "Doctor", "Source", "Created At"])
    for a in rows:
        writer.writerow([a["public_id"], a["date"], a["slot_start"], a["slot_end"], a["status"], a["patient_name"], a["patient_phone"], a.get("service_name"), a.get("doctor_name") or "", a.get("source"), a["created_at"].isoformat()])
    await audit.log(actor_of(user), "export_generated", "appointments", None, {"rows": len(rows), "date_from": date_from, "date_to": date_to}, client_ip(request))
    return StreamingResponse(iter([buffer.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=appointments.csv"})


@router.get("/{appointment_id}")
async def get_appointment(appointment_id: str, user=Depends(require("appointments:read"))):
    appt = await appointments.get_or_404(appointment_id)
    history = await db.appointment_status_history.find({"appointment_id": appt["_id"]}).sort("created_at", 1).to_list(200)
    notes = await db.notifications.find({"appointment_id": appt["_id"], "channel": "whatsapp"}).sort("created_at", -1).to_list(50)
    patient = await db.patients.find_one({"_id": appt["patient_id"]})
    return {"appointment": appointments.serialize(appt), "history": [to_public(h) for h in history], "notifications": [to_public(n) for n in notes], "patient": to_public(patient)}


async def _act(appointment_id: str, request: Request, user: dict, fn, *args):
    appt = await appointments.get_or_404(appointment_id)
    updated = await fn(appt, *args, actor_of(user), ip=client_ip(request)) if args else await fn(appt, actor_of(user), ip=client_ip(request))
    return appointments.serialize(updated)


@router.post("/{appointment_id}/confirm")
async def confirm(appointment_id: str, request: Request, user=Depends(require("appointments:write"))):
    return await _act(appointment_id, request, user, appointments.confirm)


@router.post("/{appointment_id}/contacted")
async def contacted(appointment_id: str, request: Request, user=Depends(require("appointments:write"))):
    return await _act(appointment_id, request, user, appointments.mark_contacted)


@router.post("/{appointment_id}/complete")
async def complete(appointment_id: str, request: Request, user=Depends(require("appointments:write"))):
    return await _act(appointment_id, request, user, appointments.complete)


@router.post("/{appointment_id}/no-show")
async def no_show(appointment_id: str, request: Request, user=Depends(require("appointments:write"))):
    return await _act(appointment_id, request, user, appointments.no_show)


@router.post("/{appointment_id}/cancel")
async def cancel(appointment_id: str, data: ReasonInput, request: Request, user=Depends(require("appointments:write"))):
    appt = await appointments.get_or_404(appointment_id)
    return appointments.serialize(await appointments.cancel(appt, actor_of(user), data.reason, ip=client_ip(request)))


@router.post("/{appointment_id}/reschedule")
async def reschedule(appointment_id: str, data: RescheduleInput, request: Request, user=Depends(require("appointments:write"))):
    appt = await appointments.get_or_404(appointment_id)
    return appointments.serialize(await appointments.reschedule(appt, data, actor_of(user), ip=client_ip(request)))


@router.post("/{appointment_id}/assign")
async def assign(appointment_id: str, data: AssignInput, request: Request, user=Depends(require("appointments:write"))):
    appt = await appointments.get_or_404(appointment_id)
    return appointments.serialize(await appointments.assign_doctor(appt, data.doctor_id, actor_of(user), data.force, ip=client_ip(request)))


@router.post("/{appointment_id}/notes")
async def add_note(appointment_id: str, data: NoteInput, request: Request, user=Depends(require("appointments:write"))):
    appt = await appointments.get_or_404(appointment_id)
    return appointments.serialize(await appointments.add_note(appt, data.text, actor_of(user), ip=client_ip(request)))
