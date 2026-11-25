"""가짜 출처·가짜 완성으로 조사→작성→편집→전송 검사만 실행합니다. DB·승인은 하지 않습니다."""

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from json import dumps
from pathlib import Path

from app.insights.agent_contract import (
    AgentContractError,
    BudgetUsage,
    EvidenceRecord,
    WritingBudget,
    assert_paired_manuscripts,
    budget_status,
    discovery_budget,
    public_usage_log,
    writing_budget_for_tests,
)
from app.insights.agent_tools import call_tool
from app.insights.collection_policy import DiscoveryPolicy, discovery_windows
from app.insights.collection_sources import source_key
from app.insights.schemas import Draft
from app.insights.transfer_contract import validate_transfer_bytes
from app.insights.workspace_schemas import CollectionConfig

LookupFn = Callable[[str, str, tuple[int, int]], list[dict]]
CompleteFn = Callable[[str, dict], object]
ElapsedFn = Callable[[], int]
PROFILES = ("case", "news", "explanation")
KIND_BY_PROFILE = {"case": "case", "explanation": "trend"}
WRITE_TOOL = {"case": "write_case_draft", "trend": "write_trend_draft"}
WRITE_ROLE = {"case": "case_writer", "trend": "trend_writer"}


class SourceAccessError(RuntimeError):
    """가짜 조회가 접근 불가로 끝난 경우입니다. 실제 HTTP 오류를 그대로 노출하지 않습니다."""


@dataclass
class FlowResult:
    run_id: str
    outcome: str
    hold_reason: str | None
    usage: BudgetUsage
    planned_windows: dict[str, list[tuple[int, int]]]
    logs: list[dict] = field(default_factory=list)
    bundle_bytes: bytes | None = None
    item_count: int = 0
    publication_approved: bool = False


def _halt(
    run_id: str,
    outcome: str,
    reason: str | None,
    usage: BudgetUsage,
    windows: dict[str, list[tuple[int, int]]],
    logs: list[dict],
    evidence_ids: list[str],
) -> FlowResult:
    logs.append(
        public_usage_log(
            code=outcome,
            elapsed_ms=usage.wall_seconds * 1000,
            usage=usage,
            evidence_ids=evidence_ids,
        )
    )
    return FlowResult(
        run_id=run_id,
        outcome=outcome,
        hold_reason=reason,
        usage=usage,
        planned_windows=windows,
        logs=logs,
        publication_approved=False,
    )


def _selected_urls(config: CollectionConfig) -> list[str]:
    return [source.url for source in config.sources if source.selected]


def _evidence_from_hit(hit: dict, index: int) -> EvidenceRecord:
    published = hit.get("published") or {"value": None, "precision": "unknown"}
    return EvidenceRecord(
        evidence_id=f"virtual-ev-{index}",
        url=str(hit["url"]),
        doi=hit.get("doi"),
        published=published,
        read_range="unavailable",
        locator="가상 조회 메모",
        ai_review="가짜 완성 의견. 검증 완료가 아닙니다.",
        review_status="needs_review",
    )


def virtual_complete(role: str, payload: dict) -> dict:
    """공급자 SDK 없이 가상 원고를 돌려줍니다. 실제 논문이 아닙니다."""
    evidence = payload["evidence"]
    url = evidence["url"]
    issues = payload.get("quality_issues") or []
    omit_glossary = payload.get("omit_glossary") or any(
        item.get("code") == "force_missing_glossary" for item in issues
    )
    same_slug = payload.get("same_slug", False)
    kind = "case" if role == "case_writer" else "trend"
    slug = "fictional-virtual-pair" if same_slug else f"fictional-virtual-{kind}"
    title = "가상 사례: 예측을 사람이 확인하는 방법" if kind == "case" else "가상 해설: 예측 확인이 필요한 이유"
    summary = "실제 연구 결과가 아닌 가상 회차 원고입니다."
    claim = "가상 입력이므로 사실 검증과 게시 승인을 할 수 없습니다."
    body = (
        "연구 질문과 사람의 확인 단계를 가상으로 적습니다."
        if kind == "case"
        else "쉬운 말로 예측과 확인의 차이를 가상으로 적습니다."
    )
    draft = {
        "kind": kind,
        "source": {
            "title": evidence.get("title") or "가상 연구 설명",
            "doi": evidence.get("doi"),
            "url": url,
            "access_level": "unknown",
            "bibliography_checked": False,
        },
        "title": title,
        "slug": slug,
        "summary": summary,
        "research_field": "가상 연구 분야",
        "case_type": "research",
        "claims": [
            {
                "field": "limitations",
                "text": claim,
                "locator": "가상 초록",
                "verification": "needs_review",
                "evidence_level": "unavailable",
            }
        ],
        "image_policy": "no_image",
        "glossary": []
        if omit_glossary
        else [{"label": "검증", "definition": "결과가 맞는지 별도로 확인하는 과정입니다."}],
    }
    article = {
        "slug": slug,
        "kind": kind,
        "title": title,
        "summary": summary,
        "field": "가상 연구 분야",
        "sourceUrl": url,
        "doi": evidence.get("doi"),
        "sections": [
            {
                "id": "overview",
                "title": "가상 개요",
                "toc": "개요",
                "paragraphs": [
                    body,
                    {"kind": "interpretation", "text": "해석은 원문 사실과 구분해 가상으로 적습니다."},
                    {"kind": "application", "text": "적용 예시도 가상 입력이며 실제 성과가 아닙니다."},
                    {"kind": "caution", "text": "이 원고는 실제 논문이나 게시용 글이 아닙니다."},
                ],
                "termIds": [] if omit_glossary else ["validation"],
                "steps": [{"title": "직접 확인", "detail": "가상 입력과 결과를 비교합니다."}],
                "chips": ["가상 샘플"],
            }
        ],
        "topicId": "fictional-topic",
        "topicLabel": "가상 분류",
        "domains": ["가상 분야"],
        "tags": ["가상 샘플"],
        "source": "실제 출처 없음",
        "publishedOn": "미게시",
        "readingMinutes": 1,
        "cover": "chart",
        "coverSrc": None,
        "highlights": [],
        "facts": [],
        "technologies": [],
        "relatedSlugs": [],
        "glossary": []
        if omit_glossary
        else [{"id": "validation", "label": "검증", "definition": "결과가 맞는지 별도로 확인하는 과정입니다."}],
        "sampleNotice": "가상 회차 출력. 실제 논문·게시 금지.",
    }
    refs = [] if payload.get("drop_evidence") else [evidence["evidence_id"]]
    return {"draft": draft, "article": article, "evidence_refs": refs}


def _check_budget(
    usage: BudgetUsage, policy: DiscoveryPolicy, writing: WritingBudget, elapsed: ElapsedFn
) -> str:
    usage.wall_seconds = elapsed()
    return budget_status(usage, policy, writing)


def _collect_evidence(
    config: CollectionConfig,
    usage: BudgetUsage,
    writing: WritingBudget,
    lookup: LookupFn,
    elapsed: ElapsedFn,
    windows: dict[str, list[tuple[int, int]]],
    run_id: str,
    logs: list[dict],
) -> tuple[dict[str, EvidenceRecord], FlowResult | None]:
    policy = config.discovery_policy
    search = discovery_budget(policy)
    evidence: dict[str, EvidenceRecord] = {}

    def stop(outcome: str, reason: str) -> tuple[dict[str, EvidenceRecord], FlowResult]:
        return evidence, _halt(run_id, outcome, reason, usage, windows, logs, list(evidence))

    for profile in PROFILES:
        for window in windows[profile]:
            for url in _selected_urls(config):
                status = _check_budget(usage, policy, writing, elapsed)
                if status == "held":
                    return stop("held", "budget_exhausted")
                if usage.source_requests >= search["max_source_requests"]:
                    return stop("held", "budget_exhausted")
                usage.source_requests += 1
                try:
                    hits = lookup(url, profile, window)
                except SourceAccessError:
                    return stop("source_error", "source_unreachable")
                for hit in hits:
                    if hit.get("access") == "unreachable":
                        return stop("source_error", "source_unreachable")
                    key = source_key(str(hit["url"]))
                    if key in {source_key(item.url) for item in evidence.values()}:
                        continue
                    record = _evidence_from_hit(hit, len(evidence) + 1)
                    evidence[record.evidence_id] = record
    return evidence, None


def _write_kind(
    kind: str,
    run_id: str,
    evidence: EvidenceRecord,
    known: dict[str, EvidenceRecord],
    allowed: set[str],
    complete: CompleteFn,
    usage: BudgetUsage,
    policy: DiscoveryPolicy,
    writing: WritingBudget,
    elapsed: ElapsedFn,
    extra_payload: dict,
) -> tuple[dict | None, str | None]:
    issues: list[dict] = []
    role = WRITE_ROLE[kind]
    for attempt in range(writing.max_revision_rounds + 1):
        if attempt:
            usage.revision_rounds += 1
        status = _check_budget(usage, policy, writing, elapsed)
        if status in {"held", "needs_revision"}:
            return None, status
        usage.model_calls += 1
        raw = complete(
            role,
            {
                "evidence": evidence.model_dump(mode="json"),
                "quality_issues": issues,
                "kind": kind,
                **extra_payload,
            },
        )
        if not isinstance(raw, dict):
            return None, "model_error"
        refs = raw.get("evidence_refs") or []
        if not refs:
            issues = [{"code": "missing_evidence_ref", "message": "근거 참조가 없습니다."}]
            continue
        try:
            tool_out = call_tool(
                role,
                WRITE_TOOL[kind],
                {"draft": raw["draft"], "article": raw.get("article"), "evidence_refs": refs},
                allowed_source_urls=allowed,
                known_evidence=known,
                run_id=run_id,
            )
        except AgentContractError:
            return None, "model_error"
        issues = tool_out["quality_issues"]
        if tool_out["status"] == "ok":
            return raw, None
        call_tool(
            "editor",
            "suggest_revisions",
            {"quality_issues": issues},
            allowed_source_urls=allowed,
            known_evidence=known,
            run_id=run_id,
        )
    return None, "needs_revision"


def _bundle_bytes(
    run_id: str,
    settings_version: str,
    generated_at: datetime,
    case_raw: dict,
    trend_raw: dict,
    evidence: EvidenceRecord,
) -> bytes:
    checked = generated_at - timedelta(minutes=5)
    items = []
    for raw in (case_raw, trend_raw):
        items.append(
            {
                "draft": raw["draft"],
                "article": raw["article"],
                "source_published": evidence.published.model_dump(mode="json"),
                "source_checked_at": checked.isoformat(),
                "access_notes": "가상 샘플입니다. 실제 출처에 접속하지 않았습니다.",
                "rights_notes": "원문·삽화 없이 작성한 테스트용 문장입니다.",
            }
        )
    payload = {
        "schema_version": "insight_transfer_v1",
        "bundle_id": f"{run_id}-bundle",
        "run_id": run_id,
        "generated_at": generated_at.isoformat(),
        "settings_version": settings_version,
        "generator": {
            "tool": "virtual-flow",
            "model": "no-model-called",
            "prompt_version": "flow-v1",
        },
        "items": items,
    }
    return dumps(payload, ensure_ascii=False).encode("utf-8")


def run_virtual_flow(
    config: CollectionConfig,
    *,
    lookup: LookupFn,
    complete: CompleteFn = virtual_complete,
    writing: WritingBudget | None = None,
    run_id: str = "offline-flow-001",
    now: datetime | None = None,
    elapsed: ElapsedFn | None = None,
    extra_payload: dict | None = None,
) -> FlowResult:
    """조사→근거 점검→사례/트렌드 작성→편집→전송 검사. 실제 수집기·모델·DB를 쓰지 않습니다."""
    budget = writing or writing_budget_for_tests()
    generated = now or datetime(2026, 10, 29, 8, 0, tzinfo=UTC)
    clock = elapsed or (lambda: 0)
    usage = BudgetUsage()
    logs: list[dict] = []
    policy = config.discovery_policy
    windows = {
        profile: discovery_windows(profile, policy, config.lookback_days) for profile in PROFILES
    }
    extra = extra_payload or {}
    evidence, halted = _collect_evidence(
        config, usage, budget, lookup, clock, windows, run_id, logs
    )
    if halted is not None:
        return halted
    if not evidence:
        return _halt(
            run_id, "insufficient_candidates", "empty_lookup", usage, windows, logs, []
        )
    record = next(iter(evidence.values()))
    allowed = set(_selected_urls(config))
    try:
        call_tool(
            "evidence_checker",
            "read_evidence_bundle",
            {"evidence_id": record.evidence_id},
            allowed_source_urls=allowed,
            known_evidence=evidence,
            run_id=run_id,
        )
    except AgentContractError:
        return _halt(
            run_id, "source_error", "evidence_missing", usage, windows, logs, list(evidence)
        )
    drafts: dict[str, dict] = {}
    for kind in ("case", "trend"):
        raw, error = _write_kind(
            kind, run_id, record, evidence, allowed, complete, usage, policy, budget, clock, extra
        )
        if error:
            reason = "invalid_model_json" if error == "model_error" else error
            return _halt(run_id, error, reason, usage, windows, logs, list(evidence))
        drafts[kind] = raw
    try:
        assert_paired_manuscripts(
            Draft.model_validate(drafts["case"]["draft"]),
            Draft.model_validate(drafts["trend"]["draft"]),
            drafts["case"]["article"],
            drafts["trend"]["article"],
        )
    except AgentContractError:
        return _halt(
            run_id, "duplicate_slug", "same_slug_or_body", usage, windows, logs, list(evidence)
        )
    settings_version = f"settings-{canonical_short(config)}"
    raw_bytes = _bundle_bytes(
        run_id, settings_version, generated, drafts["case"], drafts["trend"], record
    )
    validate_transfer_bytes(raw_bytes)
    logs.append(
        public_usage_log(
            code="ready_for_review",
            elapsed_ms=usage.wall_seconds * 1000,
            usage=usage,
            evidence_ids=list(evidence),
        )
    )
    return FlowResult(
        run_id=run_id,
        outcome="ready_for_review",
        hold_reason=None,
        usage=usage,
        planned_windows=windows,
        logs=logs,
        bundle_bytes=raw_bytes,
        item_count=2,
        publication_approved=False,
    )


def canonical_short(config: CollectionConfig) -> str:
    dumped = dumps(config.model_dump(mode="json"), ensure_ascii=False, sort_keys=True)
    return str(len(dumped))


def write_virtual_bundle(result: FlowResult, directory: Path) -> Path | None:
    """테스트 전용 폴더에만 씁니다. 운영 수집 저장 위치를 정하지 않습니다."""
    if result.bundle_bytes is None:
        return None
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{result.run_id}.json"
    path.write_bytes(result.bundle_bytes)
    return path
