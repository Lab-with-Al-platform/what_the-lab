"""매일 아침(9시 이후 처음 한 번) 협업 채널 브리핑 + 디스코드 · 구글 다시 맞추기.

웹 서버가 켜질 때 daily_forever 를 시작해요(app/main.py). 1분마다 "9시가 지났고 오늘 아직인지" 봐요.
새 프로그램을 따로 켤 필요가 없고, 디스코드 봇 설정이 없어도 종 알림은 쌓여요.

1) 종료일이 지난 협업 마감 (complete_ended_collaborations: 끝나지 않은 요청은 "협업 종료로 마감" 기록)
2) 브리핑: 지금 움직여야 하는 사람에게 종 알림을 남기고(notice_on = 오늘), 협업 채널에 한 메시지로 묶어 멘션해요
   - 기한 내일 · 오늘 → 받은 사람 (task_due_soon)
   - 기한 지남 → 받은 사람. 지난 다음 날 한 번, 그 뒤로는 일주일에 한 번 (task_overdue)
   - 기한 수정 요청에 1일 · 3일째 답 없음 → 보낸 사람 (task_talk_waiting)
   - 협업 종료 3일 전인데 열린 요청이 있음 → 두 사람 (collab_ending)
   같은 (사람, 종류, 협업, 요청, 날짜) 알림은 DB가 한 번만 받아요(uq_notification_daily).
   그래서 서버를 껐다 켜도, 서버가 여러 대여도 하루에 한 번만 가요. 새로 들어간 줄만 채널에 올려요.
3) 다시 맞추기: 진행 중 협업의 열린 요청 + 최근 2일 안에 바뀐 요청을 구글 · 채널 메시지에 덮어써요 (멘션 없이)
"""

import asyncio
import logging
from collections import defaultdict
from datetime import date, datetime, timedelta

import httpx

from app.db import get_connection, transaction
from app.discord_bot import bot_ready
from app.task_sync import mention, resync_task, retry_once, send_message
from app.task_text import KST, brief_text
from app.workspace_store import complete_ended_collaborations

log = logging.getLogger("labbridge.task_daily")

BRIEF_HOUR = 9  # 한국 시간 9시 이후 처음 돌 때
LAST_RUN: date | None = None  # 오늘 이미 돌았는지 (서버 메모리. 껐다 켜면 DB 중복 막기가 지켜줘요)

PICK_SQL = """
WITH open_tasks AS (
    SELECT t.task_id, t.collaboration_id, t.requested_by, t.assignee, t.due_date
    FROM collaboration_task t JOIN collaboration c ON c.collaboration_id = t.collaboration_id
    WHERE c.status = 'ongoing' AND t.status = 'open'
),
talks AS (  -- 요청마다 기한 수정 요청 쪽 마지막 기록
    SELECT DISTINCT ON (e.task_id) e.task_id, e.kind, (e.created_at AT TIME ZONE 'Asia/Seoul')::date AS on_day
    FROM collaboration_task_event e JOIN open_tasks o ON o.task_id = e.task_id
    WHERE e.kind IN ('due_talk', 'due_kept', 'due', 'done', 'canceled')
    ORDER BY e.task_id, e.event_id DESC
)
INSERT INTO notification (user_id, type, actor_id, task_id, collaboration_id, notice_on, discord_status, discord_error)
SELECT user_id, type, actor_id, task_id, collaboration_id, %(today)s, 'skipped', '협업 채널로 알려요'
FROM (
    SELECT assignee AS user_id, 'task_due_soon' AS type, requested_by AS actor_id, task_id, collaboration_id
    FROM open_tasks WHERE due_date IN (%(today)s, %(tomorrow)s)
    UNION ALL
    SELECT assignee, 'task_overdue', requested_by, task_id, collaboration_id
    FROM open_tasks WHERE due_date < %(today)s AND (%(today)s - due_date) %% 7 = 1
    UNION ALL
    SELECT o.requested_by, 'task_talk_waiting', o.assignee, o.task_id, o.collaboration_id
    FROM open_tasks o JOIN talks k ON k.task_id = o.task_id
    WHERE k.kind = 'due_talk' AND (%(today)s - k.on_day) IN (1, 3)
    UNION ALL
    SELECT people.user_id, 'collab_ending', NULL, NULL, c.collaboration_id
    FROM collaboration c
    JOIN research rs ON rs.research_id = c.research_id
    CROSS JOIN LATERAL (VALUES (rs.user_id), (c.expert_id)) AS people(user_id)
    WHERE c.status = 'ongoing' AND c.end_date = %(ending)s
      AND EXISTS (SELECT 1 FROM collaboration_task x WHERE x.collaboration_id = c.collaboration_id AND x.status = 'open')
) AS picked
ON CONFLICT DO NOTHING
RETURNING notification_id
"""

DETAIL_SQL = """
SELECT n.type, n.collaboration_id, u.discord_id, a.nickname AS actor,
       t.content, t.due_date, c.discord_channel_id, c.end_date,
       (SELECT count(*) FROM collaboration_task x
        WHERE x.collaboration_id = c.collaboration_id AND x.status = 'open') AS open_count
FROM notification n
JOIN users u ON u.user_id = n.user_id
LEFT JOIN users a ON a.user_id = n.actor_id
LEFT JOIN collaboration_task t ON t.task_id = n.task_id
JOIN collaboration c ON c.collaboration_id = n.collaboration_id
WHERE n.notification_id = ANY(%s)
ORDER BY n.notification_id
"""

RESYNC_SQL = """
SELECT t.task_id FROM collaboration_task t JOIN collaboration c ON c.collaboration_id = t.collaboration_id
WHERE c.status = 'ongoing' AND (t.status = 'open' OR t.updated_at > now() - interval '2 days')
ORDER BY t.task_id
"""


def pick_today(today: date) -> list[dict]:
    """오늘 알릴 것을 종 알림으로 저장하고(이미 있으면 건너뜀), 새로 저장된 줄의 내용을 돌려줘요."""
    with transaction() as cursor:
        complete_ended_collaborations(cursor)
        cursor.execute(
            PICK_SQL,
            {"today": today, "tomorrow": today + timedelta(days=1), "ending": today + timedelta(days=3)},
        )
        ids = [row["notification_id"] for row in cursor.fetchall()]
        if not ids:
            return []
        cursor.execute(DETAIL_SQL, (ids,))
        return cursor.fetchall()


def group_by_channel(rows: list[dict]) -> dict[str, list[dict]]:
    """새 알림 줄들 → 채널별 브리핑 항목. 협업 종료 알림은 두 사람을 한 줄로 묶어요."""
    channels: dict[str, list[dict]] = defaultdict(list)
    ending: dict[str, dict] = {}
    for row in rows:
        channel = row["discord_channel_id"]
        if not channel:
            continue  # 아직 채널이 없는 협업은 종 알림만
        if row["type"] == "collab_ending":
            if channel in ending:
                ending[channel]["to"].append(row["discord_id"])
                continue
            ending[channel] = {**row, "to": [row["discord_id"]]}
            channels[channel].append(ending[channel])
        else:
            channels[channel].append({**row, "to": [row["discord_id"]]})
    return channels


def run_daily(today: date) -> None:
    """아침 한 번: 마감 → 브리핑(종 + 채널) → 다시 맞추기"""
    rows = pick_today(today)
    if rows and bot_ready():
        for channel, items in group_by_channel(rows).items():
            people = sorted({discord_id for item in items for discord_id in item["to"] if discord_id})
            try:
                retry_once(send_message, channel, brief_text(today, items), mentions=mention(*people))
            except httpx.HTTPError as error:
                log.warning("채널 %s 아침 브리핑 실패: %s", channel, error)
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(RESYNC_SQL)
        task_ids = [row["task_id"] for row in cursor.fetchall()]
    for task_id in task_ids:
        resync_task(task_id)
    log.info("아침 브리핑 %s: 알림 %s개, 다시 맞춘 요청 %s개", today, len(rows), len(task_ids))


def run_if_due(now: datetime | None = None) -> bool:
    """9시가 지났고 오늘 아직 안 돌았으면 돌려요. 돌았으면 True."""
    global LAST_RUN
    now = now or datetime.now(KST)
    today = now.date()
    if now.hour < BRIEF_HOUR or LAST_RUN == today:
        return False
    LAST_RUN = today  # 실패해도 오늘은 다시 안 돌아요 (DB 중복 막기가 있어서 다음 날 정상)
    run_daily(today)
    return True


CHECK_EVERY_SECONDS = 60


async def daily_forever() -> None:
    """서버가 켜져 있는 동안 1분마다 아침 브리핑을 돌릴 때인지 봐요. (app/main.py 에서 시작)"""
    while True:
        try:
            await asyncio.to_thread(run_if_due)
        except Exception:  # 한 번 실패해도 서버는 그대로. 다음 날 다시 돌아요
            log.exception("아침 요청 브리핑 실패")
        await asyncio.sleep(CHECK_EVERY_SECONDS)