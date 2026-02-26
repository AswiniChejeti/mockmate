"""
app/schemas/interview.py
─────────────────────────
Pydantic schemas for AI mock interview sessions.
"""

from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class InterviewQuestion(BaseModel):
    """A single interview question generated from the resume."""
    index: int
    question: str


class InterviewStartResponse(BaseModel):
    """Response from POST /interview/start."""
    session_id: int
    questions: List[InterviewQuestion]


class AnswerItem(BaseModel):
    """One answer from the user for a specific interview question."""
    question_index: int
    answer: str


class InterviewSubmitRequest(BaseModel):
    """Request body for POST /interview/submit."""
    session_id: int
    answers: List[AnswerItem]


class QuestionFeedback(BaseModel):
    """AI feedback for one question-answer pair."""
    question_index: int
    question: str
    user_answer: str
    feedback: str      # AI's evaluation of the answer
    score: float       # 0–10 for this individual answer


class InterviewResultOut(BaseModel):
    """Response after interview submission."""
    session_id: int
    overall_score: float
    feedback: List[QuestionFeedback]
    conducted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InterviewHistoryItem(BaseModel):
    """One row in past interview history."""
    id: int
    overall_score: float
    conducted_at: Optional[datetime] = None

    class Config:
        from_attributes = True
