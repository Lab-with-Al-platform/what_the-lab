"""인사이트 수집 설정 저장만 추가합니다. 수집기·스케줄러는 실행하지 않습니다."""

import sqlalchemy as sa
from alembic import op

revision = "20261022_04"
down_revision = "20261021_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "collection_settings",
        sa.Column("id", sa.String(30), primary_key=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("updated_by", sa.String(32), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("version >= 1", name="ck_collection_settings_version"),
        schema="insight_private",
    )
    op.execute("ALTER TABLE insight_private.collection_settings ENABLE ROW LEVEL SECURITY")
    op.execute("REVOKE ALL ON TABLE insight_private.collection_settings FROM PUBLIC")
    op.execute("""DO $$ DECLARE role_name text; BEGIN
        FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
                EXECUTE format('REVOKE ALL ON TABLE insight_private.collection_settings FROM %I', role_name);
            END IF;
        END LOOP;
    END $$""")


def downgrade() -> None:
    raise RuntimeError("저장한 수집 설정은 자동 삭제하지 않습니다. 백업 후 별도 검토하세요.")
