"""
app/api/v1/auth.py
───────────────────
Authentication endpoints:
  POST /api/v1/auth/register       — Create a new user account
  POST /api/v1/auth/login          — Login and receive JWT token
  POST /api/v1/auth/reset-password — Reset password by email
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.db.database import get_db
from app.schemas.user import UserCreate, UserLogin, UserOut, Token
from app.crud.user import get_user_by_email, create_user
from app.core.security import verify_password, create_access_token, hash_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user account.

    - Checks if the email is already taken
    - Hashes the password before saving
    - Returns the created user (WITHOUT the password)

    HTTP 409 if the email already exists.
    """
    existing_user = get_user_by_email(db, email=user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An account with email '{user_data.email}' already exists.",
        )
    return create_user(db=db, user_data=user_data)


@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Login with email and password.

    - Verifies the email exists and the password is correct
    - Returns a JWT access token

    HTTP 401 if email or password is wrong.
    """
    user = get_user_by_email(db, email=credentials.email)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No account found with that email address.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Please try again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(data={"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}


class ResetPasswordPayload(BaseModel):
    email: EmailStr
    new_password: str


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(payload: ResetPasswordPayload, db: Session = Depends(get_db)):
    """Reset a user's password given their email and a new password."""
    user = get_user_by_email(db, email=payload.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with that email address.",
        )
    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="New password must be at least 8 characters.",
        )
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password reset successfully. You can now log in."}
