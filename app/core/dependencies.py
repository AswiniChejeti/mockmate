"""
app/core/dependencies.py
────────────────────────
Reusable FastAPI dependencies.

The most important one is `get_current_user` — it reads the JWT token
from the Authorization header, validates it, and returns the User object.
Any route that requires login simply adds:
    current_user: User = Depends(get_current_user)
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.database import get_db
from app.models.user import User

# This tells FastAPI where to expect the token (POST /api/v1/auth/login)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Validates the JWT token and returns the authenticated User.

    Flow:
      1. FastAPI extracts Bearer token from the Authorization header
      2. We decode + verify the token to get the user's email
      3. We look up the user in the database
      4. If anything fails → 401 Unauthorized

    Usage in any route:
        @router.get("/protected")
        def protected(current_user: User = Depends(get_current_user)):
            return {"hello": current_user.email}
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials. Please login again.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    email = decode_token(token)
    if email is None:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception

    return user
