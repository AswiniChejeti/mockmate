"""
app/crud/interview.py
──────────────────────
Database operations for mock interview sessions.
"""

import json
from sqlalchemy.orm import Session
from app.models.interview import InterviewSession


def create_interview_session(
    db: Session,
    user_id: int,
    questions: list[str],
) -> InterviewSession:
    """Create a new interview session with generated questions."""
    db_session = InterviewSession(
        user_id=user_id,
        questions_json=json.dumps(questions),
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


def submit_interview(
    db: Session,
    session: InterviewSession,
    answers: list,
    feedback: list,
    overall_score: float,
) -> InterviewSession:
    """Store user answers, AI feedback, and overall score."""
    session.answers_json = json.dumps(answers)
    session.feedback_json = json.dumps(feedback)
    session.overall_score = overall_score
    db.commit()
    db.refresh(session)
    return session


def get_interview_by_id(db: Session, session_id: int) -> InterviewSession | None:
    return db.query(InterviewSession).filter(InterviewSession.id == session_id).first()


def get_user_interviews(db: Session, user_id: int) -> list[InterviewSession]:
    """Return all past interview sessions for a user, newest first."""
    return (
        db.query(InterviewSession)
        .filter(InterviewSession.user_id == user_id)
        .order_by(InterviewSession.conducted_at.desc())
        .all()
    )
