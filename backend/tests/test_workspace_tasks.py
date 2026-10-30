"""협업 상세의 요청 (DB 없이): 상대에게 보내지는지, 기한 규칙, 받은 사람만 완료·보낸 사람만 취소."""

from contextlib import contextmanager
from datetime import date

import pytest
from fastapi import HTTPException

from app import workspace_rules as rules
from app.routers import workspace_tasks as tasks

RESEARCHER, EXPERT = 1, 2
TODAY = date(2026, 11, 5)
COLLAB = {"collaboration_id": 7, "status": "ongoing", "start_date": date(2026, 11, 3), "end_date": date(2026, 11, 30), "my_side": "researcher"}


class FakeCursor:
    """DB 대신: 실행한 SQL을 모으고, SELECT 에는 정해 둔 줄을 돌려줘요."""

    def __init__(self, task: dict | None = None) -> None:
        self.task = task
        self.sql: list[tuple[str, object]] = []

    def execute(self, sql: str, params=None) -> None:
        self.sql.append((sql, params))

    def fetchone(self) -> dict | None:
        last = self.sql[-1][0]
        if "RETURNING task_id" in last:
            return {"task_id": 11}
        if "FROM collaboration_task" in last:
            return self.task
        return {"researcher_id": RESEARCHER, "expert_id": EXPERT}  # partner_id


def use(monkeypatch, cursor: FakeCursor, collab: dict = COLLAB) -> None:
    @contextmanager
    def fake_transaction():
        yield cursor

    monkeypatch.setattr(tasks, "transaction", fake_transaction)
    monkeypatch.setattr(tasks, "find_collaboration", lambda *args, **kwargs: collab)
    monkeypatch.setattr(tasks, "load_detail", lambda user_id, collaboration_id: {"user": user_id, "collab": collaboration_id})
    monkeypatch.setattr(tasks, "today_kst", lambda: TODAY)


def open_task(**fields) -> dict:
    return {"task_id": 3, "collaboration_id": 7, "requested_by": EXPERT, "assignee": RESEARCHER, "status": "open", **fields}


# ---------- 입력 규칙 ----------
def test_clean_task_trims_and_allows_no_due():
    assert rules.clean_task(rules.TaskInput(content="  표 정리  "), (COLLAB["start_date"], COLLAB["end_date"]), TODAY) == {
        "content": "표 정리",
        "due_date": None,
    }


@pytest.mark.parametrize("due", [date(2026, 11, 4), date(2026, 12, 1)])  # 어제 / 종료일 다음 날
def test_clean_task_rejects_due_outside(due):
    with pytest.raises(HTTPException) as error:
        rules.clean_task(rules.TaskInput(content="표", due_date=due), (COLLAB["start_date"], COLLAB["end_date"]), TODAY)
    assert error.value.status_code == 400


def test_clean_task_requires_content():
    with pytest.raises(HTTPException):
        rules.clean_task(rules.TaskInput(content="   "), (COLLAB["start_date"], COLLAB["end_date"]), TODAY)


# ---------- 남기기 ----------
def test_add_task_goes_to_partner(monkeypatch):
    cursor = FakeCursor()
    use(monkeypatch, cursor)
    result = tasks.add_task(7, rules.TaskInput(content="표 정리", due_date=TODAY), user_id=RESEARCHER)
    saved = next(params for sql, params in cursor.sql if "INSERT INTO collaboration_task" in sql)
    assert saved["requested_by"] == RESEARCHER and saved["assignee"] == EXPERT  # 연구회원 → 전문가
    assert saved["source"] == "web"
    assert result == {"user": RESEARCHER, "collab": 7}


def test_create_task_from_discord(monkeypatch):
    cursor = FakeCursor()
    use(monkeypatch, cursor)
    assert tasks.create_task(EXPERT, 7, rules.TaskInput(content="데이터 폴더 공유"), source="discord") == 11  # 새 요청 번호
    saved = next(params for sql, params in cursor.sql if "INSERT INTO collaboration_task" in sql)
    assert saved["source"] == "discord" and saved["assignee"] == EXPERT  # FakeCursor 의 partner_id 는 늘 같은 줄을 돌려줘요

def test_add_task_on_ended_collab_is_409(monkeypatch):
    use(monkeypatch, FakeCursor(), {**COLLAB, "status": "done"})
    with pytest.raises(HTTPException) as error:
        tasks.add_task(7, rules.TaskInput(content="표"), user_id=RESEARCHER)
    assert error.value.status_code == 409


# ---------- 완료 · 취소 ----------
def test_only_assignee_completes(monkeypatch):
    cursor = FakeCursor(open_task())
    use(monkeypatch, cursor)
    tasks.complete_task(3, user_id=RESEARCHER)  # 받은 사람
    assert any("status = 'done'" in sql for sql, _ in cursor.sql)
    with pytest.raises(HTTPException) as error:
        tasks.complete_task(3, user_id=EXPERT)  # 보낸 사람은 완료 못 해요
    assert error.value.status_code == 403


def test_only_requester_cancels(monkeypatch):
    cursor = FakeCursor(open_task())
    use(monkeypatch, cursor)
    tasks.cancel_task(3, user_id=EXPERT)  # 보낸 사람
    assert any("status = 'canceled'" in sql for sql, _ in cursor.sql)
    with pytest.raises(HTTPException) as error:
        tasks.cancel_task(3, user_id=RESEARCHER)
    assert error.value.status_code == 403


def test_closed_or_missing_task(monkeypatch):
    use(monkeypatch, FakeCursor(open_task(status="done")))
    with pytest.raises(HTTPException) as error:
        tasks.complete_task(3, user_id=RESEARCHER)
    assert error.value.status_code == 409
    use(monkeypatch, FakeCursor(None))
    with pytest.raises(HTTPException) as error:
        tasks.complete_task(99, user_id=RESEARCHER)
    assert error.value.status_code == 404