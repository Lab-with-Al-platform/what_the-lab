"""출처·후보·불변 버전·검토 이력·공개 스냅샷.

최초 schema는 기존 사용자 테이블을 변경하지 않습니다.
"""

import sqlalchemy as sa
from alembic import op

revision = "20261016_01"
down_revision = None
branch_labels = None
depends_on = None
SCHEMA = "insight_private"


def upgrade() -> None:
    op.execute(sa.schema.CreateSchema(SCHEMA))
    op.execute(sa.text(f"REVOKE ALL ON SCHEMA {SCHEMA} FROM PUBLIC"))
    op.create_table(
        "sources",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("doi", sa.String(255), unique=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False, unique=True),
        sa.Column("access_level", sa.String(30), nullable=False),
        sa.Column("bibliography_checked", sa.Boolean(), nullable=False),
        schema=SCHEMA,
    )
    op.create_table(
        "candidates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "source_id", sa.String(36), sa.ForeignKey(f"{SCHEMA}.sources.id"), nullable=False
        ),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("current_revision", sa.Integer(), nullable=False),
        sa.Column("approved_revision", sa.Integer()),
        sa.Column("approved_by", sa.String(32)),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.Column("scheduled_for", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("source_id", "kind", name="uq_candidate_source_kind"),
        sa.CheckConstraint("version >= 1", name="ck_candidate_version"),
        sa.CheckConstraint(
            "status IN ('draft','pending_review','approved','published')",
            name="ck_candidate_status",
        ),
        schema=SCHEMA,
    )
    op.create_table(
        "revisions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "candidate_id", sa.String(36), sa.ForeignKey(f"{SCHEMA}.candidates.id"), nullable=False
        ),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("created_by", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("candidate_id", "number", name="uq_candidate_revision"),
        schema=SCHEMA,
    )
    op.create_table(
        "review_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "candidate_id", sa.String(36), sa.ForeignKey(f"{SCHEMA}.candidates.id"), nullable=False
        ),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(30), nullable=False),
        sa.Column("actor_discord_id", sa.String(32), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        schema=SCHEMA,
    )
    op.create_table(
        "publications",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "candidate_id",
            sa.String(36),
            sa.ForeignKey(f"{SCHEMA}.candidates.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("idempotency_key", sa.String(100), nullable=False, unique=True),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        schema=SCHEMA,
    )
    # Supabase의 역할이 존재하는 환경에서는 Data API 역할의 기존 권한도 제거합니다.
    op.execute(
        sa.text(f"""
        DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                REVOKE ALL ON SCHEMA {SCHEMA} FROM anon;
                REVOKE ALL ON ALL TABLES IN SCHEMA {SCHEMA} FROM anon;
            END IF;
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                REVOKE ALL ON SCHEMA {SCHEMA} FROM authenticated;
                REVOKE ALL ON ALL TABLES IN SCHEMA {SCHEMA} FROM authenticated;
            END IF;
        END $$;
    """)
    )
    op.execute(sa.text(f"REVOKE ALL ON ALL TABLES IN SCHEMA {SCHEMA} FROM PUBLIC"))


def downgrade() -> None:
    # 이 작업은 후보·이력도 지우므로 백업 후 명시적으로 실행해야 합니다.
    for name in ("publications", "review_events", "revisions", "candidates", "sources"):
        op.drop_table(name, schema=SCHEMA)
    op.execute(sa.schema.DropSchema(SCHEMA))
