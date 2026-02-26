"""
main.py
────────
FastAPI application entry point.

Run with:
    uvicorn main:app --reload

Then open: http://127.0.0.1:8000/docs  (Swagger UI)
         : http://127.0.0.1:8000/redoc (ReDoc UI)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1 import api_router
from app.db.database import engine, Base
import uvicorn

# ─── Create all database tables on startup ───────────────────────────────────
# This is equivalent to running CREATE TABLE IF NOT EXISTS for every model.
# In production, you'd use Alembic migrations instead.
Base.metadata.create_all(bind=engine)

# ─── Initialize FastAPI app ───────────────────────────────────────────────────
app = FastAPI(
    title="AI Mock Interview Platform",
    description="""
    ## AI-Powered Resume-Based Mock Interview & Skill Assessment Platform

    ### Features:
    - 🔐 **JWT Authentication** — Secure register & login
    - 📄 **Resume Upload** — PDF upload with text extraction & AI skill detection
    - 🧠 **Skill Assessment** — AI-generated MCQs with auto-scoring
    - 🎤 **Mock Interviews** — Resume-based AI interview with per-answer feedback
    - 📊 **Dashboard** — Performance analytics and progress tracking
    - 👤 **Profile** — View and update your profile
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS Middleware ──────────────────────────────────────────────────────────
# Allows the frontend (HTML/JS) to call the API even when served from a
# different port or domain. In production, restrict origins to your domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Allow all origins (restrict in production)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Mount static frontend files ──────────────────────────────────────────────
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

# ─── Include all API routes (prefixed with /api/v1) ──────────────────────────
app.include_router(api_router, prefix="/api/v1")


# ─── Root health check ────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    """Health check — confirms the API is running."""
    return {
        "status": "online",
        "message": "AI Mock Interview Platform is running!",
        "docs": "/docs",
        "version": "1.0.0",
    }


if __name__ == "__main__":
    
    uvicorn.run(app, host="192.168.0.57", port=8000)
