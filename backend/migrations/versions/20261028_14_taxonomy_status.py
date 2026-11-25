"""분류표 v4.0 기준표의 승인 상태를 active로 맞춥니다.

SQL 본문은 backend/migrations/sql/20261028_14/ 에 두었습니다.
Docker용 database/init/018_activate_taxonomy_status.sql 과 같은 상태 변경입니다.
이미 active인 행은 다시 바꾸지 않습니다.
"""

from pathlib import Path

from alembic import op

revision = "20261028_14"
down_revision = "20261028_13"
branch_labels = None
depends_on = None

SQL_FILE = Path(__file__).resolve().parents[1] / "sql" / revision / "001_activate_taxonomy_status.sql"


def upgrade() -> None:
    # 같은 DB에 동시에 적용하지 않도록 트랜잭션이 끝날 때까지 잠급니다.
    op.execute("SELECT pg_advisory_xact_lock(20261028, 14)")
    op.execute("SET LOCAL search_path TO public, pg_catalog")
    op.execute(SQL_FILE.read_text(encoding="utf-8"))


def downgrade() -> None:
    raise RuntimeError("승인한 분류 상태를 자동으로 검토 중으로 되돌리지 않습니다.")
