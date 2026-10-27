"""협업 공간: collaboration(협업) · collaboration_schedule(일정) 테이블을 공통 Supabase에 만듭니다.

SQL 본문은 backend/migrations/sql/20261028_13/ 에 동결해 두었습니다. (Docker용 database/init/012 와 같은 내용)
이미 [협업 시작하기]를 누른 요청(status=started)은 협업으로 옮겨 줘요. 기존 요청·연구는 지우지 않아요.
"""

from pathlib import Path

from alembic import op

revision = "20261028_13"
down_revision = "20261027_12"
branch_labels = None
depends_on = None

SQL_FILE = Path(__file__).resolve().parents[1] / "sql" / revision / "001_create_collaboration.sql"


def upgrade() -> None:
    # 같은 DB에 동시에 적용하지 않도록 트랜잭션이 끝날 때까지 잠급니다.
    op.execute("SELECT pg_advisory_xact_lock(20261028, 13)")
    op.execute("SET LOCAL search_path TO public, pg_catalog")
    # 이미 적용된 DB에는 다시 적용하지 않고 멈춥니다.
    op.execute("""
        DO $guard$ BEGIN
            IF to_regclass('public.collaboration') IS NOT NULL THEN
                RAISE EXCEPTION 'collaboration 테이블이 이미 있어요. 자동 적용을 중단합니다.';
            END IF;
        END $guard$;
    """)
    op.execute(SQL_FILE.read_text(encoding="utf-8"))


def downgrade() -> None:
    # 협업 기록과 일정을 실수로 지우지 않도록 자동 되돌리기는 제공하지 않습니다.
    raise RuntimeError("협업·일정 테이블 삭제는 자동 실행하지 않습니다. 백업 후 별도 복구 계획이 필요해요.")