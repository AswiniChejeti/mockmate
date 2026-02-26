"""
app/models/user.py
───────────────────
SQLAlchemy model for the `users` table.
Each row in this table represents one registered user.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    email         = Column(String(255), unique=True, index=True, nullable=False)
    full_name     = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships — one user can have many resumes, assessments, interviews
    resumes       = relationship("Resume", back_populates="user", cascade="all, delete")
    assessments   = relationship("AssessmentResult", back_populates="user", cascade="all, delete")
    interviews    = relationship("InterviewSession", back_populates="user", cascade="all, delete")
