"""
Authentication utilities for Folio.
"""
import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import bcrypt as _bcrypt
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import User

SECRET_KEY = os.environ.get("SECRET_KEY", "folio-dev-secret-change-in-production-please")
ALGORITHM  = "HS256"
TOKEN_EXPIRE_HOURS = 24 * 7    # 7-day tokens

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ── Password utils ────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ── JWT utils ─────────────────────────────────────────────────────────────────

def create_access_token(user_id: int, role: str) -> str:
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


# ── FastAPI dependencies ──────────────────────────────────────────────────────

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exc
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


# ── Seed default admin ────────────────────────────────────────────────────────

async def ensure_default_admin(db: AsyncSession) -> None:
    """Create the default admin account if no users exist."""
    result = await db.execute(select(User))
    if result.scalars().first() is not None:
        return

    admin = User(
        username="admin",
        email="admin@folio.local",
        display_name="Administrator",
        password_hash=hash_password("admin123"),
        role="admin",
        is_active=True,
    )
    db.add(admin)
    await db.commit()
    print("[Folio] Default admin created — username: admin / password: admin123")
    print("[Folio] CHANGE THIS PASSWORD IMMEDIATELY via Admin > Users")
