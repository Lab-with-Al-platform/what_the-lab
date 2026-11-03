"""협업 상세 (DB 없이): 보는 사람 기준으로 나·상대, 받은·보낸 요청, 내 결정, 답 기다리는 기간 변경 요청이 맞게 나뉘는지."""

from datetime import date

import pytest

from app import workspace_detail as detail
from app.routers import workspace

RESEARCHER, EXPERT = 1, 2

ROW = {
    "collaboration_id": 7,
    "status": "ongoing",
    "start_date": date(2026, 10, 13),
    "end_date": date(2026, 12, 31),
    "agreement": {"title": "세포 수 세기", "field_ids": ["FIELD011"]},
    "confirmed_on": date(2026, 10, 12),
    "discord_status": "ready",
    "discord_channel_id": "123",
    "google_calendar_id": "cal@group",
    "researcher_google": True,
    "expert_google": False,
    "ended_at": None,
    "end_reason": None,
    "ended_by_nickname": None,
    "today": date(2026, 10, 20),
    "r_id": RESEARCHER, "r_nickname": "jiwoo_lab", "r_photo": None,
    "r_institution": "OO대학교", "r_department": "생명과학과", "r_position": "석사과정",
    "e_id": EXPERT, "e_nickname": "cellvision_han", "e_photo": None,
    "e_job": "researcher", "e_career": "3_5", "e_affiliation": None, "e_introduce": "세포 이미지 분석",
}
TASKS = [
    {"task_id": 1, "requested_by": EXPERT, "assignee": RESEARCHER, "content": "사진 50장", "status": "open"},
    {"task_id": 2, "requested_by": RESEARCHER, "assignee": EXPERT, "content": "정확도 표", "status": "open"},
]
DECISIONS = [{"decision_id": 1, "proposed_by": RESEARCHER, "content": "F1으로 본다", "status": "agreed"}]


def change(**fields) -> dict:
    base = {"change_id": 1, "kind": "extend", "requested_by": EXPERT, "status": "pending", "overdue": False,
            "old_end_date": date(2026, 12, 31), "new_end_date": date(2027, 1, 16)}
    return {**base, **fields}


@pytest.fixture(autouse=True)
def no_google(monkeypatch):
    monkeypatch.setattr(detail, "google_login_ready", lambda: False)
    monkeypatch.setattr(detail, "channel_url", lambda channel_id: f"discord/{channel_id}")
    monkeypatch.setattr(detail, "add_calendar_url", lambda calendar_id: f"google/{calendar_id}")


def build(side: str, user_id: int, changes: list | None = None) -> dict:
    return detail.build_detail(ROW, side, user_id, schedules=[], tasks=TASKS, decisions=DECISIONS, changes=changes or [])


def test_researcher_sees_expert_as_partner():
    collab = build("researcher", RESEARCHER)["collaboration"]
    assert collab["me"]["nickname"] == "jiwoo_lab" and collab["partner"]["nickname"] == "cellvision_han"
    assert collab["partner"]["role"] == "expert" and collab["partner"]["introduce"] == "세포 이미지 분석"
    assert collab["status"] == "active"  # 시작일(10.13)이 지났으니 진행 중
    assert collab["discord_channel_url"] == "discord/123"
    assert collab["google_linked"] is True and collab["google_calendar_url"] == "google/cal@group"


def test_expert_sees_researcher_and_own_google_state():
    collab = build("expert", EXPERT)["collaboration"]
    assert collab["partner"]["nickname"] == "jiwoo_lab" and collab["partner"]["department"] == "생명과학과"
    assert collab["google_linked"] is False and collab["google_calendar_url"] is None  # 전문가는 아직 연결 안 함


def test_tasks_split_into_received_and_sent():
    researcher = {task["task_id"]: task["direction"] for task in build("researcher", RESEARCHER)["tasks"]}
    expert = {task["task_id"]: task["direction"] for task in build("expert", EXPERT)["tasks"]}
    assert researcher == {1: "in", 2: "out"}
    assert expert == {1: "out", 2: "in"}


def test_decision_mine_flag():
    assert build("researcher", RESEARCHER)["decisions"][0]["mine"] is True
    assert build("expert", EXPERT)["decisions"][0]["mine"] is False


def test_pending_change_for_each_side():
    assert build("researcher", RESEARCHER, [change()])["pending_change"]["mine"] is False  # 상대가 보냄 → [수락]
    assert build("expert", EXPERT, [change()])["pending_change"]["mine"] is True  # 내가 보냄 → [철회]


def test_overdue_or_answered_change_is_not_pending():
    assert build("researcher", RESEARCHER, [change(overdue=True)])["pending_change"] is None
    accepted = build("researcher", RESEARCHER, [change(status="accepted")])
    assert accepted["pending_change"] is None
    assert [item["change_id"] for item in accepted["extensions"]] == [1]  # 기간이 바뀐 기록


def test_detail_route_is_registered(monkeypatch):
    monkeypatch.setattr(workspace, "load_detail", lambda user_id, collaboration_id: {"id": collaboration_id, "user": user_id})
    assert workspace.get_collaboration_detail(7, user_id=RESEARCHER) == {"id": 7, "user": RESEARCHER}
    paths = {route.path for route in workspace.router.routes}
    assert "/api/v1/workspace/{collaboration_id}" in paths



def event(event_id, kind, **fields):
    return {"event_id": event_id, "task_id": 1, "kind": kind, "old_due": None, "new_due": None, "note": None, **fields}


@pytest.mark.parametrize(
    ("status", "kinds", "talk", "returned"),
    [
        ("open", ["created", "due_talk"], 2, None),  # 기한 얘기 → 보낸 사람 답 기다림
        ("open", ["created", "due_talk", "due"], None, None),  # 기한을 바꾸면 끝
        ("open", ["created", "done", "returned"], None, 3),  # 다시 요청됨
        ("open", ["created", "done", "returned", "due_talk"], 4, 3),  # 둘 다
        ("done", ["created", "due_talk", "done"], None, None),  # 끝난 요청은 표시 없음
        ("open", ["created", "done", "returned", "done", "reopened"], None, None),  # 다시 완료 후 되돌림
    ],
)
def test_task_marks(status, kinds, talk, returned):
    events = [event(number, kind) for number, kind in enumerate(kinds, start=1)]
    marks = detail.task_marks({"status": status}, events)
    assert (marks["talk"] or {}).get("event_id") == talk
    assert (marks["returned"] or {}).get("event_id") == returned