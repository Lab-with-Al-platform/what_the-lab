"""수정 시각 트리거의 함수 검색 경로를 PostgreSQL 기본 함수로 제한합니다."""

from alembic import op

revision = "20261021_03"
down_revision = "20261021_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 함수를 교체하지 않고 설정만 바꿔 기존 트리거·소유자·실행 권한을 보존합니다.
    # 본문은 now() 같은 기본 함수만 사용하므로 public을 검색할 필요가 없습니다.
    op.execute("ALTER FUNCTION public.set_updated_at() SET search_path = pg_catalog")


def downgrade() -> None:
    # 보안 설정을 실수로 해제하지 않도록 되돌리기는 별도 검토 후 진행합니다.
    raise RuntimeError("함수 검색 경로 보호는 자동 해제하지 않습니다. 별도 보안 검토가 필요합니다.")
