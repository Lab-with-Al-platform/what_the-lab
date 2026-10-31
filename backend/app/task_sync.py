"""요청이 바뀐 뒤 디스코드 채널 · 구글 캘린더에 반영해요. (웹 · 디스코드 봇 공통)

- 웹에서 남기거나 바꾸면: 응답을 먼저 보내고(BackgroundTasks) after_web_change 가
  디스코드 채널에 요청 메시지를 올리거나 고치고(HTTP), 구글 캘린더에도 반영해요.
- 디스코드 봇에서 바꾸면: 채널 메시지는 봇이 직접 고치고, 구글만 sync_google 로 반영해요.
- 디스코드 · 구글이 잠깐 안 되면 2초 뒤에 한 번 더 해 봐요(retry_once). 그래도 안 되면 로그만 남겨요.
  DB 저장은 이미 끝났고, 매일 아침 resync_task 가 진행 중 요청을 지금 DB 상태로 다시 맞춰요 (app/task_daily.py)
- 상대가 알아야 하는 일은 채널에 새 메시지 + 멘션으로 남겨요. 휴대폰 디스코드 앱 푸시가 여기서 가요
"""

import logging
import time
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
from app.task_text import (
    cancel_line,
    done_line,
    due_line,
    keep_line,
    reopen_line,
    return_line,
    talk_line,
    task_message,
)
from app.workspace_store import TASK_FLAG_SQL

log = logging.getLogger("labbridge.task_sync")
RETRY_SECONDS = 2  # 실패하면 이만큼 기다렸다가 한 번 더


def retry_once(call, *args, **kwargs):
    """디스코드 · 구글 요청이 잠깐 실패하면(연결 끊김 · 5xx · 429) 2초 뒤에 한 번 더 해요.

    잘못된 요청(400 · 403 · 404 같은 4xx)은 다시 해도 똑같아서 바로 넘겨요.
    """
    try:
        return call(*args, **kwargs)
    except httpx.HTTPStatusError as error:
        code = error.response.status_code
        if code < 500 and code != 429:
            raise
    except httpx.HTTPError:
        pass
    time.sleep(RETRY_SECONDS)
    return call(*args, **kwargs)


def task_card(task_id: int) -> dict | None:
    """요청 하나를 메시지 · 구글에 쓸 모양으로: 내용 · 상태 · 두 사람(닉네임·디스코드 번호) · 기한 · 협업 정보

    flag: due_talk(기한 수정 요청에 답 기다림) · returned(다시 요청됨) · None
    talk_due: 가장 최근 기한 수정 요청이 원한 날 (디스코드 [기한 변경] 창에 미리 채워요)
    """
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT t.task_id, t.collaboration_id, t.content, t.due_date, t.status,
                   {TASK_FLAG_SQL} AS flag,
                   (SELECT e.new_due FROM collaboration_task_event e
                    WHERE e.task_id = t.task_id AND e.kind = 'due_talk'
                    ORDER BY e.event_id DESC LIMIT 1) AS talk_due,
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


def last_event(task_id: int, kind: str) -> dict | None:
    """이 요청의 가장 최근 기록 한 줄 (kind: due_talk · returned …). 알림 문구에 이유 · 기한을 넣을 때 써요."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            "SELECT kind, actor_id, old_due, new_due, note, created_at FROM collaboration_task_event"
            " WHERE task_id = %s AND kind = %s ORDER BY event_id DESC LIMIT 1",
            (task_id, kind),
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
            retry_once(delete_event, calendar, eid)
        else:
            retry_once(put_event, calendar, eid, task_event_body(task))
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


def post_task(task: dict, quiet: bool = False) -> None:
    """요청 메시지를 새로 올려요. 열린 요청이면 받은 사람에게 멘션 알림이 가요.

    quiet: True 면 멘션 없이 올려요 (아침에 다시 맞추다가 지워진 메시지를 다시 올릴 때 · 알림을 또 보내지 않게)
    """
    alert = mention(task["assignee_discord_id"]) if task["status"] == "open" and not quiet else mention()
    message_id = retry_once(
        send_message,
        task["discord_channel_id"],
        task_message(task),
        components=manage_components(task["task_id"]),
        mentions=alert,
    )
    save_message_id(task["task_id"], message_id)


def event_alert(task: dict, event: str, old_due: date | None = None) -> tuple[str, str] | None:
    """웹에서 한 일 → (채널에 남길 한 줄, 멘션할 사람). 알릴 게 없으면 None. (봇에서 한 일은 봇이 직접 보내요)

    한 사람이 한 일을 상대에게: 완료 → 보낸 사람 / 기한 변경 · 취소 · 다시 요청 · 지금 기한 유지 → 받은 사람
    / 기한 수정 요청 → 보낸 사람 / 되돌리기 → 상대. 새 요청은 요청 메시지 자체가 받은 사람을 불러요.
    """
    task_id = task["task_id"]
    if event == "done":
        return done_line(task), task["requested_by_discord_id"]
    if event == "canceled":
        return cancel_line(task), task["assignee_discord_id"]
    if event == "due" and old_due != task["due_date"]:
        return due_line(task, old_due), task["assignee_discord_id"]
    if event == "due_talk" and (talk := last_event(task_id, "due_talk")):
        return talk_line(task, talk), task["requested_by_discord_id"]
    if event == "due_kept" and (kept := last_event(task_id, "due_kept")):
        return keep_line(task, kept), task["assignee_discord_id"]
    if event == "returned" and (back := last_event(task_id, "returned")):
        return return_line(task, back), task["assignee_discord_id"]
    if event == "reopened" and (again := last_event(task_id, "reopened")):
        by_requester = again["actor_id"] == task["requested_by"]
        who = task["assignee_discord_id"] if by_requester else task["requested_by_discord_id"]
        return reopen_line(task, by_requester), who
    return None


def refresh_channel(task: dict, quiet: bool = False) -> None:
    """채널의 요청 메시지를 지금 상태로 고쳐요. 메시지가 없으면(예전 요청 · 누가 지움) 새로 올려요."""
    channel = task["discord_channel_id"]
    message_id = task["discord_message_id"]
    components = manage_components(task["task_id"])
    if not message_id or not retry_once(edit_message, channel, message_id, task_message(task), components):
        post_task(task, quiet=quiet)


def after_web_change(task_id: int, event: str, old_due: date | None = None) -> None:
    """웹에서 요청을 남기거나 바꾼 뒤 (응답을 보낸 다음에 돌아요): 구글 + 디스코드 채널에 반영.

    event: created(남김) · done(완료) · canceled(취소) · reopened(되돌림) · due(기한 변경)
           · due_talk(기한 수정 요청) · due_kept(지금 기한 유지) · returned(다시 요청)
    old_due: 기한 변경일 때 바꾸기 전 기한 ("A → B" 알림에 써요)
    """
    task = task_card(task_id)
    if task is None:
        return
    sync_google(task)
    if not (bot_ready() and task["discord_channel_id"]):
        return  # 봇 설정이 없거나 아직 채널이 없는 협업
    try:
        if event == "created":
            post_task(task)  # 요청 메시지가 받은 사람을 불러요
        else:
            refresh_channel(task)
        alert = event_alert(task, event, old_due)
        if alert:
            line, who = alert
            retry_once(send_message, task["discord_channel_id"], line, mentions=mention(who))
    except httpx.HTTPError as error:
        log.warning("요청 %s 디스코드 반영 실패: %s", task_id, error)


def resync_task(task_id: int) -> None:
    """아침에 다시 맞추기: 구글 + 채널 메시지를 지금 DB 상태로 덮어써요. 알림(멘션)은 보내지 않아요."""
    task = task_card(task_id)
    if task is None:
        return
    sync_google(task)
    if not (bot_ready() and task["discord_channel_id"]):
        return
    if not task["discord_message_id"] and task["status"] != "open":
        return  # 메시지 없이 끝난 예전 요청은 채널에 새로 올리지 않아요 (소음)
    try:
        refresh_channel(task, quiet=True)
    except httpx.HTTPError as error:
        log.warning("요청 %s 다시 맞추기 실패: %s", task_id, error)