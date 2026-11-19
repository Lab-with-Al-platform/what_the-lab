"""운영 이력 기록 종류에 회원 역할 변경(change_role · reset_role)을 더합니다.

SQL 본문은 backend/migrations/sql/20261119_29/ 에 동결해 두었습니다. (Docker용 database/init/033 와 같은 변경)
표 구조는 바꾸지 않아요. 기록 종류 규칙(ck_operation_audit_action)만 넓혀요.
"""

from pathlib import Path

from alembic import op

revision = "20261119_29"
down_revision = "20261119_28"
branch_labels = None
depends_on = None

SQL_FILE = Path(__file__).resolve().parents[1] / "sql" / revision / "001_add_role_change_actions.sql"


def upgrade() -> None:
    # 같은 DB에 동시에 적용하지 않도록 트랜잭션이 끝날 때까지 잠급니다.
    op.execute("SELECT pg_advisory_xact_lock(20261119, 29)")
    op.execute("SET LOCAL search_path TO public, pg_catalog")
    op.execute(SQL_FILE.read_text(encoding="utf-8"))


def downgrade() -> None:
    # 이미 남은 역할 변경 기록이 규칙에 걸리지 않도록 자동 되돌리기는 제공하지 않습니다.
    raise RuntimeError("기록 종류 되돌리기는 자동 실행하지 않습니다. 백업 후 별도 복구 계획이 필요해요.")
