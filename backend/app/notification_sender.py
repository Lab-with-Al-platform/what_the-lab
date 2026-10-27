"""'보낼 예정'(pending) 알림을 디스코드 DM으로 보내요. 서버가 켜져 있는 동안 15초마다 돌아요.

사이트 안 알림(종)은 이미 저장돼 있어서, 여기서 실패해도 회원은 사이트에서 알림을 볼 수 있어요.
"""

import asyncio
import logging

import httpx

from app.config import FRONTEND_URL
from app.db import get_connection
from app.discord_bot import DmBlocked, bot_ready, send_dm
from app.notification_store import build_message

log = logging.getLogger(__name__)
WAKE = asyncio.Event()  # 협업 요청이 처리되면 켜져요. 켜지면 15초를 기다리지 않고 바로 보내요.

SEND_EVERY_SECONDS = 15  # 몇 초마다 보낼 알림을 찾을까
BATCH = 20  # 한 번에 보낼 최대 개수
MAX_ATTEMPTS = 3  # 디스코드가 잠깐 안 될 때 다시 시도하는 횟수
# 이보다 오래된 알림은 DM으로 보내지 않아요 (서버를 오래 꺼 뒀다 켰을 때 한꺼번에 가지 않게)
FRESH_MINUTES = 60
WORKSPACE_TYPES: set[str] = set()  # 협업공간 알림 종류 (협업공간 기능 때 추가)

PENDING_SQL = """
    SELECT n.notification_id, n.user_id, n.type, n.discord_attempts,
           n.created_at < now() - make_interval(mins => %(fresh)s) AS too_old,
           u.discord_id,
           COALESCE(s.discord_dm, TRUE) AS discord_dm,
           COALESCE(s.notify_request, TRUE) AS notify_request,
           COALESCE(s.notify_workspace, TRUE) AS notify_workspace,
           s.discord_joined_at,
           a.nickname AS actor_nickname, r.title AS research_title,
           cr.reject_reason, cr.expert_id, cr.status AS request_status,
           cr.is_urgent, cr.expires_at, cr.accepted_start_date, cr.cancel_reason, cr.responded_at
    FROM notification n
    JOIN users u ON u.user_id = n.user_id
    LEFT JOIN notification_setting s ON s.user_id = n.user_id
    LEFT JOIN users a ON a.user_id = n.actor_id
    LEFT JOIN collaboration_request cr ON cr.request_id = n.request_id
    LEFT JOIN research r ON r.research_id = cr.research_id
    WHERE n.discord_status = 'pending'
    ORDER BY n.created_at
    LIMIT %(batch)s
    FOR UPDATE OF n SKIP LOCKED
"""


def skip_reason(row: dict) -> str | None:
    """DM을 보내지 않을 이유. 보내도 되면 None."""
    if row["too_old"]:
        return "오래된 알림"
    if not row["discord_dm"]:
        return "DM 받기 꺼짐"
    wants = row["notify_workspace"] if row["type"] in WORKSPACE_TYPES else row["notify_request"]
    if not wants:
        return "이 종류 알림 꺼짐"
    if row["discord_joined_at"] is None:
        return "LabBridge 서버 미참가"
    return None


def dm_text(row: dict) -> str:
    """DM 글: 제목(굵게) + 설명 + 사이트 주소"""
    title, detail = build_message(row, row["user_id"])
    return f"**{title}**\n{detail}\n{FRONTEND_URL}/requests"


def send_pending() -> int:
    """보낼 예정인 알림을 최대 BATCH개 보내고, 결과를 기록해요. 보낸 개수를 돌려줘요.

    FOR UPDATE ... SKIP LOCKED: 서버가 여러 개 떠 있어도 같은 알림을 두 번 보내지 않게
    다른 서버가 잡고 있는 줄은 건너뛰어요.
    """
    if not bot_ready():
        return 0
    sent = 0
    with get_connection() as conn, conn.transaction(), conn.cursor() as cursor:
        cursor.execute(PENDING_SQL, {"fresh": FRESH_MINUTES, "batch": BATCH})
        for row in cursor.fetchall():
            reason = skip_reason(row)
            if reason:
                set_result(
                    cursor, row["notification_id"], "skipped", reason, row["discord_attempts"]
                )
                continue
            attempts = row["discord_attempts"] + 1
            try:
                send_dm(row["discord_id"], dm_text(row))
            except DmBlocked:
                set_result(
                    cursor, row["notification_id"], "failed", "DM을 받을 수 없는 상태", attempts
                )
                cursor.execute(
                    "UPDATE notification_setting SET discord_blocked_at = now() WHERE user_id = %s",
                    (row["user_id"],),
                )
                continue
            except httpx.HTTPError as error:
                status = "failed" if attempts >= MAX_ATTEMPTS else "pending"  # 다음 번에 다시 시도
                set_result(cursor, row["notification_id"], status, str(error)[:200], attempts)
                continue
            set_result(cursor, row["notification_id"], "sent", None, attempts)
            cursor.execute(
                "UPDATE notification_setting SET discord_blocked_at = NULL WHERE user_id = %s",
                (row["user_id"],),
            )
            sent += 1
    return sent


def set_result(cursor, notification_id: int, status: str, error: str | None, attempts: int):
    """알림 한 건의 디스코드 발송 결과를 기록해요.

    status: sent=보냄 / failed=실패(더 안 보냄) / pending=다음에 다시 / skipped=안 보냄
    error: 실패·건너뛴 이유 (보냈으면 None) / attempts: 지금까지 보내 본 횟수
    """
    cursor.execute(
        "UPDATE notification SET discord_status = %s, discord_error = %s, discord_attempts = %s,"
        " discord_sent_at = CASE WHEN %s = 'sent' THEN now() ELSE discord_sent_at END"
        " WHERE notification_id = %s",
        (status, error, attempts, status, notification_id),
    )


def wake_up() -> None:
    """지금 바로 보내라고 깨워요. (main.py에서 협업 요청 처리가 끝난 직후 불러요)"""
    WAKE.set()


async def run_forever() -> None:
    """서버가 켜져 있는 동안 보낼 알림을 보내요. 깨우면 바로, 아니면 15초마다. (main.py에서 시작)"""
    while True:
        try:
            await asyncio.to_thread(send_pending)  # DB·디스코드 요청 동안 다른 API가 멈추지 않게
        except Exception:  # 한 번 실패해도 다음 차례에 다시 돌아요
            log.exception("디스코드 알림 보내기 실패")
        try:
            await asyncio.wait_for(WAKE.wait(), timeout=SEND_EVERY_SECONDS)
        except TimeoutError:
            pass  # 15초 동안 깨우는 일이 없었어요 (만료 알림 등은 이때 보내요)
        WAKE.clear()