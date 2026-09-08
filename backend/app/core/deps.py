import jwt
from fastapi import Depends, Request

from app.core.config import cfg
from app.core.database import db
from app.core.errors import AppError
from app.core.security import decode_token

ROLES = ("OWNER", "ADMIN", "STAFF", "DOCTOR")

PERMISSIONS = {
    "appointments:read": {"OWNER", "ADMIN", "STAFF", "DOCTOR"},
    "appointments:write": {"OWNER", "ADMIN", "STAFF"},
    "patients:read": {"OWNER", "ADMIN", "STAFF", "DOCTOR"},
    "patients:write": {"OWNER", "ADMIN", "STAFF"},
    "doctors:read": {"OWNER", "ADMIN", "STAFF", "DOCTOR"},
    "doctors:write": {"OWNER", "ADMIN"},
    "services:write": {"OWNER", "ADMIN"},
    "schedule:read": {"OWNER", "ADMIN", "STAFF", "DOCTOR"},
    "schedule:write": {"OWNER", "ADMIN"},
    "settings:read": {"OWNER", "ADMIN"},
    "settings:write": {"OWNER"},
    "testimonials:write": {"OWNER", "ADMIN"},
    "messages:read": {"OWNER", "ADMIN", "STAFF"},
    "analytics:read": {"OWNER", "ADMIN"},
    "exports": {"OWNER", "ADMIN"},
    "audit:read": {"OWNER", "ADMIN"},
    "users:write": {"OWNER"},
}

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

USER_PUBLIC_FIELDS = ("_id", "email", "name", "role", "mfa_enabled", "last_login_at", "created_at", "is_active")


def sanitize_user(user: dict) -> dict:
    return {("id" if k == "_id" else k): user.get(k) for k in USER_PUBLIC_FIELDS}


def _extract_token(request: Request) -> str | None:
    token = request.cookies.get("access_token")
    if token:
        return token
    header = request.headers.get("Authorization", "")
    return header[7:] if header.startswith("Bearer ") else None


def _check_origin(request: Request) -> None:
    if request.method not in UNSAFE_METHODS or "*" in cfg.cors_origins:
        return
    origin = request.headers.get("origin")
    if origin and origin not in cfg.cors_origins:
        raise AppError(403, "origin_not_allowed", "Request origin is not allowed.")


async def get_current_user(request: Request) -> dict:
    token = _extract_token(request)
    if not token:
        raise AppError(401, "not_authenticated", "Please sign in to continue.")
    try:
        payload = decode_token(token, "access")
    except jwt.ExpiredSignatureError:
        raise AppError(401, "token_expired", "Your session has expired. Please sign in again.")
    except jwt.InvalidTokenError:
        raise AppError(401, "invalid_token", "Please sign in to continue.")
    session = await db.sessions.find_one({"_id": payload.get("sid"), "revoked": {"$ne": True}})
    if not session:
        raise AppError(401, "session_revoked", "Your session has ended. Please sign in again.")
    user = await db.users.find_one({"_id": payload["sub"], "is_active": True})
    if not user:
        raise AppError(401, "user_not_found", "Please sign in to continue.")
    _check_origin(request)
    user["session_id"] = payload.get("sid")
    return user


def require(*permissions: str):
    async def dependency(user: dict = Depends(get_current_user)) -> dict:
        role = user.get("role")
        for permission in permissions:
            if role not in PERMISSIONS.get(permission, set()):
                raise AppError(403, "forbidden", "You do not have permission to perform this action.")
        return user

    return dependency


def actor_of(user: dict | None) -> dict | None:
    if not user:
        return None
    return {"id": user["_id"], "email": user.get("email"), "name": user.get("name"), "role": user.get("role")}
