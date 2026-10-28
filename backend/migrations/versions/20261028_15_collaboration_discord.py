"""협업 전용 디스코드 채널: collaboration 에 채널 번호·상태 칸을 추가합니다.

SQL 본문은 backend/migrations/sql/20261028_15/ 에 동결해 두었습니다. Docker용 init/019 도 같은 칸을 추가하고, 개정 번호만 따로 올립니다.
기존 협업은 지우지 않아요. 진행 중인 협업은 채널을 만들 차례(pending)가 되고, 끝난 협업은 skipped 예요.
"""

from pathlib import Path

from alembic import op

revision = "20261028_15"
down_revision = "20261028_14"
branch_labels = None
depends_on = None

SQL_FILE = Path(__file__).resolve().parents[1] / "sql" / revision / "001_add_collaboration_discord.sql"


def upgrade() -> None:
    # 같은 DB에 동시에 적용하지 않도록 트랜잭션이 끝날 때까지 잠급니다.
    op.execute("SELECT pg_advisory_xact_lock(20261028, 15)")
    op.execute("SET LOCAL search_path TO public, pg_catalog")
    op.execute(SQL_FILE.read_text(encoding="utf-8"))


def downgrade() -> None:
    # 채널 번호를 지우면 디스코드 채널과 협업의 연결이 끊어져서 자동 되돌리기는 제공하지 않습니다.
    raise RuntimeError("디스코드 채널 칸 삭제는 자동 실행하지 않습니다. 백업 후 별도 복구 계획이 필요해요.")