"""
app/crud/resume.py
────────────────────
Database operations for resumes.
"""

import json
from sqlalchemy.orm import Session
from app.models.resume import Resume


def create_resume(
    db: Session,
    user_id: int,
    filename: str,
    file_path: str,
    extracted_text: str,
    skills: list[str],
    experience: list[str],
    education: list[str],
) -> Resume:
    """Save a new resume record to the database."""
    db_resume = Resume(
        user_id=user_id,
        filename=filename,
        file_path=file_path,
        extracted_text=extracted_text,
        skills_json=json.dumps(skills),
        experience_json=json.dumps(experience),
        education_json=json.dumps(education),
    )
    db.add(db_resume)
    db.commit()
    db.refresh(db_resume)
    return db_resume


def get_latest_resume(db: Session, user_id: int) -> Resume | None:
    """Get the most recently uploaded resume for a user."""
    return (
        db.query(Resume)
        .filter(Resume.user_id == user_id)
        .order_by(Resume.uploaded_at.desc())
        .first()
    )


def get_all_resumes(db: Session, user_id: int) -> list[Resume]:
    """Get all resumes uploaded by a user."""
    return (
        db.query(Resume)
        .filter(Resume.user_id == user_id)
        .order_by(Resume.uploaded_at.desc())
        .all()
    )
