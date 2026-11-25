"""시작 전 협업 (DB · 디스코드 없이): 시작일 미루기 범위, 전문가 요청 받기 규칙, 채널 · 알림 글자, 아침 브리핑."""

from datetime import date, datetime

import pytest
from fastapi import HTTPException

from app import collab_waiting as w
from app.notification_store import collab_message, task_message
from app.request_rules import second_try_block
from app.task_text import KST, brief_text
from app.workspace_store import check_started

TODAY = date(2026, 11, 4)
START = date(2026, 11, 9)


def test_waiting_blocks_tasks_and_schedules_until_start():
    collab = {"status": "ongoing", "start_date": START}
    with pytest.raises(HTTPException) as error:
        check_started(collab, TODAY)
    assert error.value.status_code == 409 and "11.9 (월)에 시작돼요" in error.value.detail
    check_started(collab, START)  # 시작일부터는 돼요
    check_started({"status": "canceled", "start_date": START}, TODAY)  # 끝난 협업은 check_ongoing 이 막아요


def test_check_waiting():
    w.check_waiting({"status": "ongoing", "start_date": START}, TODAY)
    for collab in ({"status": "ongoing", "start_date": TODAY}, {"status": "canceled", "start_date": START}):
        with pytest.raises(HTTPException) as error:
            w.check_waiting(collab, TODAY)
        assert error.value.status_code == 409


@pytest.mark.parametrize(
    ("new_start", "already", "code"),
    [
        (date(2026, 11, 16), False, None),
        (date(2026, 11, 23), False, None),  # 14일까지
        (date(2026, 11, 24), False, 400),  # 15일
        (START, False, 400),  # 같은 날
        (date(2026, 11, 8), False, 400),  # 앞당기기
        (date(2026, 11, 16), True, 409),  # 이미 한 번 미룸
    ],
)
def test_check_postpone(new_start, already, code):
    if code is None:
        w.check_postpone(START, new_start, already)
        return
    with pytest.raises(HTTPException) as error:
        w.check_postpone(START, new_start, already)
    assert error.value.status_code == code


def test_answer_deadline_is_three_days_or_start_midnight():
    now = datetime(2026, 11, 4, 12, 0, tzinfo=KST)
    assert w.answer_deadline(now, START) == datetime(2026, 11, 7, 12, 0, tzinfo=KST)
    assert w.answer_deadline(now, date(2026, 11, 6)) == datetime(2026, 11, 6, 0, 0, tzinfo=KST)  # 시작일이 더 빨라요


@pytest.mark.parametrize(
    ("last_end", "expected"),
    [
        (None, None),  # 협업 없음
        (date(2026, 12, 4), None),  # 30일 안에 끝남
        (date(2026, 12, 5), date(2026, 11, 5)),  # 31일 → 종료일 − 30일부터
        (date(2026, 12, 9), date(2026, 11, 9)),
    ],
)
def test_expert_open_from(last_end, expected):
    assert w.open_from(last_end, TODAY) == expected


def test_busy_closed_request_can_be_sent_again():
    assert second_try_block([{"status": "canceled", "responded_at": None, "cancel_reason": "expert_busy"}]) is None


def test_channel_texts():
    notice = {"to": "111", "actor": "jiwoo_lab", "note": "일정이 맞지 않게 됐어요 · 죄송해요", "delete_on": date(2026, 11, 6)}
    assert w.cancel_text(notice) == (
        "❌ <@111> jiwoo_lab 님이 협업을 취소했어요\n사유: 일정이 맞지 않게 됐어요 · 죄송해요\n"
        "이 채널은 **11.6 (금)**에 삭제돼요. 필요한 파일은 그 전에 받아 두세요."
    )
    ask = {
        "type": "start_change_requested", "to": "222", "actor": "jiwoo_lab", "reason": "데이터 승인 대기",
        "old_start": START, "new_start": date(2026, 11, 16), "new_end": date(2026, 12, 16),
        "deadline": datetime(2026, 11, 7, 12, 0, tzinfo=KST),
    }
    assert w.postpone_text(ask) == (
        "🗓 <@222> jiwoo_lab 님이 시작일을 미루자고 했어요 · **11.9 → 11.16** (종료 12.16)\n"
        "“데이터 승인 대기” · 11.7 12:00까지 답해 주세요"
    )
    assert w.postpone_components(5)[0]["components"][0]["custom_id"] == "start:accept:5"
    accepted = {"type": "start_change_accepted", "to": "111", "actor": "outsider_lee", "new_start": date(2026, 11, 16), "new_end": date(2026, 12, 16)}
    assert "협업 기간이 **11.16 ~ 12.16**로 바뀌었어요" in w.postpone_text(accepted)


def test_bell_messages():
    row = {"type": "collab_canceled", "actor_nickname": "outsider_lee", "collab_title": "세포 이미지", "note": "기타 · 사정이 생겼어요"}
    assert collab_message(row) == ("outsider_lee 님이 협업을 취소했어요", "기타 · 사정이 생겼어요 · 세포 이미지")
    assert collab_message({**row, "type": "start_change_requested"})[0] == "outsider_lee 님이 시작일을 미루자고 했어요"
    assert task_message({"type": "collab_starting", "actor_nickname": None, "collab_title": "세포 이미지"})[0] == "내일 협업이 시작돼요 🚀"


def test_brief_has_start_lines():
    items = [
        {"type": "collab_starting", "to": ["1", "2"], "end_date": date(2026, 12, 9)},
    ]
    text = brief_text(date(2026, 11, 8), items)
    assert "🚀 <@1> <@2> 내일 협업이 시작돼요" in text
    today = brief_text(START, [{"type": "collab_start_today", "to": ["1"], "end_date": date(2026, 12, 9)}])
    assert "🚀 <@1> 오늘부터 협업 시작! 이제 웹과 `/요청` · `/일정`을 쓸 수 있어요 (12.9 (수)까지)" in today


# ---------- 디스코드 ----------
def test_discord_waiting_text():
    from app.discord_waiting import waiting_text

    assert "11.9 (월)**에 시작돼요" in waiting_text({"status": "ongoing", "start_date": START}, TODAY)
    assert waiting_text({"status": "ongoing", "start_date": START}, START) is None  # 시작일부터는 돼요
    assert waiting_text({"status": "canceled", "start_date": START}, TODAY) == "끝난 협업이라 요청 · 일정을 쓸 수 없어요."


def test_discord_accept_uses_web_function(monkeypatch):
    import asyncio

    import app.discord_waiting as dw

    calls = []
    monkeypatch.setattr(dw.waiting, "answer_postpone", lambda *args: calls.append(("answer", *args[:3])) or {"type": "start_change_accepted"})
    monkeypatch.setattr(dw.waiting, "after_postpone", lambda notice: calls.append(("after", notice["type"])))

    class Response:
        def __init__(self):
            self.sent = []

        async def send_message(self, text, **kwargs):
            self.sent.append(text)

    class Interaction:
        message = None

        def __init__(self):
            self.response = Response()

    async def run():
        button = dw.StartChangeButton(5, "accept")  # 이벤트 루프 안에서 만들어요
        assert button.item.custom_id == "start:accept:5"
        interaction = Interaction()
        await dw.answer(interaction, 5, 2, True)
        return interaction.response.sent

    assert asyncio.run(run()) == ["✅ 수락했어요"]
    assert calls == [("answer", 2, 5, True), ("after", "start_change_accepted")]