"""협업 요청: 연구회원(보내기·취소·거절·시작·마감)과 AI 전문가(수락·거절·수락 취소).

요청은 연구회원이 고른 '등록한 연구'로 보냅니다. 요청 표에는 연구 번호만 저장하고 연구 내용은 research 표에서 읽어요.
저장 API는 모두 처리가 끝난 최신 목록 전체를 돌려줍니다. 화면은 받은 값으로 그대로 다시 그려요.
날짜·기한 규칙은 app/request_rules.py 에 모아 두었어요.
"""

from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import request_rules as rules
from app.db import transaction
from app.form_rules import bad_request, optional_text, required_text
from app.notification_store import notify_requests
from app.request_store import (
    expire_old_requests,
    load_received_requests,
    load_sent_requests,
    require_expert,
)
from app.research_store import require_researcher
from app.routers.expert import check_code
from app.security import get_current_user_id
from app.workspace_store import complete_ended_collaborations, create_collaboration

researcher_router = APIRouter(prefix="/api/v1/researcher/requests", tags=["researcher-request"])
expert_router = APIRouter(prefix="/api/v1/expert/requests", tags=["expert-request"])

MAX_MESSAGE = 300  # 요청 창 메시지
MAX_REPLY = 200  # 수락하며 남기는 한마디
MAX_REJECT_TEXT = 200  # 거절하며 남기는 말
MAX_WITHDRAW_TEXT = 200  # 수락을 취소하며 남기는 말
REJECT_CODES = {"schedule", "field_mismatch", "data_terms", "other"}


class SendRequest(BaseModel):
    expert_id: int  # 받을 AI 전문가 (users.user_id)
    research_id: int  # 어떤 연구로 요청하나 (내가 등록한 연구)
    start_date: date  # 희망 시작일 (일반: 3일 뒤부터, 급해요: 내일부터)
    end_date: date  # 희망 종료일
    message: str  # 300자
    is_urgent: bool = False  # 급해요: 전문가가 수락하면 바로 협업 시작


class AcceptRequest(BaseModel):
    message: str = ""  # 수락하며 남기는 한마디 (선택, 200자)
    start_date: date | None = None  # 기간을 조정해서 수락할 때만 (원래 시작일 ±7일)
    end_date: date | None = None  # 기간을 조정해서 수락할 때만


class RejectRequest(BaseModel):
    reason: str  # schedule / field_mismatch / data_terms / other
    text: str = ""  # 거절하며 남기는 말 (선택, 200자)


class WithdrawRequest(BaseModel):
    text: str  # 수락을 취소하는 이유 (필수, 200자). 연구회원에게 전달돼요


class CloseRequests(BaseModel):
    research_id: int  # 이 연구로 보낸 요청을 모두 닫아요


def now() -> datetime:
    return datetime.now(UTC)


# ---------- 연구회원 ----------
@researcher_router.get("")
def list_sent(user_id: int = Depends(get_current_user_id)) -> list[dict]:
    require_researcher(user_id)
    return load_sent_requests(user_id)


@researcher_router.post("")
def send_request(body: SendRequest, user_id: int = Depends(get_current_user_id)) -> list[dict]:
    """고른 연구로 AI 전문가에게 협업을 요청합니다. (전문가 찾기·상세의 [협업 요청])"""
    require_researcher(user_id)
    sent_at = now()
    rules.check_request_period(sent_at, body.start_date, body.end_date, body.is_urgent)
    message = required_text(body.message, MAX_MESSAGE, "메시지")

    with transaction() as cursor:
        expire_old_requests(cursor)
        cursor.execute(
            "SELECT status FROM research WHERE research_id = %s AND user_id = %s FOR UPDATE",
            (body.research_id, user_id),
        )
        research = cursor.fetchone()
        if research is None:
            raise HTTPException(status_code=404, detail="연구를 찾을 수 없어요")
        if research["status"] != "registered":
            raise bad_request("임시 저장한 연구로는 요청할 수 없어요. 먼저 등록해 주세요")
        check_research_capacity(cursor, body.research_id, body.is_urgent)

        cursor.execute(
            "SELECT 1 FROM expert e JOIN users u ON u.user_id = e.user_id"
            " WHERE e.user_id = %s AND e.is_public = TRUE AND u.status = 'active'",
            (body.expert_id,),
        )
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="요청할 수 있는 전문가를 찾을 수 없어요")
        cursor.execute(
            "SELECT status, responded_at, cancel_reason FROM collaboration_request"
            " WHERE research_id = %s AND expert_id = %s ORDER BY created_at DESC",
            (body.research_id, body.expert_id),
        )
        blocked = rules.second_try_block(cursor.fetchall())
        if blocked:
            raise HTTPException(status_code=409, detail=blocked)

        cursor.execute(
            "INSERT INTO collaboration_request"
            " (research_id, expert_id, start_date, end_date, message, is_urgent, expires_at)"
            " VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING request_id",
            (
                body.research_id,
                body.expert_id,
                body.start_date,
                body.end_date,
                message,
                body.is_urgent,
                rules.answer_deadline(sent_at, body.start_date, body.is_urgent),
            ),
        )
        notify_requests(cursor, "request_received", [cursor.fetchone()["request_id"]])
    return load_sent_requests(user_id)


@researcher_router.post("/{request_id}/cancel")
def cancel_request(request_id: int, user_id: int = Depends(get_current_user_id)) -> list[dict]:
    """답을 기다리는 요청을 취소합니다. 이 전문가에게는 같은 연구로 한 번 더 보낼 수 있어요."""
    require_researcher(user_id)
    with transaction() as cursor:
        expire_old_requests(cursor)
        check_status(find_sent(cursor, user_id, request_id), "pending")
        cancel(cursor, [request_id], "withdrawn")
    return load_sent_requests(user_id)


@researcher_router.post("/{request_id}/decline")
def decline_request(request_id: int, user_id: int = Depends(get_current_user_id)) -> list[dict]:
    """전문가가 수락한 요청을 연구회원이 정중히 거절합니다."""
    require_researcher(user_id)
    with transaction() as cursor:
        expire_old_requests(cursor)
        check_status(find_sent(cursor, user_id, request_id), "accepted")
        cancel(cursor, [request_id], "declined")
    return load_sent_requests(user_id)


@researcher_router.post("/{request_id}/start")
def start_collaboration(request_id: int, user_id: int = Depends(get_current_user_id)) -> list[dict]:
    """수락한 전문가와 협업을 시작합니다. 한 연구로 3명까지 따로따로 시작할 수 있어요."""
    require_researcher(user_id)
    with transaction() as cursor:
        expire_old_requests(cursor)
        request = find_sent(cursor, user_id, request_id)
        check_status(request, "accepted")
        start(cursor, request)
    return load_sent_requests(user_id)


@researcher_router.post("/close")
def close_requests(body: CloseRequests, user_id: int = Depends(get_current_user_id)) -> list[dict]:
    """[더 안 받기] / [요청 모두 취소하고 수정]: 이 연구로 보낸 대기·수락 요청을 모두 닫아요.

    답 기다리는 요청은 '취소'(한 번 더 보낼 수 있음), 수락된 요청은 '거절'로 닫혀요.
    """
    require_researcher(user_id)
    with transaction() as cursor:
        expire_old_requests(cursor)
        cursor.execute(
            "SELECT 1 FROM research WHERE research_id = %s AND user_id = %s FOR UPDATE",
            (body.research_id, user_id),
        )
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="연구를 찾을 수 없어요")
        for status, reason in (("pending", "withdrawn"), ("accepted", "declined")):
            cursor.execute(
                "SELECT request_id FROM collaboration_request"
                " WHERE research_id = %s AND status = %s FOR UPDATE",
                (body.research_id, status),
            )
            cancel(cursor, [row["request_id"] for row in cursor.fetchall()], reason)
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
    """요청을 수락합니다. 기간을 조정할 수 있어요(급한 요청은 안 돼요).

    일반 요청: 연구회원이 기한 안에 [협업 시작]을 누르면 시작돼요.
    급한 요청: 수락하는 순간 협업이 시작돼요.
    """
    require_expert(user_id)
    reply = optional_text(body.message, MAX_REPLY, "남길 말")
    accepted_at = now()
    with transaction() as cursor:
        expire_old_requests(cursor)
        request = find_received(cursor, user_id, request_id)
        check_status(request, "pending")

        adjusted = (body.start_date, body.end_date)
        if adjusted == (request["start_date"], request["end_date"]):
            adjusted = (None, None)  # 같은 날짜를 보냈으면 '그대로 수락'
        if adjusted != (None, None):
            if request["is_urgent"]:
                raise bad_request("급한 요청은 기간을 조정할 수 없어요. 어렵다면 거절해 주세요")
            if None in adjusted:
                raise bad_request("조정할 시작일과 종료일을 모두 골라 주세요")
            rules.check_adjusted_period(
                accepted_at, (request["start_date"], request["end_date"]), *adjusted
            )
        start_day = adjusted[0] or request["start_date"]
        cursor.execute(
            "UPDATE collaboration_request SET status = 'accepted', reply_message = %s,"
            " responded_at = now(), accepted_start_date = %s, accepted_end_date = %s,"
            " select_expires_at = %s WHERE request_id = %s",
            (reply, *adjusted, rules.select_deadline(accepted_at, start_day), request_id),
        )
        notify_requests(cursor, "request_accepted", [request_id])
        if request["is_urgent"]:  # 급해요 = 연구회원이 '첫 수락자와 바로 시작'에 미리 동의했어요
            start(cursor, request)
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
        notify_requests(cursor, "request_rejected", [request_id])
    return load_received_requests(user_id)


@expert_router.post("/{request_id}/withdraw")
def withdraw_acceptance(
    request_id: int, body: WithdrawRequest, user_id: int = Depends(get_current_user_id)
) -> list[dict]:
    """수락을 취소합니다. 연구회원이 협업을 시작하기 전까지만 돼요. 이유는 연구회원에게 전달돼요."""
    require_expert(user_id)
    text = required_text(body.text, MAX_WITHDRAW_TEXT, "수락 취소 이유")
    with transaction() as cursor:
        expire_old_requests(cursor)
        check_status(find_received(cursor, user_id, request_id), "accepted")
        cursor.execute(
            "UPDATE collaboration_request SET status = 'canceled', cancel_reason = 'expert_withdrew',"
            " cancel_text = %s WHERE request_id = %s",
            (text, request_id),
        )
        notify_requests(cursor, "request_withdrawn", [request_id])
    return load_received_requests(user_id)


# ---------- 상태 바꾸기 ----------
def start(cursor, request: dict) -> None:
    """협업 시작. 이 연구의 진행 중 협업이 3개가 되면 남은 대기·수락 요청은 자동으로 닫혀요."""
    check_active_slots(cursor, request["research_id"])
    cursor.execute(
        "UPDATE collaboration_request SET status = 'started', started_at = now()"
        " WHERE request_id = %s",
        (request["request_id"],),
    )
    create_collaboration(cursor, request["request_id"])  # 같은 트랜잭션에서 협업 공간도 만들어요
    notify_requests(cursor, "collab_started", [request["request_id"]])
    if active_count(cursor, request["research_id"]) >= rules.MAX_ACTIVE:
        cursor.execute(
            "SELECT request_id FROM collaboration_request"
            " WHERE research_id = %s AND status IN ('pending', 'accepted') FOR UPDATE",
            (request["research_id"],),
        )
        cancel(cursor, [row["request_id"] for row in cursor.fetchall()], "other_started")

def cancel(cursor, request_ids: list[int], reason: str) -> None:
    """요청들을 이유와 함께 닫고 전문가에게 알려요. reason: withdrawn / declined / other_started"""
    if not request_ids:
        return
    cursor.execute(
        "UPDATE collaboration_request SET status = 'canceled', cancel_reason = %s"
        " WHERE request_id = ANY(%s)",
        (reason, request_ids),
    )
    notify_requests(cursor, "request_canceled", request_ids)


# ---------- 확인 ----------
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
        "SELECT request_id, research_id, status, start_date, end_date, is_urgent"
        " FROM collaboration_request WHERE request_id = %s AND expert_id = %s FOR UPDATE",
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
        "expired": "기한이 지나 만료된 요청이에요",
        "canceled": "취소된 요청이에요",
        "started": "이미 협업을 시작한 요청이에요",
    }.get(request["status"], "이미 처리된 요청이에요")
    raise HTTPException(status_code=409, detail=message)


def active_count(cursor, research_id: int) -> int:
    """이 연구로 진행 중인 협업 수 (시작 전 포함, 완료·중도 종료·취소는 빼요)."""
    complete_ended_collaborations(cursor)
    cursor.execute(
        "SELECT count(*) AS count FROM collaboration WHERE research_id = %s AND status = 'ongoing'",
        (research_id,),
    )
    return cursor.fetchone()["count"]


def check_active_slots(cursor, research_id: int) -> None:
    if active_count(cursor, research_id) >= rules.MAX_ACTIVE:
        raise HTTPException(
            status_code=409, detail="이 연구로 진행 중인 협업이 3개라 더 시작할 수 없어요"
        )


def check_research_capacity(cursor, research_id: int, urgent: bool) -> None:
    """한 연구로 보낼 수 있는 수: 진행 중 협업 3개, 대기·수락 요청 3개, 급한 요청 1개."""
    check_active_slots(cursor, research_id)
    cursor.execute(
        "SELECT count(*) AS open, count(*) FILTER (WHERE is_urgent) AS urgent"
        " FROM collaboration_request WHERE research_id = %s AND status IN ('pending', 'accepted')",
        (research_id,),
    )
    counts = cursor.fetchone()
    if counts["open"] >= rules.MAX_OPEN:
        raise HTTPException(
            status_code=409, detail="한 연구로 답을 기다리는 요청은 3개까지예요. 답을 받은 뒤 보내 주세요"
        )
    if urgent and counts["urgent"]:
        raise HTTPException(status_code=409, detail="급한 요청은 한 연구로 한 명에게만 보낼 수 있어요")