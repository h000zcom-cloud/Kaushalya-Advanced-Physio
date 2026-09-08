from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.cors import CORSMiddleware

from app.core.config import cfg
from app.core.database import close_db, db, ensure_indexes
from app.core.errors import register_error_handlers
from app.core.middleware import SecurityHeadersMiddleware
from app.core.ratelimit import limiter, rate_limit_handler
from app.domain.appointments.router import router as appointments_router
from app.domain.auth.router import router as auth_router
from app.domain.callbacks.router import router as callbacks_router
from app.domain.dashboard.router import router as dashboard_router
from app.domain.doctors.router import router as doctors_router
from app.domain.patients.router import router as patients_router
from app.domain.public.router import router as public_router
from app.domain.scheduling.router import router as schedule_router
from app.domain.services.router import router as services_router
from app.domain.settings.router import router as settings_router
from app.domain.testimonials.router import router as testimonials_router
from app.domain.users.router import router as users_router
from app.integrations.whatsapp.router import router as whatsapp_webhook_router
from app.jobs.scheduler import start_jobs, stop_jobs
from app.seed import run_seed

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_: FastAPI):
    await ensure_indexes()
    await run_seed()
    start_jobs()
    logger.info("Application started (env=%s, whatsapp_configured=%s)", cfg.environment, cfg.whatsapp_configured)
    yield
    stop_jobs()
    close_db()


app = FastAPI(title="Kaushalya Physio Platform API", version="1.0.0", lifespan=lifespan, docs_url=None if cfg.is_production else "/api/docs", openapi_url=None if cfg.is_production else "/api/openapi.json")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)
register_error_handlers(app)

api = APIRouter(prefix="/api")


@api.get("/health")
async def health():
    try:
        await db.command("ping")
        database = "ok"
    except Exception:
        database = "unavailable"
    return {"status": "ok" if database == "ok" else "degraded", "database": database, "environment": cfg.environment, "whatsapp_configured": cfg.whatsapp_configured, "email_configured": cfg.email_configured, "version": app.version}


for r in (auth_router, public_router, appointments_router, patients_router, doctors_router, services_router, schedule_router, settings_router, testimonials_router, callbacks_router, dashboard_router, users_router, whatsapp_webhook_router):
    api.include_router(r)

app.include_router(api)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=cfg.cors_origins, allow_methods=["*"], allow_headers=["*"])
