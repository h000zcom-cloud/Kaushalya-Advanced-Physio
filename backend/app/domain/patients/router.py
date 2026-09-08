from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field, field_validator
import csv
import io

from app.core.database import db, q
from app.core.deps import actor_of, require
from app.core.errors import AppError
from app.core.models import new_id, to_public, utc_now
from app.core.phone import normalize_phone
from app.core.ratelimit import client_ip
from app.domain import audit
from app.domain.appointments.service import serialize as serialize_appt

router = APIRouter(prefix="/admin/patients", tags=["admin:patients"])


class PatientUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(min_length=10, max_length=20)
    email: EmailStr | None = None
    status: str = Field(default="ACTIVE", pattern="^(ACTIVE|INACTIVE|BLOCKED)$")
    duplicate_review: bool = False

    @field_validator("email", mode="before")
    @classmethod
    def blank(cls, v):
        return None if isinstance(v, str) and not v.strip() else v


class PatientNoteInput(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


@router.get("")
async def list_patients(search: str | None = None, duplicate_review: bool | None = None, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200), user=Depends(require("patients:read"))):
    filters = q()
    if duplicate_review:
        filters["duplicate_review"] = True
    if search:
        term = search.strip()
        digits = "".join(ch for ch in term if ch.isdigit())
        ors = [{"name": {"$regex": term, "$options": "i"}}]
        if len(digits) >= 4:
            ors.append({"phone": {"$regex": digits}})
        filters["$or"] = ors
    total = await db.patients.count_documents(filters)
    items = await db.patients.find(filters).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    return {"items": [to_public(p) for p in items], "total": total, "page": page, "page_size": page_size}


@router.get("/export.csv")
async def export_patients(request: Request, user=Depends(require("exports"))):
    rows = await db.patients.find(q()).sort("created_at", -1).to_list(50000)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Name", "Phone", "Email", "Status", "Total Appointments", "Last Appointment", "Created At"])
    for p in rows:
        writer.writerow([p["name"], p["phone"], p.get("email") or "", p.get("status"), p.get("total_appointments", 0), p["last_appointment_at"].isoformat() if p.get("last_appointment_at") else "", p["created_at"].isoformat()])
    await audit.log(actor_of(user), "export_generated", "patients", None, {"rows": len(rows)}, client_ip(request))
    return StreamingResponse(iter([buffer.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=patients.csv"})


async def _get(patient_id: str) -> dict:
    patient = await db.patients.find_one(q(_id=patient_id))
    if not patient:
        raise AppError(404, "patient_not_found", "Patient not found.")
    return patient


@router.get("/{patient_id}")
async def get_patient(patient_id: str, user=Depends(require("patients:read"))):
    patient = await _get(patient_id)
    appts = await db.appointments.find(q(patient_id=patient_id)).sort("starts_at", -1).to_list(200)
    notes = await db.patient_notes.find({"patient_id": patient_id}).sort("created_at", -1).to_list(200)
    notifications = await db.notifications.find(q(patient_id=patient_id, channel="whatsapp")).sort("created_at", -1).to_list(50)
    audit_rows = await db.audit_logs.find({"$or": [{"resource": "patient", "resource_id": patient_id}, {"resource": "appointment", "resource_id": {"$in": [a["_id"] for a in appts]}}]}).sort("created_at", -1).to_list(50)
    duplicates = await db.patients.find(q(phone=patient["phone"], _id={"$ne": patient_id})).to_list(20)
    return {"patient": to_public(patient), "appointments": [serialize_appt(a) for a in appts], "notes": [to_public(n) for n in notes], "notifications": [to_public(n) for n in notifications], "audit": [to_public(a) for a in audit_rows], "duplicates": [to_public(d) for d in duplicates]}


@router.patch("/{patient_id}")
async def update_patient(patient_id: str, data: PatientUpdate, request: Request, user=Depends(require("patients:write"))):
    patient = await _get(patient_id)
    updates = data.model_dump()
    updates["phone"] = normalize_phone(data.phone)
    updates["updated_at"] = utc_now()
    await db.patients.update_one({"_id": patient_id}, {"$set": updates})
    if updates["name"] != patient["name"] or updates["phone"] != patient["phone"]:
        await db.appointments.update_many(q(patient_id=patient_id), {"$set": {"patient_name": updates["name"], "patient_phone": updates["phone"], "patient_email": updates["email"]}})
    await audit.log(actor_of(user), "patient_updated", "patient", patient_id, {"fields": [k for k in ("name", "phone", "email", "status") if updates.get(k) != patient.get(k)]}, client_ip(request))
    return to_public(await _get(patient_id))


@router.post("/{patient_id}/notes", status_code=201)
async def add_patient_note(patient_id: str, data: PatientNoteInput, request: Request, user=Depends(require("patients:write"))):
    await _get(patient_id)
    note = {"_id": new_id(), "patient_id": patient_id, "text": data.text, "author_name": user.get("name"), "author_id": user["_id"], "created_at": utc_now()}
    await db.patient_notes.insert_one(note)
    await audit.log(actor_of(user), "patient_note_created", "patient", patient_id, {}, client_ip(request))
    return to_public(note)
