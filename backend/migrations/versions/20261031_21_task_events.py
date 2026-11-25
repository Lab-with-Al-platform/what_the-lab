"""요청 기록(collaboration_task_event): 남김 · 완료 · 취소 · 되돌리기 · 기한 변경 · 기한 얘기하기 · 다시 요청.

SQL 본문은 backend/migrations/sql/20261031_21/ 에 동결해 두었습니다. (Docker용 database/init/025 와 같은 테이블)
기존 요청은 지우거나 바꾸지 않아요. 이미 있는 요청은 남긴 때 · 끝낸 때 기록을 채워요.
"""

from pathlib import Path

from alembic import op

revision = "20261031_21"
down_revision = "20261029_20"
branch_labels = None
depends_on = None

SQL_FILE = Path(__file__).resolve().parents[1] / "sql" / revision / "001_add_task_events.sql"
# 20261029_19와 같은 보안 규칙: 브라우저용 역할은 직접 읽고 쓸 수 없고, FastAPI 서버 연결만 써요.
TABLE = "collaboration_task_event"
SEQUENCE = "collaboration_task_event_event_id_seq"
API_ROLES = ("anon", "authenticated", "service_role")  # Supabase가 브라우저 API용으로 만드는 역할


def upgrade() -> None:
    # 같은 DB에 동시에 적용하지 않도록 트랜잭션이 끝날 때까지 잠급니다.
    op.execute("SELECT pg_advisory_xact_lock(20261031, 21)")
    op.execute("SET LOCAL search_path TO public, pg_catalog")
    # 이미 적용된 DB에는 다시 적용하지 않고 멈춥니다.
    op.execute("""
        DO $guard$ BEGIN
            IF to_regclass('public.collaboration_task_event') IS NOT NULL THEN
                RAISE EXCEPTION 'collaboration_task_event 테이블이 이미 있어요. 자동 적용을 중단합니다.';
            END IF;
        END $guard$;
    """)
    op.execute(SQL_FILE.read_text(encoding="utf-8"))

    op.execute(f"ALTER TABLE public.{TABLE} ENABLE ROW LEVEL SECURITY")
    op.execute(f"REVOKE ALL ON TABLE public.{TABLE} FROM PUBLIC")
    op.execute(f"REVOKE ALL ON SEQUENCE public.{SEQUENCE} FROM PUBLIC")
    for role in API_ROLES:
        op.execute(f"""
            DO $permissions$ BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role}') THEN
                    REVOKE ALL ON TABLE public.{TABLE} FROM {role};
                    REVOKE ALL ON SEQUENCE public.{SEQUENCE} FROM {role};
                END IF;
            END $permissions$;
        """)


def downgrade() -> None:
    # 요청 기록이 지워지지 않도록 자동 되돌리기는 제공하지 않습니다.
    raise RuntimeError("요청 기록 테이블 삭제는 자동 실행하지 않습니다. 백업 후 별도 복구 계획이 필요해요.")