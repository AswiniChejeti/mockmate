"""
app/schemas/assessment.py
──────────────────────────
Pydantic schemas for skill assessment MCQs and results.
"""

from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class MCQOption(BaseModel):
    """One multiple-choice option."""
    key: str       # e.g. "A", "B", "C", "D"
    value: str     # e.g. "To declare a variable"


class MCQQuestion(BaseModel):
    """A single MCQ question returned by the AI."""
    question: str
    options: List[MCQOption]
    correct_answer: str    # e.g. "A"
    explanation: str       # Brief explanation of the correct answer


class AssessmentGenerateRequest(BaseModel):
    """Request body for POST /assessment/generate."""
    skill: str              # e.g. "Python"
    num_questions: int = 10
    level: str = "Medium"   # "Easy", "Medium", or "Hard"


class AssessmentGenerateResponse(BaseModel):
    """Response from POST /assessment/generate."""
    assessment_id: int
    skill: str
    level: str
    questions: List[MCQQuestion]


class UserAnswer(BaseModel):
    """One answer from the user during submission."""
    question_index: int    # 0-based index
    selected_answer: str   # e.g. "A"


class AssessmentSubmitRequest(BaseModel):
    """Request body for POST /assessment/submit."""
    assessment_id: int
    answers: List[UserAnswer]


class AssessmentResultOut(BaseModel):
    """Response after assessment submission."""
    assessment_id: int
    skill: str
    score: float
    total_questions: int
    correct_count: int
    taken_at: Optional[datetime] = None

class AssessmentDetailOut(AssessmentResultOut):
    """Detailed response for assessment history."""
    questions_data: list = []  # Detailed questions
    answers_data: list = []    # Detailed answers

    class Config:
        from_attributes = True


class AssessmentHistoryItem(BaseModel):
    """One item in the assessment history list."""
    id: int
    skill: str
    score: float
    total_questions: int
    taken_at: Optional[datetime] = None

    class Config:
        from_attributes = True
