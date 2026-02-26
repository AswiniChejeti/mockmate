"""
app/db/database.py
──────────────────
SQLAlchemy engine, session factory, and base class.

How it works:
  - `engine`        → The actual MySQL connection pool.
  - `SessionLocal`  → A factory that produces DB sessions.
  - `Base`          → All SQLAlchemy models inherit from this.
  - `get_db()`      → FastAPI dependency that provides one DB
                       session per request, then auto-closes it.
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
# Create the MySQL engine
# pool_pre_ping=True reconnects dropped connections automatically
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,       # recycle connections every 5 minutes
    echo=settings.DEBUG,    # log SQL queries in debug mode
)

# Session factory — each request gets its own session
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# All models will inherit from this Base
Base = declarative_base()


def get_db():
    """
    FastAPI dependency that yields a database session.
    Always closes the session after the request finishes —
    even if an exception was raised.

    Usage in a route:
        @router.get("/example")
        def example(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
