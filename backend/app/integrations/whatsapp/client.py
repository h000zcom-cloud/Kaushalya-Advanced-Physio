import logging

import httpx

from app.core.config import cfg

logger = logging.getLogger("app.whatsapp")


class WhatsAppError(Exception):
    def __init__(self, status_code: int, safe_message: str):
        self.status_code = status_code
        self.safe_message = safe_message
        super().__init__(safe_message)


class WhatsAppClient:
    @property
    def is_configured(self) -> bool:
        return cfg.whatsapp_configured

    def _url(self) -> str:
        return f"https://graph.facebook.com/{cfg.whatsapp_api_version}/{cfg.whatsapp_phone_number_id}/messages"

    async def _post(self, payload: dict) -> str:
        if not self.is_configured:
            raise WhatsAppError(503, "WhatsApp Business API is not configured.")
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(self._url(), headers={"Authorization": f"Bearer {cfg.whatsapp_access_token}"}, json=payload)
        except httpx.HTTPError:
            raise WhatsAppError(503, "Could not reach the WhatsApp API. Will retry.")
        if response.status_code >= 400:
            try:
                err = response.json().get("error", {})
                message = f"WhatsApp API error {err.get('code', response.status_code)}: {err.get('message', 'request rejected')}"
            except ValueError:
                message = f"WhatsApp API error {response.status_code}"
            raise WhatsAppError(response.status_code, message[:300])
        return response.json()["messages"][0]["id"]

    async def send_text(self, to_digits: str, body: str) -> str:
        return await self._post({"messaging_product": "whatsapp", "recipient_type": "individual", "to": to_digits, "type": "text", "text": {"preview_url": False, "body": body}})

    async def send_template(self, to_digits: str, template_name: str, language_code: str, params: list[str]) -> str:
        components = [{"type": "body", "parameters": [{"type": "text", "text": p} for p in params]}]
        return await self._post({"messaging_product": "whatsapp", "to": to_digits, "type": "template", "template": {"name": template_name, "language": {"code": language_code}, "components": components}})


whatsapp = WhatsAppClient()
