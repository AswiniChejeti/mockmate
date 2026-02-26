"""
app/schemas/resume.py
──────────────────────
Pydantic schemas for resume upload and skill extraction responses.
"""

from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class ResumeOut(BaseModel):
    """Returned after a successful resume upload."""
    id: int
    filename: str
    skills: List[str] = []
    uploaded_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SkillsOut(BaseModel):
    """Returned by GET /resume/skills."""
    resume_id: int
    skills: List[str]
