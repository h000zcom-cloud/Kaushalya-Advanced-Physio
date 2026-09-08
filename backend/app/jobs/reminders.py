import logging
from datetime import timedelta

from app.core.database import db, q
from app.core.models import utc_now
from app.domain.notifications import service as notifications
from app.domain.settings.service import get_settings

logger = logging.getLogger("app.jobs.reminders")


async def run_reminders() -> int:
    settings = await get_settings()
    rules = settings["notifications"]
    if not rules.get("reminders_enabled") or not rules.get("whatsapp_enabled"):
        return 0
    windows = [("reminder_24h", rules["reminder_hours_before"])]
    if rules.get("same_day_reminder_enabled"):
        windows.append(("reminder_same_day", rules["same_day_reminder_hours_before"]))
    now = utc_now()
    queued = 0
    for key, hours in windows:
        cursor = db.appointments.find(q(status={"$in": ["CONFIRMED", "ASSIGNED"]}, starts_at={"$gt": now, "$lte": now + timedelta(hours=hours)}))
        async for appt in cursor:
            if appt["created_at"] > appt["starts_at"] - timedelta(hours=hours):
                continue
            doc = await notifications.queue_whatsapp("appointment_reminder_due", appt, settings, idempotency_key=f"{appt['_id']}:{key}:whatsapp")
            if doc:
                queued += 1
                await notifications.create_dashboard_notification("appointment_reminder_due", appt, f"Reminder queued for {appt['public_id']}")
    if queued:
        logger.info("Queued %d reminder(s)", queued)
    return queued
