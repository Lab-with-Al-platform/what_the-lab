"""지정 개발 DB에 수집 설정 표만 추가하고 기존 원고를 보존했는지 대조합니다."""

import argparse
import json
from datetime import UTC, datetime
from uuid import uuid4

from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database_config import get_database_url
from app.insights.database import build_engine
from app.supabase_setup import ROOT, read_insights, validate_project


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--rehearse", action="store_true")
    mode.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm-project-ref", required=True)
    args = parser.parse_args()
    engine = None
    try:
        url = get_database_url()
        validate_project(url, args.confirm_project_ref)
        engine = build_engine(url)
        with engine.connect() as connection, connection.begin() as transaction:
            connection.execute(text("SET LOCAL statement_timeout='120s'"))
            connection.execute(text("SET LOCAL lock_timeout='5s'"))
            connection.execute(text("SELECT pg_advisory_xact_lock(20261022,4)"))
            version = connection.execute(
                text("SELECT version_num FROM public.insight_alembic_version")
            ).scalar_one()
            if version not in {"20261021_03", "20261022_04"}:
                raise ValueError("확인한 migration 이력과 달라 자동 적용을 중단합니다.")
            before = read_insights(connection)
            directory = ROOT / "tmp/db-checkpoints"
            directory.mkdir(parents=True, exist_ok=True)
            checkpoint = (
                directory
                / f"workspace-schema-{datetime.now(UTC):%Y%m%dT%H%M%SZ}-{uuid4().hex[:8]}.json"
            )
            with checkpoint.open("x", encoding="utf-8") as output:
                json.dump(before, output, ensure_ascii=False, indent=2)
            if version == "20261021_03":
                config = Config(str(ROOT / "backend/alembic.ini"))
                config.attributes["connection"] = connection
                command.upgrade(config, "20261022_04")
            protections = connection.execute(
                text("""SELECT c.relrowsecurity,
                EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role')
                       AND has_table_privilege(r.rolname,c.oid,'SELECT,INSERT,UPDATE,DELETE'))
                FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                WHERE n.nspname='insight_private' AND c.relname='collection_settings'""")
            ).one()
            if protections != (True, False) or read_insights(connection) != before:
                raise ValueError("접근 보호 또는 기존 원고 보존 검사가 실패했습니다.")
            current = connection.execute(
                text("SELECT version_num FROM public.insight_alembic_version")
            ).scalar_one()
            if current != "20261022_04":
                raise ValueError("최종 migration 이력이 맞지 않습니다.")
            result = {
                "revision": current,
                "existing_content_unchanged": True,
                "counts": {name: len(rows) for name, rows in before.items()},
                "settings_rows": connection.execute(
                    text("SELECT count(*) FROM insight_private.collection_settings")
                ).scalar_one(),
                "rls": True,
                "api_role_access": False,
                "checkpoint": str(checkpoint),
                "collection_executed": False,
                "rehearsal": args.rehearse,
            }
            if args.rehearse:
                transaction.rollback()
        print(json.dumps(result, ensure_ascii=False))
    except (SQLAlchemyError, ValueError) as error:
        raise SystemExit(
            str(error)
            if isinstance(error, ValueError)
            else "수집 설정 표 적용에 실패하여 변경을 취소했습니다."
        ) from None
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    main()
