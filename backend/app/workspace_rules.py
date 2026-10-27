"""협업 공간 일정 규칙 (DB 없이): 입력 정리, 협업 기간 안인지, 매주 반복 날짜 만들기.

화면에서 막더라도 API에서 한 번 더 확인합니다. 테스트: tests/test_workspace_rules.py
"""

from datetime import date, time, timedelta

from pydantic import BaseModel

from app.form_rules import bad_request, optional_text, required_text

KINDS = {"meeting", "work", "due", "etc"}  # 미팅 · 작업 기간 · 결과물 마감 · 기타
ASSIGNEES = {"researcher", "expert"}  # 작업 기간 담당 (비어 있으면 함께)
MAX_TITLE = 60
MAX_PLACE = 300
MAX_MEMO = 500
MAX_REPEAT = 26  # 매주 반복은 최대 26번 (약 반년)


class ScheduleInput(BaseModel):
    kind: str  # meeting / work / due / etc
    title: str  # 60자
    start_date: date
    end_date: date | None = None  # 종료일 (비우면 start_date 와 같은 하루짜리)
    start_time: time | None = None  # 하루짜리 미팅·기타만 (선택)
    end_time: time | None = None  # 하루짜리 미팅·기타만 (선택, 시작 시각보다 뒤)
    place: str = ""  # 장소·링크 (선택, 300자)
    memo: str = ""  # 메모 (선택, 500자)
    assignee: str | None = None  # 작업 기간 담당: researcher / expert / None(함께)
    repeat_weekly: bool = False  # 매주 같은 요일에 반복 (협업 종료일까지). 하루짜리를 새로 만들 때만 써요


def clean_schedule(body: ScheduleInput, period: tuple[date, date]) -> dict:
    """입력을 저장할 모양으로 정리합니다. 규칙에 어긋나면 400.

    - 모든 종류가 여러 날이 될 수 있어요. 시각은 하루짜리 미팅·기타만, 담당은 작업 기간만
    - 날짜는 협업 기간(시작일~종료일) 안이어야 해요
    """
    if body.kind not in KINDS:
        raise bad_request("일정 종류를 다시 골라 주세요")
    title = required_text(body.title, MAX_TITLE, "제목")
    place = optional_text(body.place, MAX_PLACE, "장소·링크")
    memo = optional_text(body.memo, MAX_MEMO, "메모")

    start = body.start_date
    end = body.end_date or start
    if end < start:
        raise bad_request("끝나는 날은 시작하는 날과 같거나 뒤여야 해요")
    check_in_period(start, end, period)

    has_time = body.kind in {"meeting", "etc"} and start == end  # 여러 날 일정은 시각 없이
    start_time = body.start_time if has_time else None
    end_time = body.end_time if has_time and start_time else None
    if end_time and end_time <= start_time:
        raise bad_request("끝나는 시각은 시작 시각보다 뒤여야 해요")

    assignee = body.assignee if body.kind == "work" else None
    if assignee is not None and assignee not in ASSIGNEES:
        raise bad_request("담당을 다시 골라 주세요")
    title = required_text(body.title, MAX_TITLE, "제목")
    place = optional_text(body.place, MAX_PLACE, "장소·링크")
    memo = optional_text(body.memo, MAX_MEMO, "메모")

    start = body.start_date
    end = body.end_date or start
    if end < start:
        raise bad_request("끝나는 날은 시작하는 날과 같거나 뒤여야 해요")
    check_in_period(start, end, period)

    has_time = body.kind in {"meeting", "etc"} and start == end  # 여러 날 일정은 시각 없이
    start_time = body.start_time if has_time else None
    end_time = body.end_time if has_time and start_time else None
    if end_time and end_time <= start_time:
        raise bad_request("끝나는 시각은 시작 시각보다 뒤여야 해요")

    assignee = body.assignee if body.kind == "work" else None
    if assignee is not None and assignee not in ASSIGNEES:
        raise bad_request("담당을 다시 골라 주세요")

    return {
        "kind": body.kind,
        "title": title,
        "start_date": start,
        "end_date": end,
        "start_time": start_time,
        "end_time": end_time,
        "place": place,
        "memo": memo,
        "assignee": assignee,
    }


def check_in_period(start: date, end: date, period: tuple[date, date]) -> None:
    """일정 날짜가 협업 기간 안인지 확인합니다."""
    first, last = period
    if start < first or end > last:
        raise bad_request(f"일정은 협업 기간({fmt(first)} ~ {fmt(last)}) 안에서만 잡을 수 있어요")


def weekly_dates(start: date, last: date) -> list[date]:
    """start 부터 7일마다, last(협업 종료일)까지의 날짜. 최대 MAX_REPEAT 번."""
    days = []
    day = start
    while day <= last and len(days) < MAX_REPEAT:
        days.append(day)
        day += timedelta(days=7)
    return days


def fmt(day: date) -> str:
    return f"{day.month}.{day.day}"