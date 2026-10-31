"""협업 상세의 요청 (DB 없이): 상대에게 보내지는지, 기한 규칙, 받은 사람만 완료·보낸 사람만 취소."""

from contextlib import contextmanager
from datetime import date

import pytest
from fastapi import BackgroundTasks, HTTPException

from app import workspace_rules as rules
from app.routers import workspace_tasks as tasks

RESEARCHER, EXPERT = 1, 2
TODAY = date(2026, 11, 5)
COLLAB = {"collaboration_id": 7, "status": "ongoing", "start_date": date(2026, 11, 3), "end_date": date(2026, 11, 30), "my_side": "researcher"}


class FakeCursor:
    """DB 대신: 실행한 SQL을 모으고, SELECT 에는 정해 둔 줄을 돌려줘요."""

    def __init__(self, task: dict | None = None, talk: dict | None = None) -> None:
        self.task = task
        self.talk = talk  # 답을 기다리는 기한 수정 요청 기록 (pending_talk 이 읽어요)
        self.sql: list[tuple[str, object]] = []

    def execute(self, sql: str, params=None) -> None:
        self.sql.append((sql, params))

    def fetchone(self) -> dict | None:
        last = self.sql[-1][0]
        if "RETURNING task_id" in last:
            return {"task_id": 11}
        if "FROM collaboration_task_event" in last:
            return self.talk
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
    return {
        "task_id": 3,
        "collaboration_id": 7,
        "requested_by": EXPERT,
        "assignee": RESEARCHER,
        "status": "open",
        "due_date": date(2026, 11, 10),
        **fields,
    }

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
    background = BackgroundTasks()
    result = tasks.add_task(7, rules.TaskInput(content="표 정리", due_date=TODAY), background=background, user_id=RESEARCHER)
    # 응답을 보낸 뒤 디스코드 채널 · 구글에 올리도록 예약돼요
    assert [(job.func, job.args) for job in background.tasks] == [(tasks.after_web_change, (11, "created"))]
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
        tasks.add_task(7, rules.TaskInput(content="표"), background=BackgroundTasks(), user_id=RESEARCHER)
    assert error.value.status_code == 409


# ---------- 완료 · 취소 ----------
def test_only_assignee_completes(monkeypatch):
    cursor = FakeCursor(open_task())
    use(monkeypatch, cursor)
    tasks.complete_task(3, background=BackgroundTasks(), user_id=RESEARCHER)  # 받은 사람
    assert any("status = 'done'" in sql for sql, _ in cursor.sql)
    with pytest.raises(HTTPException) as error:
        tasks.complete_task(3, background=BackgroundTasks(), user_id=EXPERT)  # 보낸 사람은 완료 못 해요
    assert error.value.status_code == 403


def test_only_requester_cancels(monkeypatch):
    cursor = FakeCursor(open_task())
    use(monkeypatch, cursor)
    tasks.cancel_task(3, background=BackgroundTasks(), user_id=EXPERT)  # 보낸 사람
    assert any("status = 'canceled'" in sql for sql, _ in cursor.sql)
    with pytest.raises(HTTPException) as error:
        tasks.cancel_task(3, background=BackgroundTasks(), user_id=RESEARCHER)
    assert error.value.status_code == 403


def test_closed_or_missing_task(monkeypatch):
    use(monkeypatch, FakeCursor(open_task(status="done")))
    with pytest.raises(HTTPException) as error:
        tasks.complete_task(3, background=BackgroundTasks(), user_id=RESEARCHER)
    assert error.value.status_code == 409
    use(monkeypatch, FakeCursor(None))
    with pytest.raises(HTTPException) as error:
        tasks.complete_task(99, background=BackgroundTasks(), user_id=RESEARCHER)
    assert error.value.status_code == 404




# ---------- 기한 변경 ----------
def test_requester_changes_due(monkeypatch):
    cursor = FakeCursor(open_task())
    use(monkeypatch, cursor)
    result = tasks.change_due(EXPERT, 3, date(2026, 11, 12))  # 보낸 사람
    assert result == {"collaboration_id": 7, "old_due": date(2026, 11, 10)}
    assert ("UPDATE collaboration_task SET due_date = %s WHERE task_id = %s", (date(2026, 11, 12), 3)) in cursor.sql


def test_requester_can_clear_due(monkeypatch):
    cursor = FakeCursor(open_task())
    use(monkeypatch, cursor)
    tasks.change_due(EXPERT, 3, None)  # 비우면 기한 없음
    assert ("UPDATE collaboration_task SET due_date = %s WHERE task_id = %s", (None, 3)) in cursor.sql


def test_only_requester_changes_due(monkeypatch):
    use(monkeypatch, FakeCursor(open_task()))
    with pytest.raises(HTTPException) as error:
        tasks.change_due(RESEARCHER, 3, date(2026, 11, 12))  # 받은 사람은 못 바꿔요
    assert error.value.status_code == 403


@pytest.mark.parametrize("due", [date(2026, 11, 4), date(2026, 12, 1)])  # 어제 / 종료일 다음 날
def test_change_due_checks_range(monkeypatch, due):
    use(monkeypatch, FakeCursor(open_task()))
    with pytest.raises(HTTPException) as error:
        tasks.change_due(EXPERT, 3, due)
    assert error.value.status_code == 400


# ---------- 되돌리기 ----------
@pytest.mark.parametrize(("status", "who"), [("done", RESEARCHER), ("canceled", EXPERT)])
def test_closer_reopens(monkeypatch, status, who):
    """완료는 받은 사람(RESEARCHER)이, 취소는 보낸 사람(EXPERT)이 되돌려요."""
    cursor = FakeCursor(open_task(status=status))
    use(monkeypatch, cursor)
    assert tasks.reopen_task(who, 3) == 7
    assert any("status = 'open', closed_at = NULL" in sql for sql, _ in cursor.sql)


@pytest.mark.parametrize(("status", "who"), [("done", EXPERT), ("canceled", RESEARCHER)])
def test_others_cannot_reopen(monkeypatch, status, who):
    use(monkeypatch, FakeCursor(open_task(status=status)))
    with pytest.raises(HTTPException) as error:
        tasks.reopen_task(who, 3)
    assert error.value.status_code == 403


def test_reopen_open_task_is_409(monkeypatch):
    use(monkeypatch, FakeCursor(open_task()))
    with pytest.raises(HTTPException) as error:
        tasks.reopen_task(EXPERT, 3)
    assert error.value.status_code == 409


def test_reopen_on_ended_collab_is_409(monkeypatch):
    use(monkeypatch, FakeCursor(open_task(status="done")), {**COLLAB, "status": "done"})
    with pytest.raises(HTTPException) as error:
        tasks.reopen_task(RESEARCHER, 3)
    assert error.value.status_code == 409



# ---------- 기록 (collaboration_task_event) ----------
def events(cursor: FakeCursor) -> list[tuple]:
    """저장한 기록 줄: (task_id, actor_id, kind, old_due, new_due, note, source)"""
    return [params for sql, params in cursor.sql if "INSERT INTO collaboration_task_event" in sql]


def test_every_action_leaves_event(monkeypatch):
    cursor = FakeCursor()
    use(monkeypatch, cursor)
    tasks.create_task(RESEARCHER, 7, rules.TaskInput(content="표", due_date=TODAY), source="discord")
    assert events(cursor) == [(11, RESEARCHER, "created", None, TODAY, None, "discord")]

    cursor = FakeCursor(open_task())
    use(monkeypatch, cursor)
    tasks.close_task(RESEARCHER, 3, "done")
    tasks.change_due(EXPERT, 3, date(2026, 11, 12), source="discord")
    assert events(cursor) == [
        (3, RESEARCHER, "done", None, None, None, "web"),
        (3, EXPERT, "due", date(2026, 11, 10), date(2026, 11, 12), None, "discord"),  # 누가 · 전 → 후
    ]


def test_same_due_is_not_saved_or_logged(monkeypatch):
    cursor = FakeCursor(open_task())
    use(monkeypatch, cursor)
    tasks.change_due(EXPERT, 3, date(2026, 11, 10))  # 그대로
    assert events(cursor) == [] and not any(sql.startswith("UPDATE") for sql, _ in cursor.sql)


# ---------- 기한 얘기하기 (받은 사람) ----------
def test_receiver_talks_due_without_changing_task(monkeypatch):
    cursor = FakeCursor(open_task())
    use(monkeypatch, cursor)
    background = BackgroundTasks()
    tasks.talk_task_due(3, rules.TalkInput(due_date=date(2026, 11, 14), note="  사진까지 보려면 더 걸려요 "), background=background, user_id=RESEARCHER)
    assert events(cursor) == [(3, RESEARCHER, "due_talk", date(2026, 11, 10), date(2026, 11, 14), "사진까지 보려면 더 걸려요", "web")]
    assert not any(sql.startswith("UPDATE") for sql, _ in cursor.sql)  # 기한 · 상태는 그대로
    assert [(job.func, job.args) for job in background.tasks] == [(tasks.after_web_change, (3, "due_talk"))]


def test_talk_without_date_means_hard(monkeypatch):
    cursor = FakeCursor(open_task())
    use(monkeypatch, cursor)
    tasks.talk_due(RESEARCHER, 3, rules.TalkInput(note="이번 주는 어려워요"))
    assert events(cursor)[0][4] is None


@pytest.mark.parametrize(
    ("task", "who", "body", "code"),
    [
        (open_task(), EXPERT, rules.TalkInput(note="x"), 403),  # 보낸 사람은 못 해요
        (open_task(status="done"), RESEARCHER, rules.TalkInput(note="x"), 409),  # 끝난 요청
        (open_task(), RESEARCHER, rules.TalkInput(note="  "), 400),  # 이유 필수
        (open_task(), RESEARCHER, rules.TalkInput(note="x", due_date=date(2026, 12, 1)), 400),  # 종료일 뒤
    ],
)
def test_talk_rules(monkeypatch, task, who, body, code):
    use(monkeypatch, FakeCursor(task))
    with pytest.raises(HTTPException) as error:
        tasks.talk_due(who, 3, body)
    assert error.value.status_code == code


# ---------- 다시 요청 (보낸 사람) ----------
def test_requester_returns_done_task(monkeypatch):
    cursor = FakeCursor(open_task(status="done"))
    use(monkeypatch, cursor)
    background = BackgroundTasks()
    tasks.return_done_task(3, rules.ReturnInput(note="축 단위가 빠졌어요"), background=background, user_id=EXPERT)
    assert ("UPDATE collaboration_task SET status = 'open', closed_at = NULL, due_date = %s WHERE task_id = %s", (date(2026, 11, 10), 3)) in cursor.sql
    assert events(cursor) == [(3, EXPERT, "returned", date(2026, 11, 10), date(2026, 11, 10), "축 단위가 빠졌어요", "web")]
    assert [(job.func, job.args) for job in background.tasks] == [(tasks.after_web_change, (3, "returned"))]


def test_return_with_new_due(monkeypatch):
    cursor = FakeCursor(open_task(status="done", due_date=date(2026, 11, 4)))  # 원래 기한이 지남
    use(monkeypatch, cursor)
    result = tasks.return_task(EXPERT, 3, rules.ReturnInput(note="다시", due_date=date(2026, 11, 20)))
    assert result == {"collaboration_id": 7, "old_due": date(2026, 11, 4)}
    assert events(cursor)[0][3:5] == (date(2026, 11, 4), date(2026, 11, 20))


@pytest.mark.parametrize(
    ("task", "who", "body", "code"),
    [
        (open_task(status="done"), RESEARCHER, rules.ReturnInput(note="x"), 403),  # 받은 사람은 [되돌리기]
        (open_task(), EXPERT, rules.ReturnInput(note="x"), 409),  # 진행 중인 요청
        (open_task(status="canceled"), EXPERT, rules.ReturnInput(note="x"), 409),  # 취소는 [되돌리기]
        (open_task(status="done"), EXPERT, rules.ReturnInput(note=" "), 400),  # 이유 필수
        (open_task(status="done", due_date=date(2026, 11, 4)), EXPERT, rules.ReturnInput(note="x"), 400),  # 기한 지남 → 새 기한 필수
    ],
)
def test_return_rules(monkeypatch, task, who, body, code):
    use(monkeypatch, FakeCursor(task))
    with pytest.raises(HTTPException) as error:
        tasks.return_task(who, 3, body)
    assert error.value.status_code == code



# ---------- 상대에게 종 알림 (기록과 같은 트랜잭션) ----------
def notices(cursor: FakeCursor) -> list[dict]:
    return [params for sql, params in cursor.sql if "INSERT INTO notification" in sql]


def test_every_event_notifies_partner(monkeypatch):
    cursor = FakeCursor(open_task())
    use(monkeypatch, cursor)
    tasks.close_task(RESEARCHER, 3, "done")
    tasks.change_due(EXPERT, 3, date(2026, 11, 12))
    assert [(n["type"], n["actor"], n["task"]) for n in notices(cursor)] == [
        ("task_done", RESEARCHER, 3),  # 받은 사람이 완료 → (SQL이) 보낸 사람에게
        ("task_due", EXPERT, 3),
    ]


# ---------- 지금 기한 유지 (보낸 사람) ----------
TALK = {"kind": "due_talk", "old_due": date(2026, 11, 10), "new_due": date(2026, 11, 14), "note": "더 걸려요"}


def test_requester_keeps_due(monkeypatch):
    cursor = FakeCursor(open_task(), talk=TALK)
    use(monkeypatch, cursor)
    background = BackgroundTasks()
    tasks.keep_task_due(3, rules.KeepInput(note=" 회의 전에 필요해요 "), background=background, user_id=EXPERT)
    assert events(cursor) == [(3, EXPERT, "due_kept", date(2026, 11, 10), date(2026, 11, 10), "회의 전에 필요해요", "web")]
    assert not any(sql.startswith("UPDATE") for sql, _ in cursor.sql)  # 기한 · 상태 그대로
    assert notices(cursor)[0]["type"] == "task_due_kept"
    assert [(job.func, job.args) for job in background.tasks] == [(tasks.after_web_change, (3, "due_kept"))]


def test_keep_due_reason_is_optional(monkeypatch):
    cursor = FakeCursor(open_task(), talk=TALK)
    use(monkeypatch, cursor)
    tasks.keep_due(EXPERT, 3, rules.KeepInput(), source="discord")
    assert events(cursor)[0][5:] == (None, "discord")


@pytest.mark.parametrize(
    ("task", "talk", "who", "code"),
    [
        (open_task(), TALK, RESEARCHER, 403),  # 받은 사람은 못 해요
        (open_task(), None, EXPERT, 409),  # 답을 기다리는 기한 수정 요청이 없어요
        (open_task(), {**TALK, "kind": "due"}, EXPERT, 409),  # 이미 기한을 바꿨어요
        (open_task(status="done"), TALK, EXPERT, 409),  # 끝난 요청
    ],
)
def test_keep_due_rules(monkeypatch, task, talk, who, code):
    use(monkeypatch, FakeCursor(task, talk=talk))
    with pytest.raises(HTTPException) as error:
        tasks.keep_due(who, 3, rules.KeepInput())
    assert error.value.status_code == code