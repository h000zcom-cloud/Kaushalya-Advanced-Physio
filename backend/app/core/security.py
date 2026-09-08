import base64
import hashlib
import secrets
from datetime import timedelta

import bcrypt
import jwt
import pyotp
from cryptography.fernet import Fernet

from app.core.config import cfg
from app.core.models import utc_now

JWT_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def _encode(payload: dict, ttl: timedelta) -> str:
    return jwt.encode({**payload, "exp": utc_now() + ttl, "iat": utc_now()}, cfg.jwt_secret, algorithm=JWT_ALGORITHM)


def create_access_token(user_id: str, role: str, session_id: str) -> str:
    return _encode({"sub": user_id, "role": role, "sid": session_id, "type": "access"}, timedelta(minutes=cfg.access_token_minutes))


def create_refresh_token(user_id: str, session_id: str) -> str:
    return _encode({"sub": user_id, "sid": session_id, "type": "refresh"}, timedelta(days=cfg.refresh_token_days))


def create_mfa_token(user_id: str) -> str:
    return _encode({"sub": user_id, "type": "mfa"}, timedelta(minutes=5))


def decode_token(token: str, expected_type: str) -> dict:
    payload = jwt.decode(token, cfg.jwt_secret, algorithms=[JWT_ALGORITHM])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("Unexpected token type")
    return payload


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def random_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(f"{cfg.jwt_secret}:mfa".encode()).digest())
    return Fernet(key)


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt_secret(value: str) -> str:
    return _fernet().decrypt(value.encode()).decode()


def new_totp_secret() -> str:
    return pyotp.random_base32()


def totp_uri(secret: str, email: str, issuer: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)


def verify_totp(secret: str, code: str) -> bool:
    return pyotp.TOTP(secret).verify(code.replace(" ", ""), valid_window=1)


def totp_step() -> int:
    return int(utc_now().timestamp() // 30)


def generate_recovery_codes(count: int = 8) -> list[str]:
    return [f"{secrets.token_hex(2)}-{secrets.token_hex(2)}-{secrets.token_hex(2)}" for _ in range(count)]
