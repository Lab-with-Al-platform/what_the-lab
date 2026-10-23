"""기존 공개 31개와 새 비공개 후보 6개를 개발 Supabase에 안전하게 이관합니다."""

import argparse
import json
import subprocess
from collections import Counter
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database_config import get_database_url
from app.insights.catalog_import import IMPORT_ACTOR, article_hash, import_catalog
from app.insights.collection_oct22 import collected_drafts
from app.insights.database import build_engine
from app.insights.importing import import_candidates
from app.insights.models import Candidate, Publication, Revision
from app.insights.schemas import CandidateImportInput
from app.supabase_setup import ROOT, read_insights, validate_project


def apply_catalog(connection, articles: list[dict]) -> dict:
    """백업 → 이관 → 대조를 한 트랜잭션으로 처리합니다. 실패하면 모두 취소합니다."""
    connection.execute(text("SELECT pg_advisory_xact_lock(20261022, 3)"))
    before = read_insights(connection)
    directory = ROOT / "tmp" / "db-checkpoints"
    directory.mkdir(parents=True, exist_ok=True)
    checkpoint = (
        directory / f"insight-catalog-{datetime.now(UTC):%Y%m%dT%H%M%SZ}-{uuid4().hex[:8]}.json"
    )
    with checkpoint.open("x", encoding="utf-8") as output:
        json.dump(before, output, ensure_ascii=False, indent=2)
    with Session(bind=connection) as session:
        legacy_result = import_catalog(session, articles)
        new_result = import_candidates(
            session, CandidateImportInput(dry_run=False, drafts=collected_drafts()), IMPORT_ACTOR
        )
        session.flush()
        for article in articles:
            record = session.scalar(select(Publication).where(Publication.slug == article["slug"]))
            if record is None or article_hash(record.snapshot["article"]) != article_hash(article):
                raise ValueError("원고 전체 보존 검사가 실패했습니다.")
        draft_states = []
        for item in new_result["items"]:
            candidate = session.get(Candidate, item["candidate_id"])
            # 기존 후보는 어떤 상태든 덮어쓰지 않습니다. 이번에 만든 후보만 강제 확인합니다.
            if item["action"] == "created":
                revision = session.scalar(
                    select(Revision).where(
                        Revision.candidate_id == candidate.id, Revision.number == 1
                    )
                )
                if (
                    candidate.status != "draft"
                    or candidate.approved_by
                    or candidate.approved_revision
                ):
                    raise ValueError("새 후보가 비공개 초안이 아닙니다.")
                if any(
                    claim["verification"] != "needs_review" for claim in revision.content["claims"]
                ):
                    raise ValueError("새 후보의 검토 상태가 잘못되었습니다.")
            draft_states.append(
                {"id": candidate.id, "kind": candidate.kind, "status": candidate.status}
            )
        after = read_insights(connection)
        for table, rows in before.items():
            current = {row["id"]: row for row in after[table]}
            if any(current.get(row["id"]) != row for row in rows):
                raise ValueError("기존 자료가 변경되어 전체 이관을 취소합니다.")
        return {
            "legacy": legacy_result,
            "new_candidates": new_result,
            "candidate_states": draft_states,
            "checkpoint": str(checkpoint),
            "counts": {table: len(rows) for table, rows in after.items()},
        }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--rehearse", action="store_true")
    modes.add_argument("--apply", action="store_true")
    parser.add_argument("--node", default="node", help="Node 실행 파일 경로")
    parser.add_argument("--confirm-project-ref", default="")
    args = parser.parse_args()
    engine = None
    try:
        url = get_database_url()
        if args.apply or args.rehearse:
            validate_project(url, args.confirm_project_ref)
        engine = build_engine(url)
        with engine.connect() as connection, connection.begin() as transaction:
            connection.execute(text("SET LOCAL statement_timeout = '120s'"))
            connection.execute(text("SET LOCAL lock_timeout = '5s'"))
            if args.apply or args.rehearse:
                export = subprocess.run(
                    [args.node, str(ROOT / "frontend/scripts/export-insights.cjs")],
                    check=True,
                    capture_output=True,
                    encoding="utf-8",
                )
                articles = json.loads(export.stdout)
                if len(articles) != 31 or Counter(item["kind"] for item in articles) != {
                    "case": 17,
                    "trend": 14,
                }:
                    raise ValueError("원고 수가 확인한 31개와 다릅니다. 먼저 대상을 재확인하세요.")
                result = apply_catalog(connection, articles)
            else:
                result = {
                    "counts": {key: len(value) for key, value in read_insights(connection).items()}
                }
            if args.rehearse:
                transaction.rollback()
                result["rolled_back"] = True
        print(json.dumps(result, ensure_ascii=False))
    except (
        SQLAlchemyError,
        HTTPException,
        ValueError,
        OSError,
        subprocess.CalledProcessError,
    ) as error:
        # 연결 예외에는 암호가 섞일 수 있어 원래 DB 예외를 출력하지 않습니다.
        message = (
            str(error)
            if isinstance(error, ValueError)
            else "이관을 완료하지 못했습니다. DB 변경은 취소했습니다."
        )
        raise SystemExit(message) from None
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    main()
