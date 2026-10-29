"""역할·도구·예산 계약만 검사합니다. 모델·네트워크·DB·승인 API는 호출하지 않습니다."""

import json
from copy import deepcopy
from hashlib import sha256
from pathlib import Path

import pytest

from app.insights.agent_contract import (
    CONTRACT_VERSION,
    PRODUCTION_WRITING_BUDGET,
    ROLE_TABLE,
    TEST_WRITING_BUDGET,
    AgentContractError,
    BudgetUsage,
    EvidenceRecord,
    RoleResult,
    accept_delivery_path,
    accept_role_result,
    assert_paired_manuscripts,
    budget_status,
    canonical_hash,
    combine_status,
    discovery_budget,
    public_usage_log,
    publication_approved_from_agent,
    scan_evidence_level,
    scan_manuscript,
    writing_budget_for_tests,
)
from app.insights.agent_tools import (
    FORBIDDEN_TOOLS,
    NETWORK_FUTURE_CONTRACT,
    call_tool,
)
from app.insights.collection_policy import DiscoveryPolicy
from app.insights.schemas import Draft
from app.insights.transfer_contract import TransferError

FIXTURE = Path(__file__).parent / "fixtures" / "insight-transfer-v1.json"
RUN_ID = "offline-test-001"
EVIDENCE_ID = "fictional-ev-1"
ALLOWED = {"https://example.org/fictional-study"}


def fixture_payload() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def evidence() -> EvidenceRecord:
    return EvidenceRecord(
        evidence_id=EVIDENCE_ID,
        url="https://example.org/fictional-study",
        published={"value": None, "precision": "unknown"},
        read_range="unavailable",
        locator="가상 초록",
        ai_review="형식 검사용 의견. 검증 완료가 아닙니다.",
    )


def known() -> dict[str, EvidenceRecord]:
    record = evidence()
    return {record.evidence_id: record}


def input_digest() -> str:
    return canonical_hash({"evidence_id": EVIDENCE_ID, "run_id": RUN_ID})


def role_payload(role: str, **overrides: object) -> dict:
    body = {
        "contract_version": CONTRACT_VERSION,
        "run_id": RUN_ID,
        "role": role,
        "input_hash": input_digest(),
        "evidence_refs": [EVIDENCE_ID],
        "status": "ok",
        "quality_issues": [],
        "output": {"note": "가상 역할 결과"},
    }
    body.update(overrides)
    return body


def accept(role: str, raw: dict) -> RoleResult:
    return accept_role_result(
        raw,
        assigned_role=role,
        current_run_id=RUN_ID,
        expected_input_hash=input_digest(),
        known_evidence_ids={EVIDENCE_ID},
    )


def test_role_table_covers_required_jobs_without_approval_tools():
    required = {
        "coordinator",
        "researcher",
        "evidence_checker",
        "case_writer",
        "trend_writer",
        "editor",
    }
    assert set(ROLE_TABLE) == required
    for spec in ROLE_TABLE.values():
        assert not spec["tools"].intersection(FORBIDDEN_TOOLS)


def test_unknown_field_is_rejected():
    raw = role_payload("researcher", extra_score=1)
    with pytest.raises(AgentContractError, match="형식"):
        accept("researcher", raw)


def test_forged_role_is_rejected():
    raw = role_payload("coordinator")
    with pytest.raises(AgentContractError, match="위조"):
        accept("researcher", raw)


def test_claimed_capability_does_not_grant_tools():
    raw = role_payload("editor", output={"capability": "approve", "keyword_ids": ["CAP-TEST"]})
    with pytest.raises(AgentContractError, match="자칭"):
        accept("editor", raw)


def test_other_run_message_is_rejected():
    raw = role_payload("researcher", run_id="other-run-9")
    with pytest.raises(AgentContractError, match="다른 회차"):
        accept("researcher", raw)


def test_input_hash_mismatch_is_rejected():
    raw = role_payload("researcher", input_hash=sha256(b"other").hexdigest())
    with pytest.raises(AgentContractError, match="해시"):
        accept("researcher", raw)


def test_missing_evidence_ref_is_rejected():
    raw = role_payload("case_writer", evidence_refs=[])
    with pytest.raises(AgentContractError, match="근거 참조"):
        accept("case_writer", raw)


def test_disallowed_tool_and_path_are_rejected():
    with pytest.raises(AgentContractError, match="전달 경로"):
        accept_delivery_path("direct_publish")
    with pytest.raises(AgentContractError, match="허용되지 않은 도구"):
        call_tool(
            "editor",
            "write_case_draft",
            {},
            allowed_source_urls=ALLOWED,
            known_evidence=known(),
            run_id=RUN_ID,
        )
    with pytest.raises(AgentContractError, match="제공하지 않습니다"):
        call_tool(
            "coordinator",
            "approve_candidate",
            {},
            allowed_source_urls=ALLOWED,
            known_evidence=known(),
            run_id=RUN_ID,
        )


def test_page_commands_are_data_and_fake_tool_does_not_fetch():
    result = call_tool(
        "researcher",
        "read_allowed_source",
        {"url": "https://example.org/fictional-study", "page_command": "os.system('rm')"},
        allowed_source_urls=ALLOWED,
        known_evidence=known(),
        run_id=RUN_ID,
    )
    assert result["fetched"] is False
    assert NETWORK_FUTURE_CONTRACT["implemented"] is False
    with pytest.raises(AgentContractError, match="허용 출처"):
        call_tool(
            "researcher",
            "read_allowed_source",
            {"url": "https://evil.example/secret"},
            allowed_source_urls=ALLOWED,
            known_evidence=known(),
            run_id=RUN_ID,
        )


def test_overstated_evidence_and_verified_claim_are_quality_issues():
    payload = fixture_payload()
    draft_data = payload["items"][0]["draft"]
    draft_data["claims"][0]["verification"] = "verified"
    draft_data["claims"][0]["evidence_level"] = "fulltext"
    draft_data["kind"] = "case"
    draft = Draft.model_validate(draft_data)
    issues = scan_manuscript(draft, payload["items"][0]["article"])
    issues.extend(scan_evidence_level(evidence(), draft))
    codes = {issue.code for issue in issues}
    assert "unverified_claim" in codes
    assert "overstated_evidence_level" in codes
    written = call_tool(
        "case_writer",
        "write_case_draft",
        {
            "draft": draft.model_dump(mode="json"),
            "article": payload["items"][0]["article"],
            "evidence_refs": [EVIDENCE_ID],
        },
        allowed_source_urls=ALLOWED,
        known_evidence=known(),
        run_id=RUN_ID,
    )
    assert written["status"] == "needs_revision"
    assert written["publication_approved"] is False


def test_overstated_clinical_scope_is_a_quality_issue():
    payload = fixture_payload()
    draft_data = payload["items"][0]["draft"]
    draft_data["summary"] = "임상에서 효과가 입증된 가상 문장입니다."
    draft_data["kind"] = "case"
    issues = scan_manuscript(Draft.model_validate(draft_data), payload["items"][0]["article"])
    assert any(issue.code == "overstated_clinical_or_experiment" for issue in issues)


def test_missing_v1_body_is_needs_revision():
    payload = fixture_payload()
    draft_data = payload["items"][0]["draft"]
    draft_data["kind"] = "trend"
    written = call_tool(
        "trend_writer",
        "write_trend_draft",
        {"draft": draft_data, "evidence_refs": [EVIDENCE_ID]},
        allowed_source_urls=ALLOWED,
        known_evidence=known(),
        run_id=RUN_ID,
    )
    assert written["status"] == "needs_revision"
    assert any(item["code"] == "missing_article_body" for item in written["quality_issues"])


def test_case_and_trend_from_same_source_need_different_slug_and_body():
    payload = fixture_payload()
    trend_draft = Draft.model_validate(payload["items"][0]["draft"])
    case_data = deepcopy(payload["items"][0]["draft"])
    case_data["kind"] = "case"
    case_data["slug"] = "fictional-ai-validation-case"
    case_draft = Draft.model_validate(case_data)
    case_article = deepcopy(payload["items"][0]["article"])
    case_article["kind"] = "case"
    case_article["slug"] = case_data["slug"]
    case_article["sections"][0]["paragraphs"][0] = "사례용 가상 본문입니다. 연구 질문과 한계를 따로 적습니다."
    assert_paired_manuscripts(case_draft, trend_draft, case_article, payload["items"][0]["article"])
    with pytest.raises(AgentContractError, match="서로 다른 주소"):
        assert_paired_manuscripts(
            case_draft, trend_draft, payload["items"][0]["article"], payload["items"][0]["article"]
        )
    copied = deepcopy(case_article)
    copied["kind"] = "trend"
    copied["slug"] = trend_draft.slug
    with pytest.raises(AgentContractError, match="같은 본문"):
        assert_paired_manuscripts(case_draft, trend_draft, case_article, copied)


def test_budget_exhaustion_holds_and_does_not_force_pass():
    policy = DiscoveryPolicy(enabled=False)
    writing = writing_budget_for_tests()
    search = discovery_budget(policy)
    assert search["max_source_requests"] == policy.max_source_requests
    assert PRODUCTION_WRITING_BUDGET is None
    assert writing.max_model_calls == TEST_WRITING_BUDGET["max_model_calls"]
    held = budget_status(
        BudgetUsage(model_calls=writing.max_model_calls + 1),
        policy,
        writing,
    )
    retries = budget_status(
        BudgetUsage(revision_rounds=writing.max_revision_rounds + 1),
        policy,
        writing,
    )
    assert held == "held"
    assert retries == "needs_revision"
    assert combine_status("ok", held) == "held"
    assert combine_status("ok", retries) != "ok"


def test_agent_ok_is_not_admin_or_publication_approval():
    result = accept("researcher", role_payload("researcher"))
    assert result.status == "ok"
    assert publication_approved_from_agent(result) is False
    assert not isinstance(result, TransferError)


def test_usage_log_omits_secrets_and_full_input():
    secret = "fake-secret-must-not-be-logged"
    usage = BudgetUsage(model_calls=1, tokens=12)
    entry = public_usage_log(
        code="held",
        elapsed_ms=40,
        usage=usage,
        evidence_ids=[EVIDENCE_ID],
    )
    text = json.dumps(entry, ensure_ascii=False)
    assert secret not in text
    assert "prompt" not in text
    assert EVIDENCE_ID in text
    assert entry["usage"]["tokens"] == 12


def test_keyword_cap_is_not_a_permission_capability():
    raw = role_payload("case_writer", output={"keyword_ids": ["CAP-TEST"]})
    result = accept("case_writer", raw)
    assert result.output["keyword_ids"] == ["CAP-TEST"]
    assert "CAP-TEST" not in ROLE_TABLE["case_writer"]["tools"]
