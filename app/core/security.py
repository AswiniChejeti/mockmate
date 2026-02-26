"""
app/core/security.py
────────────────────
JWT token creation/validation and password hashing.

Concepts:
  - Passwords are NEVER stored in plain text. We hash them with pbkdf2_sha256
    so even if the DB is leaked, passwords are safe.
  - JWT (JSON Web Token) is a compact, signed token the client sends
    in every request header to prove who they are.
"""

from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# Password hashing context using pbkdf2_sha256 (no 72-byte limit like bcrypt)
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# ─── Password Utilities ───────────────────────────────────────────────────────

def hash_password(plain_password: str) -> str:
    """
    Converts a plain text password → pbkdf2_sha256 hash.
    Example: "mypassword123" → "$pbkdf2-sha256$29000$..."
    """
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Checks if the plain password matches the stored hash.
    Returns True if they match, False otherwise.
    """
    return pwd_context.verify(plain_password, hashed_password)


# ─── JWT Utilities ────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Creates a signed JWT token.

    Args:
        data: Dictionary of claims to encode (e.g., {"sub": "user@email.com"})
        expires_delta: How long until the token expires. Defaults to settings value.

    Returns:
        A signed JWT string the client will store and send with every request.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[str]:
    """
    Decodes and validates a JWT token.

    Returns:
        The user's email (subject claim) if valid, None if invalid/expired.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        return email
    except JWTError:
        return None
