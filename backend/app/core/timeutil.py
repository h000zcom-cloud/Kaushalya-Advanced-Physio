from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.core.errors import AppError


def tz_of(settings: dict) -> ZoneInfo:
    return ZoneInfo(settings["clinic"].get("timezone") or "Asia/Kolkata")


def now_local(settings: dict) -> datetime:
    return datetime.now(tz_of(settings))


def parse_hm(value: str) -> int:
    hours, minutes = value.split(":")
    return int(hours) * 60 + int(minutes)


def fmt_hm(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        raise AppError(422, "invalid_date", "Please choose a valid date.", {"field": "date"})


def local_datetime(settings: dict, day: date, hm: str) -> datetime:
    minutes = parse_hm(hm)
    return datetime.combine(day, time(minutes // 60, minutes % 60), tzinfo=tz_of(settings))


def date_range(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def human_date(value: str) -> str:
    return date.fromisoformat(value).strftime("%a, %d %b %Y")


def human_time(hm: str) -> str:
    minutes = parse_hm(hm)
    suffix = "AM" if minutes < 720 else "PM"
    hour = minutes // 60 % 12 or 12
    return f"{hour}:{minutes % 60:02d} {suffix}"
