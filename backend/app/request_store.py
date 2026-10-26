"""협업 요청 읽기. 조회 API와 저장 API가 모두 이 함수로 최신 목록을 돌려줍니다.

요청에는 연구 번호(research_id)만 저장되어 있고, 연구 내용은 research 표에서 함께 읽어 옵니다.
"""

import asyncio
import logging

from fastapi import HTTPException

from app.db import get_connection, transaction
from app.notification_store import notify_requests
from app.research_store import CHILD_TABLES, load_child

# 두 화면이 함께 쓰는 요청 칸
REQUEST_COLUMNS = """
    cr.request_id, cr.research_id, cr.status, cr.start_date, cr.end_date, cr.message,
    cr.reply_message, cr.reject_reason, cr.reject_text,
    cr.expires_at, cr.responded_at, cr.started_at, cr.created_at,
    cr.is_urgent, cr.accepted_start_date, cr.accepted_end_date, cr.select_expires_at,
    cr.cancel_reason, cr.cancel_text
"""
# 받은 요청 화면에 보여 줄 연구 칸 (research 표)
RESEARCH_COLUMNS = (
    "title",
    "description",
    "task_unsure",
    "meeting_type",
    "face_to_area",
    "data_status",
    "share_policy",
    "share_condition",
)
EXPIRE_EVERY_SECONDS = 60
log = logging.getLogger(__name__)
RESEARCHER_COLUMNS = ("nickname", "user_photo", "institution_name", "department", "is_verified")


def expire_old_requests(cursor) -> None:
    """기한이 지난 요청을 만료로 바꾸고, 양쪽에 만료 알림을 남깁니다.

    - 답 기다리는 요청: 전문가 답 기한(expires_at)이 지남
    - 수락된 요청: 연구자 선택 기한(select_expires_at)이 지남
    목록을 읽거나 상태를 바꾸기 전에 부르고, 서버가 1분마다 한 번씩도 불러요(expire_forever).
    """
    cursor.execute(
        "UPDATE collaboration_request SET status = 'expired'"
        " WHERE (status = 'pending' AND expires_at <= now())"
        " OR (status = 'accepted' AND select_expires_at <= now()) RETURNING request_id"
    )
    notify_requests(cursor, "request_expired", [row["request_id"] for row in cursor.fetchall()])


def expire_now() -> None:
    """만료 처리만 한 번 (백그라운드에서 불러요)."""
    with transaction() as cursor:
        expire_old_requests(cursor)


async def expire_forever() -> None:
    """서버가 켜져 있는 동안 1분마다 만료 처리. 아무도 화면을 열지 않아도 기한이 지나면 만료·알림이 가요."""
    while True:
        try:
            await asyncio.to_thread(expire_now)
        except Exception:  # 한 번 실패해도 다음 차례에 다시 돌아요
            log.exception("협업 요청 만료 처리 실패")
        await asyncio.sleep(EXPIRE_EVERY_SECONDS)


def load_sent_requests(user_id: int) -> list[dict]:
    """연구회원이 보낸 요청 (최근 순). 내가 취소·거절한 요청도 함께 돌려줘요.

    화면에서는 내가 닫은 요청(cancel_reason이 withdrawn·declined)은 숨기고,
    '한 번 더 보낼 수 있는지' 계산에만 써요.
    """
    with get_connection() as conn, conn.cursor() as cursor:
        expire_old_requests(cursor)
        cursor.execute(
            f"""
            SELECT {REQUEST_COLUMNS}, u.user_id AS expert_user_id, u.nickname, u.user_photo
            FROM collaboration_request cr
            JOIN research r ON r.research_id = cr.research_id
            JOIN users u ON u.user_id = cr.expert_id
            WHERE r.user_id = %s
            ORDER BY cr.created_at DESC, cr.request_id DESC
            """,
            (user_id,),
        )
        rows = cursor.fetchall()

    for row in rows:
        row["expert"] = {
            "user_id": row.pop("expert_user_id"),
            "nickname": row.pop("nickname"),
            "user_photo": row.pop("user_photo"),
        }
    return rows


def load_received_requests(user_id: int) -> list[dict]:
    """AI 전문가가 받은 요청 (최근 순). 보낸 연구회원 정보와 연구 내용을 함께 담습니다."""
    with get_connection() as conn, conn.cursor() as cursor:
        expire_old_requests(cursor)
        cursor.execute(
            f"""
            SELECT {REQUEST_COLUMNS},
                   u.nickname, u.user_photo, p.institution_name, p.department, p.is_verified,
                   r.title, r.description, r.task_unsure, r.meeting_type, r.face_to_area,
                   r.data_status, r.share_policy, r.share_condition,
                   (SELECT count(*) FROM collaboration_request o
                    WHERE o.expert_id = cr.expert_id AND o.status = 'started'
                      AND o.start_date IS NOT NULL
                      AND COALESCE(o.accepted_start_date, o.start_date) <= cr.end_date
                      AND COALESCE(o.accepted_end_date, o.end_date) >= cr.start_date
                   ) AS overlap_count
            FROM collaboration_request cr
            JOIN research r ON r.research_id = cr.research_id
            JOIN users u ON u.user_id = r.user_id
            JOIN researcher_profile p ON p.user_id = r.user_id
            WHERE cr.expert_id = %s
            ORDER BY (cr.status = 'pending' AND cr.is_urgent) DESC, cr.created_at DESC, cr.request_id DESC
            """,
            (user_id,),
        )
        rows = cursor.fetchall()
        # 연구 분야·맡길 일 같은 '여러 개 고른 값'은 연구마다 따로 묻지 않고 한 번에 읽습니다.
        ids = list({row["research_id"] for row in rows})
        children = (
            {name: load_child(cursor, ids, *table) for name, table in CHILD_TABLES.items()}
            if ids
            else {}
        )

    for row in rows:
        row["researcher"] = {key: row.pop(key) for key in RESEARCHER_COLUMNS}
        research = {key: row.pop(key) for key in RESEARCH_COLUMNS}
        research["description"] = research["description"] or ""
        for name, values in children.items():
            research[name] = values.get(row["research_id"], [])
        row["research"] = research
    return rows


def require_expert(user_id: int) -> None:
    """AI 전문가 회원만 쓸 수 있어요. 아니면 403."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT 1 FROM users u
            JOIN expert e ON e.user_id = u.user_id
            WHERE u.user_id = %s AND u.user_role = 'expert'
            """,
            (user_id,),
        )
        if cursor.fetchone() is None:
            raise HTTPException(status_code=403, detail="AI 전문가 회원만 쓸 수 있어요")