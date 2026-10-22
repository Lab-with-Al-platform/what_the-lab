"""지정 개발 DB의 출처 목록에 추천 출처·용도를 추가합니다. 실제 수집은 하지 않습니다."""

import argparse
import json
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database_config import get_database_url
from app.insights.collection_sources import extend_collection_sources
from app.insights.database import build_engine
from app.insights.models import CollectionSetting, utc_now
from app.insights.workspace_schemas import CollectionConfig
from app.routers.insight_workspace import default_collection_config
from app.supabase_setup import ROOT, read_insights, validate_project


def update_source_settings(session: Session) -> dict:
    """공통 설정의 버전을 갱신하되, 주기·키워드와 기존 출처의 선택을 보존합니다."""
    row = session.scalar(
        select(CollectionSetting).where(CollectionSetting.id == "collection").with_for_update()
    )
    before = row.content if row else default_collection_config()
    updated = extend_collection_sources(before)
    # 검증은 하되, 기존에 없는 다른 설정 필드를 임의로 추가하지 않습니다.
    CollectionConfig.model_validate(updated)
    changed = row is None or updated != before
    if row is None:
        row = CollectionSetting(
            id="collection", version=1, content=updated, updated_by="system:source-catalog-update"
        )
        session.add(row)
    elif changed:
        row.content = updated
        row.version += 1
        row.updated_at = utc_now()
        row.updated_by = "system:source-catalog-update"
    session.flush()
    return {
        "changed": changed,
        "version": row.version,
        "source_count": len(updated["sources"]),
        "sources": [
            {
                "name": source["name"],
                "content_kinds": source["content_kinds"],
                "selected": source.get("selected", True),
            }
            for source in updated["sources"]
        ],
        "collection_executed": False,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--rehearse", action="store_true")
    modes.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm-project-ref", default="")
    args = parser.parse_args()
    engine = None
    try:
        url = get_database_url()
        if args.rehearse or args.apply:
            validate_project(url, args.confirm_project_ref)
        engine = build_engine(url)
        with engine.connect() as connection, connection.begin() as transaction:
            connection.execute(text("SET LOCAL statement_timeout = '60s'"))
            connection.execute(text("SET LOCAL lock_timeout = '5s'"))
            if not (args.rehearse or args.apply):
                row = connection.execute(
                    text(
                        "SELECT version, content FROM insight_private.collection_settings WHERE id='collection'"
                    )
                ).first()
                result = {
                    "saved": row is not None,
                    "version": row[0] if row else 0,
                    "source_count": len(row[1]["sources"]) if row else 0,
                }
            else:
                connection.execute(text("SELECT pg_advisory_xact_lock(20261022, 6)"))
                before = read_insights(connection)
                old_settings = (
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
                    / f"insight-sources-{datetime.now(UTC):%Y%m%dT%H%M%SZ}-{uuid4().hex[:8]}.json"
                )
                with checkpoint.open("x", encoding="utf-8") as output:
                    json.dump(
                        {"insights": before, "settings": old_settings},
                        output,
                        ensure_ascii=False,
                        indent=2,
                    )
                with Session(bind=connection) as session:
                    result = update_source_settings(session)
                if read_insights(connection) != before:
                    raise ValueError("기존 원고·출처·후보·승인 이력이 달라져 작업을 취소합니다.")
                result.update(checkpoint=str(checkpoint), existing_insights_unchanged=True)
                if args.rehearse:
                    transaction.rollback()
                    result["rolled_back"] = True
        print(json.dumps(result, ensure_ascii=False))
    except (SQLAlchemyError, ValueError, OSError):
        # 원래 예외에는 DB URL 또는 사용자 입력이 들어갈 수 있으므로 출력하지 않습니다.
        raise SystemExit(
            "출처 설정을 저장하지 못해 변경을 취소했습니다. 대상·설정·보존 조건을 확인하세요."
        ) from None
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    main()
