"""인사이트 전용 schema의 변경 이력을 적용합니다."""

import os
from pathlib import Path

from alembic import context
from dotenv import load_dotenv

from app.insights import models  # noqa: F401 - 메타데이터에 테이블을 등록합니다.
from app.insights.database import SCHEMA, Base, build_engine


def include_insight_names(
    name: str | None, type_: str, parent_names: dict[str, str | None]
) -> bool:
    """향후 변경 SQL을 생성할 때 다른 팀원의 테이블은 비교하지 않습니다."""
    if type_ == "schema":
        return name == SCHEMA
    if type_ == "table":
        return parent_names.get("schema_name") == SCHEMA
    return True


load_dotenv(Path(__file__).resolve().parents[2] / ".env")
database_url = os.getenv("DATABASE_URL", "")
if not database_url and not context.is_offline_mode():
    raise RuntimeError("마이그레이션용 DATABASE_URL을 로컬 환경에 설정해 주세요.")

if context.is_offline_mode():
    # URL에는 비밀값이 있으므로 출력용 SQL에는 dialect 정보만 전달합니다.
    context.configure(
        dialect_name="postgresql",
        target_metadata=Base.metadata,
        literal_binds=True,
        include_schemas=True,
        include_name=include_insight_names,
        version_table="insight_alembic_version",
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = build_engine(database_url)
    with engine.connect() as connection:
        # 관리 이력 테이블은 기본 public에 두되 내용은 버전 번호만 저장합니다.
        context.configure(
            connection=connection,
            target_metadata=Base.metadata,
            version_table="insight_alembic_version",
            include_schemas=True,
            include_name=include_insight_names,
        )
        with context.begin_transaction():
            context.run_migrations()
