"""
app/crud/assessment.py
───────────────────────
Database operations for skill assessments.
"""

import json
from sqlalchemy.orm import Session
from app.models.assessment import AssessmentResult


def create_assessment(
    db: Session,
    user_id: int,
    skill: str,
    questions: list,
) -> AssessmentResult:
    """Create an assessment record with generated questions (no answers yet)."""
    db_assessment = AssessmentResult(
        user_id=user_id,
        skill=skill,
        questions_json=json.dumps(questions),
        total_questions=len(questions),
    )
    db.add(db_assessment)
    db.commit()
    db.refresh(db_assessment)
    return db_assessment


def submit_assessment(
    db: Session,
    assessment: AssessmentResult,
    answers: list,
    score: float,
    correct_count: int,
) -> AssessmentResult:
    """Store user answers and computed score."""
    assessment.answers_json = json.dumps(answers)
    assessment.score = score
    db.commit()
    db.refresh(assessment)
    return assessment


def get_assessment_by_id(db: Session, assessment_id: int) -> AssessmentResult | None:
    return db.query(AssessmentResult).filter(AssessmentResult.id == assessment_id).first()


def get_user_assessments(db: Session, user_id: int) -> list[AssessmentResult]:
    """Return all past assessments for a user, newest first."""
    return (
        db.query(AssessmentResult)
        .filter(AssessmentResult.user_id == user_id)
        .order_by(AssessmentResult.taken_at.desc())
        .all()
    )
