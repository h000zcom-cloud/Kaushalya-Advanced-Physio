from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.core.database import db, q
from app.core.deps import actor_of, require
from app.core.errors import AppError
from app.core.models import new_id, to_public, utc_now
from app.core.ratelimit import client_ip
from app.core.slug import slugify, unique_slug
from app.domain import audit
from app.domain.appointments.service import serialize as serialize_appt
from app.domain.scheduling.engine import ACTIVE_STATUSES

router = APIRouter(prefix="/admin/doctors", tags=["admin:doctors"])
HM = r"^([01]\d|2[0-3]):[0-5]\d$"
DATE = r"^\d{4}-\d{2}-\d{2}$"


class DoctorHours(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start: str = Field(pattern=HM)
    end: str = Field(pattern=HM)


class TimeOff(BaseModel):
    id: str | None = None
    start_date: str = Field(pattern=DATE)
    end_date: str = Field(pattern=DATE)
    reason: str = Field(default="", max_length=120)


class DoctorInput(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    designation: str = Field(default="", max_length=80)
    qualification: str = Field(default="", max_length=120)
    specializations: list[str] = []
    experience_years: int | None = Field(default=None, ge=0, le=60)
    expertise: list[str] = []
    bio: str = Field(default="", max_length=3000)
    philosophy: str = Field(default="", max_length=1000)
    photo_url: str = Field(default="", max_length=500)
    service_ids: list[str] = []
    capacity_per_slot: int = Field(default=1, ge=1, le=50)
    working_hours: list[DoctorHours] = []
    time_off: list[TimeOff] = []
    is_active: bool = True
    is_demo: bool = False
    display_order: int = 0


class StatusInput(BaseModel):
    is_active: bool


def public_doctor(doc: dict) -> dict:
    return to_public(doc)


async def _get(doctor_id: str) -> dict:
    doc = await db.doctors.find_one(q(_id=doctor_id))
    if not doc:
        raise AppError(404, "doctor_not_found", "Doctor not found.")
    return doc


@router.get("")
async def list_doctors(include_inactive: bool = True, user=Depends(require("doctors:read"))):
    filters = q() if include_inactive else q(is_active=True)
    docs = await db.doctors.find(filters).sort([("display_order", 1), ("name", 1)]).to_list(2000)
    return {"items": [public_doctor(d) for d in docs]}


@router.post("", status_code=201)
async def create_doctor(data: DoctorInput, request: Request, user=Depends(require("doctors:write"))):
    payload = data.model_dump()
    for off in payload["time_off"]:
        off["id"] = off.get("id") or new_id()
    payload.update(q(_id=new_id(), slug=await unique_slug("doctors", slugify(data.name)), created_at=utc_now(), updated_at=utc_now()))
    await db.doctors.insert_one(payload)
    await audit.log(actor_of(user), "doctor_created", "doctor", payload["_id"], {"name": data.name}, client_ip(request))
    return public_doctor(payload)


@router.get("/{doctor_id}")
async def get_doctor(doctor_id: str, user=Depends(require("doctors:read"))):
    doc = await _get(doctor_id)
    upcoming = await db.appointments.find(q(doctor_id=doctor_id, status={"$in": list(ACTIVE_STATUSES)})).sort("starts_at", 1).limit(50).to_list(50)
    return {"doctor": public_doctor(doc), "upcoming": [serialize_appt(a) for a in upcoming]}


@router.put("/{doctor_id}")
async def update_doctor(doctor_id: str, data: DoctorInput, request: Request, user=Depends(require("doctors:write"))):
    doc = await _get(doctor_id)
    payload = data.model_dump()
    for off in payload["time_off"]:
        off["id"] = off.get("id") or new_id()
    payload["updated_at"] = utc_now()
    if data.name != doc["name"]:
        payload["slug"] = await unique_slug("doctors", slugify(data.name), exclude_id=doctor_id)
    await db.doctors.update_one({"_id": doctor_id}, {"$set": payload})
    if data.name != doc["name"]:
        await db.appointments.update_many(q(doctor_id=doctor_id), {"$set": {"doctor_name": data.name}})
    await audit.log(actor_of(user), "doctor_updated", "doctor", doctor_id, {"name": data.name}, client_ip(request))
    return public_doctor(await _get(doctor_id))


@router.patch("/{doctor_id}/status")
async def set_status(doctor_id: str, data: StatusInput, request: Request, user=Depends(require("doctors:write"))):
    await _get(doctor_id)
    await db.doctors.update_one({"_id": doctor_id}, {"$set": {"is_active": data.is_active, "updated_at": utc_now()}})
    await audit.log(actor_of(user), "doctor_activated" if data.is_active else "doctor_deactivated", "doctor", doctor_id, {}, client_ip(request))
    return public_doctor(await _get(doctor_id))
