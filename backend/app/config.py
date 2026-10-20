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


# MySQL (docker-compose로 띄운 DB)
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "3309"))
DB_NAME = os.environ["DB_NAME"]
DB_USER = os.environ["DB_USER"]
DB_PASSWORD = os.environ["DB_PASSWORD"]

# 실행 환경. development일 때만 인증번호를 화면에 보여 줍니다.
APP_ENV = os.getenv("APP_ENV", "production")


# 포트폴리오 PDF처럼 사용자가 올린 파일을 두는 폴더. git에 올리지 않습니다(.gitignore).
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(ROOT_DIR / "backend" / "uploads")))