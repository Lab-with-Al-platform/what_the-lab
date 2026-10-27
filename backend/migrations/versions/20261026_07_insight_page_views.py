"""공개 인사이트 조회수 원본과 일별 합계를 추가합니다. 기존 원고 테이블은 바꾸지 않습니다.

이 브랜치 작업 폴더에는 20261025_06 파일이 없습니다. 그 개정은 다른 기능 브랜치에 있고
원격 DB에는 이미 적용되어 있습니다. 없는 개정을 가리키면 로컬 Alembic 검사가 깨지므로
지금 파일의 부모는 이 폴더의 마지막 개정인 20261022_05입니다.
원격에 적용하기 전에는 하지 않습니다. 06 파일이 같은 브랜치에 합쳐진 뒤에
down_revision을 20261025_06으로 바꾼 다음 적용해야 사슬이 한 줄로 이어집니다.
"""

import sqlalchemy as sa
from alembic import op

revision = "20261026_07"
down_revision = "20261022_05"
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
