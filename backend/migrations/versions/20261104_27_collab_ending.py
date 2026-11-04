"""진행 중 협업 마무리: 기간 연장 · 조기 완료 · 중단 · 종료 7일 전 알림 종류 7개.

SQL 본문은 backend/migrations/sql/20261104_27/ 에 동결해 두었습니다. (Docker용 database/init/031 과 같은 변경)
표 구조는 바꾸지 않아요. 알림 종류 규칙(ck_notification_type)만 넓혀요.
"""

from pathlib import Path

from alembic import op

revision = "20261104_27"
down_revision = "20261104_26"
branch_labels = None
depends_on = None

SQL_FILE = Path(__file__).resolve().parents[1] / "sql" / revision / "001_add_collab_ending.sql"


def upgrade() -> None:
    # 같은 DB에 동시에 적용하지 않도록 트랜잭션이 끝날 때까지 잠급니다.
    op.execute("SELECT pg_advisory_xact_lock(20261104, 27)")
    op.execute("SET LOCAL search_path TO public, pg_catalog")
    op.execute(SQL_FILE.read_text(encoding="utf-8"))


def downgrade() -> None:
    # 알림이 지워지지 않도록 자동 되돌리기는 제공하지 않습니다.
    raise RuntimeError("알림 종류 되돌리기는 자동 실행하지 않습니다. 백업 후 별도 복구 계획이 필요해요.")