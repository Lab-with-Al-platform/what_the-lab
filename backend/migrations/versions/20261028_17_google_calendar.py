"""구글 캘린더 연동: 협업 캘린더 번호, 일정 구글 반영 상태, 지운 일정 대기열. 일정 수정자·데이터 유형도 같이.

SQL 본문은 backend/migrations/sql/20261028_17/ 에 동결해 두었습니다. (Docker용 database/init/021 과 같은 칸)
기존 협업·일정은 지우지 않아요. 기존 일정은 구글 캘린더가 아직 없으니 'none' 이에요.
협업·일정 테이블(20261028_13)에 빠져 있던 브라우저용 역할 차단(RLS)도 여기서 같이 겁니다.
"""

from pathlib import Path

from alembic import op

revision = "20261028_17"
down_revision = "20261028_16"
branch_labels = None
depends_on = None

SQL_FILE = Path(__file__).resolve().parents[1] / "sql" / revision / "001_add_google_calendar.sql"
# 20261021_02·20261025_06과 같은 보안 규칙: 브라우저용 역할은 직접 읽고 쓸 수 없고, FastAPI 서버 연결만 써요.
TABLES = ("collaboration", "collaboration_schedule", "google_event_trash")
SEQUENCES = (
    "collaboration_collaboration_id_seq",
    "collaboration_schedule_schedule_id_seq",
    "google_event_trash_trash_id_seq",
)
API_ROLES = ("anon", "authenticated", "service_role")  # Supabase가 브라우저 API용으로 만드는 역할


def upgrade() -> None:
    # 같은 DB에 동시에 적용하지 않도록 트랜잭션이 끝날 때까지 잠급니다.
    op.execute("SELECT pg_advisory_xact_lock(20261028, 17)")
    op.execute("SET LOCAL search_path TO public, pg_catalog")
    # 이미 적용된 DB에는 다시 적용하지 않고 멈춥니다.
    op.execute("""
        DO $guard$ BEGIN
            IF to_regclass('public.google_event_trash') IS NOT NULL THEN
                RAISE EXCEPTION 'google_event_trash 테이블이 이미 있어요. 자동 적용을 중단합니다.';
            END IF;
        END $guard$;
    """)
    op.execute(SQL_FILE.read_text(encoding="utf-8"))

    for table in TABLES:
        op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"REVOKE ALL ON TABLE public.{table} FROM PUBLIC")
    for sequence in SEQUENCES:
        op.execute(f"REVOKE ALL ON SEQUENCE public.{sequence} FROM PUBLIC")
    for role in API_ROLES:
        revokes = "\n".join(
            [f"REVOKE ALL ON TABLE public.{table} FROM {role};" for table in TABLES]
            + [f"REVOKE ALL ON SEQUENCE public.{sequence} FROM {role};" for sequence in SEQUENCES]
        )
        op.execute(f"""
            DO $permissions$ BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role}') THEN
                    {revokes}
                END IF;
            END $permissions$;
        """)


def downgrade() -> None:
    # 구글 캘린더와 연결이 끊어지지 않도록 자동 되돌리기는 제공하지 않습니다.
    raise RuntimeError("구글 캘린더 칸 삭제는 자동 실행하지 않습니다. 백업 후 별도 복구 계획이 필요해요.")