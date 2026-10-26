"""협업 요청 규칙 보완: collaboration_request 칸 6개 + 알림 종류 1개를 공통 Supabase에 추가합니다.

SQL 본문은 backend/migrations/sql/20261027_07/ 에 동결해 두었습니다. (Docker용 database/init/009 와 같은 내용)
기존 요청·알림은 지우지 않아요. 새 칸은 기본값(급해요 아님, 나머지 비어 있음)으로 채워져요.
"""

from pathlib import Path

from alembic import op

revision = "20261027_07"
down_revision = "20261025_06"
branch_labels = None
depends_on = None

SQL_FILE = Path(__file__).resolve().parents[1] / "sql" / revision / "001_alter_request_rules.sql"


def upgrade() -> None:
    # 같은 DB에 동시에 적용하지 않도록 트랜잭션이 끝날 때까지 잠급니다.
    op.execute("SELECT pg_advisory_xact_lock(20261027, 7)")
    op.execute("SET LOCAL search_path TO public, pg_catalog")
    # 이미 적용된 DB에는 다시 적용하지 않고 멈춥니다.
    op.execute("""
        DO $guard$ BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'public' AND table_name = 'collaboration_request'
                         AND column_name = 'is_urgent') THEN
                RAISE EXCEPTION 'collaboration_request.is_urgent 칸이 이미 있어요. 자동 적용을 중단합니다.';
            END IF;
        END $guard$;
    """)
    op.execute(SQL_FILE.read_text(encoding="utf-8"))


def downgrade() -> None:
    # 요청 기록(기간 조정·취소 이유)을 실수로 지우지 않도록 자동 되돌리기는 제공하지 않습니다.
    raise RuntimeError("요청 규칙 칸 삭제는 자동 실행하지 않습니다. 백업 후 별도 복구 계획이 필요해요.")