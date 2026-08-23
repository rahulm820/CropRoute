"""POST /api/auth/login, GET /api/me — issue #23 (docs/API.md "Auth").

No-password identity: login with name + role + state_id, get a JWT back.
The token is stateless — every protected endpoint verifies it independently.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from db.session import get_db
from models import ROLES, User
from services.auth_service import create_token, get_current_user

router = APIRouter()


class LoginRequest(BaseModel):
    name: str
    role: str
    state_id: int | None = None


def _user_dict(u: User) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "role": u.role,
        "state_id": u.state_id,
    }


@router.post("/auth/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Create or find a user by name+role, return a JWT.

    No password by design (PRODUCT.md "Identity").  The role must be one of
    the allowed values (farmer|wholesaler).  If a user with the exact
    name+role already exists, return it; otherwise create a new row.
    """
    role = body.role.strip().lower()
    if role not in ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"role must be one of {ROLES}",
        )

    user = db.scalars(
        select(User).where(
            User.name.ilike(body.name.strip()),
            User.role == role,
        )
    ).first()

    if user is None:
        user = User(
            name=body.name.strip(),
            role=role,
            state_id=body.state_id,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return {
        "token": create_token(user),
        "user": _user_dict(user),
    }


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    """Return the user for the bearer token.  401 if absent/invalid."""
    return _user_dict(user)
