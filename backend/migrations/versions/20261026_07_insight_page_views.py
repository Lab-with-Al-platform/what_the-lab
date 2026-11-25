"""공개 인사이트 조회수 원본과 일별 합계를 추가합니다. 기존 원고 테이블은 바꾸지 않습니다.

알림 개정 20261025_06이 같은 브랜치에 있으므로 부모는 그 개정입니다.
원격 DB에는 07부터 게시판 11까지를 이 파일만으로 적용하지 않습니다.
"""

import sqlalchemy as sa
from alembic import op

revision = "20261026_07"
down_revision = "20261025_06"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "insight_page_views",
        sa.Column("event_id", sa.String(36), primary_key=True),
        sa.Column(
            "content_id",
            sa.String(36),
            sa.ForeignKey("insight_private.publications.id"),
            nullable=False,
        ),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        schema="insight_private",
    )
    op.create_table(
        "insight_page_view_daily",
        sa.Column(
            "content_id",
            sa.String(36),
            sa.ForeignKey("insight_private.publications.id"),
            primary_key=True,
        ),
        sa.Column("view_date", sa.Date(), primary_key=True),
        sa.Column("page_views", sa.Integer(), nullable=False),
        schema="insight_private",
    )
    for table in ("insight_page_views", "insight_page_view_daily"):
        op.execute(f"ALTER TABLE insight_private.{table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"REVOKE ALL ON TABLE insight_private.{table} FROM PUBLIC")
        op.execute(f"""DO $$ DECLARE role_name text; BEGIN
            FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
                    EXECUTE format('REVOKE ALL ON TABLE insight_private.{table} FROM %I', role_name);
                END IF;
            END LOOP;
        END $$""")


def downgrade() -> None:
    raise RuntimeError("조회수 기록은 자동 삭제하지 않습니다. 백업 후 별도 검토하세요.")
