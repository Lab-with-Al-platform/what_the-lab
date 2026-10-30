"""운영자용 API. 회원 정지·공통 관리자 부여는 서버가 다시 검사하고, 연구 본문은 바꾸지 않습니다."""

from datetime import date, datetime, time, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.analytics.collect import collection_enabled
from app.analytics.read import PostgresAnalyticsSource
from app.analytics.report import build_analytics_report
from app.analytics.store import server_now
from app.insights.auth import require_trusted_origin
from app.operations.account_actions import (
    AccountActionError,
    MemoryAccountStore,
    PostgresAccountStore,
    parse_admin_change,
    parse_change,
)
from app.operations.auth import require_operations_reader
from app.operations.collaboration import (
    STATUS_CODES,
    PostgresCollaborationSource,
    build_collaboration_report,
)
from app.operations.metrics import (
    build_summary,
    filter_members,
    filter_researches,
    member_detail,
    member_detail_from,
    members_page,
    research_detail,
    research_detail_from,
    research_summary,
    researches_page,
)
from app.operations.periods import SEOUL, describe_range, resolve_range, seoul_today
from app.operations.records import (
    OperationsSnapshot,
    fetch_member,
    fetch_members_page,
    fetch_research,
    fetch_researches_of,
    fetch_researches_page,
    fetch_snapshot,
)

router = APIRouter(prefix="/api/v1/admin/operations", tags=["operations"])


class StatusBody(BaseModel):
    expected_status: Literal["active", "suspended"]
    next_status: Literal["active", "suspended"]
    reason: str = Field(min_length=1, max_length=200)
    notice: str = Field(default="", max_length=200)
    idempotency_key: str


class AdminBody(BaseModel):
    expected_is_admin: bool
    next_is_admin: bool
    reason: str = Field(min_length=1, max_length=200)
    notice: str = Field(default="", max_length=200)
    idempotency_key: str


Reader = Annotated[dict, Depends(require_operations_reader)]
Preset = Literal["today", "7d", "30d", "month", "custom"]


def get_snapshot() -> OperationsSnapshot:
    """테스트가 가상 회원으로 바꿀 수 있게 조회 함수를 분리합니다."""
    return fetch_snapshot()


def get_record_set() -> OperationsSnapshot | None:
    """None이면 SQL에서 한 페이지만 읽습니다. 테스트는 가상 스냅샷을 넣습니다."""
    return None


def get_analytics_source() -> PostgresAnalyticsSource:
    """테스트는 메모리 원본으로 바꿉니다. 기본은 분석 표를 읽습니다."""
    return PostgresAnalyticsSource()


def get_collaboration_source() -> PostgresCollaborationSource:
    """테스트는 메모리 원본으로 바꿉니다. 기본은 협업 요청 표를 읽습니다."""
    return PostgresCollaborationSource()


def get_account_store() -> PostgresAccountStore:
    """테스트는 메모리 저장소로 바꿉니다. 기본 구현은 실제 회원 표를 바꿉니다."""
    return PostgresAccountStore()


def _bounds(start: date | None, end: date | None) -> tuple[datetime | None, datetime | None]:
    if start is not None and end is not None and end <= start:
        raise HTTPException(422, "끝 날짜는 시작 날짜보다 뒤여야 합니다.")
    start_at = datetime.combine(start, time.min, SEOUL) if start else None
    end_at = datetime.combine(end, time.min, SEOUL) if end else None
    return start_at, end_at


def _period(preset: str, start: date | None, end: date | None) -> tuple[datetime, datetime, dict]:
    try:
        start_at, end_at = resolve_range(preset, start, end, seoul_today())
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    return start_at, end_at, describe_range(start_at, end_at, seoul_today())


@router.get("/access")
def access(reader: Reader) -> dict[str, bool]:
    """메뉴를 그리기 전에 서버가 운영 조회 권한을 확인합니다."""
    del reader
    return {"can_read_operations": True}


@router.get("/summary")
def summary(
    reader: Reader,
    snapshot: Annotated[OperationsSnapshot, Depends(get_snapshot)],
    preset: Preset = "7d",
    start: date | None = None,
    end: date | None = None,
) -> dict:
    """오늘 볼 수 있는 현재 상태와, 기간으로 셀 수 있는 계정 생성만 돌려줍니다."""
    del reader
    start_at, end_at, described = _period(preset, start, end)
    body = build_summary(snapshot, start_at, end_at, seoul_today())
    body["range"] = {"preset": preset, **described}
    return body


@router.get("/analytics")
def analytics(
    reader: Reader,
    source: Annotated[PostgresAnalyticsSource, Depends(get_analytics_source)],
    preset: Preset = "7d",
    start: date | None = None,
    end: date | None = None,
    grain: Literal["day", "week", "month"] = "day",
) -> dict:
    """방문·글 이동·등록 과정. 수집 전 숫자는 null이고 0으로 채우지 않습니다."""
    del reader
    start_at, end_at, described = _period(preset, start, end)
    now = server_now()
    table_ready, events, started_at, daily = source.load(start_at, end_at, now - timedelta(days=9))
    body = build_analytics_report(
        events,
        enabled=collection_enabled(),
        table_ready=table_ready,
        start=start_at,
        end=end_at,
        now=now,
        started_at=started_at,
        grain=grain,
        daily=daily,
    )
    body["range"] = {"preset": preset, "grain": grain, **described}
    return body


@router.get("/collaboration")
def collaboration(
    reader: Reader,
    source: Annotated[PostgresCollaborationSource, Depends(get_collaboration_source)],
    preset: Preset = "7d",
    start: date | None = None,
    end: date | None = None,
    status: str = "",
    page: Annotated[int, Query(ge=1)] = 1,
) -> dict:
    """협업 요청의 현재 상태. 메시지와 성공률은 포함하지 않습니다."""
    del reader
    if status not in STATUS_CODES and status != "":
        raise HTTPException(422, "알 수 없는 요청 상태입니다.")
    start_at, end_at, described = _period(preset, start, end)
    table_ready, rows = source.load()
    body = build_collaboration_report(
        rows,
        table_ready=table_ready,
        start=start_at,
        end=end_at,
        status=status,
        page=page,
    )
    body["range"] = {"preset": preset, **described}
    return body


@router.get("/members")
def members(
    reader: Reader,
    records: Annotated[OperationsSnapshot | None, Depends(get_record_set)],
    q: Annotated[str, Query(max_length=30)] = "",
    role: Literal["", "researcher", "expert", "unset"] = "",
    status: Literal["", "active", "suspended", "deleted", "any"] = "",
    signup_step: Literal["", "role", "verify", "info", "done"] = "",
    created_start: date | None = None,
    created_end: date | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
) -> dict:
    del reader
    start_at, end_at = _bounds(created_start, created_end)
    query = {
        "q": q,
        "role": role,
        "status": status,
        "signup_step": signup_step,
        "created_start": start_at,
        "created_end": end_at,
    }
    if records is None:
        total, rows = fetch_members_page(query, page)
        return members_page(rows, total, page)
    return filter_members(records.members, query, page)


@router.get("/members/{user_id}")
def one_member(
    user_id: int,
    reader: Reader,
    records: Annotated[OperationsSnapshot | None, Depends(get_record_set)],
    store: Annotated[PostgresAccountStore | MemoryAccountStore, Depends(get_account_store)],
) -> dict:
    if records is None:
        member = fetch_member(user_id)
        body = None if member is None else member_detail_from(member, fetch_researches_of(user_id))
    else:
        body = member_detail(records, user_id)
    if body is None:
        raise HTTPException(404, "회원을 찾을 수 없습니다.")
    body["admin_actions"] = _admin_action(
        is_admin=body["is_admin"],
        status=body["status"],
        actor_id=reader["user_id"],
        target_id=user_id,
    )
    body["audit"] = _audit_body(store, user_id)
    return body


@router.post("/members/{user_id}/status", dependencies=[Depends(require_trusted_origin)])
def change_status(
    user_id: int,
    body: StatusBody,
    reader: Reader,
    store: Annotated[PostgresAccountStore | MemoryAccountStore, Depends(get_account_store)],
) -> dict:
    """정상↔정지만 바꿉니다. 같은 재시도 키는 이력을 한 번만 남깁니다."""
    try:
        change = parse_change(body.model_dump())
        result = store.change(reader["user_id"], user_id, change)
    except AccountActionError as error:
        raise HTTPException(error.status_code, error.detail) from error
    return {
        "user_id": user_id,
        "status": result["after_status"],
        "previous_status": result["before_status"],
        "replayed": result["replayed"],
        "action": result["action"],
    }


@router.post("/members/{user_id}/admin", dependencies=[Depends(require_trusted_origin)])
def change_admin(
    user_id: int,
    body: AdminBody,
    reader: Reader,
    store: Annotated[PostgresAccountStore | MemoryAccountStore, Depends(get_account_store)],
) -> dict:
    """공통 관리자 표시만 바꿉니다. 환경 변수 허용 목록은 고치지 않습니다."""
    try:
        change = parse_admin_change(body.model_dump())
        result = store.change_admin(reader["user_id"], user_id, change)
    except AccountActionError as error:
        raise HTTPException(error.status_code, error.detail) from error
    return {
        "user_id": user_id,
        "is_admin": result["after_status"] == "admin",
        "previous_is_admin": result["before_status"] == "admin",
        "replayed": result["replayed"],
        "action": result["action"],
    }


@router.get("/researches/summary")
def researches_summary(
    reader: Reader,
    snapshot: Annotated[OperationsSnapshot, Depends(get_snapshot)],
    preset: Preset = "7d",
    start: date | None = None,
    end: date | None = None,
) -> dict:
    del reader
    start_at, end_at, described = _period(preset, start, end)
    return {
        "range": {"preset": preset, **described},
        **research_summary(snapshot, start_at, end_at),
    }


@router.get("/researches")
def researches(
    reader: Reader,
    records: Annotated[OperationsSnapshot | None, Depends(get_record_set)],
    q: Annotated[str, Query(max_length=60)] = "",
    status: Literal["", "draft", "registered"] = "",
    progress_status: Literal[
        "",
        "recruiting",
        "unmatched_closed",
        "scheduled",
        "in_progress",
        "completed",
        "recruitment_canceled",
        "paused",
        "completion_pending",
        "discontinued",
        "not_applicable",
        "not_linked",
    ] = "",
    field_id: Annotated[str, Query(max_length=10)] = "",
    able_work_id: Annotated[str, Query(max_length=10)] = "",
    created_start: date | None = None,
    created_end: date | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
) -> dict:
    del reader
    start_at, end_at = _bounds(created_start, created_end)
    query = {
        "q": q,
        "status": status,
        "progress_status": progress_status,
        "field_id": field_id,
        "able_work_id": able_work_id,
        "created_start": start_at,
        "created_end": end_at,
    }
    if records is None:
        total, rows = fetch_researches_page(query, page)
        return researches_page(rows, total, page)
    return filter_researches(records.researches, query, page)


def _audit_body(store: PostgresAccountStore | MemoryAccountStore, user_id: int) -> dict:
    """표가 없으면 회원 상세 전체를 막지 않고, 이력만 아직 없다고 표시합니다."""
    try:
        rows = store.history(user_id)
    except AccountActionError as error:
        return {"status": "not_collected", "note": error.detail, "items": []}
    return {
        "status": "ready",
        "note": "성공한 정지·해제·관리자 변경만 보여 줍니다. 화면에서 고치거나 지우지 않습니다.",
        "items": [
            {
                "actor_user_id": row["actor_user_id"],
                "action": row["action"],
                "before_status": row["before_status"],
                "after_status": row["after_status"],
                "reason": row["reason"],
                "notice": row["notice"],
                "created_at": row["created_at"].isoformat(),
            }
            for row in rows
        ],
    }


def _admin_action(*, is_admin: bool, status: str, actor_id: int, target_id: int) -> dict:
    """버튼 표시용입니다. 실제 부여는 POST에서 다시 검사합니다."""
    if actor_id == target_id:
        return {
            "status": "not_available",
            "next_is_admin": None,
            "note": "본인 권한은 이 화면에서 바꾸지 않습니다. 다른 관리자에게 요청하세요.",
        }
    if status != "active":
        return {
            "status": "not_available",
            "next_is_admin": None,
            "note": "정상 계정에만 공통 관리자를 주거나 해제합니다.",
        }
    if is_admin:
        return {
            "status": "ready",
            "next_is_admin": False,
            "note": "공통 관리자를 해제하면 운영·인사이트·게시판 관리가 함께 닫힙니다. 마지막 관리자는 해제할 수 없습니다.",
        }
    return {
        "status": "ready",
        "next_is_admin": True,
        "note": "공통 관리자를 부여하면 운영·인사이트·게시판 관리가 함께 열립니다. Discord 환경 변수 목록은 바꾸지 않습니다.",
    }


@router.get("/researches/{research_id}")
def one_research(
    research_id: int,
    reader: Reader,
    records: Annotated[OperationsSnapshot | None, Depends(get_record_set)],
) -> dict:
    del reader
    if records is None:
        row = fetch_research(research_id)
        body = None if row is None else research_detail_from(row)
    else:
        body = research_detail(records, research_id)
    if body is None:
        raise HTTPException(404, "연구를 찾을 수 없습니다.")
    return body
