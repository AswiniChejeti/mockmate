"""
app/api/v1/resume.py
─────────────────────
Resume management endpoints:
  POST /api/v1/resume/upload   — Upload a PDF resume
  GET  /api/v1/resume/skills   — Get skills from latest resume
  GET  /api/v1/resume/all      — Get all uploaded resumes
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.resume import ResumeOut, SkillsOut
from app.crud.resume import create_resume, get_latest_resume, get_all_resumes
from app.services.resume_service import extract_text_from_pdf, save_uploaded_file
from app.services.ai_service import extract_resume_data

import json

router = APIRouter(prefix="/resume", tags=["Resume Management"])


@router.post("/upload", response_model=ResumeOut, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a PDF resume.

    Process:
      1. Validates the file is a PDF
      2. Saves it to the /uploads directory with a unique name
      3. Extracts all text from the PDF using pdfplumber
      4. Sends the text to the AI to identify skills, experience, and education
      5. Saves everything to the database

    Returns the resume record with extracted arrays.
    """
    # Validate file type
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are accepted. Please upload a .pdf file.",
        )

    # Give it a unique filename to avoid collisions
    unique_filename = f"{current_user.id}_{uuid.uuid4().hex}_{file.filename}"

    # Read file bytes and save to disk
    file_bytes = await file.read()
    file_path = save_uploaded_file(file_bytes, unique_filename)

    # Extract text from PDF
    try:
        extracted_text = extract_text_from_pdf(file_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not read PDF: {str(e)}",
        )

    if not extracted_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The uploaded PDF appears to be empty or scanned (image-based). Please upload a text-based PDF.",
        )

    # Ask AI to extract data from the resume text
    ai_data = extract_resume_data(extracted_text)

    # Save to database
    db_resume = create_resume(
        db=db,
        user_id=current_user.id,
        filename=file.filename,
        file_path=file_path,
        extracted_text=extracted_text,
        skills=ai_data.get("skills", []),
        experience=ai_data.get("experience", []),
        education=ai_data.get("education", []),
    )

    return ResumeOut(
        id=db_resume.id,
        filename=db_resume.filename,
        skills=ai_data.get("skills", []),
        experience=ai_data.get("experience", []),
        education=ai_data.get("education", []),
        uploaded_at=db_resume.uploaded_at,
    )


@router.get("/skills", response_model=SkillsOut)
def get_my_skills(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the skills extracted from the user's most recently uploaded resume.

    HTTP 404 if no resume has been uploaded yet.
    """
    resume = get_latest_resume(db=db, user_id=current_user.id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume found. Please upload your resume first.",
        )
    skills = json.loads(resume.skills_json) if resume.skills_json else []
    return SkillsOut(resume_id=resume.id, skills=skills)


@router.get("/all", response_model=list[ResumeOut])
def get_all_my_resumes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a list of all resumes uploaded by the current user."""
    resumes = get_all_resumes(db=db, user_id=current_user.id)
    result = []
    for r in resumes:
        skills = json.loads(r.skills_json) if r.skills_json else []
        exp = json.loads(r.experience_json) if getattr(r, 'experience_json', None) else []
        edu = json.loads(r.education_json) if getattr(r, 'education_json', None) else []
        
        result.append(ResumeOut(
            id=r.id, 
            filename=r.filename, 
            skills=skills, 
            experience=exp,
            education=edu,
            uploaded_at=r.uploaded_at
        ))
    return result
