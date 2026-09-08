import hashlib
import hmac
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Request, Response
from pymongo.errors import DuplicateKeyError

from app.core.config import cfg
from app.core.database import db, q
from app.core.models import new_id, utc_now
from app.core.ratelimit import limiter

logger = logging.getLogger("app.whatsapp.webhook")
router = APIRouter(prefix="/webhooks/whatsapp", tags=["webhooks"])


@router.get("")
async def verify(request: Request):
    params = request.query_params
    if not cfg.whatsapp_verify_token:
        return Response(status_code=503, content="Webhook not configured")
    if params.get("hub.mode") == "subscribe" and params.get("hub.verify_token") == cfg.whatsapp_verify_token:
        return Response(content=params.get("hub.challenge", ""), media_type="text/plain")
    return Response(status_code=403, content="Verification failed")


def _valid_signature(raw: bytes, header: str | None) -> bool:
    if not cfg.whatsapp_app_secret or not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(cfg.whatsapp_app_secret.encode(), raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header[7:])


async def _store_event(event_id: str, kind: str, payload: dict) -> bool:
    try:
        await db.whatsapp_events.insert_one(q(_id=event_id, kind=kind, payload=payload, received_at=utc_now()))
        return True
    except DuplicateKeyError:
        return False


async def _handle_status(status: dict) -> None:
    key = f"status:{status.get('id')}:{status.get('status')}"
    if not await _store_event(key, "status", status):
        return
    await db.notifications.update_one({"provider_message_id": status.get("id")}, {"$set": {"delivery_status": status.get("status"), "updated_at": utc_now()}})
    await db.whatsapp_messages.update_one({"provider_message_id": status.get("id")}, {"$set": {"delivery_status": status.get("status")}})


async def _handle_message(message: dict, contacts: list) -> None:
    key = f"message:{message.get('id')}"
    if not await _store_event(key, "message", {k: v for k, v in message.items() if k != "text"}):
        return
    phone = f"+{message.get('from', '')}"
    patient = await db.patients.find_one(q(phone=phone))
    name = next((c.get("profile", {}).get("name") for c in contacts if c.get("wa_id") == message.get("from")), None)
    conversation = await db.whatsapp_conversations.find_one_and_update(
        q(phone=phone),
        {"$set": {"last_message_at": utc_now(), "updated_at": utc_now(), "patient_id": patient["_id"] if patient else None, "display_name": name}, "$inc": {"unread_count": 1}, "$setOnInsert": {"_id": new_id(), "created_at": utc_now()}},
        upsert=True, return_document=True,
    )
    body = (message.get("text") or {}).get("body", "") if message.get("type") == "text" else f"[{message.get('type')} message]"
    ts = datetime.fromtimestamp(int(message.get("timestamp", 0)), tz=timezone.utc) if message.get("timestamp") else utc_now()
    await db.whatsapp_messages.insert_one(q(_id=new_id(), conversation_id=conversation["_id"], direction="inbound", provider_message_id=message.get("id"), body=body[:1000], message_type=message.get("type"), created_at=ts))


@router.post("")
@limiter.limit("600/minute")
async def receive(request: Request):
    raw = await request.body()
    if not _valid_signature(raw, request.headers.get("X-Hub-Signature-256")):
        logger.warning("Rejected WhatsApp webhook with invalid signature")
        return Response(status_code=403, content="Invalid signature")
    payload = await request.json()
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            for status in value.get("statuses", []):
                await _handle_status(status)
            for message in value.get("messages", []):
                await _handle_message(message, value.get("contacts", []))
    return {"received": True}
