"""요청이 바뀐 뒤 디스코드 채널 · 구글 캘린더에 반영해요. (웹 · 디스코드 봇 공통)

- 웹에서 남기거나 바꾸면: 응답을 먼저 보내고(BackgroundTasks) after_web_change 가
  디스코드 채널에 요청 메시지를 올리거나 고치고(HTTP), 구글 캘린더에도 반영해요.
- 디스코드 봇에서 바꾸면: 채널 메시지는 봇이 직접 고치고, 구글만 sync_google 로 반영해요.
- 디스코드 · 구글이 잠깐 안 돼도 DB 저장은 이미 끝났어요. 로그만 남기고 넘어가요.
  (요청에는 "반영됐는지" 칸이 없어서 다시 시도하지 않아요. 다음에 그 요청이 바뀌면 다시 맞춰져요)
"""

import logging
from datetime import date

import httpx

from app.db import get_connection
from app.discord_bot import DISCORD_API, TIMEOUT, bot_headers, bot_ready
from app.google_calendar import (
    delete_event,
    google_ready,
    put_event,
    task_event_body,
    task_event_id,
)
from app.task_text import done_line, due_line, task_message

log = logging.getLogger("labbridge.task_sync")


def task_card(task_id: int) -> dict | None:
    """요청 하나를 메시지 · 구글에 쓸 모양으로: 내용 · 상태 · 두 사람(닉네임·디스코드 번호) · 기한 · 협업 정보"""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT t.task_id, t.collaboration_id, t.content, t.due_date, t.status,
                   t.requested_by, t.assignee, t.discord_message_id,
                   (t.closed_at AT TIME ZONE 'Asia/Seoul')::date AS closed_on,
                   rq.nickname AS requested_by_nickname, rq.discord_id AS requested_by_discord_id,
                   asg.nickname AS assignee_nickname, asg.discord_id AS assignee_discord_id,
                   c.end_date, c.status AS collab_status, c.discord_channel_id, c.google_calendar_id
            FROM collaboration_task t
            JOIN collaboration c ON c.collaboration_id = t.collaboration_id
            JOIN users rq ON rq.user_id = t.requested_by
            JOIN users asg ON asg.user_id = t.assignee
            WHERE t.task_id = %s
            """,
            (task_id,),
        )
        return cursor.fetchone()


def save_message_id(task_id: int, message_id: int | str) -> None:
    """채널에 올린 요청 메시지 번호를 저장해요. 상태가 바뀌면 이 번호로 메시지를 찾아 고쳐요."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            "UPDATE collaboration_task SET discord_message_id = %s WHERE task_id = %s",
            (str(message_id), task_id),
        )


# ---------------------------------------------------------------------------
# 구글 캘린더: 기한 있는 요청만. 취소했거나 기한을 비우면 지워요
# ---------------------------------------------------------------------------


def sync_google(task: dict) -> None:
    """요청의 지금 상태를 구글 캘린더에 맞춰요. 협업에 구글 캘린더가 없으면 건너뛰어요."""
    if not (google_ready() and task["google_calendar_id"]):
        return
    calendar, eid = task["google_calendar_id"], task_event_id(task["task_id"])
    try:
        if task["status"] == "canceled" or task["due_date"] is None:
            delete_event(calendar, eid)
        else:
            put_event(calendar, eid, task_event_body(task))
    except httpx.HTTPError as error:
        log.warning("요청 %s 구글 반영 실패: %s", task["task_id"], error)


def sync_google_by_id(task_id: int) -> None:
    """요청 번호로 구글에 맞춰요 (디스코드 봇이 바꾼 뒤 부를 때)"""
    task = task_card(task_id)
    if task:
        sync_google(task)


# ---------------------------------------------------------------------------
# 디스코드 채널 (HTTP): 웹에서 바꾼 요청을 채널에 올리거나 고쳐요
# ---------------------------------------------------------------------------


def manage_components(task_id: int) -> list[dict]:
    """채널 요청 메시지의 [요청 관리] 버튼. id 모양(task:manage:12)이 봇과 같아서, 눌리면 켜진 봇이 받아요."""
    button = {"type": 2, "style": 2, "label": "요청 관리", "custom_id": f"task:manage:{task_id}"}
    return [{"type": 1, "components": [button]}]


def mention(*discord_ids: str) -> dict:
    """이 사람들만 멘션(@) 알림. @everyone · 역할 멘션은 막아요."""
    return {"parse": [], "users": list(discord_ids)}


def send_message(
    channel_id: str, content: str, *, components: list | None = None, mentions: dict | None = None
) -> str:
    """채널에 메시지를 올리고 메시지 번호를 돌려줘요."""
    body = {"content": content, "allowed_mentions": mentions or mention()}
    if components is not None:
        body["components"] = components
    response = httpx.post(
        f"{DISCORD_API}/channels/{channel_id}/messages",
        headers=bot_headers(),
        json=body,
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    return response.json()["id"]


def edit_message(channel_id: str, message_id: str, content: str, components: list) -> bool:
    """올려 둔 메시지를 고쳐요. 메시지가 없으면(지워짐) False."""
    response = httpx.patch(
        f"{DISCORD_API}/channels/{channel_id}/messages/{message_id}",
        headers=bot_headers(),
        json={"content": content, "components": components, "allowed_mentions": mention()},
        timeout=TIMEOUT,
    )
    if response.status_code == 404:
        return False
    response.raise_for_status()
    return True


def post_task(task: dict) -> None:
    """요청 메시지를 새로 올려요. 열린 요청이면 받은 사람에게 멘션 알림이 가요."""
    alert = mention(task["assignee_discord_id"]) if task["status"] == "open" else mention()
    message_id = send_message(
        task["discord_channel_id"],
        task_message(task),
        components=manage_components(task["task_id"]),
        mentions=alert,
    )
    save_message_id(task["task_id"], message_id)


def after_web_change(task_id: int, event: str, old_due: date | None = None) -> None:
    """웹에서 요청을 남기거나 바꾼 뒤 (응답을 보낸 다음에 돌아요): 구글 + 디스코드 채널에 반영.

    event: created(남김) · done(완료) · canceled(취소) · reopened(되돌림) · due(기한 변경)
    old_due: 기한 변경일 때 바꾸기 전 기한 ("A → B" 알림에 써요)
    """
    task = task_card(task_id)
    if task is None:
        return
    sync_google(task)
    if not (bot_ready() and task["discord_channel_id"]):
        return  # 봇 설정이 없거나 아직 채널이 없는 협업
    try:
        channel = task["discord_channel_id"]
        components = manage_components(task_id)
        message_id = task["discord_message_id"]
        # 예전에 웹에서만 남겨 메시지가 없거나, 누가 메시지를 지웠으면 새로 올려요
        if (
            event == "created"
            or not message_id
            or not edit_message(channel, message_id, task_message(task), components)
        ):
            post_task(task)
        if event == "done":
            send_message(
                channel, done_line(task), mentions=mention(task["requested_by_discord_id"])
            )
        elif event == "due" and old_due != task["due_date"]:
            send_message(
                channel, due_line(task, old_due), mentions=mention(task["assignee_discord_id"])
            )
    except httpx.HTTPError as error:
        log.warning("요청 %s 디스코드 반영 실패: %s", task_id, error)