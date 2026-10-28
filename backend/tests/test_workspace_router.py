"""협업 공간 일정 API (DB 없이): 추가·수정이 같은 기간(확정한 날 ~ 종료일)을 쓰는지."""

from contextlib import contextmanager
from datetime import date

import pytest
from fastapi import HTTPException

from app import workspace_rules as rules
from app.routers import workspace

# 11.3 시작 협업을 10.28 에 확정했어요. 그래서 10.28 ~ 11.30 에 일정을 잡을 수 있어요.
COLLAB = {
    "collaboration_id": 7,
    "status": "ongoing",
    "start_date": date(2026, 11, 3),
    "end_date": date(2026, 11, 30),
    "confirmed_on": date(2026, 10, 28),
}


class FakeCursor:
    """DB 대신 실행한 SQL 값만 모아 두는 가짜 커서."""

    def __init__(self) -> None:
        self.saved: list[dict] = []

    def execute(self, sql: str, params=None) -> None:
        if isinstance(params, dict):
            self.saved.append(params)

    def fetchone(self) -> dict:
        return {"schedule_id": 1, "collaboration_id": COLLAB["collaboration_id"]}


@pytest.fixture
def cursor(monkeypatch) -> FakeCursor:
    fake = FakeCursor()

    @contextmanager
    def fake_transaction():
        yield fake

    monkeypatch.setattr(workspace, "transaction", fake_transaction)
    monkeypatch.setattr(workspace, "find_collaboration", lambda *args, **kwargs: COLLAB)
    monkeypatch.setattr(workspace, "load_workspace", lambda user_id: {"ok": True})
    return fake


def make(start: date) -> rules.ScheduleInput:
    return rules.ScheduleInput(kind="meeting", title="사전 미팅", start_date=start)


def test_add_allows_meeting_before_start(cursor):
    workspace.add_schedule(COLLAB["collaboration_id"], make(date(2026, 10, 30)), user_id=1)
    assert cursor.saved[0]["start_date"] == date(2026, 10, 30)  # 시작 전 사전 미팅


def test_update_allows_meeting_before_start(cursor):
    workspace.update_schedule(1, make(date(2026, 10, 30)), user_id=1)
    assert cursor.saved[0]["start_date"] == date(2026, 10, 30)


@pytest.mark.parametrize(
    "call",
    [
        lambda body: workspace.add_schedule(COLLAB["collaboration_id"], body, user_id=1),
        lambda body: workspace.update_schedule(1, body, user_id=1),
    ],
)
def test_rejects_day_before_confirmed(cursor, call):
    with pytest.raises(HTTPException) as error:
        call(make(date(2026, 10, 27)))  # 확정 전 날짜
    assert error.value.status_code == 400
