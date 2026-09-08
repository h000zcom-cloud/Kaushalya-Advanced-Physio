from datetime import timedelta

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from app.core.config import cfg
from app.core.database import db, q
from app.core.deps import actor_of, require
from app.core.models import to_public
from app.core.phone import normalize_phone
from app.core.ratelimit import client_ip
from app.core.timeutil import now_local
from app.domain import audit
from app.domain.appointments.service import serialize as serialize_appt
from app.domain.notifications import service as notifications
from app.domain.scheduling import engine
from app.domain.scheduling.engine import ACTIVE_STATUSES
from app.domain.settings.service import get_settings

router = APIRouter(prefix="/admin", tags=["admin:dashboard"])


@router.get("/dashboard/overview")
async def overview(user=Depends(require("appointments:read"))):
    settings = await get_settings()
    now = now_local(settings)
    today = now.date()
    iso = today.isoformat()
    week_end = (today + timedelta(days=7)).isoformat()
    pipeline = [{"$match": q(date=iso)}, {"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    today_counts = {row["_id"]: row["count"] async for row in db.appointments.aggregate(pipeline)}
    ctx = await engine.load_context([today])
    slots = engine.summarize_day(settings, ctx, today, None)
    todays = await db.appointments.find(q(date=iso)).sort("slot_start", 1).to_list(2000)
    upcoming = await db.appointments.find(q(date={"$gt": iso, "$lte": week_end}, status={"$in": list(ACTIVE_STATUSES)})).sort([("date", 1), ("slot_start", 1)]).limit(10).to_list(10)
    recent_patients = await db.patients.find(q()).sort("created_at", -1).limit(6).to_list(6)
    activity = await db.audit_logs.find(q()).sort("created_at", -1).limit(12).to_list(12)
    return {
        "date": iso,
        "stats": {
            "today_total": sum(today_counts.values()),
            "new_requests": await db.appointments.count_documents(q(status="NEW")),
            "awaiting_confirmation": await db.appointments.count_documents(q(status={"$in": ["NEW", "CONTACTED", "RESCHEDULED"]}, date={"$gte": iso})),
            "confirmed_today": today_counts.get("CONFIRMED", 0) + today_counts.get("ASSIGNED", 0),
            "completed_today": today_counts.get("COMPLETED", 0),
            "needs_assignment": await db.appointments.count_documents(q(needs_manual_assignment=True, status={"$in": list(ACTIVE_STATUSES)}, date={"$gte": iso})),
            "pending_callbacks": await db.callback_requests.count_documents(q(status="NEW")),
        },
        "capacity": [{k: s[k] for k in ("slot_start", "slot_end", "capacity", "booked", "remaining", "status")} for s in slots],
        "today": [serialize_appt(a) for a in todays],
        "upcoming": [serialize_appt(a) for a in upcoming],
        "recent_patients": [to_public(p) for p in recent_patients],
        "activity": [to_public(a) for a in activity],
        "integrations": {"whatsapp_configured": cfg.whatsapp_configured},
    }


@router.get("/analytics")
async def analytics(days: int = Query(30, ge=7, le=180), user=Depends(require("analytics:read"))):
    settings = await get_settings()
    today = now_local(settings).date()
    start = today - timedelta(days=days - 1)
    month_start = today.replace(day=1).isoformat()
    base = q(date={"$gte": start.isoformat(), "$lte": today.isoformat()})
    status_rows = {r["_id"]: r["count"] async for r in db.appointments.aggregate([{"$match": base}, {"$group": {"_id": "$status", "count": {"$sum": 1}}}])}
    trend_rows = {r["_id"]: r["count"] async for r in db.appointments.aggregate([{"$match": base}, {"$group": {"_id": "$date", "count": {"$sum": 1}}}])}
    services_rows = [{"service_name": r["_id"], "count": r["count"]} async for r in db.appointments.aggregate([{"$match": base}, {"$group": {"_id": "$service_name", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": 8}])]
    doctor_rows = [{"doctor_name": r["_id"] or "Unassigned", "count": r["count"]} async for r in db.appointments.aggregate([{"$match": base}, {"$group": {"_id": "$doctor_name", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": 8}])]
    util_days = [today - timedelta(days=i) for i in range(min(days, 14) - 1, -1, -1)]
    ctx = await engine.load_context(util_days)
    utilization = []
    for day in util_days:
        slots = engine.summarize_day(settings, ctx, day, None)
        utilization.append({"date": day.isoformat(), "capacity": sum(s["capacity"] for s in slots), "booked": sum(s["booked"] for s in slots)})
    events = {r["_id"]: r["count"] async for r in db.analytics_events.aggregate([{"$match": q(created_at={"$gte": now_local(settings) - timedelta(days=days)})}, {"$group": {"_id": "$name", "count": {"$sum": 1}}}])}
    return {
        "range": {"from": start.isoformat(), "to": today.isoformat(), "days": days},
        "totals": {
            "today": await db.appointments.count_documents(q(date=today.isoformat())),
            "this_month": await db.appointments.count_documents(q(date={"$gte": month_start})),
            "new_patients": await db.patients.count_documents(q(created_at={"$gte": now_local(settings) - timedelta(days=days)})),
            "completed": status_rows.get("COMPLETED", 0),
            "cancelled": status_rows.get("CANCELLED", 0),
            "no_show": status_rows.get("NO_SHOW", 0),
            "total": sum(status_rows.values()),
        },
        "status_breakdown": [{"status": k, "count": v} for k, v in status_rows.items()],
        "trend": [{"date": (start + timedelta(days=i)).isoformat(), "count": trend_rows.get((start + timedelta(days=i)).isoformat(), 0)} for i in range(days)],
        "popular_services": services_rows,
        "doctor_load": doctor_rows,
        "utilization": utilization,
        "web_events": events,
    }


@router.get("/search")
async def global_search(query: str = Query(min_length=2, max_length=80), user=Depends(require("appointments:read"))):
    term = query.strip()
    digits = "".join(ch for ch in term if ch.isdigit())
    appt_or = [{"public_id": {"$regex": term, "$options": "i"}}, {"patient_name": {"$regex": term, "$options": "i"}}]
    patient_or = [{"name": {"$regex": term, "$options": "i"}}]
    if len(digits) >= 4:
        appt_or.append({"patient_phone": {"$regex": digits}})
        patient_or.append({"phone": {"$regex": digits}})
    appts = await db.appointments.find(q(**{"$or": appt_or})).sort("starts_at", -1).limit(8).to_list(8)
    patients = await db.patients.find(q(**{"$or": patient_or})).sort("created_at", -1).limit(8).to_list(8)
    return {"appointments": [serialize_appt(a) for a in appts], "patients": [to_public(p) for p in patients]}


@router.get("/audit-logs")
async def audit_logs(action: str | None = None, resource: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200), user=Depends(require("audit:read"))):
    filters = q()
    if action:
        filters["action"] = action
    if resource:
        filters["resource"] = resource
    total = await db.audit_logs.count_documents(filters)
    items = await db.audit_logs.find(filters).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    return {"items": [to_public(i) for i in items], "total": total}


@router.get("/notifications")
async def list_notifications(channel: str | None = None, status: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200), user=Depends(require("messages:read"))):
    filters = q()
    if channel:
        filters["channel"] = channel
    if status:
        filters["status"] = status
    total = await db.notifications.count_documents(filters)
    items = await db.notifications.find(filters).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    return {"items": [to_public(i) for i in items], "total": total, "whatsapp_configured": cfg.whatsapp_configured}


@router.post("/notifications/{notification_id}/retry")
async def retry_notification(notification_id: str, request: Request, user=Depends(require("appointments:write"))):
    doc = await db.notifications.find_one(q(_id=notification_id, channel="whatsapp"))
    if not doc:
        return {"retried": False}
    if not cfg.whatsapp_configured:
        return {"retried": False, "reason": "WhatsApp Business API is not configured."}
    await db.notifications.update_one({"_id": notification_id}, {"$set": {"status": "queued", "attempts": 0}})
    await notifications.deliver(notification_id)
    await audit.log(actor_of(user), "notification_retried", "notification", notification_id, {}, client_ip(request))
    return {"retried": True, "notification": to_public(await db.notifications.find_one({"_id": notification_id}))}


@router.get("/conversations")
async def conversations(user=Depends(require("messages:read"))):
    convs = await db.whatsapp_conversations.find(q()).sort("last_message_at", -1).limit(100).to_list(100)
    return {"items": [to_public(c) for c in convs], "whatsapp_configured": cfg.whatsapp_configured, "webhook_configured": cfg.whatsapp_webhook_configured}


@router.get("/conversations/{conversation_id}/messages")
async def conversation_messages(conversation_id: str, user=Depends(require("messages:read"))):
    await db.whatsapp_conversations.update_one(q(_id=conversation_id), {"$set": {"unread_count": 0}})
    msgs = await db.whatsapp_messages.find(q(conversation_id=conversation_id)).sort("created_at", 1).limit(500).to_list(500)
    return {"items": [to_public(m) for m in msgs]}


@router.get("/email-outbox")
async def email_outbox(user=Depends(require("settings:write"))):
    items = await db.email_outbox.find({}).sort("created_at", -1).limit(50).to_list(50)
    return {"items": [to_public(i) for i in items], "email_configured": cfg.email_configured}


@router.post("/jobs/run-reminders")
async def run_reminders_now(request: Request, user=Depends(require("settings:write"))):
    from app.jobs.reminders import run_reminders
    sent = await run_reminders()
    retried = await notifications.retry_failed()
    await audit.log(actor_of(user), "reminder_job_run", "jobs", None, {"queued": sent, "retried": retried}, client_ip(request))
    return {"queued": sent, "retried": retried}
