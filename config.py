"""
config.py – Application configuration loaded from environment variables.
Copy .env.example to .env and fill in your PostgreSQL credentials.
"""

import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # PostgreSQL connection
    DB_HOST     = os.getenv("DB_HOST",     "localhost")
    DB_PORT     = os.getenv("DB_PORT",     "5432")
    DB_NAME     = os.getenv("DB_NAME",     "pdf_portal")
    DB_USER     = os.getenv("DB_USER",     "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

    # Flask
    SECRET_KEY  = os.getenv("SECRET_KEY",  "change-me-in-production")
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024   # 16 MB limit per upload

    # Financial defaults
    GST_RATE_DEFAULT = 18.0   # percent
