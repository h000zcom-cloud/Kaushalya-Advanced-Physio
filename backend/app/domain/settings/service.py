import re
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.config import cfg
from app.core.database import db
from app.core.models import utc_now
from app.domain.settings.defaults import default_settings

HM = r"^([01]\d|2[0-3]):[0-5]\d$"
DATE = r"^\d{4}-\d{2}-\d{2}$"


class ClinicInfo(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    short_name: str = Field(min_length=2, max_length=60)
    tagline: str = Field(default="", max_length=200)
    contact_person: str = Field(default="", max_length=80)
    phone: str = Field(min_length=8, max_length=20)
    whatsapp_number: str = Field(min_length=8, max_length=20)
    email: str = Field(default="", max_length=120)
    address_line: str = Field(default="", max_length=240)
    city: str = Field(default="", max_length=80)
    state: str = Field(default="", max_length=80)
    pincode: str = Field(default="", max_length=12)
    map_url: str = Field(default="", max_length=500)
    timezone: str = Field(default="Asia/Kolkata", max_length=60)
    country_code: str = Field(default="+91", pattern=r"^\+\d{1,3}$")

    @field_validator("timezone")
    @classmethod
    def valid_tz(cls, v):
        from zoneinfo import ZoneInfo
        ZoneInfo(v)
        return v


class WorkingHours(BaseModel):
    weekday: int = Field(ge=0, le=6)
    is_open: bool
    open: str = Field(pattern=HM)
    close: str = Field(pattern=HM)


class Holiday(BaseModel):
    date: str = Field(pattern=DATE)
    label: str = Field(default="", max_length=80)


class BookingRules(BaseModel):
    slot_minutes: int = Field(ge=15, le=240)
    acceptance_mode: Literal["AUTO", "MANUAL", "PER_SERVICE"]
    assignment_mode: Literal["MANUAL", "AUTO", "HYBRID"]
    min_notice_hours: int = Field(ge=0, le=168)
    max_horizon_days: int = Field(ge=1, le=365)
    limited_threshold: float = Field(ge=0, le=1)
    default_doctor_capacity: int = Field(ge=1, le=50)


class NotificationRules(BaseModel):
    whatsapp_enabled: bool
    send_request_received: bool = True
    send_confirmation: bool = True
    send_reschedule: bool = True
    send_cancellation: bool = True
    reminders_enabled: bool
    reminder_hours_before: int = Field(ge=1, le=168)
    same_day_reminder_enabled: bool = False
    same_day_reminder_hours_before: int = Field(default=3, ge=1, le=24)
    templates: dict[str, str]


class WhatsAppRules(BaseModel):
    language_code: str = Field(default="en", max_length=10)
    template_names: dict[str, str]


class QA(BaseModel):
    question: str = Field(max_length=200)
    answer: str = Field(max_length=1000)


class Condition(BaseModel):
    key: str = Field(max_length=40)
    label: str = Field(max_length=60)
    description: str = Field(default="", max_length=200)
    service_slug: str = Field(max_length=80)


class TitleText(BaseModel):
    title: str = Field(max_length=120)
    text: str = Field(max_length=400)


class Content(BaseModel):
    hero_title: str = Field(max_length=120)
    hero_subtitle: str = Field(max_length=400)
    about_text: str = Field(max_length=2000)
    conditions: list[Condition]
    faqs: list[QA]
    journey_steps: list[TitleText]
    why_choose_us: list[TitleText]
    trust_points: list[str]


class SettingsUpdate(BaseModel):
    clinic: ClinicInfo
    working_hours: list[WorkingHours] = Field(min_length=7, max_length=7)
    holidays: list[Holiday]
    booking: BookingRules
    notifications: NotificationRules
    whatsapp: WhatsAppRules
    content: Content


async def get_settings() -> dict:
    doc = await db.clinic_settings.find_one({"_id": cfg.organization_id})
    if doc is None:
        doc = default_settings(cfg.organization_id)
        doc["created_at"] = doc["updated_at"] = utc_now()
        await db.clinic_settings.insert_one(doc)
    return doc


async def update_settings(data: SettingsUpdate) -> dict:
    payload = data.model_dump()
    payload["updated_at"] = utc_now()
    await db.clinic_settings.update_one({"_id": cfg.organization_id}, {"$set": payload})
    return await get_settings()


def public_settings(settings: dict) -> dict:
    clinic = settings["clinic"]
    digits = re.sub(r"\D", "", clinic["whatsapp_number"])
    return {
        "clinic": clinic,
        "working_hours": settings["working_hours"],
        "booking": {k: settings["booking"][k] for k in ("slot_minutes", "min_notice_hours", "max_horizon_days")},
        "content": settings["content"],
        "whatsapp_link": f"https://wa.me/{digits}",
    }
