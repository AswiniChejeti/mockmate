"""
app/models/assessment.py
────────────────────────
SQLAlchemy model for the `assessment_results` table.
Stores MCQ quiz results per user per skill.
"""

from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class AssessmentResult(Base):
    __tablename__ = "assessment_results"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False)
    skill          = Column(String(255), nullable=False)      # e.g. "Python"
    questions_json = Column(Text, nullable=False)             # JSON: list of MCQ questions
    answers_json   = Column(Text, nullable=True)              # JSON: user's submitted answers
    score          = Column(Float, default=0.0)               # e.g. 7.5 out of 10
    total_questions = Column(Integer, default=10)
    taken_at       = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship back to user
    user = relationship("User", back_populates="assessments")
