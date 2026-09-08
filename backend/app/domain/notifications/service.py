import asyncio
import logging

from pymongo.errors import DuplicateKeyError

from app.core.config import cfg
from app.core.database import db, q
from app.core.models import new_id, utc_now
from app.core.phone import phone_digits
from app.core.timeutil import human_date, human_time
from app.integrations.whatsapp.client import WhatsAppError, whatsapp

logger = logging.getLogger("app.notifications")

EVENT_TEMPLATE = {
    "appointment_created": "request_received",
    "appointment_confirmed": "confirmation",
    "appointment_rescheduled": "rescheduled",
    "appointment_cancelled": "cancelled",
    "appointment_reminder_due": "reminder",
}
EVENT_SETTING = {
    "appointment_created": "send_request_received",
    "appointment_confirmed": "send_confirmation",
    "appointment_rescheduled": "send_reschedule",
    "appointment_cancelled": "send_cancellation",
    "appointment_reminder_due": "reminders_enabled",
}
MAX_ATTEMPTS = 3


class _Safe(dict):
    def __missing__(self, key):
        return ""


def render(template: str, appointment: dict, settings: dict) -> str:
    clinic = settings["clinic"]
    address = ", ".join(x for x in (clinic.get("address_line"), clinic.get("city"), clinic.get("pincode")) if x)
    return template.format_map(_Safe(
        patient_name=appointment["patient_name"],
        clinic_name=clinic["name"],
        appointment_id=appointment["public_id"],
        date=human_date(appointment["date"]),
        time=f"{human_time(appointment['slot_start'])} – {human_time(appointment['slot_end'])}",
        service=appointment.get("service_name", ""),
        doctor=appointment.get("doctor_name") or "To be assigned",
        address=address,
    ))


def template_params(appointment: dict, settings: dict) -> list[str]:
    return [appointment["patient_name"], appointment["public_id"], human_date(appointment["date"]), human_time(appointment["slot_start"]), appointment.get("service_name", ""), settings["clinic"]["name"]]


async def create_dashboard_notification(event: str, appointment: dict, title: str) -> None:
    await db.notifications.insert_one(q(_id=new_id(), channel="dashboard", event=event, appointment_id=appointment["_id"], appointment_public_id=appointment["public_id"], patient_id=appointment.get("patient_id"), title=title, status="delivered", read=False, created_at=utc_now(), updated_at=utc_now()))


async def queue_whatsapp(event: str, appointment: dict, settings: dict, idempotency_key: str | None = None) -> dict | None:
    rules = settings["notifications"]
    if not rules.get("whatsapp_enabled") or not rules.get(EVENT_SETTING[event], True):
        return None
    template_key = EVENT_TEMPLATE[event]
    body = render(rules["templates"].get(template_key, ""), appointment, settings)
    template_name = (settings.get("whatsapp", {}).get("template_names") or {}).get(template_key) or None
    doc = q(
        _id=new_id(), channel="whatsapp", event=event, template_key=template_key, template_name=template_name,
        appointment_id=appointment["_id"], appointment_public_id=appointment["public_id"], patient_id=appointment.get("patient_id"),
        to_phone=appointment["patient_phone"], body=body, status="queued", attempts=0, error=None, provider_message_id=None,
        idempotency_key=idempotency_key, created_at=utc_now(), updated_at=utc_now(),
    )
    if not whatsapp.is_configured:
        doc["status"] = "skipped_not_configured"
        doc["error"] = "WhatsApp Business API credentials are not configured."
    try:
        await db.notifications.insert_one(doc)
    except DuplicateKeyError:
        return None
    if doc["status"] == "queued":
        asyncio.create_task(deliver(doc["_id"]))
    return doc


async def deliver(notification_id: str) -> None:
    doc = await db.notifications.find_one({"_id": notification_id})
    if not doc or doc["status"] not in ("queued", "failed") or doc.get("attempts", 0) >= MAX_ATTEMPTS:
        return
    await db.notifications.update_one({"_id": notification_id}, {"$set": {"status": "sending", "updated_at": utc_now()}, "$inc": {"attempts": 1}})
    try:
        settings = await db.clinic_settings.find_one({"_id": cfg.organization_id})
        appointment = await db.appointments.find_one({"_id": doc["appointment_id"]})
        to = phone_digits(doc["to_phone"])
        if doc.get("template_name") and appointment:
            provider_id = await whatsapp.send_template(to, doc["template_name"], settings["whatsapp"].get("language_code", "en"), template_params(appointment, settings))
        else:
            provider_id = await whatsapp.send_text(to, doc["body"])
        await db.notifications.update_one({"_id": notification_id}, {"$set": {"status": "sent", "provider_message_id": provider_id, "sent_at": utc_now(), "updated_at": utc_now(), "error": None}})
        await _record_outbound_message(doc, provider_id)
    except WhatsAppError as exc:
        logger.warning("WhatsApp send failed for %s: %s", notification_id, exc.safe_message)
        await db.notifications.update_one({"_id": notification_id}, {"$set": {"status": "failed", "error": exc.safe_message, "updated_at": utc_now()}})
    except Exception:
        logger.exception("Unexpected notification failure %s", notification_id)
        await db.notifications.update_one({"_id": notification_id}, {"$set": {"status": "failed", "error": "Unexpected error while sending.", "updated_at": utc_now()}})


async def _record_outbound_message(notification: dict, provider_id: str) -> None:
    conversation = await db.whatsapp_conversations.find_one_and_update(
        q(phone=notification["to_phone"]),
        {"$set": {"last_message_at": utc_now(), "patient_id": notification.get("patient_id"), "updated_at": utc_now()}, "$setOnInsert": {"_id": new_id(), "created_at": utc_now()}},
        upsert=True, return_document=True,
    )
    await db.whatsapp_messages.insert_one(q(_id=new_id(), conversation_id=conversation["_id"], direction="outbound", provider_message_id=provider_id, body=notification["body"], message_type="template" if notification.get("template_name") else "text", appointment_id=notification["appointment_id"], notification_id=notification["_id"], delivery_status="sent", created_at=utc_now()))


async def retry_failed() -> int:
    cursor = db.notifications.find(q(channel="whatsapp", status="failed", attempts={"$lt": MAX_ATTEMPTS}))
    count = 0
    async for doc in cursor:
        await deliver(doc["_id"])
        count += 1
    return count


async def notify(event: str, appointment: dict, settings: dict, idempotency_key: str | None = None) -> None:
    titles = {
        "appointment_created": f"New appointment request {appointment['public_id']}",
        "appointment_confirmed": f"Appointment {appointment['public_id']} confirmed",
        "appointment_rescheduled": f"Appointment {appointment['public_id']} rescheduled",
        "appointment_cancelled": f"Appointment {appointment['public_id']} cancelled",
        "appointment_reminder_due": f"Reminder sent for {appointment['public_id']}",
        "doctor_assignment_changed": f"Doctor assignment updated for {appointment['public_id']}",
        "appointment_completed": f"Appointment {appointment['public_id']} completed",
    }
    if event in EVENT_TEMPLATE:
        await queue_whatsapp(event, appointment, settings, idempotency_key)
    await create_dashboard_notification(event, appointment, titles.get(event, event))
