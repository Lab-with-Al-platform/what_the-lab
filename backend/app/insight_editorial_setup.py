"""지정한 미게시 후보 6개에만 보강 판본을 추가합니다. 기본 실행은 조회뿐입니다."""

import argparse
import json
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database_config import get_database_url
from app.insights import editorial
from app.insights.catalog_import import article_hash
from app.insights.collection_oct22 import collected_drafts
from app.insights.database import build_engine
from app.insights.editorial_oct22 import expanded_article
from app.insights.importing import existing_candidate, unverified_draft
from app.insights.models import Publication
from app.insights.schemas import Draft
from app.supabase_setup import ROOT, read_insights, validate_project


def expand_candidates(session: Session) -> list[dict]:
    """이전 메모와 일치할 때만 추가합니다. 사람이 수정한 판본은 덮어쓰지 않습니다."""
    results = []
    for index, original in enumerate(collected_drafts()):
        draft = unverified_draft(original)
        candidate = existing_candidate(session, draft, index)
        if candidate is None:
            raise ValueError("예상한 수집 후보가 없습니다. 먼저 목록을 확인하세요.")
        if session.scalar(select(Publication.id).where(Publication.candidate_id == candidate.id)):
            raise ValueError("대상 후보에 공개본이 생겨 작업을 중단합니다.")
        current = editorial.current_revision(session, candidate)
        article = expanded_article(draft)
        if current.content.get("format") == "article_draft_v1":
            if article_hash(current.content.get("article", {})) != article_hash(article):
                raise ValueError("보강 후 수정한 원고가 있어 덮어쓰지 않습니다.")
            action = "already_expanded"
        else:
            if (
                candidate.status != "draft"
                or candidate.current_revision != 1
                or article_hash(Draft.model_validate(current.content).model_dump(mode="json"))
                != article_hash(draft.model_dump(mode="json"))
            ):
                raise ValueError("기존 후보가 초기 메모와 다릅니다. 수동 확인이 필요합니다.")
            editorial.start_article_draft(
                session,
                candidate.id,
                candidate.version,
                "system:editorial-expansion",
                "사용자 요청: 근거 메모 보존·독자용 해설 보강. 원문 검토·승인·게시와 삽화 생성은 별도.",
                article,
            )
            action = "expanded"
        report = editorial.editorial_report({"format": "article_draft_v1", "article": article})
        if not report["ready"]:
            raise ValueError("보강 본문의 구조 검사가 실패했습니다.")
        results.append(
            {
                "id": candidate.id,
                "slug": draft.slug,
                "action": action,
                "status": candidate.status,
                "revision": candidate.current_revision,
                "paragraphs": report["paragraph_count"],
                "characters": report["body_characters"],
            }
        )
    return results


def apply_expansion(connection) -> dict:
    """백업과 변경 대조를 같은 트랜잭션에서 수행합니다. 실패하면 모두 취소됩니다."""
    connection.execute(text("SELECT pg_advisory_xact_lock(20261022, 5)"))
    before = read_insights(connection)
    directory = ROOT / "tmp/db-checkpoints"
    directory.mkdir(parents=True, exist_ok=True)
    checkpoint = (
        directory / f"insight-editorial-{datetime.now(UTC):%Y%m%dT%H%M%SZ}-{uuid4().hex[:8]}.json"
    )
    with checkpoint.open("x", encoding="utf-8") as output:
        json.dump(before, output, ensure_ascii=False, indent=2)
    with Session(bind=connection) as session:
        result = expand_candidates(session)
        session.flush()
        after = read_insights(connection)
        changed_ids = {item["id"] for item in result if item["action"] == "expanded"}
        for table, rows in before.items():
            current = {row["id"]: row for row in after[table]}
            for row in rows:
                if table == "candidates" and row["id"] in changed_ids:
                    permitted = {"current_revision", "version", "updated_at"}
                    if any(
                        current[row["id"]].get(key) != value
                        for key, value in row.items()
                        if key not in permitted
                    ):
                        raise ValueError("대상 후보의 허용하지 않은 정보가 변경되었습니다.")
                elif current.get(row["id"]) != row:
                    raise ValueError("기존 공개본·메모·출처·이력이 변경되어 취소합니다.")
        for table in ("sources", "publications"):
            if len(before[table]) != len(after[table]):
                raise ValueError("출처 또는 공개본 개수가 달라져 취소합니다.")
        return {
            "items": result,
            "publications_unchanged": True,
            "old_revisions_unchanged": True,
            "counts": {key: len(value) for key, value in after.items()},
            "checkpoint": str(checkpoint),
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
        if args.apply or args.rehearse:
            validate_project(url, args.confirm_project_ref)
        engine = build_engine(url)
        with engine.connect() as connection, connection.begin() as transaction:
            connection.execute(text("SET LOCAL statement_timeout = '60s'"))
            connection.execute(text("SET LOCAL lock_timeout = '5s'"))
            result = (
                apply_expansion(connection)
                if args.apply or args.rehearse
                else {
                    "counts": {key: len(value) for key, value in read_insights(connection).items()}
                }
            )
            if args.rehearse:
                transaction.rollback()
                result["rolled_back"] = True
        print(json.dumps(result, ensure_ascii=False))
    except (SQLAlchemyError, HTTPException, ValueError, OSError) as error:
        # DB 오류에는 자격증명이 섞일 수 있으므로 원문 예외는 출력하지 않습니다.
        raise SystemExit(
            str(error)
            if isinstance(error, ValueError)
            else "보강을 완료하지 못했습니다. DB 변경은 취소했습니다."
        ) from None
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    main()
