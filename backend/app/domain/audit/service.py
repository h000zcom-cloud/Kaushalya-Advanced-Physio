from app.core.database import db, q
from app.core.models import new_id, utc_now


async def log(actor: dict | None, action: str, resource: str, resource_id: str | None = None, metadata: dict | None = None, ip: str | None = None) -> None:
    await db.audit_logs.insert_one(q(
        _id=new_id(),
        created_at=utc_now(),
        user_id=actor.get("id") if actor else None,
        user_email=actor.get("email") if actor else None,
        user_name=actor.get("name") if actor else ("Patient (web)" if not actor else None),
        action=action,
        resource=resource,
        resource_id=resource_id,
        metadata=metadata or {},
        ip=ip,
    ))
