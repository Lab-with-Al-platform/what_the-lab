"""협업 공간 일정 규칙 (DB 없이): 종류별 칸 정리, 협업 기간 안인지, 매주 반복 날짜."""

from datetime import date, time

import pytest
from fastapi import HTTPException

from app import workspace_rules as rules
from app.workspace_store import screen_status

PERIOD = (date(2026, 10, 28), date(2026, 11, 26))  # 협업 기간


def make(**fields) -> rules.ScheduleInput:
    base = {"kind": "meeting", "title": "주간 미팅", "start_date": date(2026, 11, 3)}
    return rules.ScheduleInput(**{**base, **fields})


def test_one_day_meeting_keeps_time():
    saved = rules.clean_schedule(make(start_time=time(14), end_time=time(15), assignee="expert", place=" 구글 미트 "), PERIOD)
    assert saved["end_date"] == date(2026, 11, 3)  # 종료일을 비우면 하루짜리
    assert (saved["start_time"], saved["end_time"]) == (time(14), time(15))
    assert saved["assignee"] is None  # 담당은 작업 기간만
    assert saved["place"] == "구글 미트"


@pytest.mark.parametrize("kind", ["meeting", "due", "etc"])
def test_every_kind_can_span_days_without_time(kind):
    saved = rules.clean_schedule(make(kind=kind, end_date=date(2026, 11, 5), start_time=time(14), end_time=time(15)), PERIOD)
    assert (saved["start_date"], saved["end_date"]) == (date(2026, 11, 3), date(2026, 11, 5))
    assert (saved["start_time"], saved["end_time"]) == (None, None)  # 여러 날 일정은 시각 없이


def test_work_spans_days_and_drops_time():
    saved = rules.clean_schedule(
        make(kind="work", title="라벨링", end_date=date(2026, 11, 7), start_time=time(9), assignee="researcher"),
        PERIOD,
    )
    assert (saved["start_date"], saved["end_date"]) == (date(2026, 11, 3), date(2026, 11, 7))
    assert saved["start_time"] is None
    assert saved["assignee"] == "researcher"


def test_due_has_no_time_and_empty_texts_become_none():
    saved = rules.clean_schedule(make(kind="due", title="1차 결과", start_time=time(9), memo="  "), PERIOD)
    assert saved["start_time"] is None and saved["memo"] is None


def test_end_time_without_start_is_dropped():
    assert rules.clean_schedule(make(end_time=time(15)), PERIOD)["end_time"] is None


# ---------- 막히는 경우 ----------
@pytest.mark.parametrize(
    ("fields", "message"),
    [
        ({"kind": "party"}, "종류"),
        ({"title": "  "}, "제목"),
        ({"title": "가" * 61}, "60자"),
        ({"start_date": date(2026, 10, 27)}, "협업 기간(10.28 ~ 11.26)"),
        ({"kind": "work", "end_date": date(2026, 11, 27)}, "협업 기간"),
        ({"end_date": date(2026, 11, 27)}, "협업 기간"),
        ({"kind": "work", "end_date": date(2026, 11, 2)}, "끝나는 날"),
        ({"kind": "due", "end_date": date(2026, 11, 2)}, "끝나는 날"),
        ({"start_time": time(15), "end_time": time(14)}, "끝나는 시각"),
        ({"kind": "work", "assignee": "both"}, "담당"),
    ],
)
def test_rejects(fields, message):
    with pytest.raises(HTTPException) as error:
        rules.clean_schedule(make(**fields), PERIOD)
    assert error.value.status_code == 400
    assert message in error.value.detail

# ---------- 일정을 잡을 수 있는 기간 ----------
def test_schedule_period_starts_from_confirmed_day():
    start, end = date(2026, 11, 3), date(2026, 11, 30)
    assert rules.schedule_period(start, end, date(2026, 10, 28)) == (date(2026, 10, 28), end)  # 확정한 날부터 (사전 미팅)
    assert rules.schedule_period(start, end, date(2026, 11, 5)) == (start, end)  # 시작일 뒤에 만든 협업은 시작일부터


def test_pre_start_meeting_allowed_after_confirmed():
    period = rules.schedule_period(date(2026, 11, 3), date(2026, 11, 30), date(2026, 10, 28))
    saved = rules.clean_schedule(make(start_date=date(2026, 10, 30)), period)  # 시작 전 사전 미팅
    assert saved["start_date"] == date(2026, 10, 30)
    with pytest.raises(HTTPException) as error:
        rules.clean_schedule(make(start_date=date(2026, 10, 27)), period)  # 확정 전 날짜는 안 돼요
    assert "10.28 ~ 11.30" in error.value.detail

# ---------- 매주 반복 ----------
def test_weekly_dates_until_end_and_capped():
    assert rules.weekly_dates(date(2026, 11, 3), date(2026, 11, 26)) == [
        date(2026, 11, 3),
        date(2026, 11, 10),
        date(2026, 11, 17),
        date(2026, 11, 24),
    ]
    assert len(rules.weekly_dates(date(2026, 1, 1), date(2027, 12, 31))) == rules.MAX_REPEAT


# ---------- 화면 상태 ----------
def test_screen_status():
    start = date(2026, 10, 28)
    assert screen_status("ongoing", start, date(2026, 10, 27)) == "waiting"
    assert screen_status("ongoing", start, date(2026, 10, 28)) == "active"
    assert screen_status("done", start, date(2026, 12, 1)) == "done"