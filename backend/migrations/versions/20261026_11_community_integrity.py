"""게시판 후속 무결성. 기존 운영 조회 08 개정은 변경하지 않습니다.

부모는 게시판 표 20261026_10입니다. 원격 DB에는 DB 담당자만 적용합니다.
"""

from pathlib import Path

from alembic import context, op
from sqlalchemy import text

revision = "20261026_11"
down_revision = "20261026_10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SQL만 뽑는 offline 모드에는 DB 연결이 없어서 존재 확인을 건너뜁니다.
    if not context.is_offline_mode():
        # 댓글 알림 연결 열이 있으면 무결성 SQL을 다시 실행하지 않습니다.
        ready = op.get_bind().execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = 'community_private' "
                "AND table_name = 'notifications' AND column_name = 'comment_id'"
            )
        ).scalar()
        if ready:
            return
    source = Path(__file__).resolve().parents[1] / "sql/20261026_11_community_integrity.sql"
    op.execute(source.read_text(encoding="utf-8"))


def downgrade() -> None:
    raise RuntimeError(
        "문의와 알림의 무결성 설정은 자동 제거하지 않습니다. 백업 후 별도 복구하세요."
    )
