"""
app/core/config.py
─────────────────
Central configuration using Pydantic Settings.
Reads values from the .env file automatically.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Application
    APP_NAME: str = "AI Mock Interview Platform"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # AI Provider: "openai" or "gemini"
    AI_PROVIDER: str = "gemini"
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """
    Cache the settings object so .env is only read once.
    Use this as a FastAPI dependency: settings = Depends(get_settings)
    """
    return Settings()


# Convenience singleton for non-dependency use
settings = get_settings()
