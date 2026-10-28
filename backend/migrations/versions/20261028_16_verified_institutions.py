"""메일 수신을 확인한 대학·연구기관 도메인을 인증 기관 표에 넣습니다.

SQL 본문은 backend/migrations/sql/20261028_16/ 에 동결해 두었습니다. Docker용 init/020 도 같은 목록을 넣고, 개정 번호만 따로 올립니다.
기존 도메인은 지우지 않아요. 영어 이름 그대로인 줄만 한글 이름으로 바꿔요.
"""

from pathlib import Path

from alembic import op

revision = "20261028_16"
down_revision = "20261028_15"
branch_labels = None
depends_on = None

SQL_FILE = Path(__file__).resolve().parents[1] / "sql" / revision / "001_add_verified_institutions.sql"


def upgrade() -> None:
    # 같은 DB에 동시에 적용하지 않도록 트랜잭션이 끝날 때까지 잠급니다.
    op.execute("SELECT pg_advisory_xact_lock(20261028, 16)")
    op.execute("SET LOCAL search_path TO public, pg_catalog")
    op.execute(SQL_FILE.read_text(encoding="utf-8"))


def downgrade() -> None:
    # 이미 이 목록으로 인증한 연구회원이 있을 수 있어서 자동으로 지우지 않습니다.
    raise RuntimeError("인증 기관 목록은 자동으로 되돌리지 않습니다. 지울 도메인을 따로 정해 주세요.")
