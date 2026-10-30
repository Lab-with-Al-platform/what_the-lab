"""요청 메시지 글자 (웹 서버 · 디스코드 봇 공통). 디스코드 라이브러리 없이 글자만 만들어요.

- 채널 요청 메시지: task_message
- 날짜 글자: short_day("11.8") · day_text("11.10 (화)") · due_label("기한 11.10 (화) · <t:…:R>")
"""

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")
WEEKDAYS = "월화수목금토일"


def short_day(day: date | None) -> str:
    """날짜 → "11.8" """
    return f"{day.month}.{day.day}" if day else ""


def day_text(day: date | None) -> str:
    """날짜 → "11.10 (화)" / None → "기한 없음" """
    return f"{day.month}.{day.day} ({WEEKDAYS[day.weekday()]})" if day else "기한 없음"


def due_label(due: date | None) -> str:
    """메시지에 쓸 기한. 남은 날은 디스코드 시간 표시(<t:…:R>)로 넣어요.

    디스코드가 보는 사람 화면에서 "11일 후" / "2일 전" 처럼 그때그때 계산해 줘서,
    메시지를 고치지 않아도 날이 지나면 저절로 바뀌어요. (기한 날 밤 23:59 기준)
    """
    if due is None:
        return "기한 없음"
    deadline = datetime.combine(due, time(23, 59), tzinfo=KST)
    return f"기한 {day_text(due)} · <t:{int(deadline.timestamp())}:R>"


def task_message(task: dict) -> str:
    """채널에 올라갈 요청 메시지. 상태에 따라 모양이 바뀌어요.

    open: 받은 사람을 멘션(@) / done: ✅ 완료한 날 / canceled: 내용에 줄을 그어요
    task: task_card 결과 (content · status · due_date · closed_on · 두 사람 닉네임 · 받은 사람 디스코드 번호)
    """
    route = f"{task['requested_by_nickname']} → "
    if task["status"] == "done":
        return f"✅ **요청 완료** · {route}{task['assignee_nickname']} · {short_day(task['closed_on'])} 완료\n>>> {task['content']}"
    if task["status"] == "canceled":
        return f"🚫 **취소된 요청** · {route}{task['assignee_nickname']}\n>>> ~~{task['content']}~~"
    return f"📌 **요청** · {route}<@{task['assignee_discord_id']}> · {due_label(task['due_date'])}\n>>> {task['content']}"


def done_line(task: dict) -> str:
    """완료됐을 때 보낸 사람을 불러 채널에 남기는 한 줄 (메시지를 고치기만 하면 알림이 안 가서)"""
    return f"✅ <@{task['requested_by_discord_id']}> 요청을 완료했어요\n> {task['content'][:80]}"


def due_line(task: dict, old_due: date | None) -> str:
    """기한이 바뀌었을 때 받은 사람을 불러 채널에 남기는 한 줄"""
    return (
        f"📅 <@{task['assignee_discord_id']}> 요청 기한이 바뀌었어요: "
        f"{day_text(old_due)} → **{day_text(task['due_date'])}**\n> {task['content'][:80]}"
    )