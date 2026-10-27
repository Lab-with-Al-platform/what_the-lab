"""공개 조회 수집과 인사이트 관리자 통계 조회.

수집 주소는 통계 숫자를 돌려주지 않습니다. 통계 주소는 인사이트 관리자만 통과합니다.
"""

import hashlib
import time
from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.insights.auth import is_insight_admin, require_trusted_origin
from app.insights.database import get_session
from app.insights.views import counts_for, record_page_view, statistic_detail, statistics_report
from app.security import find_user_from_token

router = APIRouter(tags=["insight-views"])
admin_router = APIRouter()
DB = Annotated[Session, Depends(get_session, scope="function")]
_HITS: dict[str, list[float]] = {}


class ViewInput(BaseModel):
    event_id: UUID
    kind: Literal["case", "trend"]
    slug: Annotated[str, Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=100)]
    purpose: Literal["public"] = "public"


def _allow(key: str, limit: int = 30, window: float = 60) -> bool:
    """메모리에서만 요청 횟수를 셉니다. IP는 분석 테이블에 남기지 않습니다."""
    now = time.monotonic()
    recent = [item for item in _HITS.get(key, []) if now - item < window]
    if len(recent) >= limit:
        _HITS[key] = recent
        return False
    recent.append(now)
    _HITS[key] = recent
    return True


@router.post("/insights/views")
def collect_view(body: ViewInput, request: Request, session: DB) -> dict:
    """기사 화면이 보인 뒤 보내는 기록. 실패해도 기사 표시와는 별개입니다."""
    require_trusted_origin(request)
    referer = request.headers.get("referer", "")
    # 관리자 화면·미리보기에서 열린 문서는 공개 조회가 아닙니다.
    if "/admin" in referer:
        return {"accepted": False, "status": "excluded", "duplicate": False}
    host = request.client.host if request.client else "unknown"
    key = hashlib.sha256(host.encode()).hexdigest()[:16]
    if not _allow(key):
        raise HTTPException(429, "조회 기록을 잠시 뒤 다시 보낼 수 있습니다.")
    user = find_user_from_token(request.cookies.get("access_token"))
    if user is not None and user.get("status") != "active":
        user = None
    result = record_page_view(
        session,
        event_id=str(body.event_id),
        slug=body.slug,
        kind=body.kind,
        admin=is_insight_admin(user),
        purpose=body.purpose,
    )
    # 수집 주소는 집계 숫자를 알려 주지 않습니다.
    return {
        "accepted": result["accepted"],
        "status": result.get("status", "stored"),
        "duplicate": result.get("duplicate", False),
    }


@admin_router.get("/statistics")
def statistics(
    session: DB,
    preset: Literal["today", "7d", "30d", "month", "custom"] = "30d",
    start: date | None = None,
    end: date | None = None,
    kind: Literal["case", "trend"] | None = None,
    grain: Literal["day", "week", "month"] = "day",
    q: str = Query("", max_length=80),
    page: int = Query(1, ge=1),
    order: Literal["newest", "period", "cumulative"] = "period",
) -> dict:
    try:
        return statistics_report(
            session,
            preset=preset,
            start=start,
            end=end,
            kind=kind,
            grain=grain,
            query=q,
            page=page,
            order=order,
        )
    except ValueError as error:
        raise HTTPException(422, "기간을 확인해 주세요.") from error


@admin_router.get("/statistics/counts")
def statistics_counts(
    session: DB,
    ids: str = Query("", max_length=2000),
    preset: Literal["today", "7d", "30d", "month", "custom"] = "30d",
    start: date | None = None,
    end: date | None = None,
) -> dict:
    content_ids = [item.strip() for item in ids.split(",") if item.strip()][:50]
    try:
        return counts_for(session, content_ids, preset, start, end)
    except ValueError as error:
        raise HTTPException(422, "기간을 확인해 주세요.") from error


@admin_router.get("/statistics/{content_id}")
def statistics_detail(
    content_id: UUID,
    session: DB,
    preset: Literal["today", "7d", "30d", "month", "custom"] = "30d",
    start: date | None = None,
    end: date | None = None,
    grain: Literal["day", "week", "month"] = "day",
) -> dict:
    try:
        detail = statistic_detail(session, str(content_id), preset, start, end, grain)
    except ValueError as error:
        raise HTTPException(422, "기간을 확인해 주세요.") from error
    if detail is None:
        raise HTTPException(404, "게시된 글을 찾을 수 없습니다.")
    return detail
