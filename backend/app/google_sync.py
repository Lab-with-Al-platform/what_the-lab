"""LabBridge 일정 → 구글 캘린더 복사. 서버가 켜져 있는 동안 15초마다 돌아요. (디스코드 채널 만들기와 같은 방식)

- 일정을 넣거나 고치면 google_status 가 'pending' 이 되고, 여기서 구글에 반영한 뒤 'synced' 로 바꿔요.
- 일정을 지우면 google_event_trash 에 적어 두고, 여기서 구글에서도 지워요.
- 구글이 잠깐 안 되면 다음 차례에 다시, MAX_ATTEMPTS 번 실패하면 멈추고 이유를 남겨요.
- 구글에는 "앞으로 볼 것"만 둬요: 지난 일정은 넣지 않고(이미 있으면 지워요), 매일 아침 어제 끝난 일정을 지워요.
  협업 시작일 · 종료일도 넣어요 (시작일이 지나면 시작일은 빼요). LabBridge 웹에는 지난 것도 흐리게 남아요.
"""

import asyncio
import logging
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx

from app.db import get_connection
from app.google_calendar import (
    delete_event,
    event_id,
    google_ready,
    mark_body,
    mark_id,
    put_event,
    upsert_event,
)

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
                if row["end_date"] < today_kst():  # 지난 일정은 구글에 두지 않아요 (웹에는 흐리게 남아요)
                    delete_event(row["google_calendar_id"], event_id(row["schedule_id"]))
                else:
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

def today_kst() -> date:
    return datetime.now(ZoneInfo("Asia/Seoul")).date()


PAST_SQL = """
    SELECT s.schedule_id, c.google_calendar_id
    FROM collaboration_schedule s JOIN collaboration c ON c.collaboration_id = s.collaboration_id
    WHERE c.google_calendar_id IS NOT NULL AND s.end_date BETWEEN %s AND %s
"""
MARKS_SQL = """
    SELECT collaboration_id, google_calendar_id, start_date, end_date, agreement ->> 'title' AS title
    FROM collaboration WHERE status = 'ongoing' AND google_calendar_id IS NOT NULL
      AND (%s::bigint IS NULL OR collaboration_id = %s)
"""
PAST_DAYS = 7  # 아침에 지울 지난 일정: 최근 7일 안에 끝난 것 (서버가 며칠 꺼져 있었어도 따라잡아요)


def tidy_google(today: date) -> int:
    """매일 아침 (app/task_daily.py): 최근에 끝난 일정을 구글에서 지우고, 협업 시작일 · 종료일을 맞춰요.

    이미 없는 일정을 지워도(404) 괜찮아서 몇 번을 돌려도 같아요. 처리한 개수를 돌려줘요.
    """
    if not google_ready():
        return 0
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(PAST_SQL, (today - timedelta(days=PAST_DAYS), today - timedelta(days=1)))
        past = cursor.fetchall()
    done = 0
    for row in past:
        try:
            delete_event(row["google_calendar_id"], event_id(row["schedule_id"]))
            done += 1
        except httpx.HTTPError as error:
            log.warning("지난 일정 %s 구글에서 지우기 실패: %s", row["schedule_id"], error)
    return done + sync_marks(today)


def sync_marks(today: date, collaboration_id: int | None = None) -> int:
    """진행 중 협업의 시작일 · 종료일을 구글에 맞춰요. 시작일이 지났으면 시작일은 빼요.

    collaboration_id: 한 협업만 (구글 캘린더를 처음 연결했을 때 바로 넣으려고)
    """
    if not google_ready():
        return 0
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(MARKS_SQL, (collaboration_id, collaboration_id))
        collabs = cursor.fetchall()
    done = 0
    for collab in collabs:
        calendar, cid, title = collab["google_calendar_id"], collab["collaboration_id"], collab["title"] or ""
        try:
            if collab["start_date"] >= today:
                put_event(calendar, mark_id(cid, "start"), mark_body(cid, "start", collab["start_date"], title))
            else:
                delete_event(calendar, mark_id(cid, "start"))
            put_event(calendar, mark_id(cid, "end"), mark_body(cid, "end", collab["end_date"], title))
            done += 1
        except httpx.HTTPError as error:
            log.warning("협업 %s 시작 · 종료일 구글 반영 실패: %s", cid, error)
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

def clear_collab_google(collaboration_id: int) -> int:
    """협업이 취소되면 이 협업이 구글에 넣은 일정 · 시작일/종료일 표시를 모두 지워요. 지운 개수를 돌려줘요.

    없는 일정을 지워도(404) 괜찮아서 몇 번을 돌려도 같아요. 요청(lbt)은 협업이 끝나면 sync_google 이 지워요.
    """
    if not google_ready():
        return 0
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("SELECT google_calendar_id FROM collaboration WHERE collaboration_id = %s", (collaboration_id,))
        row = cursor.fetchone()
        if not row or not row["google_calendar_id"]:
            return 0
        cursor.execute("SELECT schedule_id FROM collaboration_schedule WHERE collaboration_id = %s", (collaboration_id,))
        ids = [event_id(item["schedule_id"]) for item in cursor.fetchall()]
    ids += [mark_id(collaboration_id, "start"), mark_id(collaboration_id, "end")]
    done = 0
    for eid in ids:
        try:
            delete_event(row["google_calendar_id"], eid)
            done += 1
        except httpx.HTTPError as error:
            log.warning("취소한 협업 %s 구글 일정 %s 지우기 실패: %s", collaboration_id, eid, error)
    return done