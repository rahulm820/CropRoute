"""JWT auth helpers — issue #23, docs/API.md "Auth".

No-password identity: login sends name + role + state_id, server returns a
signed JWT containing the user row.  The token is stateless; every protected
endpoint verifies it via ``get_current_user``.

Token payload: {"sub": user_id, "name": ..., "role": ..., "state_id": ...}
Expiry: 30 days.  HMAC-SHA256 via PyJWT.
"""

import logging
import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from db.session import get_db
from models import User

log = logging.getLogger(__name__)

_ALGORITHM = "HS256"
_TOKEN_TTL_DAYS = 30

_bearer = HTTPBearer(auto_error=False)


def _secret() -> str:
    secret = os.getenv("JWT_SECRET", "").strip()
    if not secret:
        raise RuntimeError(
            "JWT_SECRET is not set — generate one with "
            "'python -c \"import secrets; print(secrets.token_urlsafe(32))\"' "
            "and add it to infra/.env (see infra/.env.example)"
        )
    return secret


def create_token(user: User) -> str:
    """Sign a JWT for the given user.  Returns the encoded token string."""
    now = datetime.now(timezone.utc)
    payload = {
        # PyJWT >=2.10 requires `sub` to be a string - int subs fail on decode
        "sub": str(user.id),
        "name": user.name,
        "role": user.role,
        "state_id": user.state_id,
        "iat": now,
        "exp": now + timedelta(days=_TOKEN_TTL_DAYS),
    }
    return jwt.encode(payload, _secret(), algorithm=_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and verify a JWT.  Raises HTTPException(401) on any failure."""
    try:
        return jwt.decode(token, _secret(), algorithms=[_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token expired",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid token",
        )


def get_current_user(
    cred: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency — resolves the bearer token to a User row.

    Raises 401 if the token is missing, expired, or references a deleted user.
    """
    if cred is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing bearer token",
        )
    payload = decode_token(cred.credentials)
    raw_sub = payload.get("sub")
    try:
        user_id = int(raw_sub)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token missing user id",
        )
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="user not found",
        )
    return user


def require_farmer(user: User = Depends(get_current_user)) -> User:
    """FastAPI dependency — chain after ``get_current_user`` to enforce farmer role."""
    if user.role != "farmer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="farmer role required",
        )
    return user
