"""디스코드 봇 (/요청 · [요청 관리]): 기한 읽기 · 메시지 모양 · 관리 창 버튼. 디스코드에 연결하지 않고 확인해요."""

import re
from datetime import date

import pytest

from app.discord_gateway import DueError, ManageButton, panel, parse_due
from app.task_text import due_label, task_message

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
        ("open", RECEIVER, ["done"]),  # 받은 사람: 완료
        ("open", SENDER, ["due", "cancel"]),  # 보낸 사람: 기한 변경 · 요청 취소
        ("open", OTHER, []),
        ("done", RECEIVER, ["reopen"]),  # 완료한 사람이 되돌리기
        ("done", SENDER, []),
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