"""일정 알림: 알림 표에 일정 번호 · 그때의 일정 글자 칸과 일정 알림 종류를 더하고, 아침 알림 중복 막기에 일정을 넣습니다.

SQL 본문은 backend/migrations/sql/20261101_23/ 에 동결해 두었습니다. (Docker용 database/init/027 과 같은 변경)
기존 알림은 지우거나 바꾸지 않아요. 칸과 규칙만 넓혀요.
"""

from pathlib import Path

from alembic import op

revision = "20261101_23"
down_revision = "20261031_22"
branch_labels = None
depends_on = None

SQL_FILE = Path(__file__).resolve().parents[1] / "sql" / revision / "001_add_schedule_notifications.sql"


def upgrade() -> None:
    # 같은 DB에 동시에 적용하지 않도록 트랜잭션이 끝날 때까지 잠급니다.
    op.execute("SELECT pg_advisory_xact_lock(20261101, 23)")
    op.execute("SET LOCAL search_path TO public, pg_catalog")
    # 이미 적용된 DB에는 다시 적용하지 않고 멈춥니다.
    op.execute("""
        DO $guard$ BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'public' AND table_name = 'notification' AND column_name = 'schedule_id') THEN
                RAISE EXCEPTION 'notification.schedule_id 가 이미 있어요. 자동 적용을 중단합니다.';
            END IF;
        END $guard$;
    """)
    op.execute(SQL_FILE.read_text(encoding="utf-8"))


def downgrade() -> None:
    # 알림 · 기록이 지워지지 않도록 자동 되돌리기는 제공하지 않습니다.
    raise RuntimeError("일정 알림 칸 삭제는 자동 실행하지 않습니다. 백업 후 별도 복구 계획이 필요해요.")