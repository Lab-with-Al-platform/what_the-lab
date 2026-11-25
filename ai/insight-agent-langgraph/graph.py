"""LangGraph 얇은 어댑터. 도메인 규칙은 기존 Python 함수에 두고 순서만 고정합니다."""

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import TypedDict

from app.insights.agent_contract import (
    AgentContractError,
    BudgetUsage,
    WritingBudget,
    assert_paired_manuscripts,
    public_usage_log,
    writing_budget_for_tests,
)
from app.insights.agent_flow import (
    PROFILES,
    CompleteFn,
    ElapsedFn,
    FlowResult,
    LookupFn,
    _bundle_bytes,
    _collect_evidence,
    _halt,
    _selected_urls,
    _write_kind,
    canonical_short,
    virtual_complete,
)
from app.insights.agent_tools import call_tool
from app.insights.collection_policy import discovery_windows
from app.insights.schemas import Draft
from app.insights.transfer_contract import validate_transfer_bytes
from app.insights.workspace_schemas import CollectionConfig
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph

# 모델이 다음 칸을 고르지 않습니다. 아래 칸만 이어집니다.
HALT_OUTCOMES = frozenset(
    {
        "insufficient_candidates",
        "source_error",
        "needs_revision",
        "model_error",
        "duplicate_slug",
        "held",
    }
)


class GraphState(TypedDict, total=False):
    """그래프에 남는 공개 칸. 원문·비밀값은 넣지 않습니다."""

    run_id: str
    step: str
    outcome: str
    hold_reason: str | None
    source_requests: int
    model_calls: int
    revision_rounds: int
    wall_seconds: int
    evidence_ids: list[str]
    item_count: int
    publication_approved: bool


@dataclass
class GraphScratch:
    """프로세스 RAM에만 있는 작업 메모. 재시작되면 사라집니다."""

    config: CollectionConfig
    lookup: LookupFn
    complete: CompleteFn
    writing: WritingBudget
    elapsed: ElapsedFn
    extra: dict
    now: datetime
    usage: BudgetUsage
    logs: list[dict]
    windows: dict[str, list[tuple[int, int]]]
    evidence: dict = field(default_factory=dict)
    drafts: dict = field(default_factory=dict)
    bundle_bytes: bytes | None = None
    steps: list[str] = field(default_factory=list)


def _usage_fields(usage: BudgetUsage) -> dict:
    return {
        "source_requests": usage.source_requests,
        "model_calls": usage.model_calls,
        "revision_rounds": usage.revision_rounds,
        "wall_seconds": usage.wall_seconds,
        "publication_approved": False,
    }


class InsightGraphAdapter:
    """조사→점검→작성→전송 검사. 승인·게시는 하지 않습니다."""

    def __init__(
        self,
        checkpointer: InMemorySaver | None = None,
        *,
        interrupt_before: tuple[str, ...] = (),
    ) -> None:
        self.checkpointer = checkpointer or InMemorySaver()
        self._scratch: dict[str, GraphScratch] = {}
        builder = StateGraph(GraphState)
        builder.add_node("research", self._research)
        builder.add_node("check", self._check)
        builder.add_node("draft", self._draft)
        builder.add_node("review", self._review)
        builder.add_edge(START, "research")
        builder.add_conditional_edges("research", self._route("check"))
        builder.add_conditional_edges("check", self._route("draft"))
        builder.add_conditional_edges("draft", self._route("review"))
        builder.add_edge("review", END)
        self.app = builder.compile(
            checkpointer=self.checkpointer,
            interrupt_before=list(interrupt_before),
        )

    def _route(self, nxt: str):
        def decide(state: GraphState) -> str:
            if state.get("outcome") in HALT_OUTCOMES:
                return END
            return nxt

        return decide

    def _from_halt(self, run_id: str, halted: FlowResult) -> GraphState:
        scratch = self._scratch[run_id]
        return {
            "run_id": run_id,
            "step": halted.outcome,
            "outcome": halted.outcome,
            "hold_reason": halted.hold_reason,
            "evidence_ids": list(scratch.evidence),
            "item_count": 0,
            **_usage_fields(halted.usage),
        }

    def _research(self, state: GraphState) -> GraphState:
        run_id = state["run_id"]
        scratch = self._scratch[run_id]
        scratch.steps.append("research")
        evidence, halted = _collect_evidence(
            scratch.config,
            scratch.usage,
            scratch.writing,
            scratch.lookup,
            scratch.elapsed,
            scratch.windows,
            run_id,
            scratch.logs,
        )
        scratch.evidence = evidence
        if halted is not None:
            return self._from_halt(run_id, halted)
        if not evidence:
            empty = _halt(
                run_id,
                "insufficient_candidates",
                "empty_lookup",
                scratch.usage,
                scratch.windows,
                scratch.logs,
                [],
            )
            return self._from_halt(run_id, empty)
        return {
            "run_id": run_id,
            "step": "researching",
            "outcome": "",
            "hold_reason": None,
            "evidence_ids": list(evidence),
            "item_count": 0,
            **_usage_fields(scratch.usage),
        }

    def _check(self, state: GraphState) -> GraphState:
        run_id = state["run_id"]
        scratch = self._scratch[run_id]
        scratch.steps.append("check")
        record = next(iter(scratch.evidence.values()))
        allowed = set(_selected_urls(scratch.config))
        try:
            call_tool(
                "evidence_checker",
                "read_evidence_bundle",
                {"evidence_id": record.evidence_id},
                allowed_source_urls=allowed,
                known_evidence=scratch.evidence,
                run_id=run_id,
            )
        except AgentContractError:
            halted = _halt(
                run_id,
                "source_error",
                "evidence_missing",
                scratch.usage,
                scratch.windows,
                scratch.logs,
                list(scratch.evidence),
            )
            return self._from_halt(run_id, halted)
        return {
            "run_id": run_id,
            "step": "checking",
            "outcome": "",
            "hold_reason": None,
            "evidence_ids": list(scratch.evidence),
            **_usage_fields(scratch.usage),
        }

    def _draft(self, state: GraphState) -> GraphState:
        run_id = state["run_id"]
        scratch = self._scratch[run_id]
        scratch.steps.append("draft")
        record = next(iter(scratch.evidence.values()))
        allowed = set(_selected_urls(scratch.config))
        drafts: dict[str, dict] = {}
        for kind in ("case", "trend"):
            raw, error = _write_kind(
                kind,
                run_id,
                record,
                scratch.evidence,
                allowed,
                scratch.complete,
                scratch.usage,
                scratch.config.discovery_policy,
                scratch.writing,
                scratch.elapsed,
                scratch.extra,
            )
            if error:
                reason = "invalid_model_json" if error == "model_error" else error
                halted = _halt(
                    run_id,
                    error,
                    reason,
                    scratch.usage,
                    scratch.windows,
                    scratch.logs,
                    list(scratch.evidence),
                )
                return self._from_halt(run_id, halted)
            drafts[kind] = raw
        try:
            assert_paired_manuscripts(
                Draft.model_validate(drafts["case"]["draft"]),
                Draft.model_validate(drafts["trend"]["draft"]),
                drafts["case"]["article"],
                drafts["trend"]["article"],
            )
        except AgentContractError:
            halted = _halt(
                run_id,
                "duplicate_slug",
                "same_slug_or_body",
                scratch.usage,
                scratch.windows,
                scratch.logs,
                list(scratch.evidence),
            )
            return self._from_halt(run_id, halted)
        scratch.drafts = drafts
        return {
            "run_id": run_id,
            "step": "drafting",
            "outcome": "",
            "hold_reason": None,
            "evidence_ids": list(scratch.evidence),
            **_usage_fields(scratch.usage),
        }

    def _review(self, state: GraphState) -> GraphState:
        run_id = state["run_id"]
        scratch = self._scratch[run_id]
        scratch.steps.append("review")
        record = next(iter(scratch.evidence.values()))
        settings_version = f"settings-{canonical_short(scratch.config)}"
        raw_bytes = _bundle_bytes(
            run_id,
            settings_version,
            scratch.now,
            scratch.drafts["case"],
            scratch.drafts["trend"],
            record,
        )
        validate_transfer_bytes(raw_bytes)
        scratch.bundle_bytes = raw_bytes
        scratch.logs.append(
            public_usage_log(
                code="ready_for_review",
                elapsed_ms=scratch.usage.wall_seconds * 1000,
                usage=scratch.usage,
                evidence_ids=list(scratch.evidence),
            )
        )
        return {
            "run_id": run_id,
            "step": "reviewing",
            "outcome": "ready_for_review",
            "hold_reason": None,
            "evidence_ids": list(scratch.evidence),
            "item_count": 2,
            **_usage_fields(scratch.usage),
        }

    def _to_result(self, run_id: str, state: GraphState, *, paused: bool) -> FlowResult:
        scratch = self._scratch[run_id]
        outcome = "paused" if paused else str(state.get("outcome") or "")
        return FlowResult(
            run_id=run_id,
            outcome=outcome,
            hold_reason=None if paused else state.get("hold_reason"),
            usage=scratch.usage,
            planned_windows=scratch.windows,
            logs=scratch.logs,
            bundle_bytes=None if paused else scratch.bundle_bytes,
            item_count=0 if paused else int(state.get("item_count") or 0),
            publication_approved=False,
        )

    def prepare(
        self,
        config: CollectionConfig,
        *,
        lookup: LookupFn,
        complete: CompleteFn,
        writing: WritingBudget,
        run_id: str,
        now: datetime,
        elapsed: ElapsedFn,
        extra_payload: dict,
    ) -> None:
        windows = {
            profile: discovery_windows(profile, config.discovery_policy, config.lookback_days)
            for profile in PROFILES
        }
        self._scratch[run_id] = GraphScratch(
            config=config,
            lookup=lookup,
            complete=complete,
            writing=writing,
            elapsed=elapsed,
            extra=extra_payload,
            now=now,
            usage=BudgetUsage(),
            logs=[],
            windows=windows,
        )

    def invoke_thread(self, run_id: str, payload: dict | None) -> FlowResult:
        config = {"configurable": {"thread_id": run_id}}
        state = self.app.invoke(payload, config)
        snapshot = self.app.get_state(config)
        paused = bool(snapshot.next)
        return self._to_result(run_id, state, paused=paused)


def run_graph_flow(
    config: CollectionConfig,
    *,
    lookup: LookupFn,
    complete: CompleteFn = virtual_complete,
    writing: WritingBudget | None = None,
    run_id: str = "offline-flow-001",
    now: datetime | None = None,
    elapsed: ElapsedFn | None = None,
    extra_payload: dict | None = None,
    adapter: InsightGraphAdapter | None = None,
    stop_before: str | None = None,
) -> FlowResult:
    """가짜 조회·가짜 완성만 사용합니다. thread_id는 회차 이름일 뿐 관리자 권한이 아닙니다."""
    generated = now or datetime(2026, 10, 29, 8, 0, tzinfo=UTC)
    clock = elapsed or (lambda: 0)
    budget = writing or writing_budget_for_tests()
    extra = extra_payload or {}
    before = ("draft",) if stop_before == "drafting" else ()
    graph = adapter or InsightGraphAdapter(interrupt_before=before)
    graph.prepare(
        config,
        lookup=lookup,
        complete=complete,
        writing=budget,
        run_id=run_id,
        now=generated,
        elapsed=clock,
        extra_payload=extra,
    )
    return graph.invoke_thread(
        run_id,
        {
            "run_id": run_id,
            "outcome": "",
            "hold_reason": None,
            "item_count": 0,
            "publication_approved": False,
        },
    )
