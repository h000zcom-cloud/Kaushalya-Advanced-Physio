import logging

import httpx

from app.core.config import cfg
from app.core.database import db
from app.core.models import new_id, utc_now

logger = logging.getLogger("app.email")


async def send_email(to: str, subject: str, text: str, kind: str = "operational") -> dict:
    record = {"_id": new_id(), "to": to, "subject": subject, "kind": kind, "status": "queued", "created_at": utc_now()}
    if not cfg.email_configured:
        record["status"] = "logged_not_configured"
        logger.info("EMAIL (not configured) to=%s subject=%s\n%s", to, subject, text)
        await db.email_outbox.insert_one(record)
        return record
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post("https://api.resend.com/emails", headers={"Authorization": f"Bearer {cfg.resend_api_key}"}, json={"from": cfg.email_from, "to": [to], "subject": subject, "text": text})
        record["status"] = "sent" if response.status_code < 400 else "failed"
        if response.status_code >= 400:
            record["error"] = f"Provider responded {response.status_code}"
    except httpx.HTTPError:
        record["status"] = "failed"
        record["error"] = "Could not reach email provider"
    await db.email_outbox.insert_one(record)
    return record
