from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.core.database import db, q
from app.core.deps import actor_of, require
from app.core.errors import AppError
from app.core.models import new_id, to_public, utc_now
from app.core.ratelimit import client_ip
from app.domain import audit

router = APIRouter(prefix="/admin/testimonials", tags=["admin:testimonials"])


class TestimonialInput(BaseModel):
    patient_name: str = Field(min_length=1, max_length=80)
    display_mode: Literal["full", "initials", "anonymous"] = "full"
    content: str = Field(min_length=10, max_length=1500)
    service_id: str | None = None
    condition_key: str = Field(default="", max_length=40)
    rating: int | None = Field(default=None, ge=1, le=5)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    is_featured: bool = False
    is_published: bool = False
    is_demo: bool = False
    consent_confirmed: bool = False


def display_name(t: dict) -> str:
    name = t.get("patient_name", "")
    if t.get("display_mode") == "anonymous":
        return "Patient"
    if t.get("display_mode") == "initials":
        return " ".join(f"{p[0]}." for p in name.split() if p)
    return name


def public_testimonial(t: dict, service_names: dict | None = None) -> dict:
    return {"id": t["_id"], "display_name": display_name(t), "content": t["content"], "service_id": t.get("service_id"), "service_name": (service_names or {}).get(t.get("service_id")), "condition_key": t.get("condition_key"), "rating": t.get("rating"), "date": t.get("date"), "is_featured": t.get("is_featured", False), "is_demo": t.get("is_demo", False)}


@router.get("")
async def list_testimonials(user=Depends(require("appointments:read"))):
    docs = await db.testimonials.find(q()).sort("date", -1).to_list(1000)
    return {"items": [to_public(d) for d in docs]}


@router.post("", status_code=201)
async def create_testimonial(data: TestimonialInput, request: Request, user=Depends(require("testimonials:write"))):
    if data.is_published and not data.consent_confirmed:
        raise AppError(422, "consent_required", "Confirm that the patient approved publishing this testimonial.")
    payload = data.model_dump() | q(_id=new_id(), created_at=utc_now(), updated_at=utc_now())
    await db.testimonials.insert_one(payload)
    await audit.log(actor_of(user), "testimonial_created", "testimonial", payload["_id"], {}, client_ip(request))
    return to_public(payload)


@router.put("/{testimonial_id}")
async def update_testimonial(testimonial_id: str, data: TestimonialInput, request: Request, user=Depends(require("testimonials:write"))):
    if data.is_published and not data.consent_confirmed:
        raise AppError(422, "consent_required", "Confirm that the patient approved publishing this testimonial.")
    result = await db.testimonials.update_one(q(_id=testimonial_id), {"$set": data.model_dump() | {"updated_at": utc_now()}})
    if result.matched_count == 0:
        raise AppError(404, "testimonial_not_found", "Testimonial not found.")
    await audit.log(actor_of(user), "testimonial_updated", "testimonial", testimonial_id, {}, client_ip(request))
    return to_public(await db.testimonials.find_one({"_id": testimonial_id}))


@router.delete("/{testimonial_id}")
async def delete_testimonial(testimonial_id: str, request: Request, user=Depends(require("testimonials:write"))):
    result = await db.testimonials.delete_one(q(_id=testimonial_id))
    if result.deleted_count == 0:
        raise AppError(404, "testimonial_not_found", "Testimonial not found.")
    await audit.log(actor_of(user), "testimonial_deleted", "testimonial", testimonial_id, {}, client_ip(request))
    return {"deleted": True}
