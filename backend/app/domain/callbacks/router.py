from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field, field_validator

from app.core.database import db, q
from app.core.deps import actor_of, require
from app.core.errors import AppError
from app.core.models import new_id, to_public, utc_now
from app.core.phone import normalize_phone
from app.core.ratelimit import client_ip
from app.domain import audit

router = APIRouter(prefix="/admin/callbacks", tags=["admin:callbacks"])


class CallbackCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(min_length=10, max_length=20)
    reason: str | None = Field(default=None, max_length=300)
    preferred_time: str | None = Field(default=None, max_length=80)
    website: str | None = None

    @field_validator("reason", "preferred_time", mode="before")
    @classmethod
    def blank(cls, v):
        return None if isinstance(v, str) and not v.strip() else v


class CallbackUpdate(BaseModel):
    status: Literal["NEW", "CONTACTED", "CLOSED"]
    note: str | None = Field(default=None, max_length=500)


async def create_callback(data: CallbackCreate, ip: str | None) -> dict:
    if data.website:
        raise AppError(400, "spam_detected", "Submission could not be processed.")
    phone = normalize_phone(data.phone)
    doc = q(_id=new_id(), name=" ".join(data.name.split()), phone=phone, reason=data.reason, preferred_time=data.preferred_time, status="NEW", note=None, created_at=utc_now(), updated_at=utc_now())
    await db.callback_requests.insert_one(doc)
    await audit.log(None, "callback_requested", "callback_request", doc["_id"], {}, ip)
    return doc


@router.get("")
async def list_callbacks(status: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200), user=Depends(require("appointments:read"))):
    filters = q(status=status) if status else q()
    total = await db.callback_requests.count_documents(filters)
    items = await db.callback_requests.find(filters).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    return {"items": [to_public(i) for i in items], "total": total}


@router.patch("/{callback_id}")
async def update_callback(callback_id: str, data: CallbackUpdate, request: Request, user=Depends(require("appointments:write"))):
    result = await db.callback_requests.update_one(q(_id=callback_id), {"$set": {"status": data.status, "note": data.note, "updated_at": utc_now(), "handled_by": user.get("name")}})
    if result.matched_count == 0:
        raise AppError(404, "callback_not_found", "Callback request not found.")
    await audit.log(actor_of(user), "callback_updated", "callback_request", callback_id, {"status": data.status}, client_ip(request))
    return to_public(await db.callback_requests.find_one({"_id": callback_id}))
