"""
app/api/v1/profile.py
──────────────────────
User profile endpoints:
  GET /api/v1/profile   — View current user's profile
  PUT /api/v1/profile   — Update full_name or password
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import UserOut, UserUpdate
from app.crud.user import update_user

router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get("", response_model=UserOut)
def get_profile(current_user: User = Depends(get_current_user)):
    """
    Returns the current logged-in user's profile information.
    No DB query needed — user is already loaded by get_current_user dependency.
    """
    return current_user


@router.put("", response_model=UserOut)
def update_profile(
    update_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update the current user's profile.
    Only fields provided in the request body will be updated.
    Both full_name and password are optional.
    """
    return update_user(db=db, user=current_user, update_data=update_data)
