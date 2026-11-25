"""공통 DB 변경 이력. 자동 비교는 인사이트에만 제한합니다."""

from pathlib import Path

from alembic import context
from dotenv import load_dotenv

from app.database_config import get_database_url
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
    def run_migrations(connection) -> None:
        # 기존에 적용된 이력 테이블 이름을 유지하며 회원 후속 변경도 기록합니다.
        context.configure(
            connection=connection,
            target_metadata=Base.metadata,
            version_table="insight_alembic_version",
            include_schemas=True,
            include_name=include_insight_names,
        )
        with context.begin_transaction():
            context.run_migrations()

    supplied_connection = context.config.attributes.get("connection")
    if supplied_connection is not None:
        # 사전 검증·적용·사후 검증을 호출자가 연 하나의 트랜잭션으로 묶습니다.
        run_migrations(supplied_connection)
    else:
        engine = build_engine(get_database_url())
        try:
            with engine.connect() as connection:
                run_migrations(connection)
        finally:
            engine.dispose()
