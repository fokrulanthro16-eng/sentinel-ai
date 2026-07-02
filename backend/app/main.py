"""Sentinel AI — Community ActionGrid Backend"""
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.limiter import limiter
from app.core.connection_manager import manager
from app.api.routes import incidents, ai, ai_settings, alerts, resources, auth, websocket, intelligence, analytics


def _configure_logging() -> None:
    try:
        from pythonjsonlogger import jsonlogger
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            jsonlogger.JsonFormatter(
                "%(asctime)s %(name)s %(levelname)s %(message)s",
                datefmt="%Y-%m-%dT%H:%M:%SZ",
            )
        )
        logging.root.handlers = [handler]
        logging.root.setLevel(logging.INFO)
    except ImportError:
        logging.basicConfig(level=logging.INFO)


_configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.db.database import init_db, create_tables
    db_ready = init_db()
    if db_ready:
        await create_tables()
        logger.info("PostgreSQL connected — tables created/verified")
    else:
        logger.info("No DATABASE_URL — in-memory mock store active")

    _INSECURE_KEY = "dev-secret-key-change-in-production"
    if settings.SECRET_KEY == _INSECURE_KEY:
        logger.warning(
            "WARNING: SECRET_KEY is set to the default development value. "
            "Set a strong SECRET_KEY in your .env file before deploying to production."
        )

    await manager.startup()

    logger.info("Sentinel AI backend starting — %s", settings.APP_VERSION)
    logger.info(
        "AI mode: %s",
        "Gemini connected" if settings.GEMINI_API_KEY else "MOCK (no GEMINI_API_KEY)",
    )
    logger.info(
        "Intelligence: weather=%s  firms=%s  nasa_power=free",
        "OpenWeatherMap" if settings.OPENWEATHER_API_KEY else "mock",
        "NASA FIRMS" if settings.NASA_FIRMS_API_KEY else "mock",
    )
    logger.info(
        "Notifications: sms=%s  email=%s  whatsapp=%s",
        "live" if settings.SMS_GATEWAY_URL else "MOCK",
        "live" if settings.EMAIL_SMTP_HOST else "MOCK",
        "live" if settings.WHATSAPP_TOKEN else "MOCK",
    )
    logger.info(
        "WebSocket: %s",
        f"Redis Pub/Sub ({settings.REDIS_URL})" if settings.REDIS_URL else "in-memory (single-instance)",
    )
    yield
    await manager.shutdown()
    logger.info("Sentinel AI backend shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Real-time community disaster response platform powered by Gemini AI.",
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(incidents.router)
app.include_router(ai.router)
app.include_router(ai_settings.router)
app.include_router(alerts.router)
app.include_router(resources.router)
app.include_router(auth.router)
app.include_router(websocket.router)
app.include_router(intelligence.router)
app.include_router(analytics.router)


@app.get("/", tags=["health"])
async def root():
    from app.db.database import db_enabled
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "operational",
        "docs": "/docs",
        "ai_enabled": bool(settings.GEMINI_API_KEY),
        "db_mode": "postgresql" if db_enabled() else "mock",
        "ws_mode": "redis" if settings.REDIS_URL else "memory",
    }


@app.get("/health", tags=["health"])
async def health():
    return JSONResponse({"status": "ok"})
