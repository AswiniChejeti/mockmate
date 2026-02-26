"""
app/api/v1/__init__.py
───────────────────────
Aggregates all API route modules into a single router.
This keeps main.py clean — it only imports `api_router` from here.
"""

from fastapi import APIRouter

from app.api.v1 import auth, resume, assessment, interview, dashboard, profile

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(resume.router)
api_router.include_router(assessment.router)
api_router.include_router(interview.router)
api_router.include_router(dashboard.router)
api_router.include_router(profile.router)
