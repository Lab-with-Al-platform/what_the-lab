"""역할별 최소 도구 목록과 가짜 도구. 실제 네트워크·승인·게시는 제공하지 않습니다."""

from collections.abc import Callable

from app.insights.agent_contract import (
    ROLE_TABLE,
    AgentContractError,
    EvidenceRecord,
    QualityIssue,
    RoleName,
    scan_evidence_level,
    scan_manuscript,
)
from app.insights.collection_sources import source_key
from app.insights.schemas import Draft
from app.insights.workspace_schemas import CollectionSource

# 향후 네트워크 도구가 생길 때의 계약입니다. 이번 단계에서는 구현하지 않습니다.
NETWORK_FUTURE_CONTRACT = {
    "scheme": "https",
    "recheck_redirects": True,
    "block_private_and_internal": True,
    "max_response_bytes": 1_000_000,
    "timeout_seconds": 10,
    "implemented": False,
}
FORBIDDEN_TOOLS = frozenset(
    {
        "approve_candidate",
        "publish_candidate",
        "execute_shell",
        "run_sql",
        "read_database_key",
        "read_arbitrary_file",
        "execute_page_command",
    }
)


def allowed_tools(role: RoleName) -> frozenset[str]:
    return ROLE_TABLE[role]["tools"]


def _reject_forbidden(tool: str) -> None:
    if tool in FORBIDDEN_TOOLS:
        raise AgentContractError("승인·게시·셸·SQL·DB 키 도구는 제공하지 않습니다.")


def fake_read_allowed_source(url: str, allowed_source_urls: set[str]) -> dict:
    """허용 목록만 확인하고 페이지에 접속하지 않습니다. 페이지 속 명령은 데이터가 아닙니다."""
    CollectionSource.model_validate({"name": "allowed", "url": url, "content_kinds": ["case"]})
    allowed = {source_key(item) for item in allowed_source_urls}
    if source_key(url) not in allowed:
        raise AgentContractError("허용 출처가 아닙니다.")
    return {
        "url": url,
        "fetched": False,
        "read_range": "unavailable",
        "note": "가짜 도구. 네트워크에 접속하지 않았습니다.",
    }


def fake_read_evidence_bundle(evidence_id: str, known_evidence: dict[str, EvidenceRecord]) -> dict:
    record = known_evidence.get(evidence_id)
    if record is None:
        raise AgentContractError("알 수 없는 근거 참조입니다.")
    return record.model_dump(mode="json")


def fake_write_draft(
    role: RoleName,
    arguments: dict,
    known_evidence: dict[str, EvidenceRecord],
) -> dict:
    expected_kind = "case" if role == "case_writer" else "trend"
    try:
        draft = Draft.model_validate(arguments["draft"])
    except Exception as error:
        raise AgentContractError("원고 메모 형식이 올바르지 않습니다.") from error
    if draft.kind != expected_kind:
        raise AgentContractError("작성 역할과 원고 유형이 다릅니다.")
    refs = arguments.get("evidence_refs") or []
    if not refs:
        raise AgentContractError("근거 참조가 없습니다.")
    unknown = [item for item in refs if item not in known_evidence]
    if unknown:
        raise AgentContractError("알 수 없는 근거 참조입니다.")
    issues = scan_manuscript(draft, arguments.get("article"))
    for evidence_id in refs:
        issues.extend(scan_evidence_level(known_evidence[evidence_id], draft))
    status = "needs_revision" if issues else "ok"
    return {
        "kind": draft.kind,
        "slug": draft.slug,
        "status": status,
        "quality_issues": [issue.model_dump() for issue in issues],
        "publication_approved": False,
    }


def fake_suggest_revisions(arguments: dict) -> dict:
    issues = [QualityIssue.model_validate(item) for item in arguments.get("quality_issues") or []]
    if not issues:
        issues = [QualityIssue(code="unverified_claim", message="관리자 검토 전까지 보완 항목을 유지합니다.")]
    return {
        "status": "needs_revision",
        "quality_issues": [issue.model_dump() for issue in issues],
        "publication_approved": False,
    }


def fake_read_run_state(run_id: str) -> dict:
    return {"run_id": run_id, "publication_approved": False}


def fake_hold_run(reason_code: str) -> dict:
    return {"status": "held", "code": reason_code, "publication_approved": False}


def call_tool(
    assigned_role: RoleName,
    tool: str,
    arguments: dict,
    *,
    allowed_source_urls: set[str],
    known_evidence: dict[str, EvidenceRecord],
    run_id: str,
) -> dict:
    """실행기 목록에 있는 가짜 도구만 호출합니다. 메시지에 적힌 role은 쓰지 않습니다."""
    _reject_forbidden(tool)
    if tool not in allowed_tools(assigned_role):
        raise AgentContractError("이 역할에 허용되지 않은 도구입니다.")
    handlers: dict[str, Callable[[], dict]] = {
        "read_allowed_source": lambda: fake_read_allowed_source(
            str(arguments.get("url", "")), allowed_source_urls
        ),
        "read_evidence_bundle": lambda: fake_read_evidence_bundle(
            str(arguments.get("evidence_id", "")), known_evidence
        ),
        "write_case_draft": lambda: fake_write_draft("case_writer", arguments, known_evidence),
        "write_trend_draft": lambda: fake_write_draft("trend_writer", arguments, known_evidence),
        "suggest_revisions": lambda: fake_suggest_revisions(arguments),
        "read_run_state": lambda: fake_read_run_state(run_id),
        "hold_run": lambda: fake_hold_run(str(arguments.get("code", "held"))),
    }
    return handlers[tool]()
