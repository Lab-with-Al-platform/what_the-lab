"""develop 일정·알림 + Feature 평가·검색 통합 회귀 계약.

공용 DB 없이 안전하게 실행할 수 있는 테스트만 포함합니다.
"""
import re
from pathlib import Path

from app import notification_sender, notification_store, workspace_store

ROOT = Path(__file__).resolve().parents[2]


def test_review_notification_classification_and_link():
    assert "review_ready" in notification_store.TO_BOTH
    assert "review_ready" in notification_store.WORKSPACE_TYPES
    assert notification_store.notice_link({
        "type": "review_ready", "collaboration_id": 100, "task_id": None
    }) == "/workspace/100#review"
    assert notification_store.notice_link({
        "type": "task_done", "collaboration_id": 100, "task_id": 77
    }) == "/workspace/100#task-77"
    assert notification_store.notice_link({
        "type": "request_accepted", "collaboration_id": None, "task_id": None
    }) == "/requests"


def test_review_dm_points_to_review_not_requests():
    row = {
        "type": "review_ready", "user_id": 10, "expert_id": 20,
        "actor_nickname": "tester", "research_title": "예시 연구",
        "collaboration_id": 400,
    }
    message = notification_sender.dm_text(row)
    assert "/workspace/400#review" in message
    assert "/requests" not in message


class CompletionCursor:
    def __init__(self, rows):
        self.rows = rows
        self.queries = []

    def execute(self, sql, params=()):
        self.queries.append((str(sql), params))

    def fetchall(self):
        return self.rows


def test_completion_updates_task_events_and_reviews_in_one_flow(monkeypatch):
    calls = []
    monkeypatch.setattr(
        workspace_store, "notify_requests",
        lambda cursor, kind, ids: calls.append((kind, ids)),
    )
    completed = CompletionCursor([
        {"request_id": 10, "collaboration_id": 101},
        {"request_id": 20, "collaboration_id": 201},
    ])
    workspace_store.complete_ended_collaborations(completed)
    assert len(completed.queries) == 2
    assert "RETURNING request_id, collaboration_id" in completed.queries[0][0]
    assert "INSERT INTO collaboration_task_event" in completed.queries[1][0]
    assert completed.queries[1][1] == ([101, 201],)
    assert calls == [("review_ready", [10, 20])]
    untouched = CompletionCursor([])
    workspace_store.complete_ended_collaborations(untouched)
    assert len(untouched.queries) == 1
    assert calls == [("review_ready", [10, 20])]


def test_review_and_workspace_alerts_keep_separate_templates():
    review = notification_store.build_message({
        "type": "review_ready", "actor_nickname": "tester",
        "research_title": "연구", "expert_id": 20,
    }, 10)
    assert "평가 작성하기" in review[0]
    assert "30일" in review[1]
    assert "task_created" in notification_store.WORKSPACE_TYPES
    assert "schedule_created" in notification_store.SCHEDULE_TYPES


def test_unique_linear_migrations_after_develop():
    versions = ROOT / "backend/migrations/versions"
    found = {}
    for migration in versions.glob("*.py"):
        text = migration.read_text(encoding="utf-8")
        match = re.search(r'^revision\s*=\s*["\']([^"\']+)', text, re.MULTILINE)
        if match:
            number = match.group(1)
            assert number not in found, (number, found.get(number), migration)
            found[number] = migration.name
    assert found["20261031_21"].endswith("task_events.py")
    assert found["20261031_22"].endswith("task_notifications.py")
    assert found["20261101_23"].endswith("schedule_notifications.py")
    assert found["20261103_24"].endswith("collaboration_reviews.py")
    review = (versions / found["20261103_24"]).read_text(encoding="utf-8")
    assert 'down_revision = "20261101_23"' in review


def test_review_sql_keeps_every_develop_notification_type():
    sql = (ROOT / "backend/migrations/sql/20261103_24/001_create_collaboration_reviews.sql").read_text(encoding="utf-8")
    for event in (
        "review_ready", "request_withdrawn", "task_created", "task_due_kept",
        "task_due_soon", "collab_ending", "schedule_created",
        "schedule_changed", "schedule_tomorrow", "schedule_ending",
    ):
        assert "'" + event + "'" in sql
    assert "ENABLE ROW LEVEL SECURITY" in sql
    init = (ROOT / "database/init/028_create_collaboration_reviews.sql").read_text(encoding="utf-8")
    assert "20261101_23" in init and "20261103_24" in init


def test_frontend_keeps_develop_calendar_and_feature_reviews():
    home = (ROOT / "frontend/src/components/workspace-home.tsx").read_text(encoding="utf-8")
    assert "GOOGLE_CALENDAR_HOME" in home
    assert "google_enabled" in home
    assert "협업 평가하기" in home
    assert "#review" in home
    detail = (ROOT / "frontend/src/components/workspace-detail-page.tsx").read_text(encoding="utf-8")
    assert "CollaborationReviewCard" in detail
    assert "review" in detail
