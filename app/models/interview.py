"""
app/models/interview.py
────────────────────────
SQLAlchemy model for the `interview_sessions` table.
Stores AI mock interview sessions including questions, answers, and AI feedback.
"""

from sqlalchemy import Column, Integer, Text, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=False)
    questions_json  = Column(Text, nullable=False)   # JSON: list of interview questions
    answers_json    = Column(Text, nullable=True)    # JSON: user's text answers
    feedback_json   = Column(Text, nullable=True)    # JSON: AI feedback per question
    overall_score   = Column(Float, default=0.0)     # 0–10 score
    conducted_at    = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship back to user
    user = relationship("User", back_populates="interviews")
