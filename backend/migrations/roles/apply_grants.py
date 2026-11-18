"""02_grant_privileges.sql 을 DATABASE_URL(표의 주인 = labbridge_migrator)로 실행해요. (B11)

backend 이미지 안에 psql 이 없어서, deploy.sh 는 이 파일로 권한을 맞춰요.
    python migrations/roles/apply_grants.py
"""

import sys
from pathlib import Path

import psycopg

BACKEND_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND_DIR))  # 어느 폴더에서 실행해도 app 을 찾게

from app.database_config import get_database_url

GRANTS_SQL = Path(__file__).with_name("02_grant_privileges.sql")


def connection_string() -> str:
    """SQLAlchemy 주소(postgresql+psycopg://)를 psycopg가 읽는 주소로 바꿔요."""
    url = get_database_url().set(drivername="postgresql")
    return url.render_as_string(hide_password=False)


def main() -> None:
    sql = GRANTS_SQL.read_text(encoding="utf-8")
    with psycopg.connect(connection_string(), autocommit=True) as conn:
        conn.execute(sql)
        policies = conn.execute(
            "SELECT count(*) FROM pg_policies WHERE policyname LIKE 'labbridge_%'"
        ).fetchone()[0]
    print(f"권한 맞추기 완료 (labbridge_* 정책 {policies}개)")


if __name__ == "__main__":
    main()
