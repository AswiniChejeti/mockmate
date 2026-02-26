"""
app/api/v1/dashboard.py
────────────────────────
Dashboard endpoint:
  GET /api/v1/dashboard/stats — Aggregated stats for the logged-in user
"""

import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.crud.assessment import get_user_assessments
from app.crud.interview import get_user_interviews
from app.crud.resume import get_latest_resume

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns aggregated performance data for the user's dashboard:
      - Skills extracted from latest resume
      - All assessment scores (per skill)
      - Average assessment score
      - All interview scores
      - Average interview score
      - Total sessions completed
    """
    # --- Resume / Skills ---
    resume = get_latest_resume(db=db, user_id=current_user.id)
    skills = json.loads(resume.skills_json) if (resume and resume.skills_json) else []

    # --- Assessments ---
    assessments = get_user_assessments(db=db, user_id=current_user.id)
    assessment_stats = [
        {
            "id": a.id,
            "skill": a.skill,
            "score": a.score,
            "total_questions": a.total_questions,
            "taken_at": a.taken_at.isoformat() if a.taken_at else None,
        }
        for a in assessments
    ]
    avg_assessment_score = (
        round(sum(a.score for a in assessments) / len(assessments), 2)
        if assessments else 0.0
    )

    # --- Interviews ---
    interviews = get_user_interviews(db=db, user_id=current_user.id)
    interview_stats = [
        {
            "id": i.id,
            "overall_score": i.overall_score,
            "conducted_at": i.conducted_at.isoformat() if i.conducted_at else None,
        }
        for i in interviews
    ]
    avg_interview_score = (
        round(sum(i.overall_score for i in interviews) / len(interviews), 2)
        if interviews else 0.0
    )

    return {
        "user": {
            "id": current_user.id,
            "full_name": current_user.full_name,
            "email": current_user.email,
        },
        "resume": {
            "uploaded": resume is not None,
            "skills": skills,
            "skill_count": len(skills),
        },
        "assessments": {
            "total": len(assessments),
            "average_score": avg_assessment_score,
            "history": assessment_stats,
        },
        "interviews": {
            "total": len(interviews),
            "average_score": avg_interview_score,
            "history": interview_stats,
        },
        "summary": {
            "total_activities": len(assessments) + len(interviews),
            "overall_performance": round((avg_assessment_score + avg_interview_score) / 2, 2),
        },
    }
