"""
app/schemas/user.py
────────────────────
Pydantic schemas for user-related request/response validation.
These are NOT database models — they define what data goes IN and OUT of the API.
"""

from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


class UserCreate(BaseModel):
    """Used for POST /auth/register — data the client sends."""
    email: EmailStr
    full_name: str
    password: str
    face_image: Optional[str] = None   # base64-encoded webcam photo (optional)


class UserLogin(BaseModel):
    """Used for POST /auth/login."""
    email: EmailStr
    password: str


class UserOut(BaseModel):
    """Returned to client — never includes the password hash."""
    id: int
    email: str
    full_name: str
    phone_number: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True   # allows creating from SQLAlchemy model


class UserUpdate(BaseModel):
    """Used for PUT /profile — all fields are optional."""
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    password: Optional[str] = None


class Token(BaseModel):
    """Response from POST /auth/login."""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Internal: decoded token payload."""
    email: Optional[str] = None
