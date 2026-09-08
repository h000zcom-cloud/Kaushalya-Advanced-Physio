import base64
import io
from datetime import timedelta

import jwt
import qrcode
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, EmailStr, Field

from app.core.config import cfg
from app.core.database import db, q
from app.core.deps import actor_of, get_current_user, sanitize_user
from app.core.errors import AppError
from app.core.models import new_id, to_public, utc_now
from app.core.ratelimit import client_ip, limiter
from app.core.security import (create_access_token, create_mfa_token, create_refresh_token, decode_token, decrypt_secret, encrypt_secret, generate_recovery_codes, hash_password, new_totp_secret, random_token, sha256_hex, totp_step, totp_uri, verify_password, verify_totp)
from app.domain import audit
from app.domain.settings.service import get_settings
from app.integrations.email.client import send_email

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_ATTEMPTS = 5
LOCK_MINUTES = 15
GENERIC_LOGIN_ERROR = "Incorrect email or password."


class LoginInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class MfaVerifyInput(BaseModel):
    mfa_token: str
    code: str = Field(min_length=6, max_length=20)


class ForgotInput(BaseModel):
    email: EmailStr


class ResetInput(BaseModel):
    token: str
    new_password: str = Field(min_length=10, max_length=200)


class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str = Field(min_length=10, max_length=200)


class CodeInput(BaseModel):
    code: str = Field(min_length=6, max_length=8)


class DisableMfaInput(BaseModel):
    password: str
    code: str = Field(min_length=6, max_length=20)


def _set_cookies(response: Response, access: str, refresh: str) -> None:
    common = {"httponly": True, "secure": cfg.cookie_secure, "samesite": cfg.cookie_samesite, "path": "/"}
    response.set_cookie("access_token", access, max_age=cfg.access_token_minutes * 60, **common)
    response.set_cookie("refresh_token", refresh, max_age=cfg.refresh_token_days * 86400, **common)


def _clear_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


async def _start_session(user: dict, request: Request, response: Response) -> dict:
    session_id = new_id()
    await db.sessions.insert_one({"_id": session_id, "user_id": user["_id"], "ip": client_ip(request), "user_agent": (request.headers.get("user-agent") or "")[:200], "created_at": utc_now(), "expires_at": utc_now() + timedelta(days=cfg.refresh_token_days), "revoked": False})
    _set_cookies(response, create_access_token(user["_id"], user["role"], session_id), create_refresh_token(user["_id"], session_id))
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": utc_now()}})
    await audit.log(actor_of(user), "admin_logged_in", "user", user["_id"], {}, client_ip(request))
    return {"user": sanitize_user(user), "access_token": create_access_token(user["_id"], user["role"], session_id)}


async def _check_lock(identifier: str) -> None:
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("locked_until") and attempt["locked_until"] > utc_now():
        raise AppError(429, "account_locked", "Too many failed attempts. Please try again in a few minutes.")


async def _record_failure(identifier: str) -> None:
    doc = await db.login_attempts.find_one_and_update({"identifier": identifier}, {"$inc": {"count": 1}, "$set": {"expires_at": utc_now() + timedelta(hours=1)}}, upsert=True, return_document=True)
    if doc and doc.get("count", 0) >= MAX_ATTEMPTS:
        await db.login_attempts.update_one({"identifier": identifier}, {"$set": {"locked_until": utc_now() + timedelta(minutes=LOCK_MINUTES), "count": 0}})


@router.post("/login")
@limiter.limit("10/minute")
async def login(data: LoginInput, request: Request, response: Response):
    email = data.email.lower().strip()
    identifier = f"{client_ip(request)}:{email}"
    await _check_lock(identifier)
    user = await db.users.find_one({"email": email})
    if not user or not user.get("is_active") or not verify_password(data.password, user["password_hash"]):
        await _record_failure(identifier)
        await audit.log(None, "admin_login_failed", "user", None, {"email_domain": email.split("@")[-1]}, client_ip(request))
        raise AppError(401, "invalid_credentials", GENERIC_LOGIN_ERROR)
    await db.login_attempts.delete_one({"identifier": identifier})
    if user.get("mfa_enabled"):
        return {"mfa_required": True, "mfa_token": create_mfa_token(user["_id"])}
    return await _start_session(user, request, response)


@router.post("/mfa/verify")
@limiter.limit("10/minute")
async def mfa_verify(data: MfaVerifyInput, request: Request, response: Response):
    try:
        payload = decode_token(data.mfa_token, "mfa")
    except jwt.InvalidTokenError:
        raise AppError(401, "mfa_expired", "Your sign-in attempt expired. Please sign in again.")
    user = await db.users.find_one({"_id": payload["sub"], "is_active": True, "mfa_enabled": True})
    if not user:
        raise AppError(401, "mfa_invalid", "Please sign in again.")
    identifier = f"{client_ip(request)}:mfa:{user['email']}"
    await _check_lock(identifier)
    code = data.code.replace(" ", "").replace("-", "").lower()
    secret = decrypt_secret(user["mfa_secret"])
    step = totp_step()
    if verify_totp(secret, code) and user.get("mfa_last_step") != step:
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"mfa_last_step": step}})
    else:
        codes = user.get("mfa_recovery_codes") or []
        hashed = sha256_hex(code)
        if hashed not in codes:
            await _record_failure(identifier)
            raise AppError(401, "mfa_invalid", "That code is not valid. Please try again.")
        await db.users.update_one({"_id": user["_id"]}, {"$pull": {"mfa_recovery_codes": hashed}})
        await audit.log(actor_of(user), "mfa_recovery_code_used", "user", user["_id"], {}, client_ip(request))
    await db.login_attempts.delete_one({"identifier": identifier})
    return await _start_session(user, request, response)


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise AppError(401, "no_refresh_token", "Please sign in again.")
    try:
        payload = decode_token(token, "refresh")
    except jwt.InvalidTokenError:
        _clear_cookies(response)
        raise AppError(401, "invalid_refresh_token", "Your session has expired. Please sign in again.")
    session = await db.sessions.find_one({"_id": payload["sid"], "revoked": {"$ne": True}})
    user = await db.users.find_one({"_id": payload["sub"], "is_active": True})
    if not session or not user:
        _clear_cookies(response)
        raise AppError(401, "session_revoked", "Your session has ended. Please sign in again.")
    await db.sessions.update_one({"_id": session["_id"]}, {"$set": {"last_seen_at": utc_now()}})
    _set_cookies(response, create_access_token(user["_id"], user["role"], session["_id"]), create_refresh_token(user["_id"], session["_id"]))
    return {"user": sanitize_user(user)}


@router.post("/logout")
async def logout(request: Request, response: Response, user=Depends(get_current_user)):
    await db.sessions.update_one({"_id": user.get("session_id")}, {"$set": {"revoked": True}})
    _clear_cookies(response)
    await audit.log(actor_of(user), "admin_logged_out", "user", user["_id"], {}, client_ip(request))
    return {"logged_out": True}


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return {"user": sanitize_user(user)}


@router.get("/sessions")
async def sessions(user=Depends(get_current_user)):
    docs = await db.sessions.find({"user_id": user["_id"], "revoked": {"$ne": True}}).sort("created_at", -1).to_list(50)
    return {"items": [to_public(s) | {"current": s["_id"] == user.get("session_id")} for s in docs]}


@router.delete("/sessions/{session_id}")
async def revoke_session(session_id: str, request: Request, user=Depends(get_current_user)):
    await db.sessions.update_one({"_id": session_id, "user_id": user["_id"]}, {"$set": {"revoked": True}})
    await audit.log(actor_of(user), "session_revoked", "session", session_id, {}, client_ip(request))
    return {"revoked": True}


@router.post("/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(data: ForgotInput, request: Request):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email, "is_active": True})
    if user:
        token = random_token(32)
        await db.password_reset_tokens.insert_one({"_id": new_id(), "user_id": user["_id"], "token_hash": sha256_hex(token), "expires_at": utc_now() + timedelta(hours=1), "used": False, "created_at": utc_now()})
        link = f"{cfg.public_url or ''}/admin/reset-password?token={token}"
        settings = await get_settings()
        await send_email(email, f"Reset your {settings['clinic']['short_name']} admin password", f"Use this link within 1 hour to reset your password:\n\n{link}\n\nIf you did not request this, you can ignore this email.", kind="password_reset")
        await audit.log(None, "password_reset_requested", "user", user["_id"], {}, client_ip(request))
    return {"message": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(data: ResetInput, request: Request):
    record = await db.password_reset_tokens.find_one({"token_hash": sha256_hex(data.token), "used": False, "expires_at": {"$gt": utc_now()}})
    if not record:
        raise AppError(400, "invalid_reset_token", "This reset link is invalid or has expired.")
    await db.users.update_one({"_id": record["user_id"]}, {"$set": {"password_hash": hash_password(data.new_password), "updated_at": utc_now()}})
    await db.password_reset_tokens.update_one({"_id": record["_id"]}, {"$set": {"used": True}})
    await db.sessions.update_many({"user_id": record["user_id"]}, {"$set": {"revoked": True}})
    await audit.log(None, "password_reset_completed", "user", record["user_id"], {}, client_ip(request))
    return {"message": "Your password has been updated. Please sign in."}


@router.post("/change-password")
async def change_password(data: ChangePasswordInput, request: Request, user=Depends(get_current_user)):
    if not verify_password(data.current_password, user["password_hash"]):
        raise AppError(400, "wrong_password", "Your current password is incorrect.")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": hash_password(data.new_password), "updated_at": utc_now()}})
    await db.sessions.update_many({"user_id": user["_id"], "_id": {"$ne": user.get("session_id")}}, {"$set": {"revoked": True}})
    await audit.log(actor_of(user), "password_changed", "user", user["_id"], {}, client_ip(request))
    return {"message": "Password updated."}


@router.post("/mfa/setup")
async def mfa_setup(user=Depends(get_current_user)):
    if user.get("mfa_enabled"):
        raise AppError(400, "mfa_already_enabled", "Two-factor authentication is already enabled.")
    settings = await get_settings()
    secret = new_totp_secret()
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"mfa_pending_secret": encrypt_secret(secret)}})
    uri = totp_uri(secret, user["email"], settings["clinic"]["short_name"])
    image = qrcode.make(uri)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return {"secret": secret, "otpauth_url": uri, "qr_data_url": "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()}


@router.post("/mfa/enable")
async def mfa_enable(data: CodeInput, request: Request, user=Depends(get_current_user)):
    pending = user.get("mfa_pending_secret")
    if not pending:
        raise AppError(400, "mfa_not_started", "Start the setup first to get a QR code.")
    secret = decrypt_secret(pending)
    if not verify_totp(secret, data.code):
        raise AppError(400, "mfa_invalid", "That code is not valid. Check your authenticator app and try again.")
    codes = generate_recovery_codes()
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"mfa_enabled": True, "mfa_secret": pending, "mfa_recovery_codes": [sha256_hex(c) for c in codes], "mfa_last_step": totp_step(), "updated_at": utc_now()}, "$unset": {"mfa_pending_secret": ""}})
    await audit.log(actor_of(user), "mfa_enabled", "user", user["_id"], {}, client_ip(request))
    return {"enabled": True, "recovery_codes": codes}


@router.post("/mfa/disable")
async def mfa_disable(data: DisableMfaInput, request: Request, user=Depends(get_current_user)):
    if not user.get("mfa_enabled"):
        raise AppError(400, "mfa_not_enabled", "Two-factor authentication is not enabled.")
    if not verify_password(data.password, user["password_hash"]) or not verify_totp(decrypt_secret(user["mfa_secret"]), data.code):
        raise AppError(400, "mfa_invalid", "Password or code is incorrect.")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"mfa_enabled": False, "updated_at": utc_now()}, "$unset": {"mfa_secret": "", "mfa_recovery_codes": "", "mfa_last_step": ""}})
    await audit.log(actor_of(user), "mfa_disabled", "user", user["_id"], {}, client_ip(request))
    return {"enabled": False}
