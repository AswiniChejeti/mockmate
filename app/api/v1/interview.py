"""
app/api/v1/interview.py
────────────────────────
Mock Interview endpoints:
  POST /api/v1/interview/start    — Start interview (AI generates questions from resume)
  POST /api/v1/interview/submit   — Submit answers and receive AI feedback + score
  GET  /api/v1/interview/history  — View past interview sessions
"""

import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.interview import (
    InterviewStartResponse, InterviewQuestion,
    InterviewSubmitRequest, InterviewResultOut,
    InterviewHistoryItem, QuestionFeedback,
)
from app.crud.interview import (
    create_interview_session, submit_interview,
    get_interview_by_id, get_user_interviews,
)
from app.crud.resume import get_latest_resume
from app.services.ai_service import generate_interview_questions, evaluate_interview_answer

router = APIRouter(prefix="/interview", tags=["Mock Interview"])


@router.post("/start", response_model=InterviewStartResponse, status_code=status.HTTP_201_CREATED)
def start_interview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Start a new AI mock interview session.

    Process:
      1. Fetches the user's latest resume from the database
      2. Sends resume text to the AI to generate tailored interview questions
      3. Saves the session to the database
      4. Returns the questions for the user to answer

    HTTP 404 if user hasn't uploaded a resume yet.
    """
    resume = get_latest_resume(db=db, user_id=current_user.id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume found. Please upload your resume before starting an interview.",
        )

    questions = generate_interview_questions(resume_text=resume.extracted_text or "")
    if not questions:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not generate interview questions. Please try again.",
        )

    db_session = create_interview_session(
        db=db,
        user_id=current_user.id,
        questions=questions,
    )

    interview_questions = [
        InterviewQuestion(index=i, question=q) for i, q in enumerate(questions)
    ]
    return InterviewStartResponse(
        session_id=db_session.id,
        questions=interview_questions,
    )


@router.post("/submit", response_model=InterviewResultOut)
def submit_interview_answers(
    request: InterviewSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit answers for each interview question and receive AI feedback.

    For each answer:
      - The AI evaluates it and provides feedback + a score (0-10)
    Overall score = average of all individual scores.
    """
    session = get_interview_by_id(db=db, session_id=request.session_id)

    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found.")

    if session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized.")

    questions_list = json.loads(session.questions_json)
    answers_dict = {a.question_index: a.answer for a in request.answers}

    feedback_list = []
    total_score = 0.0

    for idx, question_text in enumerate(questions_list):
        user_answer = answers_dict.get(idx, "")
        eval_result = evaluate_interview_answer(question=question_text, answer=user_answer)

        feedback_list.append(
            QuestionFeedback(
                question_index=idx,
                question=question_text,
                user_answer=user_answer,
                feedback=eval_result["feedback"],
                score=eval_result["score"],
            )
        )
        total_score += eval_result["score"]

    overall = round(total_score / len(questions_list), 2) if questions_list else 0.0

    updated = submit_interview(
        db=db,
        session=session,
        answers=[a.dict() for a in request.answers],
        feedback=[f.dict() for f in feedback_list],
        overall_score=overall,
    )

    return InterviewResultOut(
        session_id=updated.id,
        overall_score=updated.overall_score,
        feedback=feedback_list,
        conducted_at=updated.conducted_at,
    )


@router.get("/history", response_model=list[InterviewHistoryItem])
def get_interview_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all past interview sessions for the logged-in user."""
    return get_user_interviews(db=db, user_id=current_user.id)
