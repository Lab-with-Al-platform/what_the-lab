"""게시판 후속 무결성. 기존 운영 조회 08 개정은 변경하지 않습니다.

부모는 게시판 표 20261026_10입니다. 원격 DB에는 DB 담당자만 적용합니다.
"""

from pathlib import Path

from alembic import op

revision = "20261026_11"
down_revision = "20261026_10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    source = Path(__file__).resolve().parents[1] / "sql/20261026_11_community_integrity.sql"
    op.execute(source.read_text(encoding="utf-8"))


def downgrade() -> None:
    raise RuntimeError(
        "문의와 알림의 무결성 설정은 자동 제거하지 않습니다. 백업 후 별도 복구하세요."
    )
