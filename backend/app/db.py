"""MySQL 접속을 한곳에서 만듭니다."""
import pymysql
from pymysql.cursors import DictCursor

from app import config


def get_connection() -> pymysql.connections.Connection:
    """DB 연결 하나를 엽니다. `with get_connection() as conn:` 으로 쓰면 끝날 때 자동으로 닫힙니다."""
    return pymysql.connect(
        host=config.DB_HOST,
        port=config.DB_PORT,
        user=config.DB_USER,
        password=config.DB_PASSWORD,
        database=config.DB_NAME,
        charset="utf8mb4",
        cursorclass=DictCursor,  # 조회 결과를 dict로 받습니다.
        autocommit=True,  # SQL 한 줄은 실행 즉시 저장합니다.
    )