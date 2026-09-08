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

router = APIRouter(prefix="/admin/services", tags=["admin:services"])


class QA(BaseModel):
    question: str = Field(max_length=200)
    answer: str = Field(max_length=1000)


class ServiceInput(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    short_description: str = Field(default="", max_length=300)
    category: str = Field(default="General", max_length=60)
    condition_keys: list[str] = []
    hero_image_url: str = Field(default="", max_length=500)
    overview: str = Field(default="", max_length=3000)
    symptoms: list[str] = []
    who_benefits: list[str] = []
    how_it_helps: str = Field(default="", max_length=3000)
    approach: list[str] = []
    what_to_expect: str = Field(default="", max_length=3000)
    faqs: list[QA] = []
    duration_minutes: int = Field(default=60, ge=15, le=240)
    acceptance_mode: Literal["INHERIT", "AUTO", "MANUAL"] = "INHERIT"
    is_active: bool = True
    is_demo: bool = False
    display_order: int = 0


class StatusInput(BaseModel):
    is_active: bool


async def _get(service_id: str) -> dict:
    doc = await db.services.find_one(q(_id=service_id))
    if not doc:
        raise AppError(404, "service_not_found", "Service not found.")
    return doc


@router.get("")
async def list_services(user=Depends(require("appointments:read"))):
    docs = await db.services.find(q()).sort([("display_order", 1), ("name", 1)]).to_list(500)
    doctors = await db.doctors.find(q(is_active=True), {"service_ids": 1}).to_list(2000)
    counts = {}
    for d in doctors:
        for sid in d.get("service_ids", []):
            counts[sid] = counts.get(sid, 0) + 1
    return {"items": [to_public(s) | {"eligible_doctor_count": counts.get(s["_id"], 0)} for s in docs]}


@router.post("", status_code=201)
async def create_service(data: ServiceInput, request: Request, user=Depends(require("services:write"))):
    payload = data.model_dump()
    payload.update(q(_id=new_id(), slug=await unique_slug("services", slugify(data.name)), created_at=utc_now(), updated_at=utc_now()))
    await db.services.insert_one(payload)
    await audit.log(actor_of(user), "service_created", "service", payload["_id"], {"name": data.name}, client_ip(request))
    return to_public(payload)


@router.put("/{service_id}")
async def update_service(service_id: str, data: ServiceInput, request: Request, user=Depends(require("services:write"))):
    doc = await _get(service_id)
    payload = data.model_dump()
    payload["updated_at"] = utc_now()
    if data.name != doc["name"]:
        payload["slug"] = await unique_slug("services", slugify(data.name), exclude_id=service_id)
        await db.appointments.update_many(q(service_id=service_id), {"$set": {"service_name": data.name, "service_slug": payload["slug"]}})
    await db.services.update_one({"_id": service_id}, {"$set": payload})
    await audit.log(actor_of(user), "service_updated", "service", service_id, {"name": data.name}, client_ip(request))
    return to_public(await _get(service_id))


@router.patch("/{service_id}/status")
async def set_status(service_id: str, data: StatusInput, request: Request, user=Depends(require("services:write"))):
    await _get(service_id)
    await db.services.update_one({"_id": service_id}, {"$set": {"is_active": data.is_active, "updated_at": utc_now()}})
    await audit.log(actor_of(user), "service_activated" if data.is_active else "service_deactivated", "service", service_id, {}, client_ip(request))
    return to_public(await _get(service_id))


@router.put("/{service_id}/doctors")
async def set_eligible_doctors(service_id: str, body: dict, request: Request, user=Depends(require("services:write"))):
    await _get(service_id)
    doctor_ids = [d for d in body.get("doctor_ids", []) if isinstance(d, str)]
    await db.doctors.update_many(q(_id={"$in": doctor_ids}), {"$addToSet": {"service_ids": service_id}, "$set": {"updated_at": utc_now()}})
    await db.doctors.update_many(q(_id={"$nin": doctor_ids}, service_ids=service_id), {"$pull": {"service_ids": service_id}, "$set": {"updated_at": utc_now()}})
    await audit.log(actor_of(user), "service_doctors_updated", "service", service_id, {"doctor_count": len(doctor_ids)}, client_ip(request))
    return {"doctor_ids": doctor_ids}
