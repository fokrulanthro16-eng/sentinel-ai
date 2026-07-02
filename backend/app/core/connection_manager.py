"""WebSocket connection manager with optional Redis Pub/Sub.

Single-instance (default): broadcasts directly to in-memory connections.
Multi-instance (REDIS_URL set): publishes to a Redis channel so every
pod receives the message and relays it to its own local WS connections.
"""
import asyncio
import json
import logging
from typing import Optional
from uuid import uuid4

from fastapi import WebSocket

logger = logging.getLogger(__name__)

_REDIS_CHANNEL = "sentinel:ws:broadcast"


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, WebSocket] = {}
        self._lock = asyncio.Lock()
        self._redis_pub = None
        self._redis_sub = None
        self._sub_task: Optional[asyncio.Task] = None

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def startup(self) -> None:
        """Call from app lifespan to connect Redis when REDIS_URL is set."""
        from app.core.config import settings
        if not settings.REDIS_URL:
            logger.info("WebSocket manager: in-memory mode (no REDIS_URL)")
            return
        try:
            import redis.asyncio as aioredis
            self._redis_pub = aioredis.from_url(
                settings.REDIS_URL, decode_responses=True
            )
            sub_client = aioredis.from_url(
                settings.REDIS_URL, decode_responses=True
            )
            self._redis_sub = sub_client.pubsub()
            await self._redis_sub.subscribe(_REDIS_CHANNEL)
            self._sub_task = asyncio.create_task(self._listen_redis())
            logger.info(
                "WebSocket manager: Redis Pub/Sub enabled — channel=%s", _REDIS_CHANNEL
            )
        except Exception as exc:
            logger.warning(
                "WebSocket manager: Redis unavailable (%s) — falling back to in-memory", exc
            )
            self._redis_pub = None
            self._redis_sub = None

    async def shutdown(self) -> None:
        """Call from app lifespan on shutdown."""
        if self._sub_task:
            self._sub_task.cancel()
            try:
                await self._sub_task
            except asyncio.CancelledError:
                pass
        if self._redis_sub:
            await self._redis_sub.aclose()
        if self._redis_pub:
            await self._redis_pub.aclose()

    # ── Public API ────────────────────────────────────────────────────────────

    @property
    def count(self) -> int:
        return len(self._connections)

    async def connect(self, ws: WebSocket) -> str:
        await ws.accept()
        client_id = uuid4().hex[:8]
        async with self._lock:
            self._connections[client_id] = ws
        await self._send_direct(
            ws, {"type": "connected", "client_id": client_id, "online_count": self.count}
        )
        await self._broadcast_count()
        logger.info("WS connect  %s  (total: %d)", client_id, self.count)
        return client_id

    async def disconnect(self, client_id: str) -> None:
        async with self._lock:
            self._connections.pop(client_id, None)
        await self._broadcast_count()
        logger.info("WS disconnect %s  (total: %d)", client_id, self.count)

    async def broadcast(self, message: dict) -> int:
        """Broadcast to all instances via Redis, or locally if Redis is unavailable."""
        if self._redis_pub is not None:
            try:
                await self._redis_pub.publish(
                    _REDIS_CHANNEL, json.dumps(message, default=str)
                )
                # Delivery to local WS connections happens via _listen_redis
                return self.count
            except Exception as exc:
                logger.warning("Redis publish failed (%s) — local fallback", exc)
        return await self._broadcast_local(message)

    async def send_to(self, client_id: str, message: dict) -> bool:
        ws = self._connections.get(client_id)
        if not ws:
            return False
        return await self._send_direct(ws, message)

    # ── Internal ──────────────────────────────────────────────────────────────

    async def _listen_redis(self) -> None:
        """Background task: relay messages from Redis to local WS connections."""
        try:
            async for message in self._redis_sub.listen():
                if message["type"] == "message":
                    try:
                        await self._broadcast_local(json.loads(message["data"]))
                    except Exception:
                        pass
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.error("Redis subscriber error: %s", exc)

    async def _broadcast_local(self, message: dict) -> int:
        """Send message to every WS connection on this instance."""
        if not self._connections:
            return 0
        data = json.dumps(message, default=str)
        snapshot = dict(self._connections)
        dead: list[str] = []

        async def _send(cid: str, sock: WebSocket) -> bool:
            try:
                await sock.send_text(data)
                return True
            except Exception:
                dead.append(cid)
                return False

        results = await asyncio.gather(*[_send(cid, s) for cid, s in snapshot.items()])
        if dead:
            async with self._lock:
                for cid in dead:
                    self._connections.pop(cid, None)
        return sum(1 for r in results if r)

    @staticmethod
    async def _send_direct(ws: WebSocket, message: dict) -> bool:
        try:
            await ws.send_text(json.dumps(message, default=str))
            return True
        except Exception:
            return False

    async def _broadcast_count(self) -> None:
        """Announce local connection count — stays local, not cross-instance."""
        if self._connections:
            await self._broadcast_local({"type": "online_count", "count": self.count})


# Module-level singleton shared by all routes on this instance
manager = ConnectionManager()
