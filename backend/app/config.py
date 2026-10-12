"""환경변수(.env)를 읽어 한곳에 모아 둡니다."""
import os
from pathlib import Path

from dotenv import load_dotenv

# 저장소 맨 위 폴더의 .env를 읽습니다. (config.py → app → backend → what_the-lab)
ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")

DISCORD_CLIENT_ID = os.environ["DISCORD_CLIENT_ID"]
DISCORD_CLIENT_SECRET = os.environ["DISCORD_CLIENT_SECRET"]
DISCORD_REDIRECT_URI = os.environ["DISCORD_REDIRECT_URI"]
JWT_SECRET = os.environ["JWT_SECRET"]
FRONTEND_URL = os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")