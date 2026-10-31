"""디스코드 봇 (/요청 · [요청 관리]): 기한 읽기 · 메시지 모양 · 관리 창 버튼. 디스코드에 연결하지 않고 확인해요."""

import re
from datetime import date

import pytest

from app.discord_gateway import (
    DueError,
    ManageButton,
    list_sections,
    panel,
    parse_due,
    select_options,
)
from app.task_text import due_label, task_list_text, task_message

TODAY = date(2026, 10, 30)  # 금요일


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("", None),  # 비우면 기한 없음
        ("  ", None),
        ("11.10", date(2026, 11, 10)),
        ("11/10", date(2026, 11, 10)),
        ("11-10", date(2026, 11, 10)),
        ("11.10.", date(2026, 11, 10)),
        ("2026-11-10", date(2026, 11, 10)),
        ("2026.11.10", date(2026, 11, 10)),
        ("2026/11/10", date(2026, 11, 10)),
        ("11월 10일", date(2026, 11, 10)),
        ("11월10일", date(2026, 11, 10)),
        ("11월 10", date(2026, 11, 10)),
        ("2026년 11월 10일", date(2026, 11, 10)),
        ("10일", date(2026, 11, 10)),  # 이번 달 10일은 지났으니 다음 달
        ("31일", date(2026, 10, 31)),  # 이번 달
        ("오늘", date(2026, 10, 30)),
        ("내일", date(2026, 10, 31)),
        ("모레", date(2026, 11, 1)),
        ("3일 뒤", date(2026, 11, 2)),
        ("3일후", date(2026, 11, 2)),
        ("1주 뒤", date(2026, 11, 6)),
        ("2주 후", date(2026, 11, 13)),
        ("이번 주 금요일", date(2026, 10, 30)),
        ("다음 주 월요일", date(2026, 11, 2)),
        ("다음주 수", date(2026, 11, 4)),
        ("다다음 주 월요일", date(2026, 11, 9)),
        ("1.5", date(2027, 1, 5)),  # 연도 없이 지난 날짜면 내년 (범위 검사에서 걸러져요)
    ],
)
def test_parse_due(text, expected):
    assert parse_due(text, TODAY) == expected


@pytest.mark.parametrize(
    "text", ["금요일", "1110", "20261110", "다음주쯤", "월말", "빨리", "2.30", "11월 31일", "13.1", "32일"]
)
def test_parse_due_rejects_unclear(text):
    with pytest.raises(DueError):
        parse_due(text, TODAY)


def test_day_only_rolls_over_year():
    assert parse_due("5일", date(2026, 12, 20)) == date(2027, 1, 5)


def test_due_label_uses_live_discord_time():
    """남은 날은 디스코드가 보는 사람 화면에서 계산해요 (<t:…:R> → "11일 후", 날이 지나도 맞게)"""
    assert due_label(None) == "기한 없음"
    assert due_label(date(2026, 11, 10)) == "기한 11.10 (화) · <t:1794322740:R>"  # 11-10 23:59 (한국 시간)


SENDER, RECEIVER, OTHER = 1, 4, 9
CARD = {
    "content": "학습 곡선 그래프를 보내 주세요",
    "due_date": date(2026, 11, 10),
    "requested_by": SENDER,
    "assignee": RECEIVER,
    "requested_by_nickname": "jiwoo_lab",
    "assignee_nickname": "outsider_lee",
    "assignee_discord_id": "123456789",
    "closed_on": date(2026, 11, 8),
    "collab_status": "ongoing",
}


def test_task_message_by_status():
    opened = task_message({**CARD, "status": "open"})
    assert opened.startswith("📌 **요청** · jiwoo_lab → <@123456789> · 기한 11.10 (화)")
    assert opened.endswith(">>> 학습 곡선 그래프를 보내 주세요")
    assert task_message({**CARD, "status": "done"}).startswith(
        "✅ **요청 완료** · jiwoo_lab → outsider_lee · 11.8 완료"
    )
    canceled = task_message({**CARD, "status": "canceled"})
    assert canceled.startswith("🚫 **취소된 요청**") and canceled.endswith(
        "~~학습 곡선 그래프를 보내 주세요~~"
    )
    assert "<@" not in canceled  # 끝난 요청은 다시 알림(멘션)을 보내지 않아요


@pytest.mark.parametrize(
    ("status", "user", "buttons"),
    [
        ("open", RECEIVER, ["done", "talk"]),  # 받은 사람: 완료 · 기한 얘기하기
        ("open", SENDER, ["due", "cancel"]),  # 보낸 사람: 기한 변경 · 요청 취소
        ("open", OTHER, []),
        ("done", RECEIVER, ["reopen"]),  # 완료한 사람이 되돌리기
        ("done", SENDER, ["return"]),  # 보낸 사람: 다시 요청
        ("canceled", SENDER, ["reopen"]),  # 취소한 사람이 되돌리기
        ("canceled", RECEIVER, []),
    ],
)
def test_panel_buttons_by_role(status, user, buttons):
    assert panel({**CARD, "status": status}, user)[1] == buttons


def test_panel_on_ended_collab_has_no_buttons():
    text, buttons = panel({**CARD, "status": "open", "collab_status": "done"}, RECEIVER)
    assert buttons == [] and "끝난 협업" in text


@pytest.mark.parametrize("custom_id", ["task:manage:42", "task:done:42", "task:cancel:42"])
def test_button_id_round_trip(custom_id):
    """버튼 id 만으로 어떤 요청인지 알아야 봇을 다시 켜도 동작해요. 예전 버튼 id 도 받아요."""
    match = re.fullmatch(ManageButton.__discord_ui_compiled_template__, custom_id)
    assert match["task_id"] == "42"



def list_row(task_id, status="open", flag=None, message_id="700", content="그래프 정리"):
    return {
        "task_id": task_id, "content": content, "due_date": date(2026, 11, 10), "status": status,
        "discord_message_id": message_id, "closed_on": date(2026, 10, 29) if status == "done" else None,
        "requested_by_nickname": "jiwoo_lab", "assignee_nickname": "outsider_lee", "flag": flag,
    }


def test_received_list_puts_returned_first_and_links_messages():
    """/받은요청: 다시 요청된 요청이 '내가 답할 것'에, 제목은 채널 메시지 링크"""
    rows = [list_row(1), list_row(2, flag="returned", message_id="701", content="표 [최종] 다시")]
    text = task_list_text("📥 **받은 요청**", list_sections(rows, "in"), "https://discord.com/channels/1/900", "http://web/workspace/3")
    answer, progress = text.index("**내가 답할 것**"), text.index("**진행 중**")
    assert answer < text.index("표 (최종) 다시") < progress  # 대괄호는 링크가 깨지지 않게 바꿔요
    assert "(https://discord.com/channels/1/900/701)" in text and "jiwoo_lab → 나" in text
    assert "↩️ 다시 요청됨" in text and "최근 완료" not in text  # 받은 요청에는 완료 묶음이 없어요


def test_sent_list_shows_due_talk_and_recent_done():
    rows = [list_row(1, flag="due_talk"), list_row(2), list_row(3, status="done", message_id=None)]
    sections = dict(list_sections(rows, "out"))
    assert [row["task_id"] for row in sections["내가 답할 것"]] == [1]
    assert [row["task_id"] for row in sections["최근 완료 (7일)"]] == [3]
    text = task_list_text("📤 **보낸 요청**", list(sections.items()), "https://discord.com/channels/1/900", "http://web")
    assert "나 → outsider_lee" in text and "10.29 완료" in text and "🗓 기한 얘기 있음" in text


def test_list_is_cut_with_web_link():
    rows = [list_row(i) for i in range(20)]
    text = task_list_text("📥 **받은 요청**", list_sections(rows, "in"), None, "http://web/workspace/3")
    assert "외 5개는 웹에서 보세요: http://web/workspace/3" in text
    assert "](" not in text  # 채널 주소가 없으면 링크 없이 글자만
    assert len(text) < 2000  # 디스코드 메시지 한도
    assert "없어요" in task_list_text("📥", list_sections([], "in"), None, "http://web")



def test_sender_answers_due_talk_with_change_or_keep():
    """기한 수정 요청이 와 있으면 보낸 사람 패널: [기한 변경] [지금 기한 유지] [요청 취소]"""
    text, buttons = panel({**CARD, "status": "open", "flag": "due_talk", "talk_due": date(2026, 11, 14)}, SENDER)
    assert buttons == ["due", "keep", "cancel"] and "**11.14 (토)**까지로" in text
    assert panel({**CARD, "status": "open", "flag": "due_talk"}, RECEIVER)[1] == ["done", "talk"]

def test_select_options_follow_list_order_with_plain_dates():
    """/받은요청 드롭다운: 목록과 같은 순서(내가 답할 것 먼저), 날짜는 글자로 (드롭다운엔 <t:…>가 안 보여요)"""
    rows = [list_row(1), list_row(2, flag="returned", content="x" * 120), list_row(3, status="done")]
    options = select_options(list_sections(rows, "out"))
    assert [option.value for option in options] == ["1", "2", "3"]  # 보낸 요청: 내가 답할 것(due_talk) 없음 → 진행 중 → 완료
    options = select_options(list_sections(rows, "in"))
    assert options[0].value == "2" and options[0].description == "11.10 (화) · ↩️ 다시 요청됨"
    assert len(options[0].label) == 96 and options[0].label.endswith("…")  # 디스코드 한도 100자 안
    assert "<t:" not in "".join(option.description for option in options)
    many = [list_row(i) for i in range(40)]
    assert len(select_options(list_sections(many, "in"))) == 25  # 드롭다운 한도



def test_list_view_is_built_on_the_event_loop(monkeypatch):
    """디스코드 창(View)을 다른 스레드에서 만들면 눌러도 응답이 없어요("적시에 응답하지 않았어요").
    DB 읽기만 스레드에서 하고, 창은 이벤트 루프 안에서 만들어야 해요."""
    import asyncio

    import app.discord_gateway as gateway

    rows = [list_row(1)]
    monkeypatch.setattr(gateway, "my_tasks", lambda *args: rows)
    back = {"collaboration_id": 3, "user_id": 4, "direction": "in", "channel_id": 900}

    async def build():
        return await gateway.list_view(back)

    text, view = asyncio.run(build())
    assert "받은 요청" in text and view is not None
    assert view._BaseView__stopped is not None  # 루프 안에서 만들어져야 버튼 · 드롭다운을 받아요 (스레드면 None)