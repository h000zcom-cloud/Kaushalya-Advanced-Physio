import asyncio
import logging

from app.core.config import cfg
from app.domain.notifications import service as notifications
from app.jobs.reminders import run_reminders

logger = logging.getLogger("app.jobs")
_task: asyncio.Task | None = None


async def _loop() -> None:
    await asyncio.sleep(10)
    while True:
        try:
            await run_reminders()
            await notifications.retry_failed()
        except Exception:
            logger.exception("Background job cycle failed")
        await asyncio.sleep(cfg.reminder_job_interval_seconds)


def start_jobs() -> None:
    global _task
    if _task is None:
        _task = asyncio.create_task(_loop())


def stop_jobs() -> None:
    global _task
    if _task:
        _task.cancel()
        _task = None
