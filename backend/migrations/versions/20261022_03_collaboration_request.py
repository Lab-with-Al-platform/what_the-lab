"""협업 요청(연구회원 → AI 전문가) 테이블을 공통 Supabase에 추가합니다.

SQL 본문은 backend/migrations/sql/20261022_03/ 에 동결해 두었습니다. (Docker용 database/init/007 과 같은 내용)
"""

from pathlib import Path

from alembic import op

revision = "20261022_03"
down_revision = "20261021_02"
branch_labels = None
depends_on = None

SQL_FILE = Path(__file__).resolve().parents[1] / "sql" / revision / "001_create_collaboration_request.sql"
TABLE = "collaboration_request"
API_ROLES = ("anon", "authenticated", "service_role")  # Supabase가 브라우저 API용으로 만드는 역할


def upgrade() -> None:
    # 같은 DB에 동시에 적용하지 않도록 트랜잭션이 끝날 때까지 잠급니다.
    op.execute("SELECT pg_advisory_xact_lock(20261022, 3)")
    op.execute("SET LOCAL search_path TO public, pg_catalog")
    # 이미 있으면 덮어쓰지 않고 멈춥니다.
    op.execute(f"""
        DO $guard$ BEGIN
            IF to_regclass('public.{TABLE}') IS NOT NULL THEN
                RAISE EXCEPTION '{TABLE} 테이블이 이미 있어요. 자동 덮어쓰기를 중단합니다.';
            END IF;
        END $guard$;
    """)
    op.execute(SQL_FILE.read_text(encoding="utf-8"))

    # 20261021_02와 같은 보안 규칙: 브라우저용 역할은 직접 읽고 쓸 수 없고, FastAPI 서버 연결만 사용합니다.
    op.execute(f"ALTER TABLE public.{TABLE} ENABLE ROW LEVEL SECURITY")
    op.execute(f"REVOKE ALL ON TABLE public.{TABLE} FROM PUBLIC")
    op.execute(f"REVOKE ALL ON SEQUENCE public.{TABLE}_request_id_seq FROM PUBLIC")
    for role in API_ROLES:
        op.execute(f"""
            DO $permissions$ BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role}') THEN
                    REVOKE ALL ON TABLE public.{TABLE} FROM {role};
                    REVOKE ALL ON SEQUENCE public.{TABLE}_request_id_seq FROM {role};
                END IF;
            END $permissions$;
        """)


def downgrade() -> None:
    # 요청 기록을 실수로 지우지 않도록 자동 되돌리기는 제공하지 않습니다.
    raise RuntimeError("협업 요청 기록 삭제는 자동 실행하지 않습니다. 백업 후 별도 복구 계획이 필요합니다.")