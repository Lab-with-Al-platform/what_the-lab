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



def talk_line(task: dict, event: dict) -> str:
    """기한 수정 요청([기한 얘기하기])이 왔을 때 보낸 사람을 불러 채널에 남기는 한 줄.

    event: 기록 한 줄 (new_due = 원하는 기한, 없으면 "지금 기한으로는 어려워요" · note = 이유)
    """
    want = (
        f"{day_text(event['old_due'])} → **{day_text(event['new_due'])}**"
        if event["new_due"]
        else f"지금 기한({day_text(event['old_due'])})으로는 어렵대요"
    )
    return (
        f"🗓 <@{task['requested_by_discord_id']}> {task['assignee_nickname']} 님이 기한 수정을 요청했어요: {want}\n"
        f"> {task['content'][:80]}\n> 이유: {event['note']}\n"
        f"요청 메시지의 [요청 관리]에서 [기한 변경] 또는 [지금 기한 유지]를 눌러 주세요."
    )


def keep_line(task: dict, event: dict) -> str:
    """[지금 기한 유지] 했을 때 받은 사람을 불러 채널에 남기는 한 줄 (이유는 있을 때만)"""
    reason = f"\n> 이유: {event['note']}" if event.get("note") else ""
    return (
        f"📌 <@{task['assignee_discord_id']}> {task['requested_by_nickname']} 님이 "
        f"지금 기한(**{day_text(task['due_date'])}**)을 유지하기로 했어요\n> {task['content'][:80]}{reason}"
    )


def cancel_line(task: dict) -> str:
    """보낸 사람이 요청을 취소했을 때 받은 사람을 불러 남기는 한 줄"""
    return (
        f"🚫 <@{task['assignee_discord_id']}> {task['requested_by_nickname']} 님이 요청을 취소했어요\n"
        f"> {task['content'][:80]}"
    )


def reopen_line(task: dict, by_requester: bool) -> str:
    """[되돌리기] 했을 때 상대를 불러 남기는 한 줄.

    by_requester: True = 보낸 사람이 취소를 되돌림 → 받은 사람 / False = 받은 사람이 완료를 되돌림 → 보낸 사람
    """
    if by_requester:
        return (
            f"↩️ <@{task['assignee_discord_id']}> {task['requested_by_nickname']} 님이 취소한 요청을 되돌렸어요 "
            f"(다시 진행 중)\n> {task['content'][:80]}"
        )
    return (
        f"↩️ <@{task['requested_by_discord_id']}> {task['assignee_nickname']} 님이 완료를 되돌렸어요 "
        f"(다시 진행 중)\n> {task['content'][:80]}"
    )


def return_line(task: dict, event: dict) -> str:
    """[다시 요청] 했을 때 받은 사람을 불러 채널에 남기는 한 줄"""
    due = (
        f"기한 {day_text(event['old_due'])} → **{day_text(event['new_due'])}**"
        if event["new_due"] != event["old_due"]
        else f"기한 {day_text(event['new_due'])}"
    )
    return (
        f"↩️ <@{task['assignee_discord_id']}> {task['requested_by_nickname']} 님이 다시 요청했어요 · {due}\n"
        f"> {task['content'][:80]}\n> 부족한 점: {event['note']}"
    )


LIST_LIMIT = 15  # 목록에 보여 줄 최대 줄 수 (디스코드 메시지는 2000자까지라서)


def task_list_text(title: str, sections: list[tuple[str, list[dict]]], channel_link: str | None, web_link: str) -> str:
    """/받은요청 · /보낸요청 에서 나에게만 보이는 목록.

    sections: [(묶음 이름, 줄들)] — 줄: content · due_date · status · flag · who · discord_message_id
    channel_link: 채널 주소 (https://discord.com/channels/서버/채널). 요청 제목을 누르면 그 메시지로 이동해요
    web_link: 웹 협업 상세 주소 (줄이 많아 다 못 보여 줄 때)
    """
    lines = [title]
    shown = 0
    total = sum(len(rows) for _, rows in sections)
    for name, rows in sections:
        if not rows or shown == LIST_LIMIT:  # 빈 묶음 · 이미 다 채웠으면 제목도 안 써요
            continue
        lines.append(f"\n**{name}**")
        for row in rows:
            if shown == LIST_LIMIT:
                break
            shown += 1
            content = row["content"].replace("\n", " ")
            content = content[:40] + ("…" if len(content) > 40 else "")
            content = content.replace("[", "(").replace("]", ")")  # 링크 글자가 깨지지 않게
            title_text = (
                f"[{content}]({channel_link}/{row['discord_message_id']})"
                if channel_link and row["discord_message_id"]
                else content
            )
            lines.append(f"· {title_text} · {row_due(row)} · {row['who']}{FLAGS.get(row['flag'], '')}")
    if total == 0:
        lines.append("\n없어요.")
    elif shown < total:
        lines.append(f"\n…외 {total - shown}개는 웹에서 보세요: {web_link}")
    else:
        lines.append("\n제목을 누르면 그 메시지로 이동해요. 처리는 아래에서 고르면 돼요.")
    return "\n".join(lines)


FLAGS = {"due_talk": " · 🗓 기한 얘기 있음", "returned": " · ↩️ 다시 요청됨"}


def row_due(row: dict) -> str:
    """목록 한 줄의 기한 글자: 완료면 "11.8 완료", 진행 중이면 기한 + 남은 날"""
    if row["status"] == "done":
        return f"{short_day(row['closed_on'])} 완료"
    return due_label(row["due_date"]).removeprefix("기한 ")



def brief_text(today: date, items: list[dict]) -> str:
    """아침 브리핑 (협업 채널 하나에 하루 한 번). 지금 움직여야 하는 사람만 멘션해요.

    items: 알림 한 줄씩 — type · to(멘션할 디스코드 번호들) · content · due_date · actor · end_date · open_count
      task_due_soon(기한 오늘 · 내일) / task_overdue(기한 지남) / task_talk_waiting(기한 수정 요청에 답 없음)
      / collab_ending(협업 종료 3일 전, 열린 요청 있음)
    """
    order = {"collab_ending": 0, "task_overdue": 1, "task_due_soon": 2, "task_talk_waiting": 3}
    lines = [f"☀️ **오늘 챙길 요청** · {short_day(today)} ({WEEKDAYS[today.weekday()]})"]
    for item in sorted(items, key=lambda row: (order[row["type"]], row.get("due_date") or today)):
        who = " ".join(f"<@{discord_id}>" for discord_id in item["to"] if discord_id)
        content = (item.get("content") or "").replace("\n", " ")[:50]
        kind = item["type"]
        if kind == "collab_ending":
            lines.append(
                f"📅 {who} 협업이 {day_text(item['end_date'])}에 끝나요 · 열린 요청 {item['open_count']}개를 "
                f"끝내거나 정리해 주세요 (필요하면 기간 연장을 얘기해요)"
            )
        elif kind == "task_overdue":
            days = (today - item["due_date"]).days
            lines.append(f"⚠️ {who} 기한 {day_text(item['due_date'])}이 {days}일 지났어요 · {content}")
        elif kind == "task_due_soon":
            when = "오늘" if item["due_date"] == today else "내일"
            lines.append(f"⏰ {who} {when}까지예요 · {content}")
        elif kind == "task_talk_waiting":
            lines.append(
                f"🗓 {who} {item['actor']} 님의 기한 수정 요청에 아직 답하지 않았어요 · {content} "
                f"→ [요청 관리]에서 [기한 변경] 또는 [지금 기한 유지]"
            )
    return "\n".join(lines)