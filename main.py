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

# ─── Include all API routes (prefixed with /api/v1) ──────────────────────────
from fastapi.staticfiles import StaticFiles
import os

app.include_router(api_router, prefix="/api/v1")

# Mount static files for videos
os.makedirs("uploads/interviews", exist_ok=True)
app.mount("/videos", StaticFiles(directory="uploads/interviews"), name="videos")

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


def _free_port(port: int = 8000):
    """Kill every process bound to *port* using netstat (works on any IP)."""
    import subprocess, os, sys
    if sys.platform != "win32":
        return
    result = subprocess.run(
        f"netstat -ano | findstr :{port}",
        shell=True, capture_output=True, text=True
    )
    killed = set()
    for line in result.stdout.splitlines():
        parts = line.split()
        if not parts:
            continue
        last = parts[-1]
        if last.isdigit():
            proc_id = int(last)
            if proc_id != os.getpid() and proc_id not in killed:
                subprocess.run(f"taskkill /F /PID {proc_id}",
                               shell=True, capture_output=True)
                print(f"[Startup] Freed port {port} — killed PID {proc_id}")
                killed.add(proc_id)


if __name__ == "__main__":
    _free_port(8000)
    uvicorn.run("main:app", host="192.168.0.57", port=8000, reload=True)
