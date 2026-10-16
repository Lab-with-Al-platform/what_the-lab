"""서버 전용 DB 연결. 앱 시작만으로 테이블을 만들지는 않습니다."""

import os
from collections.abc import Iterator
from functools import lru_cache

from fastapi import HTTPException
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session

SCHEMA = "insight_private"


class Base(DeclarativeBase):
    pass


def build_engine(database_url: str, *, allow_sqlite: bool = False) -> Engine:
    """운영은 PostgreSQL, 단위 테스트만 명시적으로 SQLite를 허용합니다."""
    url = make_url(database_url)
    if url.drivername in {"postgres", "postgresql"}:
        url = url.set(drivername="postgresql+psycopg")
    if url.drivername == "sqlite" and allow_sqlite:
        engine = create_engine(
            url,
            connect_args={"check_same_thread": False},
            execution_options={"schema_translate_map": {SCHEMA: None}},
        )

        @event.listens_for(engine, "connect")
        def enable_foreign_keys(connection, _record) -> None:
            connection.execute("PRAGMA foreign_keys=ON")

        return engine
    if url.drivername != "postgresql+psycopg":
        raise ValueError("인사이트 운영 DB는 PostgreSQL이어야 합니다.")
    return create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 5})


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    database_url = os.getenv("DATABASE_URL", "")
    if not database_url:
        raise HTTPException(503, "인사이트 DB 연결이 설정되지 않았습니다.")
    try:
        return build_engine(database_url)
    except (ValueError, TypeError):
        # 연결 문자열에는 비밀번호가 있어 원래 예외 내용을 응답에 포함하지 않습니다.
        raise HTTPException(503, "인사이트 DB 연결 설정을 확인해 주세요.") from None


def get_session() -> Iterator[Session]:
    """요청 하나를 트랜잭션 하나로 묶어 실패 시 함께 되돌립니다."""
    try:
        with Session(get_engine()) as session, session.begin():
            yield session
    except SQLAlchemyError:
        raise HTTPException(503, "인사이트 DB에 접근할 수 없습니다.") from None
