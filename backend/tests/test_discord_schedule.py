"""디스코드 일정 (DB · 디스코드 연결 없이): 날짜 · 시각 읽기, 관리 창 버튼, 목록 글, 입력 창 → 웹과 같은 저장 함수."""

import asyncio
from datetime import date, time

import pytest

import app.discord_schedule as ds
from app.discord_gateway import DueError

TODAY = date(2026, 11, 2)  # 월요일


# ---------- 시각 ----------
@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("", (None, None)),
        ("14:00", (time(14), None)),
        ("9:30", (time(9, 30), None)),
        ("14시", (time(14), None)),
        ("2시 30분", (time(2, 30), None)),
        ("오후 2시", (time(14), None)),
        ("오후 2시 반", (time(14, 30), None)),
        ("오전 12시", (time(0), None)),
        ("오후 12시", (time(12), None)),
        ("14:00~15:30", (time(14), time(15, 30))),
        ("오후 2시~3시", (time(14), time(15))),  # 끝에 오후가 없으면 시작과 같은 쪽
        ("오전 11시~오후 1시", (time(11), time(13))),
        ("2pm", (time(14), None)),
        ("2:30 PM", (time(14, 30), None)),
        ("2 p.m.", (time(14), None)),
        ("PM 2시", (time(14), None)),
        ("12am", (time(0), None)),
        ("12pm", (time(12), None)),
        ("10am~11:30am", (time(10), time(11, 30))),
        ("2pm~3", (time(14), time(15))),  # 끝에 pm 이 없으면 시작과 같은 쪽
        ("11am~1pm", (time(11), time(13))),
    ],
)
def test_parse_clock(text, expected):
    assert ds.parse_clock(text) == expected


@pytest.mark.parametrize("text", ["2", "오후", "25:00", "14:00~", "14:00~15:00~16:00", "두시", "14pm", "오후 2pm", "0am"])
def test_parse_clock_rejects(text):
    with pytest.raises(ds.TimeError):
        ds.parse_clock(text)


# ---------- 날짜 · 기간 ----------
def test_parse_period():
    assert ds.parse_period("11.5", TODAY) == (date(2026, 11, 5), date(2026, 11, 5))
    assert ds.parse_period("11.3~11.7", TODAY) == (date(2026, 11, 3), date(2026, 11, 7))
    assert ds.parse_period("내일 ~ 다음 주 금요일", TODAY) == (date(2026, 11, 3), date(2026, 11, 13))
    for bad in ["", "~", "11.3~11.5~11.7", "금요일"]:
        with pytest.raises(DueError):
            ds.parse_period(bad, TODAY)


def test_prefill_texts():
    assert ds.clock_text(time(14), time(15, 30)) == "14:00~15:30"
    assert ds.clock_text(time(9), None) == "09:00" and ds.clock_text(None, None) == ""
    assert ds.period_text(date(2026, 11, 5), date(2026, 11, 5)) == "11.5"
    assert ds.period_text(date(2026, 11, 3), date(2026, 11, 12)) == "11.3~11.12"


# ---------- 관리 창 ----------
CARD = {
    "schedule_id": 7,
    "collaboration_id": 3,
    "kind": "meeting",
    "title": "주간 미팅",
    "start_date": date(2026, 11, 5),
    "end_date": date(2026, 11, 5),
    "start_time": time(14),
    "end_time": time(15),
    "place": "",
    "memo": "줌 링크",
    "assignee": None,
    "series_id": None,
    "collab_status": "ongoing",
    "collab_end": date(2026, 11, 30),
    "researcher_id": 1,
    "expert_id": 4,
}


def test_panel_buttons():
    text, actions = ds.schedule_panel(CARD, 1)
    assert actions == ["edit", "delete"]
    assert "**주간 미팅** · 미팅\n11.5 (목) 14:00~15:00\n📝 줌 링크" in text
    assert ds.schedule_panel({**CARD, "series_id": 7}, 4)[1] == ["edit", "edit_series", "delete", "delete_series"]  # 반복 일정
    assert ds.schedule_panel({**CARD, "collab_status": "done"}, 1)[1] == []  # 끝난 협업
    assert ds.schedule_panel(CARD, 99)[1] == []  # 이 협업 사람이 아님


# ---------- /일정목록 ----------
def row(schedule_id, start, end=None, **fields):
    base = {
        "schedule_id": schedule_id,
        "kind": "meeting",
        "title": f"일정{schedule_id}",
        "start_date": start,
        "end_date": end or start,
        "start_time": None,
        "end_time": None,
        "series_id": None,
    }
    return {**base, **fields}


def test_list_text_and_options():
    rows = [
        row(1, date(2026, 10, 30), date(2026, 11, 6), kind="work", title="라벨링"),  # 이미 시작해 진행 중
        row(2, date(2026, 11, 5), start_time=time(14), end_time=time(15), series_id=2),
    ]
    text = ds.list_text(rows, TODAY, "http://web/workspace/3")
    assert text.startswith("📅 **다가오는 일정 (2주)** · 11.2 (월) ~ 11.15 (일)")
    assert "· 오늘 · 10.30 (금) ~ 11.6 (금) · **라벨링** · 작업 기간" in text
    assert "· 11.5 (목) 14:00~15:00 · **일정2** · 미팅 🔁" in text
    assert "웹에서 보기: http://web/workspace/3" in text
    options = ds.schedule_options(rows)
    assert [option.value for option in options] == ["1", "2"]
    assert options[1].description == "11.5 (목) 14:00~15:00 · 미팅"
    assert "일정이 없어요" in ds.list_text([], TODAY, "http://web")


def test_list_view_is_built_on_the_event_loop(monkeypatch):
    """창(View)은 봇의 이벤트 루프 안에서 만들어야 눌러져요 (요청 목록에서 겪은 문제와 같아요)"""
    monkeypatch.setattr(ds, "upcoming_schedules", lambda *args: [row(1, date(2026, 11, 5))])
    monkeypatch.setattr(ds, "today_kst", lambda: TODAY)

    async def build():
        return await ds.list_view({"collaboration_id": 3, "user_id": 1})

    text, view = asyncio.run(build())
    assert "일정1" in text and view is not None
    assert view._BaseView__stopped is not None


# ---------- 입력 창 ----------
def make_modal(kind, **kwargs):
    async def build():
        return ds.ScheduleModal(kind, 1, **kwargs)

    return asyncio.run(build())


def fill(box, value):
    box._value = value  # 디스코드가 채워 주는 값 대신


def test_modal_fields_by_kind():
    assert [item.label for item in make_modal("meeting").children] == ["제목", "날짜", "시각 (선택 · 비우면 시각 없이)", "메모 (선택)"]
    assert [item.label for item in make_modal("work").children] == ["제목", "기간 (시작~끝)", "메모 (선택)"]  # 작업 기간은 시각 없음
    edit = make_modal("meeting", card=CARD)
    assert edit.title == "일정 수정 · 미팅"
    assert (edit.title_box.default, edit.when_box.default, edit.clock_box.default) == ("주간 미팅", "11.5", "14:00~15:00")


def test_modal_body_is_same_input_as_web():
    modal = make_modal("meeting", member={"collaboration_id": 3}, repeat=True)
    fill(modal.title_box, "주간 미팅")
    fill(modal.when_box, "다음 주 목요일")
    fill(modal.clock_box, "오후 2시~3시 반")
    fill(modal.memo_box, "")
    body = modal.body(TODAY)
    assert (body.kind, body.start_date, body.end_date) == ("meeting", date(2026, 11, 12), date(2026, 11, 12))
    assert (body.start_time, body.end_time, body.repeat_weekly) == (time(14), time(15, 30), True)

    edit = make_modal("work", card={**CARD, "kind": "work", "assignee": "expert", "place": "302호"})
    fill(edit.title_box, "라벨링")
    fill(edit.when_box, "11.3~11.7")
    fill(edit.memo_box, "")
    body = edit.body(TODAY)
    assert (body.start_date, body.end_date, body.start_time) == (date(2026, 11, 3), date(2026, 11, 7), None)
    assert (body.assignee, body.place, body.repeat_weekly) == ("expert", "302호", False)  # 디스코드에 없는 칸은 그대로


class FakeResponse:
    def __init__(self):
        self.sent = []

    async def send_message(self, text, **kwargs):
        self.sent.append(("send", text))

    async def edit_message(self, content=None, **kwargs):
        self.sent.append(("edit", content))


class FakeInteraction:
    def __init__(self):
        self.response = FakeResponse()


def test_add_saves_with_web_function_and_announces(monkeypatch):
    calls = []
    sent = {"type": "schedule_created", "note": "주간 미팅 · 미팅 · 11.5 (목) 14:00", "schedule_id": 9}
    monkeypatch.setattr(ds, "today_kst", lambda: TODAY)
    monkeypatch.setattr(ds, "save_schedule", lambda user_id, collab_id, body: calls.append(("save", user_id, collab_id)) or sent)
    monkeypatch.setattr(ds.notice, "announce", lambda notice: calls.append(("announce", notice)))

    async def run():
        modal = ds.ScheduleModal("meeting", 1, member={"collaboration_id": 3})
        for box, value in ((modal.title_box, "주간 미팅"), (modal.when_box, "11.5"), (modal.clock_box, "14:00"), (modal.memo_box, "")):
            fill(box, value)
        interaction = FakeInteraction()
        await modal.on_submit(interaction)
        return interaction.response.sent

    replies = asyncio.run(run())
    assert calls == [("save", 1, 3), ("announce", sent)]  # 웹과 같은 저장 → 채널에 상대 멘션
    assert replies == [("send", "✅ 일정을 추가했어요 · 주간 미팅 · 미팅 · 11.5 (목) 14:00\n상대에게 알렸어요.")]


def test_bad_time_does_not_save(monkeypatch):
    monkeypatch.setattr(ds, "today_kst", lambda: TODAY)
    monkeypatch.setattr(ds, "save_schedule", lambda *args: pytest.fail("저장하면 안 돼요"))

    async def run():
        modal = ds.ScheduleModal("meeting", 1, member={"collaboration_id": 3})
        for box, value in ((modal.title_box, "주간 미팅"), (modal.when_box, "11.5"), (modal.clock_box, "두시"), (modal.memo_box, "")):
            fill(box, value)
        interaction = FakeInteraction()
        await modal.on_submit(interaction)
        return interaction.response.sent

    [(kind, text)] = asyncio.run(run())
    assert kind == "send" and text.startswith('⚠️ "두시" 을(를) 시각으로 읽지 못했어요')

def test_list_links_to_channel_message():
    rows = [row(1, date(2026, 11, 5), discord_message_id="555"), row(2, date(2026, 11, 6))]
    text = ds.list_text(rows, TODAY, "http://web", "https://discord.com/channels/1/900")
    assert "**[일정1](https://discord.com/channels/1/900/555)**" in text  # 누르면 그 메시지로
    assert "**일정2**" in text  # 메시지가 없는 예전 일정은 글자만


def test_past_date_says_past(monkeypatch):
    monkeypatch.setattr(ds, "today_kst", lambda: TODAY)
    monkeypatch.setattr(ds, "save_schedule", lambda *args: pytest.fail("저장하면 안 돼요"))

    async def run():
        modal = ds.ScheduleModal("meeting", 1, member={"collaboration_id": 3})
        for box, value in ((modal.title_box, "회의"), (modal.when_box, "10.30"), (modal.clock_box, ""), (modal.memo_box, "")):
            fill(box, value)
        interaction = FakeInteraction()
        await modal.on_submit(interaction)
        return interaction.response.sent

    [(_kind, text)] = asyncio.run(run())
    assert text.startswith('⚠️ "10.30" 은(는) 이미 지난 날(10.30 (금))이에요. 지난 일정을 넣으려면 2026.10.30 처럼 연도까지 적어 주세요.')


def test_series_edit_modal_title():
    modal = make_modal("meeting", card={**CARD, "series_id": 7}, series=True)
    assert modal.title == "반복 일정 모두 수정 · 미팅" and modal.series is True