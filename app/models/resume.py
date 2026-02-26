"""
app/models/resume.py
─────────────────────
SQLAlchemy model for the `resumes` table.
Stores uploaded resume file info, extracted text, and skills.
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class Resume(Base):
    __tablename__ = "resumes"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename       = Column(String(255), nullable=False)
    file_path      = Column(String(500), nullable=False)
    extracted_text = Column(Text, nullable=True)       # Raw text from the PDF
    skills_json    = Column(Text, nullable=True)       # JSON string: ["Python","FastAPI",...]
    uploaded_at    = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship back to the user
    user = relationship("User", back_populates="resumes")
