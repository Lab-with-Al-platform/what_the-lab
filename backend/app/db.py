"""PostgreSQL 접속을 한곳에서 만듭니다."""

from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

from app import config


def get_connection() -> psycopg.Connection:
    """DB 연결 하나를 엽니다. `with get_connection() as conn:` 으로 쓰면 끝날 때 자동으로 닫힙니다."""
    return psycopg.connect(
        host=config.DB_HOST,
        port=config.DB_PORT,
        user=config.DB_USER,
        password=config.DB_PASSWORD,
        dbname=config.DB_NAME,
        row_factory=dict_row,  # 조회 결과를 dict로 받습니다.
        autocommit=True,  # SQL 한 줄은 실행 즉시 저장합니다.
        connect_timeout=5,  # DB(Docker)가 꺼져 있으면 5초 안에 오류를 냅니다.
    )


@contextmanager
def transaction():
    """with 블록 안의 SQL을 한 묶음으로 저장합니다. 중간에 실패하면 전부 취소돼요.

    사용법: with transaction() as cursor: cursor.execute(...)
    """
    with get_connection() as conn, conn.transaction(), conn.cursor() as cursor:
        yield cursor