"""Verified collaboration reviews and moderation reports. No automatic destructive downgrade."""
from pathlib import Path
from alembic import op

revision = "20261031_21"
down_revision = "20261029_20"
branch_labels = None
depends_on = None
SQL_FILE = Path(__file__).resolve().parents[1] / "sql" / revision / "001_create_collaboration_reviews.sql"

def upgrade() -> None:
    op.execute("SELECT pg_advisory_xact_lock(20261031, 21)")
    op.execute("SET LOCAL search_path TO public, pg_catalog")
    op.execute("""
        DO $guard$ BEGIN
          IF to_regclass('public.collaboration_review') IS NOT NULL
             OR to_regclass('public.collaboration_review_report') IS NOT NULL THEN
            RAISE EXCEPTION 'Review tables already exist: stop migration and reconcile first.';
          END IF;
        END $guard$;
    """)
    op.execute(SQL_FILE.read_text(encoding="utf-8"))

def downgrade() -> None:
    raise RuntimeError("Review records and reports must not be destroyed automatically. Use an approved backup/recovery plan.")
