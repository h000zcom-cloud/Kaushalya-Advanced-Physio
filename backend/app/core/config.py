import os
from dataclasses import dataclass


def _env(name: str, default=None, required: bool = False):
    value = os.environ.get(name)
    if value in (None, "") and required:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value if value not in (None, "") else default


def _bool(name: str, default: bool = False) -> bool:
    return str(_env(name, str(default))).strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class AppConfig:
    mongo_url: str
    db_name: str
    jwt_secret: str
    environment: str
    cors_origins: list
    organization_id: str
    public_url: str | None
    admin_email: str | None
    admin_password: str | None
    admin_name: str
    seed_demo_data: bool
    cookie_secure: bool
    cookie_samesite: str
    access_token_minutes: int
    refresh_token_days: int
    whatsapp_phone_number_id: str | None
    whatsapp_access_token: str | None
    whatsapp_verify_token: str | None
    whatsapp_app_secret: str | None
    whatsapp_api_version: str
    resend_api_key: str | None
    email_from: str | None
    reminder_job_interval_seconds: int

    @property
    def whatsapp_configured(self) -> bool:
        return bool(self.whatsapp_phone_number_id and self.whatsapp_access_token)

    @property
    def whatsapp_webhook_configured(self) -> bool:
        return bool(self.whatsapp_verify_token and self.whatsapp_app_secret)

    @property
    def email_configured(self) -> bool:
        return bool(self.resend_api_key and self.email_from)

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


def load_config() -> AppConfig:
    return AppConfig(
        mongo_url=_env("MONGO_URL", required=True),
        db_name=_env("DB_NAME", required=True),
        jwt_secret=_env("JWT_SECRET", required=True),
        environment=_env("ENVIRONMENT", "development"),
        cors_origins=[o.strip() for o in _env("CORS_ORIGINS", "*").split(",") if o.strip()],
        organization_id=_env("ORGANIZATION_ID", "org_primary"),
        public_url=_env("PUBLIC_APP_URL"),
        admin_email=_env("ADMIN_EMAIL"),
        admin_password=_env("ADMIN_PASSWORD"),
        admin_name=_env("ADMIN_NAME", "Clinic Owner"),
        seed_demo_data=_bool("SEED_DEMO_DATA", False),
        cookie_secure=_bool("COOKIE_SECURE", True),
        cookie_samesite=_env("COOKIE_SAMESITE", "lax"),
        access_token_minutes=int(_env("ACCESS_TOKEN_MINUTES", "15")),
        refresh_token_days=int(_env("REFRESH_TOKEN_DAYS", "7")),
        whatsapp_phone_number_id=_env("WHATSAPP_PHONE_NUMBER_ID"),
        whatsapp_access_token=_env("WHATSAPP_ACCESS_TOKEN"),
        whatsapp_verify_token=_env("WHATSAPP_VERIFY_TOKEN"),
        whatsapp_app_secret=_env("WHATSAPP_APP_SECRET"),
        whatsapp_api_version=_env("WHATSAPP_API_VERSION", "v21.0"),
        resend_api_key=_env("RESEND_API_KEY"),
        email_from=_env("EMAIL_FROM"),
        reminder_job_interval_seconds=int(_env("REMINDER_JOB_INTERVAL_SECONDS", "300")),
    )


cfg = load_config()
