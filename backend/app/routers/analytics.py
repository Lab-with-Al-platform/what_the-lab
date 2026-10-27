"""방문·글 이동·등록 과정 수집 API.

수집이 꺼져 있으면 저장하지 않습니다. 응답에 합계 숫자는 넣지 않습니다.
인사이트 기능 스위치와 별개라서, 인사이트가 꺼져 있어도 이 주소는 있습니다.
"""

import hashlib
import time
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from psycopg.errors import UndefinedTable
from pydantic import BaseModel, Field

from app.analytics.collect import (
    AnalyticsEvent,
    EventRejected,
    collection_enabled,
    prepare_client_event,
)
from app.analytics.store import PostgresAnalyticsStore, server_now
from app.insights.auth import require_trusted_origin

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])
_HITS: dict[str, list[float]] = {}


class EventInput(BaseModel):
    """허용 필드만 받습니다. 제목·본문·연락처 칸은 없습니다."""

    model_config = {"extra": "forbid"}

    event_id: UUID
    event_name: Annotated[str, Field(max_length=40)]
    target: Annotated[str, Field(max_length=80)]
    session_id: UUID | None = None
    attempt_id: UUID | None = None
    mode: Annotated[str, Field(max_length=16)] | None = None
    result_code: Annotated[str, Field(max_length=40)] | None = None
    reason_code: Annotated[str, Field(max_length=32)] | None = None
    research_id: Annotated[int, Field(ge=1)] | None = None


def get_analytics_store() -> PostgresAnalyticsStore:
    return PostgresAnalyticsStore()


def _allow(key: str, limit: int = 60, window: float = 60) -> bool:
    """요청 횟수는 메모리에만 둡니다. IP는 분석 표에 남기지 않습니다."""
    now = time.monotonic()
    recent = [item for item in _HITS.get(key, []) if now - item < window]
    if len(recent) >= limit:
        _HITS[key] = recent
        return False
    recent.append(now)
    _HITS[key] = recent
    return True


@router.post("/events")
def collect_event(
    body: EventInput,
    request: Request,
    store: Annotated[PostgresAnalyticsStore, Depends(get_analytics_store)],
) -> dict:
    """화면이 보낸 허용 사건. 실패해도 글 보기와 연구 저장은 이 함수 밖에서 계속됩니다."""
    require_trusted_origin(request)
    referer = request.headers.get("referer", "")
    if "/admin" in referer or "/preview" in referer:
        return {"accepted": False, "status": "excluded", "duplicate": False}
    if not collection_enabled():
        return {"accepted": False, "status": "disabled", "duplicate": False}
    host = request.client.host if request.client else "unknown"
    key = hashlib.sha256(host.encode()).hexdigest()[:16]
    if not _allow(key):
        raise HTTPException(429, "기록을 잠시 뒤 다시 보낼 수 있습니다.")
    try:
        prepared = prepare_client_event(body.model_dump(mode="json"))
    except EventRejected as error:
        raise HTTPException(422, error.detail) from error
    if isinstance(prepared, dict):
        return prepared
    event = AnalyticsEvent(
        event_id=prepared.event_id,
        event_name=prepared.event_name,
        target=prepared.target,
        session_id=prepared.session_id,
        attempt_id=prepared.attempt_id,
        mode=prepared.mode,
        result_code=prepared.result_code,
        reason_code=prepared.reason_code,
        research_id=prepared.research_id,
        received_at=server_now(),
    )
    try:
        created = store.save(event)
    except UndefinedTable:
        return {"accepted": False, "status": "unavailable", "duplicate": False}
    return {"accepted": True, "status": "stored", "duplicate": not created}
