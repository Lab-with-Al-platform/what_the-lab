"""작업 회차를 프로세스 밖에 저장하고 안전하게 재개합니다.

Receipt(묶음 접수)와 Candidate(글 상태)와 칸을 섞지 않습니다.
모델 응답을 받은 뒤 저장 전에 끝나면 그 단계는 다시 돌 수 있습니다.
외부 호출 exactly-once를 주장하지 않으며, 중복 후보는 접수 이력이 막습니다.
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from hashlib import sha256

from sqlalchemy import Engine, select, update
from sqlalchemy.orm import Session

from app.insights.agent_contract import (
    AgentContractError,
    BudgetUsage,
    WritingBudget,
    assert_paired_manuscripts,
    canonical_hash,
    writing_budget_for_tests,
)
from app.insights.agent_flow import (
    PROFILES,
    FlowResult,
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
from app.insights.models import AgentRun, utc_now
from app.insights.schemas import Draft
from app.insights.transfer_contract import validate_transfer_bytes
from app.insights.transfer_staging import (
    LOCAL_VIRTUAL_TRUST_SCOPE,
    find_receipt,
    replay_or_conflict,
    stage_transfer_candidates,
)
from app.insights.workspace_schemas import CollectionConfig

CompleteFn = Callable[[str, dict], object]
LookupFn = Callable[[str, str, tuple[int, int]], list[dict]]
ElapsedFn = Callable[[], int]
# 운영 만료 초는 미확정입니다. 테스트만 짧은 값을 씁니다.
PRODUCTION_LEASE_SECONDS = None
TEST_LEASE_SECONDS = 30
# 모델 응답 수신 후 상태 저장 전 종료 구간. 재개 때 작성이 한 번 더 돌 수 있습니다.
DUPLICATE_EXECUTION_GAP = "complete_returned_before_checkpoint_save"
TERMINAL = frozenset({"ready_for_human", "needs_revision", "held", "failed", "cancelled"})


class CheckpointConflict(ValueError):
    """오래된 version·다른 설정·다른 작업자의 유효 임대는 덮어쓰지 않습니다."""


class CheckpointStoreError(RuntimeError):
    """저장 실패. 마지막 성공 체크포인트가 재개 기준입니다."""


@dataclass
class RunSnapshot:
    """관리자 검토 연결용 최소 읽기 칸. 원문·비밀값은 없습니다."""

    run_id: str
    step: str
    status: str
    settings_version: str
    settings_hash: str
    input_hash: str
    manuscript_hash: str | None
    attempt_count: int
    budget_usage: dict
    error_code: str | None
    evidence_ids: list[str]
    bundle_id: str | None
    state_version: int
    publication_approved: bool = False


def config_fingerprints(config: CollectionConfig) -> tuple[str, str, str]:
    """설정 버전 문자열과 내용 해시, 입력 해시를 만듭니다. 원문은 저장하지 않습니다."""
    dumped = config.model_dump(mode="json")
    settings_hash = canonical_hash(dumped)
    settings_version = f"settings-{canonical_short(config)}"
    input_hash = canonical_hash({"settings": settings_hash, "urls": _selected_urls(config)})
    return settings_version, settings_hash, input_hash


def manuscript_digest(bundle_bytes: bytes) -> str:
    return sha256(bundle_bytes).hexdigest()


def row_snapshot(row: AgentRun) -> RunSnapshot:
    return RunSnapshot(
        run_id=row.run_id,
        step=row.step,
        status=row.status,
        settings_version=row.settings_version,
        settings_hash=row.settings_hash,
        input_hash=row.input_hash,
        manuscript_hash=row.manuscript_hash,
        attempt_count=row.attempt_count,
        budget_usage=dict(row.budget_usage or {}),
        error_code=row.error_code,
        evidence_ids=list(row.evidence_ids or []),
        bundle_id=row.bundle_id,
        state_version=row.state_version,
        publication_approved=False,
    )


def read_run_for_review(session: Session, run_id: str) -> RunSnapshot | None:
    """5단계 관리자 연결용 읽기. HTTP·승인 API를 열지 않습니다."""
    row = session.scalar(select(AgentRun).where(AgentRun.run_id == run_id))
    if row is None:
        return None
    return row_snapshot(row)


def planned_windows(config: CollectionConfig) -> dict[str, list[tuple[int, int]]]:
    policy = config.discovery_policy
    return {
        profile: discovery_windows(profile, policy, config.lookback_days) for profile in PROFILES
    }


def save_run(session: Session, run_id: str, expected_version: int, **fields: object) -> int:
    """같은 version만 갱신합니다. 0행이면 다른 재개가 먼저 저장한 것입니다."""
    values = {**fields, "state_version": expected_version + 1, "updated_at": utc_now()}
    result = session.execute(
        update(AgentRun)
        .where(AgentRun.run_id == run_id, AgentRun.state_version == expected_version)
        .values(**values)
    )
    if result.rowcount != 1:
        raise CheckpointConflict("stale_version")
    session.flush()
    return expected_version + 1


def _lease_held(row: AgentRun, owner: str, now: datetime) -> bool:
    if not row.lease_owner or row.lease_owner == owner:
        return False
    if row.lease_expires_at is None:
        return False
    expires = row.lease_expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    return expires > now


def acquire_lease(
    session: Session, row: AgentRun, owner: str, now: datetime, ttl_seconds: int
) -> int:
    if _lease_held(row, owner, now):
        raise CheckpointConflict("lease_held")
    return save_run(
        session,
        row.run_id,
        row.state_version,
        lease_owner=owner,
        lease_expires_at=now + timedelta(seconds=ttl_seconds),
    )


def _create_run(
    session: Session,
    run_id: str,
    settings_version: str,
    settings_hash: str,
    input_hash: str,
    owner: str,
    now: datetime,
    ttl_seconds: int,
) -> AgentRun:
    row = AgentRun(
        run_id=run_id,
        step="queued",
        status="queued",
        settings_version=settings_version,
        settings_hash=settings_hash,
        input_hash=input_hash,
        attempt_count=0,
        budget_usage=BudgetUsage().model_dump(),
        evidence_ids=[],
        bundle_id=f"{run_id}-bundle",
        lease_owner=owner,
        lease_expires_at=now + timedelta(seconds=ttl_seconds),
        state_version=1,
    )
    session.add(row)
    session.flush()
    return row


def load_or_create_run(
    session: Session,
    run_id: str,
    settings_version: str,
    settings_hash: str,
    input_hash: str,
    owner: str,
    now: datetime,
    ttl_seconds: int,
    current_manuscript_hash: str | None,
) -> AgentRun:
    row = session.scalar(select(AgentRun).where(AgentRun.run_id == run_id))
    if row is None:
        return _create_run(
            session, run_id, settings_version, settings_hash, input_hash, owner, now, ttl_seconds
        )
    if row.settings_hash != settings_hash or row.settings_version != settings_version:
        raise CheckpointConflict("settings_changed")
    if row.input_hash != input_hash:
        raise CheckpointConflict("input_changed")
    if (
        current_manuscript_hash
        and row.manuscript_hash
        and current_manuscript_hash != row.manuscript_hash
    ):
        raise CheckpointConflict("manuscript_changed")
    acquire_lease(session, row, owner, now, ttl_seconds)
    session.refresh(row)
    return row


def _paused(run_id: str, step: str, usage: BudgetUsage, windows: dict) -> FlowResult:
    return FlowResult(
        run_id=run_id,
        outcome="paused",
        hold_reason=f"stop:{step}",
        usage=usage,
        planned_windows=windows,
        publication_approved=False,
    )


def _usage_from_row(row: AgentRun) -> BudgetUsage:
    return BudgetUsage.model_validate(row.budget_usage or {})


def _result_from_row(row: AgentRun, windows: dict, bundle_bytes: bytes | None = None) -> FlowResult:
    usage = _usage_from_row(row)
    outcome = row.error_code or row.status
    if row.status == "ready_for_human":
        outcome = "ready_for_review"
    elif row.status not in TERMINAL:
        outcome = "paused"
    return FlowResult(
        run_id=row.run_id,
        outcome=outcome,
        hold_reason=row.error_code,
        usage=usage,
        planned_windows=windows,
        bundle_bytes=bundle_bytes,
        item_count=2 if row.status == "ready_for_human" else 0,
        publication_approved=False,
    )


def _reload(session: Session, run_id: str) -> AgentRun:
    row = session.scalar(select(AgentRun).where(AgentRun.run_id == run_id))
    if row is None:
        raise CheckpointStoreError("작업 회차가 없습니다.")
    return row


def _commit_step(session: Session) -> None:
    session.commit()


def _mark_terminal(
    session: Session,
    row: AgentRun,
    status: str,
    error_code: str | None,
    usage: BudgetUsage,
    evidence_ids: list[str],
    manuscript_hash: str | None = None,
) -> AgentRun:
    step = "ready_for_human" if status == "ready_for_human" else row.step
    fields: dict[str, object] = {
        "step": step,
        "status": status,
        "error_code": error_code,
        "budget_usage": usage.model_dump(),
        "evidence_ids": evidence_ids,
        "lease_owner": None,
        "lease_expires_at": None,
    }
    if manuscript_hash is not None:
        fields["manuscript_hash"] = manuscript_hash
    save_run(session, row.run_id, row.state_version, **fields)
    _commit_step(session)
    return _reload(session, row.run_id)


def _start_step(session: Session, row: AgentRun, step: str, usage: BudgetUsage) -> AgentRun:
    save_run(
        session,
        row.run_id,
        row.state_version,
        step=step,
        status=step,
        attempt_count=row.attempt_count + 1,
        budget_usage=usage.model_dump(),
        error_code=None,
    )
    _commit_step(session)
    return _reload(session, row.run_id)


def _finish_step(session: Session, row: AgentRun, next_step: str, status: str, usage: BudgetUsage, evidence_ids: list[str]) -> AgentRun:
    save_run(
        session,
        row.run_id,
        row.state_version,
        step=next_step,
        status=status,
        budget_usage=usage.model_dump(),
        evidence_ids=evidence_ids,
    )
    _commit_step(session)
    return _reload(session, row.run_id)


def _halt_and_store(session: Session, row: AgentRun, halted: FlowResult) -> FlowResult:
    status = halted.outcome if halted.outcome in {"held", "needs_revision"} else "failed"
    _mark_terminal(session, row, status, halted.outcome, halted.usage, [])
    return halted


def _replay_completed(session: Session, row: AgentRun, windows: dict, actor: str | None) -> FlowResult:
    receipt = None
    if row.bundle_id:
        receipt = find_receipt(session, LOCAL_VIRTUAL_TRUST_SCOPE, row.bundle_id)
    if actor is not None and receipt is not None:
        replay_or_conflict(session, receipt, receipt.sha256)
    return _result_from_row(row, windows)


def _research(
    session: Session,
    row: AgentRun,
    config: CollectionConfig,
    lookup: LookupFn,
    budget: WritingBudget,
    clock: ElapsedFn,
    windows: dict,
    usage: BudgetUsage,
) -> tuple[AgentRun, dict, FlowResult | None]:
    row = _start_step(session, row, "researching", usage)
    logs: list[dict] = []
    evidence, halted = _collect_evidence(
        config, usage, budget, lookup, clock, windows, row.run_id, logs
    )
    if halted is not None:
        return row, evidence, halted
    if not evidence:
        halted = _halt(
            row.run_id, "insufficient_candidates", "empty_lookup", usage, windows, logs, []
        )
        return row, evidence, halted
    row = _finish_step(session, row, "drafting", "researching", usage, list(evidence))
    return row, evidence, None


def _check_evidence(row: AgentRun, evidence: dict, allowed: set[str], windows: dict, usage: BudgetUsage) -> FlowResult | None:
    record = next(iter(evidence.values()))
    try:
        call_tool(
            "evidence_checker",
            "read_evidence_bundle",
            {"evidence_id": record.evidence_id},
            allowed_source_urls=allowed,
            known_evidence=evidence,
            run_id=row.run_id,
        )
    except AgentContractError:
        return _halt(
            row.run_id, "source_error", "evidence_missing", usage, windows, [], list(evidence)
        )
    return None


def _draft_pair(
    run_id: str,
    config: CollectionConfig,
    evidence: dict,
    allowed: set[str],
    complete: CompleteFn,
    budget: WritingBudget,
    clock: ElapsedFn,
    extra: dict,
    usage: BudgetUsage,
    windows: dict,
) -> tuple[dict, FlowResult | None]:
    record = next(iter(evidence.values()))
    drafts: dict[str, dict] = {}
    logs: list[dict] = []
    for kind in ("case", "trend"):
        raw, error = _write_kind(
            kind,
            run_id,
            record,
            evidence,
            allowed,
            complete,
            usage,
            config.discovery_policy,
            budget,
            clock,
            extra,
        )
        if error:
            reason = "invalid_model_json" if error == "model_error" else error
            return {}, _halt(run_id, error, reason, usage, windows, logs, list(evidence))
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
            run_id, "duplicate_slug", "same_slug_or_body", usage, windows, logs, list(evidence)
        )
        return {}, halted
    return drafts, None


def _review_and_stage(
    session: Session,
    row: AgentRun,
    drafts: dict,
    evidence: dict,
    settings_version: str,
    generated: datetime,
    usage: BudgetUsage,
    actor: str | None,
) -> tuple[AgentRun, bytes]:
    # 검토 시작·접수·완료 저장을 한 트랜잭션으로 묶어 접수만 남는 상태를 막습니다.
    version = save_run(
        session,
        row.run_id,
        row.state_version,
        step="reviewing",
        status="reviewing",
        attempt_count=row.attempt_count + 1,
        budget_usage=usage.model_dump(),
        error_code=None,
    )
    record = next(iter(evidence.values()))
    raw_bytes = _bundle_bytes(
        row.run_id, settings_version, generated, drafts["case"], drafts["trend"], record
    )
    validate_transfer_bytes(raw_bytes)
    if actor is not None:
        if not session.in_transaction():
            session.begin()
        stage_transfer_candidates(
            session,
            raw_bytes,
            actor,
            dry_run=False,
            trust_scope=LOCAL_VIRTUAL_TRUST_SCOPE,
        )
    save_run(
        session,
        row.run_id,
        version,
        step="ready_for_human",
        status="ready_for_human",
        error_code=None,
        budget_usage=usage.model_dump(),
        evidence_ids=list(evidence),
        manuscript_hash=manuscript_digest(raw_bytes),
        lease_owner=None,
        lease_expires_at=None,
    )
    _commit_step(session)
    return _reload(session, row.run_id), raw_bytes


def _rebuild_unsaved(
    config: CollectionConfig,
    lookup: LookupFn,
    complete: CompleteFn,
    budget: WritingBudget,
    clock: ElapsedFn,
    extra: dict,
    windows: dict,
    run_id: str,
    allowed: set[str],
    need_drafts: bool,
) -> tuple[dict, dict, FlowResult | None]:
    """원문을 저장하지 않으므로 재개 때 메모리를 다시 만듭니다. 이미 기록된 예산은 다시 깎지 않습니다."""
    scratch = BudgetUsage()
    logs: list[dict] = []
    evidence, halted = _collect_evidence(
        config, scratch, budget, lookup, clock, windows, run_id, logs
    )
    if halted is not None:
        halted.usage = BudgetUsage()
        return evidence, {}, halted
    if not evidence:
        return evidence, {}, _halt(
            run_id, "insufficient_candidates", "empty_lookup", BudgetUsage(), windows, logs, []
        )
    if not need_drafts:
        return evidence, {}, None
    drafts, halted = _draft_pair(
        run_id, config, evidence, allowed, complete, budget, clock, extra, scratch, windows
    )
    return evidence, drafts, halted


def run_checkpointed_flow(
    config: CollectionConfig,
    engine: Engine,
    *,
    lookup: LookupFn,
    complete: CompleteFn = virtual_complete,
    writing: WritingBudget | None = None,
    run_id: str = "offline-flow-001",
    worker_id: str = "virtual-worker-a",
    now: datetime | None = None,
    elapsed: ElapsedFn | None = None,
    extra_payload: dict | None = None,
    stop_before: str | None = None,
    stop_after: str | None = None,
    lease_seconds: int = TEST_LEASE_SECONDS,
    actor: str | None = None,
    current_manuscript_hash: str | None = None,
    after_model: Callable[[], None] | None = None,
) -> FlowResult:
    """조사→작성→전송 검사를 단계 저장과 함께 실행합니다. 외부 실행 경로는 열지 않습니다."""
    generated = now or datetime(2026, 10, 29, 8, 0, tzinfo=UTC)
    clock = elapsed or (lambda: 0)
    budget = writing or writing_budget_for_tests()
    extra = extra_payload or {}
    windows = planned_windows(config)
    settings_version, settings_hash, input_hash = config_fingerprints(config)
    session = Session(engine)
    try:
        row = load_or_create_run(
            session,
            run_id,
            settings_version,
            settings_hash,
            input_hash,
            worker_id,
            generated,
            lease_seconds,
            current_manuscript_hash,
        )
        _commit_step(session)
        row = _reload(session, run_id)
        usage = _usage_from_row(row)
        if row.status == "ready_for_human":
            result = _replay_completed(session, row, windows, actor)
            _commit_step(session)
            return result
        if row.status in TERMINAL:
            return _result_from_row(row, windows)
        if row.step == "queued" and stop_after == "queued":
            return _paused(run_id, "queued", usage, windows)
        if stop_before == "researching" and row.step in {"queued", "researching"}:
            return _paused(run_id, "researching", usage, windows)

        evidence: dict = {}
        drafts: dict = {}
        allowed = set(_selected_urls(config))
        if row.step in {"queued", "researching"}:
            row, evidence, halted = _research(
                session, row, config, lookup, budget, clock, windows, usage
            )
            if halted is not None:
                return _halt_and_store(session, row, halted)
            if stop_after == "researching":
                return _paused(run_id, "researching", usage, windows)
        else:
            evidence, drafts, halted = _rebuild_unsaved(
                config,
                lookup,
                complete,
                budget,
                clock,
                extra,
                windows,
                run_id,
                allowed,
                need_drafts=row.step == "reviewing",
            )
            if halted is not None:
                return _halt_and_store(session, row, halted)

        evidence_error = _check_evidence(row, evidence, allowed, windows, usage)
        if evidence_error is not None:
            return _halt_and_store(session, row, evidence_error)
        if stop_before == "drafting" and row.step == "drafting":
            return _paused(run_id, "drafting", usage, windows)

        if row.step == "drafting":
            row = _start_step(session, row, "drafting", usage)
            drafts, halted = _draft_pair(
                row.run_id, config, evidence, allowed, complete, budget, clock, extra, usage, windows
            )
            # 중복 실행 가능 구간: 모델 응답은 받았지만 아직 체크포인트를 안 남겼습니다.
            if after_model is not None:
                after_model()
            if halted is not None:
                return _halt_and_store(session, row, halted)
            row = _finish_step(session, row, "reviewing", "drafting", usage, list(evidence))
            if stop_after == "drafting":
                return _paused(run_id, "drafting", usage, windows)

        if stop_before == "reviewing" and row.step == "reviewing":
            return _paused(run_id, "reviewing", usage, windows)
        row, raw_bytes = _review_and_stage(
            session, row, drafts, evidence, settings_version, generated, usage, actor
        )
        return FlowResult(
            run_id=run_id,
            outcome="ready_for_review",
            hold_reason=None,
            usage=usage,
            planned_windows=windows,
            bundle_bytes=raw_bytes,
            item_count=2,
            publication_approved=False,
        )
    finally:
        session.close()
