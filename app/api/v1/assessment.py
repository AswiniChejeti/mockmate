"""
app/api/v1/assessment.py
─────────────────────────
Skill Assessment endpoints:
  POST /api/v1/assessment/generate  — Generate MCQ questions for a skill
  POST /api/v1/assessment/submit    — Submit answers and get your score
  GET  /api/v1/assessment/history   — View all past assessment results
"""

import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.assessment import (
    AssessmentGenerateRequest, AssessmentGenerateResponse,
    AssessmentSubmitRequest, AssessmentResultOut, AssessmentHistoryItem, MCQQuestion,
)
from app.crud.assessment import (
    create_assessment, submit_assessment,
    get_assessment_by_id, get_user_assessments,
)
from app.services.ai_service import generate_mcqs

router = APIRouter(prefix="/assessment", tags=["Skill Assessment"])


@router.post("/generate", response_model=AssessmentGenerateResponse, status_code=status.HTTP_201_CREATED)
def generate_assessment(
    request: AssessmentGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate MCQ questions for a specific skill using AI.

    Steps:
      1. Calls LLM to generate `num_questions` MCQs for the given skill
      2. Saves the questions to the database (answers not yet submitted)
      3. Returns the questions for the user to answer

    The frontend stores the `assessment_id` and sends it with answers
    when calling /assessment/submit.
    """
    questions_raw = generate_mcqs(
        skill=request.skill,
        num_questions=request.num_questions,
        level=request.level,
    )

    if not questions_raw:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not generate questions at this time. Please try again.",
        )

    db_assessment = create_assessment(
        db=db,
        user_id=current_user.id,
        skill=request.skill,
        questions=questions_raw,
    )

    questions = [MCQQuestion(**q) for q in questions_raw]
    return AssessmentGenerateResponse(
        assessment_id=db_assessment.id,
        skill=request.skill,
        level=request.level,
        questions=questions,
    )


@router.post("/submit", response_model=AssessmentResultOut)
def submit_assessment_answers(
    request: AssessmentSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit answers for an assessment and get your score.

    Scoring logic: For each question, compare the submitted answer key
    (e.g., "A") against the `correct_answer` field in the stored questions.
    Score = (correct_count / total) × 10
    """
    assessment = get_assessment_by_id(db=db, assessment_id=request.assessment_id)

    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found.")

    if assessment.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized.")

    questions_list = json.loads(assessment.questions_json)
    answers_dict = {a.question_index: a.selected_answer for a in request.answers}

    correct_count = 0
    for idx, q in enumerate(questions_list):
        if answers_dict.get(idx, "").upper() == q.get("correct_answer", "").upper():
            correct_count += 1

    total = len(questions_list)
    score = round((correct_count / total) * 10, 2) if total > 0 else 0.0

    updated = submit_assessment(
        db=db,
        assessment=assessment,
        answers=[a.dict() for a in request.answers],
        score=score,
        correct_count=correct_count,
    )

    return AssessmentResultOut(
        assessment_id=updated.id,
        skill=updated.skill,
        score=updated.score,
        total_questions=updated.total_questions,
        correct_count=correct_count,
        taken_at=updated.taken_at,
    )


@router.get("/history", response_model=list[AssessmentHistoryItem])
def get_assessment_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all past assessment results for the logged-in user."""
    return get_user_assessments(db=db, user_id=current_user.id)


from app.schemas.assessment import AssessmentDetailOut

@router.get("/{assessment_id}", response_model=AssessmentDetailOut)
def get_assessment_detail(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return full details for a single assessment."""
    assessment = get_assessment_by_id(db=db, assessment_id=assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if assessment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    questions_data = json.loads(assessment.questions_json) if assessment.questions_json else []
    answers_data = json.loads(assessment.answers_json) if assessment.answers_json else []
    
    correct_count = 0
    answers_dict = {a.get("question_index"): a.get("selected_answer") for a in answers_data}
    for idx, q in enumerate(questions_data):
        if answers_dict.get(idx, "").upper() == q.get("correct_answer", "").upper():
            correct_count += 1

    return AssessmentDetailOut(
        assessment_id=assessment.id,
        skill=assessment.skill,
        score=assessment.score or 0.0,
        total_questions=assessment.total_questions or 0,
        correct_count=correct_count,
        taken_at=assessment.taken_at,
        questions_data=questions_data,
        answers_data=answers_data
    )
