"""작업 회차 저장 표를 추가합니다.

후보 상태 enum과 접수 이력 표는 바꾸지 않습니다. 원격 DB 적용·stamp는 이 파일이 하지 않습니다.
"""

import sqlalchemy as sa
from alembic import op

revision = "20261029_20"
down_revision = "20261029_19"
branch_labels = None
depends_on = None
SCHEMA = "insight_private"
TABLE = "agent_runs"


def upgrade() -> None:
    op.create_table(
        TABLE,
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("run_id", sa.String(100), nullable=False),
        sa.Column("step", sa.String(30), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("settings_version", sa.String(80), nullable=False),
        sa.Column("settings_hash", sa.String(64), nullable=False),
        sa.Column("input_hash", sa.String(64), nullable=False),
        sa.Column("manuscript_hash", sa.String(64)),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column("budget_usage", sa.JSON(), nullable=False),
        sa.Column("error_code", sa.String(50)),
        sa.Column("evidence_ids", sa.JSON(), nullable=False),
        sa.Column("bundle_id", sa.String(120)),
        sa.Column("lease_owner", sa.String(80)),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True)),
        sa.Column("state_version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("run_id", name="uq_agent_run_id"),
        sa.CheckConstraint("state_version >= 1", name="ck_agent_run_state_version"),
        sa.CheckConstraint("attempt_count >= 0", name="ck_agent_run_attempt_count"),
        sa.CheckConstraint(
            "step IN ('queued','researching','drafting','reviewing','ready_for_human')",
            name="ck_agent_run_step",
        ),
        sa.CheckConstraint(
            "status IN ('queued','researching','drafting','reviewing',"
            "'ready_for_human','needs_revision','held','failed','cancelled')",
            name="ck_agent_run_status",
        ),
        schema=SCHEMA,
    )
    op.execute(f"ALTER TABLE {SCHEMA}.{TABLE} ENABLE ROW LEVEL SECURITY")
    op.execute(f"REVOKE ALL ON TABLE {SCHEMA}.{TABLE} FROM PUBLIC")
    op.execute(f"""DO $$ DECLARE role_name text; BEGIN
        FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
                EXECUTE format('REVOKE ALL ON TABLE {SCHEMA}.{TABLE} FROM %I', role_name);
            END IF;
        END LOOP;
    END $$""")


def downgrade() -> None:
    raise RuntimeError("작업 회차 저장은 자동 삭제하지 않습니다. 백업 후 별도 검토하세요.")
