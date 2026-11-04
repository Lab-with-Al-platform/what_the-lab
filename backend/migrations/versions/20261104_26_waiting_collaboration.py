"""시작 전 협업: 시작일 미루기(collaboration_change.kind = 'start') · 요청 닫힘 사유 expert_busy · 채널 상태 deleted · 알림 종류 7개.

SQL 본문은 backend/migrations/sql/20261104_26/ 에 동결해 두었습니다. (Docker용 database/init/030 과 같은 변경)
기존 협업 · 요청 · 알림은 지우거나 바꾸지 않아요. 칸과 규칙만 넓혀요.
"""

from pathlib import Path

from alembic import op

revision = "20261104_26"
down_revision = "20261104_25"
branch_labels = None
depends_on = None

SQL_FILE = Path(__file__).resolve().parents[1] / "sql" / revision / "001_add_waiting_collaboration.sql"


def upgrade() -> None:
    # 같은 DB에 동시에 적용하지 않도록 트랜잭션이 끝날 때까지 잠급니다.
    op.execute("SELECT pg_advisory_xact_lock(20261104, 26)")
    op.execute("SET LOCAL search_path TO public, pg_catalog")
    # 이미 적용된 DB에는 다시 적용하지 않고 멈춥니다.
    op.execute("""
        DO $guard$ BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'public' AND table_name = 'collaboration_change' AND column_name = 'new_start_date') THEN
                RAISE EXCEPTION 'collaboration_change.new_start_date 가 이미 있어요. 자동 적용을 중단합니다.';
            END IF;
        END $guard$;
    """)
    op.execute(SQL_FILE.read_text(encoding="utf-8"))


def downgrade() -> None:
    # 미루기 기록 · 알림이 지워지지 않도록 자동 되돌리기는 제공하지 않습니다.
    raise RuntimeError("시작 전 협업 칸 삭제는 자동 실행하지 않습니다. 백업 후 별도 복구 계획이 필요해요.")