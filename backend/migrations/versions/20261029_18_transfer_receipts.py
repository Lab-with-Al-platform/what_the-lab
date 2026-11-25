"""전송 묶음 접수 이력과 당시 후보/판본 매핑을 추가합니다.

기존 후보 상태 enum은 바꾸지 않습니다. 원격 DB 적용·stamp는 이 파일이 하지 않습니다.
"""

import sqlalchemy as sa
from alembic import op

revision = "20261029_18"
down_revision = "20261028_17"
branch_labels = None
depends_on = None
SCHEMA = "insight_private"
TABLES = ("transfer_receipts", "transfer_receipt_items")


def upgrade() -> None:
    op.create_table(
        "transfer_receipts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("trust_scope", sa.String(64), nullable=False),
        sa.Column("bundle_id", sa.String(100), nullable=False),
        sa.Column("run_id", sa.String(100), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("outcome", sa.String(30), nullable=False),
        sa.Column("first_result", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("trust_scope", "bundle_id", name="uq_transfer_receipt_scope_bundle"),
        sa.CheckConstraint(
            "outcome IN ('imported','existing_preserved')",
            name="ck_transfer_receipt_outcome",
        ),
        schema=SCHEMA,
    )
    op.create_table(
        "transfer_receipt_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "receipt_id",
            sa.String(36),
            sa.ForeignKey(f"{SCHEMA}.transfer_receipts.id"),
            nullable=False,
        ),
        sa.Column("item_index", sa.Integer(), nullable=False),
        sa.Column("candidate_id", sa.String(36)),
        sa.Column("revision_number", sa.Integer()),
        sa.Column("action", sa.String(30), nullable=False),
        sa.UniqueConstraint("receipt_id", "item_index", name="uq_transfer_receipt_item_index"),
        sa.CheckConstraint(
            "action IN ('created','existing_preserved','duplicate_in_batch')",
            name="ck_transfer_receipt_item_action",
        ),
        schema=SCHEMA,
    )
    for table in TABLES:
        op.execute(f"ALTER TABLE {SCHEMA}.{table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"REVOKE ALL ON TABLE {SCHEMA}.{table} FROM PUBLIC")
        op.execute(f"""DO $$ DECLARE role_name text; BEGIN
            FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
                    EXECUTE format('REVOKE ALL ON TABLE {SCHEMA}.{table} FROM %I', role_name);
                END IF;
            END LOOP;
        END $$""")


def downgrade() -> None:
    raise RuntimeError("접수 이력은 자동 삭제하지 않습니다. 백업 후 별도 검토하세요.")
