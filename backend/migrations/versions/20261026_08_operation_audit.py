"""회원 정지·해제 이력. 원격 DB에는 이 파일만으로 적용하지 않습니다.

부모는 조회수 개정 20261026_07입니다. 07의 부모는 알림 20261025_06입니다.
"""

from pathlib import Path

from alembic import op

revision = "20261026_08"
down_revision = "20261026_07"
branch_labels = None
depends_on = None

SQL_FILE = Path(__file__).resolve().parents[1] / "sql" / "20261026_08" / "001_create_operation_audit.sql"
TABLE = "operation_audit"


def upgrade() -> None:
    op.execute("SELECT pg_advisory_xact_lock(20261026, 8)")
    op.execute("SET LOCAL search_path TO public, pg_catalog")
    op.execute(f"""
        DO $guard$ BEGIN
            IF to_regclass('public.{TABLE}') IS NOT NULL THEN
                RAISE EXCEPTION '{TABLE} 테이블이 이미 있어요. 자동 덮어쓰기를 중단합니다.';
            END IF;
        END $guard$;
    """)
    op.execute(SQL_FILE.read_text(encoding="utf-8"))
    op.execute(f"ALTER TABLE public.{TABLE} ENABLE ROW LEVEL SECURITY")
    op.execute(f"REVOKE ALL ON TABLE public.{TABLE} FROM PUBLIC")
    op.execute(f"REVOKE ALL ON SEQUENCE public.{TABLE}_audit_id_seq FROM PUBLIC")
    op.execute(f"""DO $$ DECLARE role_name text; BEGIN
        FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
                EXECUTE format('REVOKE ALL ON TABLE public.{TABLE} FROM %I', role_name);
                EXECUTE format('REVOKE ALL ON SEQUENCE public.{TABLE}_audit_id_seq FROM %I', role_name);
            END IF;
        END LOOP;
    END $$""")


def downgrade() -> None:
    raise RuntimeError("운영 이력은 자동 삭제하지 않습니다.")
