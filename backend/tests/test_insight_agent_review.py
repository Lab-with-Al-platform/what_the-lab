"""관리자 검토 연결을 가상 DB만으로 검사합니다. 실제 모델·원격 DB는 쓰지 않습니다."""

from contextlib import contextmanager
from copy import deepcopy
from datetime import UTC, datetime

from sqlalchemy import select

from app.insights.agent_checkpoint import run_checkpointed_flow
from app.insights.agent_review import REWRITE_ERROR
from app.insights.database import get_session
from app.insights.models import AgentRun, Candidate, Revision, TransferReceipt, TransferReceiptItem
from app.insights.transfer_staging import LOCAL_VIRTUAL_TRUST_SCOPE
from app.main import app
from tests.test_insight_agent_checkpoint import lookup_hits, ok_hit, sample_config
from tests.test_insight_workflow import (
    ADMIN_PATH,
    ORIGIN,
    approval_body,
    create,
    login,
    make_draft,
)
from tests.test_insight_workflow import client as client  # noqa: PLC0414

WORKSPACE = "/api/v1/admin/insights/workspace"
RUN_ID = "offline-review-001"
NOW = datetime(2026, 10, 30, 8, 0, tzinfo=UTC)


def db_session():
    return contextmanager(app.dependency_overrides[get_session])()


def attach_run(candidate_id: str, run_id: str = RUN_ID, status: str = "ready_for_human", version: int = 4) -> None:
    with db_session() as session:
        session.add(
            AgentRun(
                run_id=run_id,
                step="ready_for_human",
                status=status,
                settings_version="settings-review-test",
                settings_hash="a" * 64,
                input_hash="b" * 64,
                manuscript_hash="c" * 64,
                attempt_count=1,
                budget_usage={
                    "model_calls": 2,
                    "tokens": 40,
                    "revision_rounds": 0,
                    "wall_seconds": 1,
                    "source_requests": 1,
                },
                error_code=None,
                evidence_ids=["virtual-ev-1"],
                bundle_id=f"{run_id}-bundle",
                state_version=version,
            )
        )
        receipt = TransferReceipt(
            trust_scope=LOCAL_VIRTUAL_TRUST_SCOPE,
            bundle_id=f"{run_id}-bundle",
            run_id=run_id,
            sha256="d" * 64,
            outcome="imported",
            first_result={"items": []},
        )
        session.add(receipt)
        session.flush()
        session.add(
            TransferReceiptItem(
                receipt_id=receipt.id,
                item_index=0,
                candidate_id=candidate_id,
                revision_number=1,
                action="created",
            )
        )


def rewrite_body(detail: dict, **extra) -> dict:
    run = detail["agent_run"]
    return {
        "expected_version": detail["version"],
        "reason": "설명과 근거를 보완해 다시 작성해 주세요",
        "run_id": run["run_id"],
        "expected_run_version": run["state_version"],
        **extra,
    }


def test_detail_shows_run_notes_without_approving(client):
    login(client)
    candidate = create(client)
    attach_run(candidate["id"])
    detail = client.get(f"{ADMIN_PATH}/{candidate['id']}").json()
    run = detail["agent_run"]
    assert run["run_id"] == RUN_ID
    assert run["status"] == "ready_for_human"
    assert run["status_label"] == "사람 검토 대기"
    assert run["evidence_ids"] == ["virtual-ev-1"]
    assert run["publication_approved"] is False
    assert detail["status"] == "draft"
    assert detail["approved_revision"] is None
    listed = client.get(WORKSPACE).json()["items"][0]
    assert listed["agent_run"]["status_label"] == "사람 검토 대기"


def test_rewrite_request_records_intent_and_keeps_manuscript(client):
    login(client)
    candidate = create(client, make_draft("rewrite"))
    attach_run(candidate["id"])
    path = f"{ADMIN_PATH}/{candidate['id']}"
    before = client.get(path).json()
    title = before["revisions"][-1]["content"]["title"]
    response = client.post(f"{path}/rewrite-request", headers=ORIGIN, json=rewrite_body(before))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "draft"
    assert body["publication_approved"] is False
    assert body["agent_run"]["rewrite_requested"] is True
    assert body["agent_run"]["status"] == "needs_revision"
    assert body["agent_run"]["error_code"] == REWRITE_ERROR
    after = client.get(path).json()
    assert after["revisions"][-1]["content"]["title"] == title
    assert after["current_revision"] == before["current_revision"]
    assert after["events"][-1]["action"] == "rewrite_requested"


def test_rewrite_rejects_non_admin_stale_version_wrong_run_and_duplicate(client):
    login(client)
    candidate = create(client, make_draft("guards"))
    attach_run(candidate["id"])
    path = f"{ADMIN_PATH}/{candidate['id']}/rewrite-request"
    detail = client.get(f"{ADMIN_PATH}/{candidate['id']}").json()
    payload = rewrite_body(detail)
    login(client, "200000000000000001")
    assert client.post(path, headers=ORIGIN, json=payload).status_code == 403
    login(client)
    assert client.post(path, json=payload).status_code == 403
    stale = {**payload, "expected_version": 99}
    assert client.post(path, headers=ORIGIN, json=stale).status_code == 409
    wrong_run = {**payload, "run_id": "other-run"}
    assert client.post(path, headers=ORIGIN, json=wrong_run).status_code == 409
    stale_run = {**payload, "expected_run_version": 1}
    assert client.post(path, headers=ORIGIN, json=stale_run).status_code == 409
    first = client.post(path, headers=ORIGIN, json=payload)
    assert first.status_code == 200, first.text
    again = client.post(
        path,
        headers=ORIGIN,
        json=rewrite_body(client.get(f"{ADMIN_PATH}/{candidate['id']}").json()),
    )
    assert again.status_code == 409


def test_rewrite_without_run_or_on_unrelated_candidate_is_conflict(client):
    login(client)
    lonely = create(client, make_draft("lonely"))
    linked = create(client, make_draft("linked"))
    attach_run(linked["id"])
    lonely_detail = client.get(f"{ADMIN_PATH}/{lonely['id']}").json()
    assert lonely_detail["agent_run"] is None
    missing = client.post(
        f"{ADMIN_PATH}/{lonely['id']}/rewrite-request",
        headers=ORIGIN,
        json={
            "expected_version": lonely_detail["version"],
            "reason": "회차 없는 후보",
            "run_id": RUN_ID,
            "expected_run_version": 4,
        },
    )
    assert missing.status_code == 409
    linked_detail = client.get(f"{ADMIN_PATH}/{linked['id']}").json()
    crossed = client.post(
        f"{ADMIN_PATH}/{lonely['id']}/rewrite-request",
        headers=ORIGIN,
        json=rewrite_body(linked_detail, expected_version=lonely_detail["version"]),
    )
    assert crossed.status_code == 409


def test_trend_and_agent_success_cannot_skip_existing_approval(client):
    login(client)
    trend = create(client, {**make_draft("trend-block"), "kind": "trend", "slug": "test-trend-block"})
    attach_run(trend["id"], run_id="trend-run-001")
    submitted = client.post(
        f"{ADMIN_PATH}/{trend['id']}/submit",
        headers=ORIGIN,
        json={"expected_version": trend["version"], "reason": "트렌드 검토"},
    ).json()
    blocked = client.post(
        f"{ADMIN_PATH}/{trend['id']}/approve",
        headers=ORIGIN,
        json=approval_body(submitted),
    )
    assert blocked.status_code == 422
    assert "트렌드" in blocked.json()["detail"]
    detail = client.get(f"{ADMIN_PATH}/{trend['id']}").json()
    assert detail["agent_run"]["publication_approved"] is False
    assert detail["status"] == "pending_review"


def test_admin_edit_is_not_overwritten_by_rewrite_or_resume(client):
    login(client)
    candidate = create(client, make_draft("keep-body"))
    attach_run(candidate["id"], run_id="keep-body-run")
    path = f"{ADMIN_PATH}/{candidate['id']}"
    prepared = client.post(
        f"{path}/article-draft",
        headers=ORIGIN,
        json={"expected_version": 1, "reason": "게시용 원고 틀"},
    )
    assert prepared.status_code == 200, prepared.text
    detail = client.get(path).json()
    article = deepcopy(detail["article"])
    draft = deepcopy(detail["review_draft"])
    article["title"] = "관리자가 고친 가상 제목"
    draft["title"] = article["title"]
    saved = client.post(
        f"{path}/article-revisions",
        headers=ORIGIN,
        json={
            "expected_version": detail["version"],
            "reason": "관리자가 본문을 고침",
            "article": article,
            "draft": draft,
        },
    )
    assert saved.status_code == 200, saved.text
    edited = client.get(path).json()
    rewritten = client.post(
        f"{path}/rewrite-request", headers=ORIGIN, json=rewrite_body(edited)
    )
    assert rewritten.status_code == 200, rewritten.text
    after = client.get(path).json()
    assert after["article"]["title"] == "관리자가 고친 가상 제목"
    stale_approve = client.post(
        f"{path}/approve",
        headers=ORIGIN,
        json=approval_body({"id": after["id"], "version": 1}),
    )
    assert stale_approve.status_code == 409
    with db_session() as session:
        run = session.scalar(select(AgentRun).where(AgentRun.run_id == "keep-body-run"))
        assert run.status == "needs_revision"
        assert run.error_code == REWRITE_ERROR


def test_checkpointed_bundle_resume_does_not_duplicate_after_rewrite(client):
    login(client)
    with db_session() as session:
        engine = session.get_bind()
    result = run_checkpointed_flow(
        sample_config(),
        engine,
        lookup=lookup_hits([ok_hit()]),
        run_id="bundle-review-001",
        now=NOW,
        actor="100000000000000001",
    )
    assert result.outcome == "ready_for_review"
    with db_session() as session:
        case = session.scalar(select(Candidate).where(Candidate.kind == "case"))
        case_id = case.id
    detail = client.get(f"{ADMIN_PATH}/{case_id}").json()
    assert detail["agent_run"]["run_id"] == "bundle-review-001"
    assert detail["agent_run"]["publication_approved"] is False
    rewritten = client.post(
        f"{ADMIN_PATH}/{case_id}/rewrite-request",
        headers=ORIGIN,
        json=rewrite_body(detail),
    )
    assert rewritten.status_code == 200, rewritten.text
    second = run_checkpointed_flow(
        sample_config(),
        engine,
        lookup=lookup_hits([ok_hit()]),
        run_id="bundle-review-001",
        now=NOW,
        actor="100000000000000001",
    )
    assert second.publication_approved is False
    with db_session() as session:
        count = len(session.scalars(select(Candidate)).all())
        assert count == 2
        revision = session.scalar(
            select(Revision).where(Revision.candidate_id == case_id, Revision.number == 1)
        )
        assert revision is not None
        title = revision.content.get("article", {}).get("title") or revision.content.get("title")
        assert "가상" in title
