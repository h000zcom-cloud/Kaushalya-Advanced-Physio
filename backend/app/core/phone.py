import re

from app.core.errors import AppError


def normalize_phone(raw: str, country_code: str = "+91") -> str:
    digits = re.sub(r"\D", "", raw or "")
    cc = country_code.lstrip("+")
    if digits.startswith("00"):
        digits = digits[2:]
    if len(digits) == 10 + len(cc) and digits.startswith(cc):
        digits = digits[len(cc):]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) != 10 or digits[0] not in "6789":
        raise AppError(422, "invalid_phone", "Please enter a valid 10-digit mobile number.", {"field": "phone"})
    return f"+{cc}{digits}"


def phone_digits(phone: str) -> str:
    return re.sub(r"\D", "", phone or "")


def display_phone(phone: str) -> str:
    d = phone_digits(phone)
    return f"+{d[:-10]} {d[-10:-5]} {d[-5:]}" if len(d) > 10 else phone
