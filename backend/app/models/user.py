"""SQLAlchemy ORM model for FastAPI-managed users.

Uses a separate `sentinel_api_users` table so SQLAlchemy and Prisma
(which manages the `users` table) never conflict.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, String
from sqlalchemy.sql import func

from app.db.database import Base


class User(Base):
    __tablename__ = "sentinel_api_users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="USER")
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
