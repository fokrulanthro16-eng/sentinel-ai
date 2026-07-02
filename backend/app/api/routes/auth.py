"""Auth routes: register, login, me.

Users are stored in `sentinel_api_users` when DATABASE_URL is set,
falling back to the in-memory dict for zero-config local development.
Login and register endpoints are rate-limited to resist brute-force.
"""
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, status, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password, create_access_token
from app.core.limiter import limiter
from app.api.dependencies import require_auth
from app.db.database import get_optional_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# In-memory fallback when DATABASE_URL is not configured
_users: dict[str, dict] = {}


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str | None = None
    email: EmailStr
    password: str
    role: str = "USER"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ── DB helpers (dual-mode) ────────────────────────────────────────────────────

async def _find_user(email: str, session: Optional[AsyncSession]) -> Optional[dict]:
    if session is None:
        return _users.get(email)
    from app.models.user import User
    result = await session.execute(select(User).where(User.email == email))
    row = result.scalar_one_or_none()
    if row is None:
        return None
    return {
        "id": row.id,
        "name": row.name,
        "email": row.email,
        "password": row.password,
        "role": row.role,
    }


async def _save_user(user: dict, session: Optional[AsyncSession]) -> None:
    if session is None:
        _users[user["email"]] = user
        return
    from app.models.user import User
    db_user = User(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        password=user["password"],
        role=user["role"],
    )
    session.add(db_user)
    await session.commit()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/register", response_model=AuthResponse, status_code=201)
@limiter.limit("5/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    session: Optional[AsyncSession] = Depends(get_optional_session),
):
    try:
        if len(body.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

        email = body.email.lower().strip()
        if await _find_user(email, session):
            raise HTTPException(status_code=409, detail="Email already registered")

        user_id = str(uuid.uuid4())
        hashed = hash_password(body.password)
        user = {
            "id": user_id,
            "name": body.name,
            "email": email,
            "password": hashed,
            "role": "USER",
        }
        await _save_user(user, session)

        token = create_access_token({"sub": user_id, "email": email, "role": "USER"})
        logger.info("User registered: %s", email)
        return AuthResponse(
            access_token=token,
            user={"id": user_id, "email": email, "name": body.name, "role": "USER"},
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Registration failed for %s", body.email)
        raise HTTPException(status_code=500, detail="Registration failed. Check server logs.")


@router.post("/login", response_model=AuthResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    body: LoginRequest,
    session: Optional[AsyncSession] = Depends(get_optional_session),
):
    try:
        email = body.email.lower().strip()
        user = await _find_user(email, session)
        if not user or not verify_password(body.password, user["password"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        token = create_access_token(
            {"sub": user["id"], "email": email, "role": user["role"]}
        )
        logger.info("User logged in: %s", email)
        return AuthResponse(
            access_token=token,
            user={"id": user["id"], "email": email, "name": user.get("name"), "role": user["role"]},
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Login failed for %s", body.email)
        raise HTTPException(status_code=500, detail="Login failed. Check server logs.")


@router.get("/me")
async def me(current_user: dict = Depends(require_auth)):
    return {
        "id": current_user.get("sub"),
        "email": current_user.get("email"),
        "role": current_user.get("role"),
    }
