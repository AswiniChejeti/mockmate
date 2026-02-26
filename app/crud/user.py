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
    If face_image is provided, extracts face encoding via DeepFace.
    """
    import json
    face_encoding_json = None

    if user_data.face_image:
        try:
            from app.services.face_service import extract_face_encoding
            encoding = extract_face_encoding(user_data.face_image)
            if encoding:
                face_encoding_json = json.dumps(encoding)
                print(f"[Face] Saved face encoding for {user_data.email}")
            else:
                print(f"[Face] No face detected in signup image for {user_data.email}")
        except Exception as e:
            print(f"[Face] Error during signup face encoding: {e}")

    db_user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=hash_password(user_data.password),
        face_encoding=face_encoding_json,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, user: User, update_data: UserUpdate) -> User:
    """Update user profile fields (name, phone_number, and/or password)."""
    if update_data.full_name is not None:
        user.full_name = update_data.full_name
    if update_data.phone_number is not None:
        user.phone_number = update_data.phone_number
    if update_data.password:
        user.hashed_password = hash_password(update_data.password)
    db.commit()
    db.refresh(user)
    return user
