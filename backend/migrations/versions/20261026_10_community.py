"""공개·비공개 게시판. 기존 회원·인사이트·운영 조회 자료는 변경하지 않습니다.

운영 조회가 20261026_07~09를 이미 쓰므로 게시판은 10입니다.
부모는 방문 수집 20261026_09입니다. 원격 DB에는 DB 담당자만 적용합니다.
"""

from pathlib import Path

from alembic import context, op
from sqlalchemy import text

revision = "20261026_10"
down_revision = "20261026_09"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SQL만 뽑는 offline 모드에는 DB 연결이 없어서 존재 확인을 건너뜁니다.
    if not context.is_offline_mode():
        # 게시판 표만 먼저 만든 DB에서는 같은 표를 다시 만들지 않습니다.
        exists = op.get_bind().execute(text("SELECT to_regclass('community_private.posts')")).scalar()
        if exists:
            return
    source = Path(__file__).resolve().parents[1] / "sql/20261026_10_community.sql"
    op.execute(source.read_text(encoding="utf-8"))


def downgrade() -> None:
    raise RuntimeError(
        "회원 문의를 자동 삭제하지 않습니다. 백업·보존 정책 검토 후 별도 복구하세요."
    )
