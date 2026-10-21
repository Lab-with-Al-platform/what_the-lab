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


# DB 설정의 해석은 app.database_config에서 공통 처리합니다.
# DATABASE_URL만 설정해도 회원·인사이트가 같은 DB에 연결됩니다.

# 실행 환경. development일 때만 인증번호를 화면에 보여 줍니다.
APP_ENV = os.getenv("APP_ENV", "production")


# 포트폴리오 PDF처럼 사용자가 올린 파일을 두는 폴더. git에 올리지 않습니다(.gitignore).
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(ROOT_DIR / "backend" / "uploads")))
