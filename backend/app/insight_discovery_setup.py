"""기간 확장 정책만 개발 DB 설정에 저장합니다. 조회·수집 실행기는 연결하지 않습니다."""

import argparse
import json
from copy import deepcopy
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database_config import get_database_url
from app.insights.collection_policy import recommended_discovery_policy
from app.insights.database import build_engine
from app.insights.models import CollectionSetting, utc_now
from app.insights.workspace_schemas import CollectionConfig
from app.supabase_setup import ROOT, read_insights, validate_project


def update_discovery_settings(session: Session, expected_version: int) -> dict:
    """확인한 버전일 때만 정책을 추가하며 기존 저장 상한·출처·검색어를 보존합니다."""
    row = session.scalar(
        select(CollectionSetting).where(CollectionSetting.id == "collection").with_for_update()
    )
    if row is None or row.version != expected_version:
        raise ValueError("설정 버전이 바뀌었습니다. 기존 입력을 보존하고 다시 확인하세요.")
    before = row.content
    updated = deepcopy(before)
    updated["lookback_days"] = 30
    updated["discovery_policy"] = recommended_discovery_policy(before["max_items"]).model_dump(
        mode="json"
    )
    CollectionConfig.model_validate(updated)
    changed = updated != before
    if changed:
        row.content = updated
        row.version += 1
        row.updated_at = utc_now()
        row.updated_by = "system:discovery-policy"
        session.flush()
    # 여기에 없는 필드는 변경하지 않았는지 명시적으로 검사합니다.
    original_fields = {
        key: value
        for key, value in before.items()
        if key not in {"lookback_days", "discovery_policy"}
    }
    preserved_fields = {
        key: value
        for key, value in row.content.items()
        if key not in {"lookback_days", "discovery_policy"}
    }
    if original_fields != preserved_fields:
        raise ValueError("기간 정책 이외의 설정이 바뀌어 취소합니다.")
    return {
        "changed": changed,
        "version": row.version,
        "lookback_days": row.content["lookback_days"],
        "max_items": row.content["max_items"],
        "discovery_policy": row.content["discovery_policy"],
        "source_count": len(row.content["sources"]),
        "collection_executed": False,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--rehearse", action="store_true")
    modes.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm-project-ref", default="")
    parser.add_argument("--expected-version", type=int)
    args = parser.parse_args()
    engine = None
    try:
        url = get_database_url()
        if args.rehearse or args.apply:
            validate_project(url, args.confirm_project_ref)
            if args.expected_version is None:
                raise ValueError("확인한 설정 버전을 지정해야 합니다.")
        engine = build_engine(url)
        with engine.connect() as connection, connection.begin() as transaction:
            connection.execute(text("SET LOCAL statement_timeout = '60s'"))
            connection.execute(text("SET LOCAL lock_timeout = '5s'"))
            if args.rehearse or args.apply:
                connection.execute(text("SELECT pg_advisory_xact_lock(20261022, 7)"))
                before = read_insights(connection)
                settings = (
                    connection.execute(
                        text(
                            "SELECT row_to_json(t) FROM insight_private.collection_settings t ORDER BY id"
                        )
                    )
                    .scalars()
                    .all()
                )
                directory = ROOT / "tmp/db-checkpoints"
                directory.mkdir(parents=True, exist_ok=True)
                checkpoint = (
                    directory
                    / f"insight-discovery-{datetime.now(UTC):%Y%m%dT%H%M%SZ}-{uuid4().hex[:8]}.json"
                )
                with checkpoint.open("x", encoding="utf-8") as output:
                    json.dump(
                        {"insights": before, "settings": settings},
                        output,
                        ensure_ascii=False,
                        indent=2,
                    )
                with Session(bind=connection) as session:
                    result = update_discovery_settings(session, args.expected_version)
                if read_insights(connection) != before:
                    raise ValueError("기존 원고·후보·검토 이력이 달라져 취소합니다.")
                result.update(existing_insights_unchanged=True, checkpoint=str(checkpoint))
                if args.rehearse:
                    transaction.rollback()
                    result["rolled_back"] = True
            else:
                row = connection.execute(
                    text(
                        "SELECT version, content FROM insight_private.collection_settings WHERE id='collection'"
                    )
                ).one()
                result = {
                    "version": row.version,
                    "lookback_days": row.content["lookback_days"],
                    "max_items": row.content["max_items"],
                    "discovery_policy": row.content.get("discovery_policy"),
                    "source_count": len(row.content["sources"]),
                }
        print(json.dumps(result, ensure_ascii=False))
    except (SQLAlchemyError, ValueError, OSError, AssertionError):
        raise SystemExit(
            "기간 확장 설정을 저장하지 못했습니다. 대상·버전·입력 조건을 확인하세요. 변경은 취소했습니다."
        ) from None
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    main()
