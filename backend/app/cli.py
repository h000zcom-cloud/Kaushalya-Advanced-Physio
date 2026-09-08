"""Operator CLI: python -m app.cli <command> [args]

Commands:
  reset-password <email> <new_password>   Set a new password (revokes sessions)
  disable-mfa <email>                     Disable TOTP for a locked-out user
  list-users                              Show all dashboard accounts
"""
import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from app.core.database import db  # noqa: E402
from app.core.models import utc_now  # noqa: E402
from app.core.security import hash_password  # noqa: E402


async def main(argv: list[str]) -> int:
    if not argv or argv[0] not in ("reset-password", "disable-mfa", "list-users"):
        print(__doc__)
        return 1
    if argv[0] == "list-users":
        async for u in db.users.find({}, {"email": 1, "role": 1, "is_active": 1, "mfa_enabled": 1}):
            print(f"{u['email']:40} {u['role']:7} active={u['is_active']} mfa={u.get('mfa_enabled', False)}")
        return 0
    email = argv[1].lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        print(f"No user with email {email}")
        return 1
    if argv[0] == "reset-password":
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": hash_password(argv[2]), "updated_at": utc_now()}})
        await db.sessions.update_many({"user_id": user["_id"]}, {"$set": {"revoked": True}})
        print("Password updated and sessions revoked.")
    else:
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"mfa_enabled": False}, "$unset": {"mfa_secret": "", "mfa_recovery_codes": ""}})
        print("MFA disabled.")
    await db.audit_logs.insert_one({"_id": __import__("uuid").uuid4().hex, "organization_id": user.get("organization_id"), "created_at": utc_now(), "user_name": "Operator CLI", "action": argv[0].replace("-", "_") + "_cli", "resource": "user", "resource_id": user["_id"], "metadata": {}})
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main(sys.argv[1:])))
