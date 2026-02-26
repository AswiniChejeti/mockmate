"""
app/crud/user.py
─────────────────
Database operations for users.
CRUD = Create, Read, Update, Delete
"""

from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import hash_password


def get_user_by_email(db: Session, email: str) -> User | None:
    """Find a user by their email address."""
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    """Find a user by their ID."""
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, user_data: UserCreate) -> User:
    """
    Create a new user in the database.
    Hashes the password before storing.
    """
    db_user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=hash_password(user_data.password),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, user: User, update_data: UserUpdate) -> User:
    """Update user profile fields (name and/or password)."""
    if update_data.full_name:
        user.full_name = update_data.full_name
    if update_data.password:
        user.hashed_password = hash_password(update_data.password)
    db.commit()
    db.refresh(user)
    return user
