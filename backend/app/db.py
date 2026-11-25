"""PostgreSQL 접속을 한곳에서 만듭니다."""

from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

from app.database_config import get_database_url


def get_connection() -> psycopg.Connection:
    """DB 연결 하나를 엽니다. `with get_connection() as conn:` 으로 쓰면 끝날 때 자동으로 닫힙니다."""
    url = get_database_url()
    connection_args = url.translate_connect_args(username="user", database="dbname")
    # Supabase URL의 sslmode 같은 연결 옵션도 회원 DB에 그대로 전달합니다.
    connection_args.update(url.query)
    connection_args.setdefault("connect_timeout", 5)
    return psycopg.connect(
        **connection_args,
        row_factory=dict_row,  # 조회 결과를 dict로 받습니다.
        autocommit=True,  # SQL 한 줄은 실행 즉시 저장합니다.
    )


@contextmanager
def transaction():
    """with 블록 안의 SQL을 한 묶음으로 저장합니다. 중간에 실패하면 전부 취소돼요.

    사용법: with transaction() as cursor: cursor.execute(...)
    """
    with get_connection() as conn, conn.transaction(), conn.cursor() as cursor:
        yield cursor
