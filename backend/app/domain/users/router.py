from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr, Field

from app.core.config import cfg
from app.core.database import db
from app.core.deps import actor_of, require, sanitize_user
from app.core.errors import AppError
from app.core.models import new_id, utc_now
from app.core.ratelimit import client_ip
from app.core.security import hash_password
from app.domain import audit

router = APIRouter(prefix="/admin/users", tags=["admin:users"])


class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=80)
    password: str = Field(min_length=10, max_length=200)
    role: Literal["ADMIN", "STAFF", "DOCTOR"]


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    role: Literal["ADMIN", "STAFF", "DOCTOR"] | None = None
    is_active: bool | None = None


@router.get("")
async def list_users(user=Depends(require("users:write"))):
    docs = await db.users.find({"organization_id": cfg.organization_id}).sort("created_at", 1).to_list(200)
    return {"items": [sanitize_user(u) for u in docs]}


@router.post("", status_code=201)
async def create_user(data: UserCreate, request: Request, user=Depends(require("users:write"))):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise AppError(409, "email_taken", "A user with that email already exists.")
    doc = {"_id": new_id(), "organization_id": cfg.organization_id, "email": email, "name": data.name, "role": data.role, "password_hash": hash_password(data.password), "is_active": True, "mfa_enabled": False, "created_at": utc_now(), "updated_at": utc_now()}
    await db.users.insert_one(doc)
    await audit.log(actor_of(user), "user_created", "user", doc["_id"], {"role": data.role}, client_ip(request))
    return sanitize_user(doc)


@router.patch("/{user_id}")
async def update_user(user_id: str, data: UserUpdate, request: Request, user=Depends(require("users:write"))):
    target = await db.users.find_one({"_id": user_id, "organization_id": cfg.organization_id})
    if not target:
        raise AppError(404, "user_not_found", "User not found.")
    if target["role"] == "OWNER" and (data.role or data.is_active is False):
        raise AppError(400, "owner_protected", "The owner account cannot be demoted or deactivated.")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    updates["updated_at"] = utc_now()
    await db.users.update_one({"_id": user_id}, {"$set": updates})
    if data.is_active is False:
        await db.sessions.update_many({"user_id": user_id}, {"$set": {"revoked": True}})
    await audit.log(actor_of(user), "user_updated", "user", user_id, {"fields": list(updates.keys())}, client_ip(request))
    return sanitize_user(await db.users.find_one({"_id": user_id}))
