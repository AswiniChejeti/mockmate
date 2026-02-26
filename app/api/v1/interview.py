"""
app/api/v1/interview.py
────────────────────────
Mock Interview endpoints:
  POST /api/v1/interview/start         — Start interview (AI generates questions from resume)
  POST /api/v1/interview/verify-face   — Verify user's face before interview
  POST /api/v1/interview/submit        — Submit answers, receive AI feedback + NLP analysis
  GET  /api/v1/interview/history       — View past interview sessions
"""

import json
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.interview import (
    InterviewStartResponse, InterviewQuestion,
    InterviewSubmitRequest, InterviewResultOut,
    InterviewHistoryItem, QuestionFeedback,
    InterviewStartRequest
)
from app.crud.interview import (
    create_interview_session, submit_interview,
    get_interview_by_id, get_user_interviews,
)
from app.crud.resume import get_latest_resume
from app.services.ai_service import generate_interview_questions, evaluate_interview_answer
from app.services.nlp_service import analyze_answer

router = APIRouter(prefix="/interview", tags=["Mock Interview"])


# ── Schema for face verification request ────────────────────────────────────
class FaceVerifyRequest(BaseModel):
    face_image: str   # base64-encoded webcam snapshot


class FaceVerifyResponse(BaseModel):
    verified: bool
    confidence: float
    message: str


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/start", response_model=InterviewStartResponse, status_code=status.HTTP_201_CREATED)
def start_interview(
    payload: InterviewStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Start a new AI mock interview session.

    Process:
      1. Fetches the user's latest resume from the database
      2. Sends resume text to the AI to generate tailored interview questions (10 questions)
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

    # Convert resume text and targeted skills into the generation 
    resume_context = resume.extracted_text or ""
    if payload.skills:
        resume_context += f"\n\nTarget Skills for Interview: {', '.join(payload.skills)}"

    questions = generate_interview_questions(
        resume_text=resume_context,
        num_questions=10,
        level=payload.level
    )
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


@router.post("/verify-face", response_model=FaceVerifyResponse)
def verify_face(
    request: FaceVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Verify that the current webcam user matches the face captured at signup.

    Returns verified=True with confidence score if faces match.
    Returns verified=False if no stored face or faces don't match.
    """
    # No face stored at signup — skip verification
    if not current_user.face_encoding:
        return FaceVerifyResponse(
            verified=True,
            confidence=1.0,
            message="No face registered at signup. Proceeding without verification.",
        )

    try:
        stored_encoding = json.loads(current_user.face_encoding)
        from app.services.face_service import verify_face as face_verify
        result = face_verify(
            live_base64=request.face_image,
            stored_encoding=stored_encoding,
        )

        if result["verified"]:
            return FaceVerifyResponse(
                verified=True,
                confidence=result["confidence"],
                message=f"Identity verified! Confidence: {result['confidence'] * 100:.1f}%",
            )
        else:
            return FaceVerifyResponse(
                verified=False,
                confidence=result["confidence"],
                message=result.get("message", "Face does not match the registered user. Please ensure you are the account holder."),
            )
    except Exception as e:
        print(f"[Face] verify_face endpoint error: {e}")
        # On error, allow interview to proceed (don't block users)
        return FaceVerifyResponse(
            verified=True,
            confidence=0.0,
            message="Face verification unavailable. Proceeding anyway.",
        )


@router.post("/submit", response_model=InterviewResultOut)
def submit_interview_answers(
    request: InterviewSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit answers for each interview question.

    For each answer:
      - AI evaluates and provides feedback + score (0-10)
      - NLP analysis runs: filler words, fluency, vocabulary richness
    Overall score = average of all individual AI scores.
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

        # AI evaluation
        eval_result = evaluate_interview_answer(question=question_text, answer=user_answer)

        # NLP analysis
        nlp_result = analyze_answer(user_answer)

        feedback_list.append(
            QuestionFeedback(
                question_index=idx,
                question=question_text,
                user_answer=user_answer,
                feedback=eval_result["feedback"],
                score=eval_result["score"],
                nlp_analysis=nlp_result,
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


@router.get("/{session_id}", response_model=InterviewResultOut)
def get_interview_detail(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return full details of a specific interview session."""
    session = get_interview_by_id(db=db, session_id=session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview not found")
    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return InterviewResultOut(
        session_id=session.id,
        overall_score=session.overall_score or 0.0,
        video_url=session.video_url,
        conducted_at=session.conducted_at,
        feedback=json.loads(session.feedback_json) if session.feedback_json else []
    )


import os
import shutil
import uuid
from fastapi import UploadFile, File

@router.post("/{session_id}/video", response_model=dict)
def upload_interview_video(
    session_id: int,
    video: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Uploads recorded interview video to the backend."""
    session = get_interview_by_id(db=db, session_id=session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Interview not found")

    ext = video.filename.split(".")[-1] if "." in video.filename else "webm"
    filename = f"interview_{session_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join("uploads", "interviews", filename)

    try:
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(video.file, buffer)
    except Exception as e:
        print(f"[Video] Upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to save video.")

    session.video_url = f"/videos/{filename}"
    db.commit()
    
    return {"message": "Video uploaded successfully", "video_url": session.video_url}
