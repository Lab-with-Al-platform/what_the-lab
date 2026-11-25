"""작업 회차를 기존 관리자 검토에 연결합니다.

별도 승인 저장소가 아닙니다. 게시는 기존 approve/publish만 수행합니다.
다시 작성 요청은 의도를 기록할 뿐, 현재 원고를 덮어쓰지 않습니다.
"""

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.insights import service
from app.insights.agent_checkpoint import row_snapshot, save_run
from app.insights.agent_contract import QualityIssue, scan_manuscript
from app.insights.editorial import current_revision
from app.insights.models import AgentRun, Candidate, TransferReceipt, TransferReceiptItem
from app.insights.schemas import Draft

REWRITE_EVENT = "rewrite_requested"
REWRITE_ERROR = "human_rewrite_requested"
# 사람 검토 대기 이후에만 다시 작성을 받습니다. 조사 중인 회차는 건드리지 않습니다.
REWRITE_STATUSES = frozenset({"ready_for_human", "needs_revision", "held", "failed"})
RUN_STATUS_LABELS = {
    "queued": "대기",
    "researching": "조사 중",
    "drafting": "작성 중",
    "reviewing": "기계 검토 중",
    "ready_for_human": "사람 검토 대기",
    "needs_revision": "보완 필요",
    "held": "보류",
    "failed": "실패",
    "cancelled": "취소",
}
ERROR_LABELS = {
    REWRITE_ERROR: "관리자가 다시 작성을 요청했습니다. 게시 승인이 아닙니다.",
    "insufficient_candidates": "자료가 부족해 보류했습니다.",
    "source_error": "출처를 읽지 못해 보류했습니다.",
    "held": "예산 한도에 닿아 보류했습니다.",
    "needs_revision": "기계 검사가 보완을 요청했습니다.",
}


def find_run_for_candidate(session: Session, candidate_id: str) -> AgentRun | None:
    """접수 이력의 후보 매핑으로 회차를 찾습니다. 글 상태 enum과 섞지 않습니다."""
    return session.scalar(
        select(AgentRun)
        .join(TransferReceipt, TransferReceipt.run_id == AgentRun.run_id)
        .join(TransferReceiptItem, TransferReceiptItem.receipt_id == TransferReceipt.id)
        .where(TransferReceiptItem.candidate_id == candidate_id)
        .order_by(TransferReceipt.created_at.desc())
        .limit(1)
    )


def compact_run(row: AgentRun) -> dict:
    return {
        "run_id": row.run_id,
        "status": row.status,
        "status_label": RUN_STATUS_LABELS.get(row.status, row.status),
    }


def run_summaries_for(session: Session, candidate_ids: list[str]) -> dict[str, dict]:
    """목록 한 페이지용 짧은 회차 표시. 원문·비밀값은 넣지 않습니다."""
    if not candidate_ids:
        return {}
    rows = session.execute(
        select(TransferReceiptItem.candidate_id, AgentRun)
        .join(TransferReceipt, TransferReceipt.id == TransferReceiptItem.receipt_id)
        .join(AgentRun, AgentRun.run_id == TransferReceipt.run_id)
        .where(TransferReceiptItem.candidate_id.in_(candidate_ids))
        .order_by(TransferReceipt.created_at.desc())
    ).all()
    summaries: dict[str, dict] = {}
    for candidate_id, row in rows:
        if candidate_id not in summaries:
            summaries[candidate_id] = compact_run(row)
    return summaries


def _current_notes(session: Session, candidate: Candidate) -> list[dict]:
    """지금 저장된 원고만 검사합니다. 예전 에이전트 PASS를 재사용하지 않습니다."""
    content = current_revision(session, candidate).content
    notes: list[QualityIssue] = []
    raw_draft = content.get("draft")
    if raw_draft is None and content.get("claims"):
        raw_draft = content
    if raw_draft:
        try:
            notes.extend(scan_manuscript(Draft.model_validate(raw_draft), content.get("article")))
        except (ValidationError, ValueError, TypeError):
            notes.append(
                QualityIssue(code="missing_article_body", message="현재 원고를 검사할 수 없습니다.")
            )
    unique: list[QualityIssue] = []
    seen: set[tuple[str, str]] = set()
    for item in notes:
        key = (item.code, item.message)
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return [item.model_dump() for item in unique]


def review_payload(session: Session, candidate: Candidate) -> dict | None:
    """상세 화면에 붙는 회차 칸. publication_approved는 항상 false입니다."""
    row = find_run_for_candidate(session, candidate.id)
    if row is None:
        return None
    snapshot = row_snapshot(row)
    notes = _current_notes(session, candidate)
    if snapshot.error_code:
        notes.insert(
            0,
            {
                "code": snapshot.error_code,
                "message": ERROR_LABELS.get(snapshot.error_code, snapshot.error_code),
            },
        )
    return {
        "run_id": snapshot.run_id,
        "step": snapshot.step,
        "status": snapshot.status,
        "status_label": RUN_STATUS_LABELS.get(snapshot.status, snapshot.status),
        "state_version": snapshot.state_version,
        "evidence_ids": snapshot.evidence_ids,
        "error_code": snapshot.error_code,
        "revision_notes": notes,
        "rewrite_requested": snapshot.status == "needs_revision"
        and snapshot.error_code == REWRITE_ERROR,
        "publication_approved": False,
    }


def request_rewrite(
    session: Session,
    candidate_id: str,
    expected_version: int,
    run_id: str,
    expected_run_version: int,
    actor: str,
    reason: str,
) -> Candidate:
    """다시 작성 의도를 기록합니다. 승인·게시·원고 덮어쓰기를 하지 않습니다."""
    candidate = service.get_candidate(session, candidate_id, expected_version)
    if candidate.status == "published":
        raise HTTPException(409, "공개본은 이 화면에서 다시 작성하지 않습니다.")
    row = find_run_for_candidate(session, candidate.id)
    if row is None or row.run_id != run_id:
        raise HTTPException(409, "다른 후보나 작업 회차를 가리킵니다.")
    if row.state_version != expected_run_version:
        raise HTTPException(409, "작업 회차가 바뀌었습니다. 다시 조회해 주세요.")
    if row.status not in REWRITE_STATUSES:
        raise HTTPException(409, "아직 사람 검토 단계가 아닌 회차입니다.")
    if row.status == "needs_revision" and row.error_code == REWRITE_ERROR:
        raise HTTPException(409, "이미 다시 작성 요청이 있습니다.")
    save_run(
        session,
        row.run_id,
        row.state_version,
        status="needs_revision",
        error_code=REWRITE_ERROR,
        lease_owner=None,
        lease_expires_at=None,
    )
    candidate.version += 1
    service.add_event(session, candidate, actor, REWRITE_EVENT, reason)
    service.flush_changes(session)
    return candidate
