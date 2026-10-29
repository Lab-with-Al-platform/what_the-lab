"""협업 상세: 요청(collaboration_task) · 정한 것(collaboration_decision) · 기간 연장/조기 완료 요청(collaboration_change).

collaboration 에는 취소·중단한 사람과 이유, 취소된 협업의 디스코드 채널을 지울 때를 더합니다.
SQL 본문은 backend/migrations/sql/20261029_19/ 에 동결해 두었습니다. (Docker용 database/init/023 와 같은 테이블)
기존 협업·일정은 지우거나 바꾸지 않아요. 새 테이블 세 개는 처음엔 비어 있어요.
"""

from pathlib import Path

from alembic import op

revision = "20261029_19"
down_revision = "20261029_18"
branch_labels = None
depends_on = None

SQL_FILE = Path(__file__).resolve().parents[1] / "sql" / revision / "001_add_collaboration_detail.sql"
# 20261021_02·20261025_06·20261028_17과 같은 보안 규칙: 브라우저용 역할은 직접 읽고 쓸 수 없고, FastAPI 서버 연결만 써요.
TABLES = ("collaboration_task", "collaboration_decision", "collaboration_change")
SEQUENCES = (
    "collaboration_task_task_id_seq",
    "collaboration_decision_decision_id_seq",
    "collaboration_change_change_id_seq",
)
API_ROLES = ("anon", "authenticated", "service_role")  # Supabase가 브라우저 API용으로 만드는 역할


def upgrade() -> None:
    # 같은 DB에 동시에 적용하지 않도록 트랜잭션이 끝날 때까지 잠급니다.
    op.execute("SELECT pg_advisory_xact_lock(20261029, 19)")
    op.execute("SET LOCAL search_path TO public, pg_catalog")
    # 이미 적용된 DB에는 다시 적용하지 않고 멈춥니다.
    op.execute("""
        DO $guard$ BEGIN
            IF to_regclass('public.collaboration_task') IS NOT NULL THEN
                RAISE EXCEPTION 'collaboration_task 테이블이 이미 있어요. 자동 적용을 중단합니다.';
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
    # 협업 기록(요청·정한 것·기간 변경)이 지워지지 않도록 자동 되돌리기는 제공하지 않습니다.
    raise RuntimeError("협업 상세 테이블 삭제는 자동 실행하지 않습니다. 백업 후 별도 복구 계획이 필요해요.")