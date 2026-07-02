"""Async SQLAlchemy engine and session factory.

When DATABASE_URL is configured (and contains asyncpg/postgresql),
this module provides a real PostgreSQL connection via create_all() on startup.
When DATABASE_URL is empty the module stays uninitialised and all callers
transparently fall back to the in-memory mock store in mock_data.py.
"""
from __future__ import annotations

from typing import AsyncGenerator, Optional

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    pass


_engine = None
_session_factory: Optional[async_sessionmaker] = None


def _normalise_url(url: str) -> str:
    """Convert sync postgresql:// to the asyncpg driver URL if needed."""
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


def init_db() -> bool:
    """Initialise engine; returns True when a real DB is configured."""
    global _engine, _session_factory
    if not settings.DATABASE_URL:
        return False
    url = _normalise_url(settings.DATABASE_URL)
    try:
        _engine = create_async_engine(
            url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            echo=False,
        )
        _session_factory = async_sessionmaker(
            _engine, class_=AsyncSession, expire_on_commit=False
        )
        return True
    except Exception:
        return False


async def create_tables() -> None:
    """Create all registered ORM tables. Idempotent — safe every startup."""
    if _engine is None:
        return
    import app.models  # noqa: F401 — imports __init__ which registers all ORM models with Base
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_optional_session() -> AsyncGenerator[Optional[AsyncSession], None]:
    """FastAPI dependency — yields an AsyncSession or None (mock mode)."""
    if _session_factory is None:
        yield None
        return
    async with _session_factory() as session:
        yield session


def db_enabled() -> bool:
    return _engine is not None
