"""Shared slowapi rate-limiter instance.

Auth endpoints apply per-IP limits to prevent brute-force attacks.
SlowAPI uses in-memory storage by default; set REDIS_URL to share
limits across multiple workers/instances.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address


def _make_limiter() -> Limiter:
    from app.core.config import settings
    if settings.REDIS_URL:
        return Limiter(key_func=get_remote_address, storage_uri=settings.REDIS_URL)
    return Limiter(key_func=get_remote_address)


# Initialised lazily so config is available at import time
limiter = _make_limiter()
