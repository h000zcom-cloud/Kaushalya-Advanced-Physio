from fastapi import APIRouter, Depends, Request

from app.core.config import cfg
from app.core.deps import actor_of, require
from app.core.ratelimit import client_ip
from app.domain import audit
from app.domain.settings.service import SettingsUpdate, get_settings, update_settings

router = APIRouter(prefix="/admin/settings", tags=["admin:settings"])


def _serialize(settings: dict) -> dict:
    return {k: v for k, v in settings.items() if k != "_id"}


@router.get("")
async def read_settings(user=Depends(require("settings:read"))):
    return _serialize(await get_settings())


@router.put("")
async def write_settings(data: SettingsUpdate, request: Request, user=Depends(require("settings:write"))):
    before = await get_settings()
    after = await update_settings(data)
    changed = [k for k in data.model_dump().keys() if before.get(k) != after.get(k)]
    await audit.log(actor_of(user), "settings_changed", "clinic_settings", cfg.organization_id, {"sections": changed}, client_ip(request))
    return _serialize(after)


@router.get("/integrations")
async def integrations_status(user=Depends(require("settings:read"))):
    return {
        "whatsapp": {"configured": cfg.whatsapp_configured, "webhook_configured": cfg.whatsapp_webhook_configured, "api_version": cfg.whatsapp_api_version, "required_env": ["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET"], "webhook_url": f"{cfg.public_url or ''}/api/webhooks/whatsapp"},
        "email": {"configured": cfg.email_configured, "required_env": ["RESEND_API_KEY", "EMAIL_FROM"]},
        "environment": cfg.environment,
    }
