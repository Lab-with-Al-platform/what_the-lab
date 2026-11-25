"""방문·등록 과정 수집 표. 원격 DB에는 이 파일만으로 적용하지 않습니다.

부모는 운영 이력 20261026_08입니다. 사슬은 알림 06 다음 조회수 07, 운영 이력 08, 이 개정 09입니다.
"""

from pathlib import Path

from alembic import op

revision = "20261026_09"
down_revision = "20261026_08"
branch_labels = None
depends_on = None

SQL_FILE = (
    Path(__file__).resolve().parents[1] / "sql" / "20261026_09" / "001_create_analytics_events.sql"
)
TABLES = ("analytics_events", "analytics_event_daily")


def upgrade() -> None:
    op.execute("SELECT pg_advisory_xact_lock(20261026, 9)")
    op.execute("SET LOCAL search_path TO public, pg_catalog")
    for table in TABLES:
        op.execute(f"""
            DO $guard$ BEGIN
                IF to_regclass('public.{table}') IS NOT NULL THEN
                    RAISE EXCEPTION '{table} 테이블이 이미 있어요. 자동 덮어쓰기를 중단합니다.';
                END IF;
            END $guard$;
        """)
    op.execute(SQL_FILE.read_text(encoding="utf-8"))
    for table in TABLES:
        op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"REVOKE ALL ON TABLE public.{table} FROM PUBLIC")
        op.execute(f"""DO $$ DECLARE role_name text; BEGIN
            FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
                    EXECUTE format('REVOKE ALL ON TABLE public.{table} FROM %I', role_name);
                END IF;
            END LOOP;
        END $$""")


def downgrade() -> None:
    raise RuntimeError("수집 원본은 자동 삭제하지 않습니다.")
