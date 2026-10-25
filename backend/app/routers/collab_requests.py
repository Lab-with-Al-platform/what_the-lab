"""협업 요청: 연구회원(보내기·취소·시작)과 AI 전문가(수락·거절).

요청은 연구회원이 고른 '등록한 연구'로 보냅니다. 요청 표에는 연구 번호만 저장하고 연구 내용은 research 표에서 읽어요.
저장 API는 모두 처리가 끝난 최신 목록 전체를 돌려줍니다. 화면은 받은 값으로 그대로 다시 그려요.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import transaction
from app.form_rules import bad_request, optional_text, required_text
from app.request_store import (
    expire_old_requests,
    load_received_requests,
    load_sent_requests,
    require_expert,
)
from app.research_store import require_researcher
from app.routers.expert import check_code
from app.security import get_current_user_id

researcher_router = APIRouter(prefix="/api/v1/researcher/requests", tags=["researcher-request"])
expert_router = APIRouter(prefix="/api/v1/expert/requests", tags=["expert-request"])

MAX_MESSAGE = 300  # 요청 창 메시지
MAX_REPLY = 200  # 수락하며 남기는 한마디
MAX_REJECT_TEXT = 200  # 거절하며 남기는 말
REJECT_CODES = {"schedule", "field_mismatch", "data_terms", "other"}
# 같은 연구·같은 전문가로 다시 보낼 수 없는 상태 (DB의 uq_request_research_expert와 같은 기준)
BLOCKING = {
    "pending": "이 전문가에게 이미 보낸 요청이 있어요",
    "accepted": "이 전문가가 이미 수락한 요청이 있어요",
    "started": "이 전문가와 이미 협업을 시작했어요",
    "rejected": "거절한 전문가에게는 같은 연구로 다시 보낼 수 없어요",
}


class SendRequest(BaseModel):
    expert_id: int  # 받을 AI 전문가 (users.user_id)
    research_id: int  # 어떤 연구로 요청하나 (내가 등록한 연구)
    start_date: date  # 희망 시작일
    end_date: date  # 희망 종료일
    message: str  # 300자

class AcceptRequest(BaseModel):
    message: str = ""  # 수락하며 남기는 한마디 (선택, 200자)


class RejectRequest(BaseModel):
    reason: str  # schedule / field_mismatch / data_terms / other
    text: str = ""  # 거절하며 남기는 말 (선택, 200자)


# ---------- 연구회원 ----------
@researcher_router.get("")
def list_sent(user_id: int = Depends(get_current_user_id)) -> list[dict]:
    require_researcher(user_id)
    return load_sent_requests(user_id)


@researcher_router.post("")
def send_request(body: SendRequest, user_id: int = Depends(get_current_user_id)) -> list[dict]:
    
    """고른 연구로 AI 전문가에게 협업을 요청합니다. (전문가 찾기·상세의 [협업 요청])"""
    require_researcher(user_id)
    if body.end_date < body.start_date:
        raise bad_request("희망 종료일은 시작일보다 빠를 수 없어요")
    message = required_text(body.message, MAX_MESSAGE, "메시지")

    with transaction() as cursor:
        expire_old_requests(cursor)
        cursor.execute(
            "SELECT status FROM research WHERE research_id = %s AND user_id = %s",
            (body.research_id, user_id),
        )
        research = cursor.fetchone()
        if research is None:
            raise HTTPException(status_code=404, detail="연구를 찾을 수 없어요")
        if research["status"] != "registered":
            raise bad_request("임시 저장한 연구로는 요청할 수 없어요. 먼저 등록해 주세요")
        research_id = body.research_id
        check_not_started(cursor, research_id)

        cursor.execute(
            "SELECT 1 FROM expert e JOIN users u ON u.user_id = e.user_id"
            " WHERE e.user_id = %s AND e.is_public = TRUE AND u.status = 'active'",
            (body.expert_id,),
        )
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="요청할 수 있는 전문가를 찾을 수 없어요")
        check_no_blocking(cursor, research_id, body.expert_id)

        cursor.execute(
            "INSERT INTO collaboration_request"
            " (research_id, expert_id, start_date, end_date, message)"
            " VALUES (%s, %s, %s, %s, %s)",
            (research_id, body.expert_id, body.start_date, body.end_date, message),
        )
    return load_sent_requests(user_id)


@researcher_router.post("/{request_id}/cancel")
def cancel_request(request_id: int, user_id: int = Depends(get_current_user_id)) -> list[dict]:
    """답을 기다리는 요청을 취소합니다. 화면에서 사라져요."""
    require_researcher(user_id)
    with transaction() as cursor:
        expire_old_requests(cursor)
        request = find_sent(cursor, user_id, request_id)
        check_status(request, "pending")
        set_status(cursor, request_id, "canceled")
    return load_sent_requests(user_id)


@researcher_router.post("/{request_id}/decline")
def decline_request(request_id: int, user_id: int = Depends(get_current_user_id)) -> list[dict]:
    """전문가가 수락한 요청을 연구회원이 정중히 거절합니다. (취소와 같이 화면에서 사라져요)"""
    require_researcher(user_id)
    with transaction() as cursor:
        request = find_sent(cursor, user_id, request_id)
        check_status(request, "accepted")
        set_status(cursor, request_id, "canceled")
    return load_sent_requests(user_id)


@researcher_router.post("/{request_id}/resend")
def resend_request(request_id: int, user_id: int = Depends(get_current_user_id)) -> list[dict]:
    """만료된 요청을 같은 내용으로 다시 보냅니다. 보낸 때와 7일 기한이 새로 시작돼요."""
    require_researcher(user_id)
    with transaction() as cursor:
        expire_old_requests(cursor)
        request = find_sent(cursor, user_id, request_id)
        check_status(request, "expired")
        check_not_started(cursor, request["research_id"])
        check_no_blocking(cursor, request["research_id"], request["expert_id"])
        cursor.execute(
            "UPDATE collaboration_request SET status = 'pending', created_at = now(),"
            " expires_at = now() + INTERVAL '7 days', responded_at = NULL"
            " WHERE request_id = %s",
            (request_id,),
        )
    return load_sent_requests(user_id)


@researcher_router.post("/{request_id}/start")
def start_collaboration(request_id: int, user_id: int = Depends(get_current_user_id)) -> list[dict]:
    """수락된 요청으로 협업을 시작합니다. 같은 연구로 보낸 다른 요청은 자동으로 취소돼요."""
    require_researcher(user_id)
    with transaction() as cursor:
        request = find_sent(cursor, user_id, request_id)
        check_status(request, "accepted")
        check_not_started(cursor, request["research_id"])
        cursor.execute(
            "UPDATE collaboration_request SET status = 'started', started_at = now()"
            " WHERE request_id = %s",
            (request_id,),
        )
        cursor.execute(
            "UPDATE collaboration_request SET status = 'canceled'"
            " WHERE research_id = %s AND request_id <> %s AND status IN ('pending', 'accepted')",
            (request["research_id"], request_id),
        )
    return load_sent_requests(user_id)


# ---------- AI 전문가 ----------
@expert_router.get("")
def list_received(user_id: int = Depends(get_current_user_id)) -> list[dict]:
    require_expert(user_id)
    return load_received_requests(user_id)


@expert_router.post("/{request_id}/accept")
def accept_request(
    request_id: int, body: AcceptRequest, user_id: int = Depends(get_current_user_id)
) -> list[dict]:
    """요청을 수락합니다. 연구회원이 [협업 시작하기]로 확정하면 협업이 시작돼요."""
    require_expert(user_id)
    reply = optional_text(body.message, MAX_REPLY, "남길 말")
    with transaction() as cursor:
        expire_old_requests(cursor)
        check_status(find_received(cursor, user_id, request_id), "pending")
        cursor.execute(
            "UPDATE collaboration_request SET status = 'accepted', reply_message = %s,"
            " responded_at = now() WHERE request_id = %s",
            (reply, request_id),
        )
    return load_received_requests(user_id)


@expert_router.post("/{request_id}/reject")
def reject_request(
    request_id: int, body: RejectRequest, user_id: int = Depends(get_current_user_id)
) -> list[dict]:
    """요청을 거절합니다. 거절한 요청은 같은 연구로 다시 받지 않아요."""
    require_expert(user_id)
    check_code(body.reason, REJECT_CODES, "거절 사유")
    text = optional_text(body.text, MAX_REJECT_TEXT, "거절 사유")
    with transaction() as cursor:
        expire_old_requests(cursor)
        check_status(find_received(cursor, user_id, request_id), "pending")
        cursor.execute(
            "UPDATE collaboration_request SET status = 'rejected', reject_reason = %s,"
            " reject_text = %s, responded_at = now() WHERE request_id = %s",
            (body.reason, text, request_id),
        )
    return load_received_requests(user_id)


# ---------- DB 도우미 ----------
def find_sent(cursor, user_id: int, request_id: int) -> dict:
    """내 연구로 보낸 요청인지 확인합니다. 남의 것이거나 없으면 똑같이 404.

    FOR UPDATE: 처리가 끝날 때까지 이 줄을 잠가서, 두 번 눌러도 한 번만 처리돼요.
    """
    cursor.execute(
        "SELECT cr.request_id, cr.research_id, cr.expert_id, cr.status"
        " FROM collaboration_request cr JOIN research r ON r.research_id = cr.research_id"
        " WHERE cr.request_id = %s AND r.user_id = %s FOR UPDATE OF cr",
        (request_id, user_id),
    )
    return found(cursor.fetchone())


def find_received(cursor, user_id: int, request_id: int) -> dict:
    """나에게 온 요청인지 확인합니다. 남의 것이거나 없으면 똑같이 404."""
    cursor.execute(
        "SELECT request_id, status FROM collaboration_request"
        " WHERE request_id = %s AND expert_id = %s FOR UPDATE",
        (request_id, user_id),
    )
    return found(cursor.fetchone())


def found(request: dict | None) -> dict:
    if request is None:
        raise HTTPException(status_code=404, detail="요청을 찾을 수 없어요")
    return request


def check_status(request: dict, expected: str) -> None:
    """지금 상태에서만 할 수 있는 일인지 확인합니다. 아니면 409 (화면을 새로고침하면 최신 상태가 보여요)."""
    if request["status"] == expected:
        return
    message = {
        "expired": "답을 기다리는 7일이 지나 만료된 요청이에요",
        "canceled": "취소된 요청이에요",
    }.get(request["status"], "이미 처리된 요청이에요")
    raise HTTPException(status_code=409, detail=message)


def set_status(cursor, request_id: int, status: str) -> None:
    cursor.execute(
        "UPDATE collaboration_request SET status = %s WHERE request_id = %s", (status, request_id)
    )


def check_not_started(cursor, research_id: int) -> None:
    """이미 협업을 시작한 연구로는 새 요청을 보내거나 시작할 수 없어요."""
    cursor.execute(
        "SELECT 1 FROM collaboration_request WHERE research_id = %s AND status = 'started'",
        (research_id,),
    )
    if cursor.fetchone():
        raise HTTPException(status_code=409, detail="이 연구는 이미 협업을 시작했어요")


def check_no_blocking(cursor, research_id: int, expert_id: int) -> None:
    """같은 연구로 같은 전문가에게 진행 중이거나 거절된 요청이 있으면 409."""
    cursor.execute(
        "SELECT status FROM collaboration_request"
        " WHERE research_id = %s AND expert_id = %s AND status = ANY(%s)",
        (research_id, expert_id, list(BLOCKING)),
    )
    row = cursor.fetchone()
    if row:
        raise HTTPException(status_code=409, detail=BLOCKING[row["status"]])