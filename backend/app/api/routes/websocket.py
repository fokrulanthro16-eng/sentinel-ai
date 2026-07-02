"""WebSocket endpoint — real-time incident push for all connected clients."""
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.connection_manager import manager

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    client_id = await manager.connect(ws)
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except ValueError:
                continue

            if msg.get("type") == "ping":
                await manager.send_to(client_id, {"type": "pong", "ts": msg.get("ts", 0)})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug("WS error client=%s: %s", client_id, e)
    finally:
        await manager.disconnect(client_id)
