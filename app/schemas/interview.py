"""
app/schemas/interview.py
─────────────────────────
Pydantic schemas for AI mock interview sessions.
"""

from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class InterviewStartRequest(BaseModel):
    """Configuration options for starting an interview"""
    level: str = "Medium"
    skills: List[str] = []
    num_questions: int = 5


class InterviewQuestion(BaseModel):
    """A single interview question generated from the resume."""
    index: int
    question: str
    average_time: int = 90        # estimated seconds to answer
    answer_type: str = "voice"    # "voice" = speak answer | "code" = write code/query
    code_language: str = ""       # e.g. "python", "sql", "java" — populated when answer_type=="code"


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


class NlpAnalysis(BaseModel):
    """NLP metrics for a spoken/typed interview answer."""
    word_count: int = 0
    filler_count: int = 0
    filler_words_found: List[str] = []
    fluency_score: float = 0.0
    vocabulary_richness: float = 0.0
    sentence_count: int = 0
    avg_words_per_sentence: float = 0.0


class QuestionFeedback(BaseModel):
    """AI feedback + NLP analysis for one question-answer pair."""
    question_index: int
    question: str
    user_answer: str
    feedback: str           # AI's evaluation of the answer
    score: float            # 0–10 for this individual answer
    nlp_analysis: Optional[NlpAnalysis] = None


class InterviewResultOut(BaseModel):
    """Response after interview submission."""
    session_id: int
    overall_score: float
    video_url: Optional[str] = None
    feedback: List[QuestionFeedback]
    conducted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InterviewHistoryItem(BaseModel):
    """One row in past interview history."""
    id: int
    overall_score: float
    video_url: Optional[str] = None
    conducted_at: Optional[datetime] = None

    class Config:
        from_attributes = True
