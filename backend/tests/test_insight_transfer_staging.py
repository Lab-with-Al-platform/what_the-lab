"""웹서버·실제 DB 없이 메모와 전체 원고의 원자적 반입을 검사합니다."""

import json
from copy import deepcopy
from hashlib import sha256
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import event, func, select
from sqlalchemy.orm import Session

from app.insights import editorial, service
from app.insights.database import Base, build_engine
from app.insights.models import Candidate, Publication, ReviewEvent, Revision, Source
from app.insights.schemas import Draft
from app.insights.transfer_contract import TransferError
from app.insights.transfer_staging import stage_transfer_candidates

FIXTURE = Path(__file__).parent / "fixtures" / "insight-transfer-v1.json"
ACTOR = "fictional-local-reviewer"


@pytest.fixture
def payload() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


@pytest.fixture
def engine(tmp_path, monkeypatch):
    # 승인 목록도 가상으로 고정하여 실제 파일·DB의 운영 승인을 테스트에 섞지 않습니다.
    monkeypatch.setattr(service, "approved_capabilities", lambda: [{"id": "CAP-TEST"}])
    connection = build_engine(f"sqlite:///{tmp_path / 'transfer.db'}", allow_sqlite=True)

    @event.listens_for(connection, "connect")
    def explicit_transactions(dbapi_connection, _record) -> None:
        # SQLite의 암묵적 트랜잭션 대신 테스트에서 BEGIN을 명시해 SAVEPOINT를 검사합니다.
        dbapi_connection.isolation_level = None

    @event.listens_for(connection, "begin")
    def begin_transaction(conn) -> None:
        conn.exec_driver_sql("BEGIN")

    Base.metadata.create_all(connection)
    yield connection
    connection.dispose()


def raw(payload: dict) -> bytes:
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


def count(session: Session, model) -> int:
    return session.scalar(select(func.count()).select_from(model))


def add_second_item(payload: dict) -> None:
    item = deepcopy(payload["items"][0])
    item["draft"]["slug"] = item["article"]["slug"] = "fictional-second"
    item["draft"]["source"]["url"] = item["article"]["sourceUrl"] = (
        "https://example.org/fictional-second"
    )
    payload["items"].append(item)


def test_default_preview_stores_nothing(engine, payload):
    with Session(engine) as session, session.begin():
        result = stage_transfer_candidates(session, raw(payload), ACTOR)
        assert result["dry_run"] is True
        assert result["would_create"] == 1
        for model in (Source, Candidate, Revision, ReviewEvent, Publication):
            assert count(session, model) == 0


def test_creates_full_unapproved_manuscript_and_clears_external_claims(engine, payload):
    draft = payload["items"][0]["draft"]
    draft["source"]["bibliography_checked"] = True
    draft["source"]["access_level"] = "open_authorized"
    draft["claims"][0]["verification"] = "verified"
    draft["scores"] = [{"criterion": "limitations", "value": 1, "rationale": "가상 자체 평가"}]
    draft["keyword_ids"] = ["CAP-TEST", "CAP-FAKE"]
    content = raw(payload)
    with Session(engine) as session, session.begin():
        result = stage_transfer_candidates(session, content, ACTOR, dry_run=False)
        candidate = session.get(Candidate, result["items"][0]["candidate_id"])
        revision = editorial.current_revision(session, candidate)
        saved = revision.content
        assert saved["format"] == "article_draft_v1"
        assert saved["article"]["sections"] == payload["items"][0]["article"]["sections"]
        assert saved["article"]["glossary"] == payload["items"][0]["article"]["glossary"]
        assert saved["draft"]["claims"][0]["verification"] == "needs_review"
        assert saved["draft"]["source"]["bibliography_checked"] is False
        assert saved["draft"]["source"]["access_level"] == "unknown"
        assert saved["draft"]["scores"] == []
        assert saved["draft"]["keyword_ids"] == ["CAP-TEST"]
        assert result["items"][0]["dropped_keyword_ids"] == ["CAP-FAKE"]
        assert saved["transfer"]["sha256"] == sha256(content).hexdigest()
        assert saved["transfer"]["trust"] == "unverified_submission"
        assert saved["transfer"]["source_published"] == {"value": None, "precision": "unknown"}
        assert candidate.status == "draft"
        assert candidate.current_revision == 2
        assert candidate.approved_revision is None
        assert candidate.approved_by is None
        assert candidate.scheduled_for is None
        assert count(session, Publication) == 0
        assert result["publication_approved"] is False


def test_same_file_and_changed_submission_preserve_admin_work(engine, payload):
    with Session(engine) as session, session.begin():
        first = stage_transfer_candidates(session, raw(payload), ACTOR, dry_run=False)
        candidate = session.get(Candidate, first["items"][0]["candidate_id"])
        revision = editorial.current_revision(session, candidate)
        revision.content = {**revision.content, "admin_note": "관리자 수정 보존"}
        session.flush()
        snapshot = deepcopy(revision.content)
        events_before = count(session, ReviewEvent)
        for change in (False, True):
            if change:
                for part in (payload["items"][0]["draft"], payload["items"][0]["article"]):
                    part["title"] = "같은 출처의 새로운 제목 제안"
            repeated = stage_transfer_candidates(session, raw(payload), ACTOR, dry_run=False)
            assert repeated["existing_preserved"] == 1
            assert repeated["created"] == 0
            assert editorial.current_revision(session, candidate).content == snapshot
            assert count(session, ReviewEvent) == events_before
        assert count(session, Candidate) == 1
        assert count(session, Revision) == 2


def test_published_snapshot_and_candidate_state_are_preserved(engine, payload):
    with Session(engine) as session, session.begin():
        existing = service.create_candidate(
            session, Draft.model_validate(payload["items"][0]["draft"]), ACTOR
        )
        existing.status = "published"  # 테스트 DB에만 이미 게시된 상태를 가정합니다.
        snapshot = {"title": "가상 공개본", "body": "기존 본문 보존"}
        publication = Publication(
            candidate_id=existing.id,
            revision=1,
            idempotency_key="fictional-publication",
            slug=payload["items"][0]["draft"]["slug"],
            snapshot=deepcopy(snapshot),
        )
        session.add(publication)
        session.flush()
        result = stage_transfer_candidates(session, raw(payload), ACTOR, dry_run=False)
        assert result["existing_preserved"] == 1
        assert existing.status == "published"
        assert existing.current_revision == 1
        assert publication.snapshot == snapshot
        assert count(session, Revision) == 1


def test_later_article_failure_rolls_back_entire_bundle_but_preserves_outer_work(
    engine, payload, monkeypatch
):
    original = editorial.start_article_draft
    calls = 0

    def fail_second(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("가상 두 번째 원고 저장 실패")
        return original(*args, **kwargs)

    monkeypatch.setattr(editorial, "start_article_draft", fail_second)
    with Session(engine) as session, session.begin():
        kept_data = deepcopy(payload["items"][0]["draft"])
        kept_data["slug"] = "fictional-preexisting"
        kept_data["source"]["url"] = "https://example.org/preexisting"
        kept = Draft.model_validate(kept_data)
        # 새 전송과 무관한 바깥 트랜잭션의 작업은 남아 있어야 합니다.
        preexisting = service.create_candidate(session, kept, ACTOR)
        before = {
            model: count(session, model) for model in (Source, Candidate, Revision, ReviewEvent)
        }
        add_second_item(payload)
        with pytest.raises(RuntimeError, match="두 번째"):
            stage_transfer_candidates(session, raw(payload), ACTOR, dry_run=False)
        for model, expected in before.items():
            assert count(session, model) == expected
        assert session.get(Candidate, preexisting.id).status == "draft"
    with Session(engine) as session:
        assert count(session, Candidate) == 1
        assert count(session, Publication) == 0


def test_does_not_commit_callers_transaction(engine, payload):
    with Session(engine) as session:
        transaction = session.begin()
        stage_transfer_candidates(session, raw(payload), ACTOR, dry_run=False)
        transaction.rollback()
    with Session(engine) as session:
        assert count(session, Candidate) == 0
        assert count(session, Revision) == 0


def test_caller_must_own_transaction(engine, payload):
    with Session(engine) as session, pytest.raises(ValueError, match="바깥 트랜잭션"):
        stage_transfer_candidates(session, raw(payload), ACTOR)


def test_invalid_later_article_prevents_any_write(engine, payload):
    add_second_item(payload)
    payload["items"][1]["article"]["summary"] = "근거 메모와 다른 요약"
    with Session(engine) as session, session.begin():
        with pytest.raises(TransferError):
            stage_transfer_candidates(session, raw(payload), ACTOR, dry_run=False)
        assert count(session, Candidate) == 0


def test_normalized_source_is_used_in_full_article(engine, payload):
    item = payload["items"][0]
    item["draft"]["source"]["doi"] = "10.9999/fictional"
    item["article"]["doi"] = "https://doi.org/10.9999/FICTIONAL"
    item["draft"]["source"]["url"] = "https://example.org/"
    item["article"]["sourceUrl"] = "https://example.org"
    with Session(engine) as session, session.begin():
        result = stage_transfer_candidates(session, raw(payload), ACTOR, dry_run=False)
        candidate = session.get(Candidate, result["items"][0]["candidate_id"])
        article = editorial.current_revision(session, candidate).content["article"]
        assert article["doi"] == "10.9999/fictional"
        assert article["sourceUrl"] == "https://example.org/"


def test_duplicate_source_with_other_kind_creates_two_unapproved_articles(engine, payload):
    item = deepcopy(payload["items"][0])
    item["draft"]["kind"] = item["article"]["kind"] = "case"
    item["draft"]["slug"] = item["article"]["slug"] = "fictional-paired-case"
    payload["items"].append(item)
    with Session(engine) as session, session.begin():
        result = stage_transfer_candidates(session, raw(payload), ACTOR, dry_run=False)
        assert result["created"] == 2
        assert count(session, Source) == 1
        assert count(session, Candidate) == 2
        assert count(session, Publication) == 0


def test_slug_conflict_keeps_existing_candidate(engine, payload):
    with Session(engine) as session, session.begin():
        first = stage_transfer_candidates(session, raw(payload), ACTOR, dry_run=False)
        payload["items"][0]["draft"]["source"]["url"] = payload["items"][0]["article"][
            "sourceUrl"
        ] = "https://example.org/different"
        with pytest.raises(HTTPException) as caught:
            stage_transfer_candidates(session, raw(payload), ACTOR, dry_run=False)
        assert caught.value.status_code == 409
        assert count(session, Candidate) == 1
        assert session.get(Candidate, first["items"][0]["candidate_id"]).current_revision == 2
