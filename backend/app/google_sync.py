"""LabBridge 일정 → 구글 캘린더 복사. 서버가 켜져 있는 동안 15초마다 돌아요. (디스코드 채널 만들기와 같은 방식)

- 일정을 넣거나 고치면 google_status 가 'pending' 이 되고, 여기서 구글에 반영한 뒤 'synced' 로 바꿔요.
- 일정을 지우면 google_event_trash 에 적어 두고, 여기서 구글에서도 지워요.
- 구글이 잠깐 안 되면 다음 차례에 다시, MAX_ATTEMPTS 번 실패하면 멈추고 이유를 남겨요.
"""

import asyncio
import logging

import httpx

from app.db import get_connection
from app.google_calendar import delete_event, google_ready, upsert_event

log = logging.getLogger(__name__)
WAKE = asyncio.Event()  # 일정이 바뀌면 켜져요. 켜지면 15초를 기다리지 않고 바로 반영해요.
EVERY_SECONDS = 15
BATCH = 20
MAX_ATTEMPTS = 5

PENDING_SQL = """
    SELECT s.schedule_id, s.kind, s.title, s.start_date, s.end_date,
           to_char(s.start_time, 'HH24:MI') AS start_time, to_char(s.end_time, 'HH24:MI') AS end_time,
           s.place, s.memo, s.google_attempts, c.google_calendar_id
    FROM collaboration_schedule s
    JOIN collaboration c ON c.collaboration_id = s.collaboration_id
    WHERE s.google_status = 'pending' AND c.google_calendar_id IS NOT NULL
    ORDER BY s.schedule_id
    LIMIT %s
    FOR UPDATE OF s SKIP LOCKED
"""


def sync_once() -> int:
    """구글에 반영할 일정과 지울 일정을 처리해요. 처리한 개수를 돌려줘요."""
    if not google_ready():
        return 0
    done = 0
    with get_connection() as conn, conn.transaction(), conn.cursor() as cursor:
        cursor.execute(PENDING_SQL, (BATCH,))
        for row in cursor.fetchall():
            try:
                upsert_event(row["google_calendar_id"], row)
            except httpx.HTTPError as error:
                attempts = row["google_attempts"] + 1
                cursor.execute(
                    "UPDATE collaboration_schedule SET google_status = %s, google_attempts = %s, google_error = %s"
                    " WHERE schedule_id = %s",
                    ("failed" if attempts >= MAX_ATTEMPTS else "pending", attempts, str(error)[:200], row["schedule_id"]),
                )
                continue
            cursor.execute(
                "UPDATE collaboration_schedule SET google_status = 'synced', google_attempts = 0, google_error = NULL"
                " WHERE schedule_id = %s",
                (row["schedule_id"],),
            )
            done += 1

        cursor.execute(
            "SELECT trash_id, calendar_id, event_id, attempts FROM google_event_trash"
            " WHERE attempts < %s ORDER BY trash_id LIMIT %s FOR UPDATE SKIP LOCKED",
            (MAX_ATTEMPTS, BATCH),
        )
        for row in cursor.fetchall():
            try:
                delete_event(row["calendar_id"], row["event_id"])
            except httpx.HTTPError as error:
                cursor.execute(
                    "UPDATE google_event_trash SET attempts = attempts + 1, error = %s WHERE trash_id = %s",
                    (str(error)[:200], row["trash_id"]),
                )
                continue
            cursor.execute("DELETE FROM google_event_trash WHERE trash_id = %s", (row["trash_id"],))
            done += 1
    return done


def wake_up() -> None:
    """지금 바로 반영하라고 깨워요. (일정을 저장한 직후 불러요)"""
    WAKE.set()


async def run_forever() -> None:
    """서버가 켜져 있는 동안 구글에 반영해요. 깨우면 바로, 아니면 15초마다. (main.py에서 시작)"""
    while True:
        try:
            await asyncio.to_thread(sync_once)
        except Exception:  # 한 번 실패해도 다음 차례에 다시 돌아요
            log.exception("구글 캘린더 반영 실패")
        try:
            await asyncio.wait_for(WAKE.wait(), timeout=EVERY_SECONDS)
        except TimeoutError:
            pass
        WAKE.clear()