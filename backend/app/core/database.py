from datetime import timezone

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING

from app.core.config import cfg

client = AsyncIOMotorClient(cfg.mongo_url, tz_aware=True, tzinfo=timezone.utc)
db = client[cfg.db_name]


def q(**filters) -> dict:
    return {"organization_id": cfg.organization_id, **filters}


async def ensure_indexes() -> None:
    await db.users.create_index("email", unique=True)
    await db.sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.sessions.create_index("user_id")
    await db.login_attempts.create_index("identifier", unique=True)
    await db.login_attempts.create_index("expires_at", expireAfterSeconds=0)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.password_reset_tokens.create_index("token_hash", unique=True)
    await db.patients.create_index([("organization_id", ASCENDING), ("phone", ASCENDING)])
    await db.patients.create_index([("organization_id", ASCENDING), ("created_at", DESCENDING)])
    await db.patients.create_index([("organization_id", ASCENDING), ("name", ASCENDING)])
    await db.patient_notes.create_index([("patient_id", ASCENDING), ("created_at", DESCENDING)])
    await db.appointments.create_index("public_id", unique=True)
    await db.appointments.create_index([("organization_id", ASCENDING), ("date", ASCENDING), ("slot_start", ASCENDING)])
    await db.appointments.create_index([("organization_id", ASCENDING), ("status", ASCENDING), ("starts_at", ASCENDING)])
    await db.appointments.create_index([("organization_id", ASCENDING), ("doctor_id", ASCENDING), ("date", ASCENDING)])
    await db.appointments.create_index([("organization_id", ASCENDING), ("service_id", ASCENDING)])
    await db.appointments.create_index([("organization_id", ASCENDING), ("patient_id", ASCENDING), ("starts_at", DESCENDING)])
    await db.appointments.create_index([("organization_id", ASCENDING), ("patient_phone", ASCENDING), ("date", ASCENDING)])
    await db.appointments.create_index([("organization_id", ASCENDING), ("created_at", DESCENDING)])
    await db.appointment_status_history.create_index([("appointment_id", ASCENDING), ("created_at", ASCENDING)])
    await db.slot_reservations.create_index([("organization_id", ASCENDING), ("date", ASCENDING)])
    await db.capacity_overrides.create_index([("organization_id", ASCENDING), ("date", ASCENDING), ("slot_start", ASCENDING)], unique=True)
    await db.doctors.create_index([("organization_id", ASCENDING), ("slug", ASCENDING)], unique=True)
    await db.doctors.create_index([("organization_id", ASCENDING), ("is_active", ASCENDING)])
    await db.services.create_index([("organization_id", ASCENDING), ("slug", ASCENDING)], unique=True)
    await db.notifications.create_index("idempotency_key", unique=True, sparse=True)
    await db.notifications.create_index([("organization_id", ASCENDING), ("created_at", DESCENDING)])
    await db.notifications.create_index("appointment_id")
    await db.notifications.create_index("provider_message_id", sparse=True)
    await db.whatsapp_messages.create_index([("conversation_id", ASCENDING), ("created_at", DESCENDING)])
    await db.whatsapp_messages.create_index("provider_message_id", unique=True, sparse=True)
    await db.whatsapp_conversations.create_index([("organization_id", ASCENDING), ("phone", ASCENDING)], unique=True)
    await db.audit_logs.create_index([("organization_id", ASCENDING), ("created_at", DESCENDING)])
    await db.audit_logs.create_index([("resource", ASCENDING), ("resource_id", ASCENDING)])
    await db.analytics_events.create_index([("organization_id", ASCENDING), ("created_at", DESCENDING)])
    await db.analytics_events.create_index([("organization_id", ASCENDING), ("name", ASCENDING)])
    await db.callback_requests.create_index([("organization_id", ASCENDING), ("created_at", DESCENDING)])
    await db.testimonials.create_index([("organization_id", ASCENDING), ("is_published", ASCENDING)])
    await db.email_outbox.create_index("created_at")


def close_db() -> None:
    client.close()
