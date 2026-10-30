"""디스코드 봇 (/요청): 기한 읽기 · 채널 메시지 모양. 디스코드에 연결하지 않고 확인해요."""

from datetime import date

import pytest

from app.discord_gateway import due_label, parse_due, task_message

TODAY = date(2026, 10, 30)


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("", None),  # 기한 없음
        ("  ", None),
        ("11.10", date(2026, 11, 10)),
        ("11/10", date(2026, 11, 10)),
        ("11-10", date(2026, 11, 10)),
        ("11.10.", date(2026, 11, 10)),
        ("2026-11-10", date(2026, 11, 10)),
        ("2026.11.10", date(2026, 11, 10)),
        ("10.30", date(2026, 10, 30)),  # 오늘
        ("1.5", date(2027, 1, 5)),  # 이미 지난 날짜면 내년
    ],
)
def test_parse_due(text, expected):
    assert parse_due(text, TODAY) == expected


@pytest.mark.parametrize("text", ["다음주", "11월 10일", "13.40", "2026-02-30"])
def test_parse_due_rejects(text):
    with pytest.raises(ValueError):
        parse_due(text, TODAY)


def test_due_label():
    assert due_label(None, TODAY) == "기한 없음"
    assert due_label(TODAY, TODAY) == "10.30 (오늘까지)"
    assert due_label(date(2026, 11, 10), TODAY) == "11.10 (D-11)"


def test_task_message_mentions_assignee():
    task = {
        "content": "학습 곡선 그래프를 보내 주세요",
        "due_date": date(2026, 11, 10),
        "requested_by_nickname": "jiwoo_lab",
        "assignee_discord_id": "123456789",
    }
    text = task_message(task, TODAY)
    assert text.startswith("📌 **요청** · jiwoo_lab → <@123456789> · 11.10 (D-11)")
    assert text.endswith(">>> 학습 곡선 그래프를 보내 주세요")