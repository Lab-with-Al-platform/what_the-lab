"""회원과 인사이트가 같은 PostgreSQL 연결 대상을 사용하도록 설정합니다."""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import ArgumentError

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


def get_database_url() -> URL:
    """DATABASE_URL을 우선하고, 없을 때만 기존 DB_* 설정을 사용합니다."""
    try:
        raw_url = os.getenv("DATABASE_URL", "").strip()
        if raw_url:
            url = make_url(raw_url)
        else:
            # URL.create는 비밀번호의 @, # 같은 문자를 직접 이어 붙이지 않아도 됩니다.
            url = URL.create(
                "postgresql+psycopg",
                host=os.getenv("DB_HOST", "127.0.0.1"),
                port=int(os.getenv("DB_PORT", "5433")),
                database=os.getenv("DB_NAME"),
                username=os.getenv("DB_USER"),
                password=os.getenv("DB_PASSWORD"),
            )
        if url.drivername not in {"postgres", "postgresql", "postgresql+psycopg"}:
            raise ValueError
        if not url.host or not url.database or not url.username or not url.password:
            raise ValueError
        if url.host.endswith(".supabase.co") or url.host.endswith(".supabase.com"):
            if url.query.get("sslmode") in {"disable", "allow", "prefer"}:
                raise ValueError
            # Supabase 원격 연결은 SSL을 기본으로 하고 더 강한 검증 설정은 유지합니다.
            if "sslmode" not in url.query:
                url = url.update_query_dict({"sslmode": "require"})
        return url.set(drivername="postgresql+psycopg")
    except (ArgumentError, ValueError, TypeError):
        # 원래 예외에 연결 문자열이나 비밀번호가 포함될 수 있어 숨깁니다.
        raise ValueError("공통 PostgreSQL 연결 설정을 확인해 주세요.") from None
