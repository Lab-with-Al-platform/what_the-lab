"""일정 알림: 한 사람이 일정을 추가 · 변경 · 삭제하면 상대에게 알려요. (웹 · 디스코드 공통)

- 알림 종: 같은 트랜잭션 안에서 notification 한 줄 (notify_schedule). 디스코드 DM은 보내지 않아요.
- 폰 알림: 응답을 보낸 뒤 협업 채널에 상대를 멘션한 한 줄 (announce, BackgroundTasks)
- 처음 "일정을 추가했어요" 메시지 번호를 일정에 저장해 두고, 바뀌거나 지워지면 그 메시지도 고쳐요 (요청과 같은 방식)
  → 채널을 올려 보다가 옛 메시지를 봐도 지금 일정이 보여요
- 제목 · 메모만 바뀐 것은 종에만 남기고 원래 메시지만 조용히 고쳐요 (오타 하나 고칠 때마다 폰이 울리지 않게)
- 알림에는 그때의 일정 글자(note)를 같이 저장해요. 일정을 지워도 "무엇을 지웠는지" 보이게.

아침 브리핑(내일 · 오늘 · 내일 끝남)은 app/task_daily.py 에 있어요.
"""

import logging
from datetime import date, time

import httpx

from app.db import get_connection
from app.discord_bot import bot_ready
from app.task_sync import edit_message, mention, retry_once, send_message
from app.task_text import day_text

log = logging.getLogger("labbridge.schedule_notice")

KIND_NAMES = {"meeting": "미팅", "work": "작업 기간", "due": "결과물 마감", "data": "자료", "etc": "기타"}
NOTE_LIMIT = 200  # notification.note 글자 수

# 바로 알림 종류 → 채널 한 줄 앞 그림
NOW_ICONS = {"schedule_created": "📅", "schedule_changed": "🔁", "schedule_deleted": "🗑"}


def clock(value) -> str:
    """time · "14:00:00" · "14:00" → "14:00" """
    if value is None or value == "":
        return ""
    if isinstance(value, time):
        return value.strftime("%H:%M")
    return str(value)[:5]


def when_text(row: dict) -> str:
    """일정의 날짜 · 시각 → "11.5 (목) 14:00~15:30" / "11.5 (목)" / "11.3 (화) ~ 11.12 (목)" """
    start, end = row["start_date"], row["end_date"]
    if start != end:
        return f"{day_text(start)} ~ {day_text(end)}"
    begin, finish = clock(row.get("start_time")), clock(row.get("end_time"))
    hours = f" {begin}~{finish}" if begin and finish else f" {begin}" if begin else ""
    return f"{day_text(start)}{hours}"


def schedule_line(row: dict) -> str:
    """"주간 미팅 · 미팅 · 11.5 (목) 14:00~15:30" """
    return f"{row['title']} · {KIND_NAMES.get(row['kind'], '기타')} · {when_text(row)}"


def is_moved(old: dict, new: dict) -> bool:
    """날짜 · 시각이 바뀌었으면 True (폰 알림). 제목 · 메모 · 종류만 바뀌면 False (종에만)"""
    keys = ("start_date", "end_date")
    if any(old[key] != new[key] for key in keys):
        return True
    return clock(old.get("start_time")) != clock(new.get("start_time")) or clock(old.get("end_time")) != clock(
        new.get("end_time")
    )


def is_edited(old: dict, new: dict) -> bool:
    """제목 · 메모 · 종류 중 하나라도 바뀌었으면 True"""
    return any((old.get(key) or "") != (new.get(key) or "") for key in ("title", "memo", "kind"))


def collab_people(cursor, collaboration_id: int) -> dict:
    """협업의 두 사람 · 디스코드 번호 · 채널 (알림 받을 사람 고르기용)"""
    cursor.execute(
        """
        SELECT c.collaboration_id, c.discord_channel_id,
               rs.user_id AS researcher_id, ru.discord_id AS researcher_discord_id, ru.nickname AS researcher_name,
               c.expert_id, eu.discord_id AS expert_discord_id, eu.nickname AS expert_name
        FROM collaboration c
        JOIN research rs ON rs.research_id = c.research_id
        JOIN users ru ON ru.user_id = rs.user_id
        JOIN users eu ON eu.user_id = c.expert_id
        WHERE c.collaboration_id = %s
        """,
        (collaboration_id,),
    )
    return cursor.fetchone()


def notify_schedule(
    cursor,
    people: dict,
    actor_id: int,
    type_: str,
    schedule_id: int,
    note: str,
    *,
    line: str | None = None,
    message_id: str | None = None,
) -> dict:
    """상대에게 종 알림 한 줄을 저장하고, 채널에 올릴 때 쓸 정보를 돌려줘요.

    people: collab_people 결과 / type_: schedule_created · schedule_changed · schedule_edited · schedule_deleted
    note: 그때의 일정 글자 (예: "주간 미팅 · 미팅 · 11.5 (목) 14:00")
    line: 지금(바뀐 뒤 · 지우기 전) 일정 한 줄 → 원래 메시지를 이 글자로 고쳐요
    message_id: 처음 올린 "일정을 추가했어요" 메시지 번호 (없으면 고칠 메시지 없음)
    돌려주는 값: channel · to · actor · type · note · schedule_id · line · message_id → announce 에 그대로 넘겨요
    """
    mine_is_researcher = people["researcher_id"] == actor_id
    partner = people["expert_id"] if mine_is_researcher else people["researcher_id"]
    note = note[:NOTE_LIMIT]
    cursor.execute(
        """
        INSERT INTO notification (user_id, type, actor_id, collaboration_id, schedule_id, note,
                                  discord_status, discord_error)
        VALUES (%s, %s, %s, %s, %s, %s, 'skipped', '협업 채널로 알려요')
        """,
        (partner, type_, actor_id, people["collaboration_id"], schedule_id, note),
    )
    return {
        "channel": people["discord_channel_id"],
        "to": people["expert_discord_id"] if mine_is_researcher else people["researcher_discord_id"],
        "actor": people["researcher_name"] if mine_is_researcher else people["expert_name"],
        "type": type_,
        "note": note,
        "schedule_id": schedule_id,
        "line": line,
        "message_id": message_id,
    }


def announce_text(notice: dict) -> str:
    """채널 한 줄: "📅 <@상대> jiwoo_lab 님이 일정을 추가했어요 · 주간 미팅 · 미팅 · 11.5 (목) 14:00" """
    verbs = {
        "schedule_created": "일정을 추가했어요",
        "schedule_changed": "일정을 바꿨어요",
        "schedule_deleted": "일정을 지웠어요",
    }
    kind = notice["type"]
    who = f"<@{notice['to']}> " if notice.get("to") else ""
    return f"{NOW_ICONS[kind]} {who}{notice['actor']} 님이 {verbs[kind]} · {notice['note']}"


def message_text(notice: dict) -> str:
    """처음 올린 "일정을 추가했어요" 메시지를 고칠 글자 (멘션 없음 · 고쳐도 폰은 안 울려요)

    바뀜: "📅 **주간 미팅** · 미팅 · 11.6 (금) 16:00 · ✏️ jiwoo_lab 님이 바꿨어요"
    지움: "🗑 ~~주간 미팅 · 미팅 · 11.5 (목) 14:00~~ · jiwoo_lab 님이 지웠어요"
    """
    line = notice.get("line") or notice["note"]
    if notice["type"] == "schedule_deleted":
        return f"🗑 ~~{line}~~ · {notice['actor']} 님이 지웠어요"
    title, _, rest = line.partition(" · ")
    return f"📅 **{title}** · {rest} · ✏️ {notice['actor']} 님이 바꿨어요"


def announce(notice: dict | None) -> None:
    """응답을 보낸 뒤 협업 채널에:
    - 추가 · 날짜/시각 변경 · 삭제 → 상대를 멘션한 새 메시지 (폰 알림). 추가 메시지 번호는 일정에 저장해요
    - 변경 · 삭제 · 제목/메모 수정 → 처음 올린 추가 메시지를 지금 상태로 고쳐요 (조용히)
    """
    if not notice or not (bot_ready() and notice.get("channel")):
        return  # 봇 설정이 없거나 아직 채널이 없는 협업은 종 알림만
    channel = notice["channel"]
    try:
        if notice.get("message_id") and notice["type"] != "schedule_created":
            components = [] if notice["type"] == "schedule_deleted" else manage_components(notice) or []
            retry_once(edit_message, channel, notice["message_id"], message_text(notice), components)
        if notice["type"] not in NOW_ICONS:
            return  # 제목 · 메모만 바뀌었으면 새 메시지(폰 알림)는 안 보내요
        people = [notice["to"]] if notice.get("to") else []
        message_id = retry_once(
            send_message,
            channel,
            announce_text(notice),
            components=manage_components(notice),
            mentions=mention(*people),
        )
        if notice["type"] == "schedule_created" and message_id:
            save_message_id(notice["schedule_id"], message_id)
    except httpx.HTTPError as error:
        log.warning("일정 알림 채널 %s 실패: %s", channel, error)


def save_message_id(schedule_id: int, message_id: int | str) -> None:
    """처음 올린 "일정을 추가했어요" 메시지 번호를 일정에 저장해요 (바뀌면 이 메시지를 고쳐요)"""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            "UPDATE collaboration_schedule SET discord_message_id = %s WHERE schedule_id = %s",
            (str(message_id), schedule_id),
        )


def manage_components(notice: dict) -> list | None:
    """추가 · 변경 메시지에 붙는 [일정 관리] 버튼 (디스코드 봇이 schedule:manage:번호 로 받아요). 삭제는 버튼 없음"""
    if notice["type"] == "schedule_deleted" or not notice.get("schedule_id"):
        return None
    button = {"type": 2, "style": 2, "label": "일정 관리", "custom_id": f"schedule:manage:{notice['schedule_id']}"}
    return [{"type": 1, "components": [button]}]


def created_note(first: dict, count: int) -> str:
    """추가 알림 글자. 매주 반복이면 몇 번인지 붙여요."""
    line = schedule_line(first)
    return f"{line} · 매주 반복 {count}번" if count > 1 else line


def changed_note(old: dict, new: dict) -> str:
    """변경 알림 글자: "주간 미팅 · 11.5 (목) 14:00 → 11.6 (금) 10:00" """
    return f"{new['title']} · {when_text(old)} → {when_text(new)}"


def deleted_note(first: dict, count: int) -> str:
    """삭제 알림 글자. 반복 일정을 여러 개 지웠으면 "이 날짜부터 매주 n개" """
    line = schedule_line(first)
    return f"{line} · 이 날짜부터 매주 {count}개" if count > 1 else line


def schedule_message(row: dict) -> tuple[str, str]:
    """알림 종 한 줄 → (제목, 작은 설명). row: type · actor_nickname · note · collab_title"""
    actor = row.get("actor_nickname") or "상대"
    title = row.get("collab_title") or "협업"
    title = title[:24] + ("…" if len(title) > 24 else "")
    note = row.get("note") or ""
    detail = f"{note} · {title}" if note else title
    texts = {
        "schedule_created": f"{actor} 님이 일정을 추가했어요",
        "schedule_changed": f"{actor} 님이 일정 날짜·시각을 바꿨어요",
        "schedule_edited": f"{actor} 님이 일정 내용을 고쳤어요",
        "schedule_deleted": f"{actor} 님이 일정을 지웠어요",
        "schedule_tomorrow": "내일 마감이에요",
        "schedule_today": "오늘 일정이 있어요",
        "schedule_ending": "일정이 내일 끝나요",
    }
    return texts.get(row["type"], "새 알림이 있어요"), detail


def daily_label(kind: str, row: dict, today: date) -> str:
    """아침 브리핑 한 줄의 앞부분 (멘션 뒤에 붙어요)"""
    line = schedule_line(row)
    if kind == "schedule_today":
        if row["start_date"] != row["end_date"]:
            return f"📅 오늘부터 · {line}"
        return f"📅 오늘 · {line}"
    if kind == "schedule_tomorrow":  # 결과물 마감 전날
        return f"🔔 내일 마감 · {line}"
    return f"🏁 내일 끝나요 · {line}"