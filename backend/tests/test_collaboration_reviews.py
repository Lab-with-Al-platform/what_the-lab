"""Completion-gated review unit contracts (no real DB needed)."""
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app import review_store
from app.routers import reviews
from app.workspace_store import complete_ended_collaborations

NOW = datetime(2026, 11, 20, 8, 0, tzinfo=UTC)


def project(status="done", ended_at=None):
    return {
        "collaboration_id": 47,
        "status": status,
        "ended_at": ended_at if ended_at is not None else NOW - timedelta(days=1),
        "researcher_id": 10,
        "expert_id": 20,
        "researcher_name": "연구회원",
        "expert_name": "AI 전문가",
        "research_title": "비공개 연구",
    }


@pytest.mark.parametrize("status,can_submit", [
    ("done",True),("ended_early",True),("ongoing",False),("canceled",False),
])
def test_only_end_state_qualifies(status,can_submit):
    row = project(status)
    assert review_store.review_window(row,10,NOW)["eligible"] is can_submit
    assert review_store.review_window(row,20,NOW)["eligible"] is can_submit


def test_review_window_is_strictly_bounded_to_thirty_days():
    row = project(ended_at=NOW-timedelta(days=30))
    assert review_store.review_window(row,10,NOW)["eligible"] is True
    assert review_store.review_window(row,10,NOW+timedelta(seconds=1))["eligible"] is False


def test_unauthorized_participant_has_indistinguishable_not_found():
    with pytest.raises(HTTPException) as error:
        review_store.review_window(project(),12345,NOW)
    assert error.value.status_code == 404


def test_rater_and_target_come_from_project_not_client():
    p=project()
    assert review_store.review_window(p,10,NOW)["side"] == "researcher"
    assert review_store.review_window(p,20,NOW)["side"] == "expert"


@pytest.mark.parametrize("key",[ "expertise","communication","timeliness","quality"])
def test_each_dimension_must_be_between_one_and_five(key):
    valid={"expertise":4,"communication":5,"timeliness":3,"quality":4,"comment":""}
    assert getattr(reviews.ReviewBody(**valid),key)==valid[key]
    for wrong in [0,6,-1]:
        with pytest.raises(ValidationError):
            reviews.ReviewBody(**{**valid,key:wrong})


def test_comment_is_trimmed_and_bounded():
    assert review_store.clean_comment("  덕분에 잘 마쳤어요  ")=="덕분에 잘 마쳤어요"
    with pytest.raises(HTTPException) as error:
        review_store.clean_comment("x"*501)
    assert error.value.status_code==422


def test_moderator_uses_admin_write_flag_not_operations_read_role():
    with pytest.raises(HTTPException) as error:
        reviews.require_review_moderator({"user_id":7,"is_admin":False,"discord_id":"one"})
    assert error.value.status_code==403
    assert reviews.require_review_moderator({"user_id":7,"is_admin":True})["user_id"]==7


class InsertCursor:
    def __init__(self, duplicate=False):
        self.duplicate=duplicate
        self.calls=[]
        self.last=""
        self.returned=False

    def execute(self,sql,params=()):
        self.last=str(sql)
        self.calls.append((self.last,params))

    def fetchone(self):
        if "SELECT c.collaboration_id" in self.last:
            return project()
        if "INSERT INTO collaboration_review" in self.last:
            return None if self.duplicate else {"review_id":12}
        if "SELECT review_id,collaboration_id" in self.last:
            return None
        return None

    def fetchall(self):
        return []


@contextmanager
def fake_transaction(cursor):
    yield cursor


def test_review_submission_enforces_unique_conflict_and_no_fake_users(monkeypatch):
    cursor=InsertCursor(duplicate=True)
    monkeypatch.setattr(review_store,"transaction",lambda:fake_transaction(cursor))
    monkeypatch.setattr(review_store,"complete_ended_collaborations",lambda _cursor:None)
    body={"expertise":4,"communication":5,"timeliness":3,"quality":4,"comment":"좋아요"}
    with pytest.raises(HTTPException) as error:
        review_store.submit_review(10,47,body)
    assert error.value.status_code==409
    sql,params=next((sql,p) for sql,p in cursor.calls if "INSERT INTO collaboration_review" in sql)
    assert "ON CONFLICT (collaboration_id,reviewer_id) DO NOTHING" in sql
    assert params[1:4] == (10,20,"researcher")


class CompletionCursor:
    def execute(self,sql,params=()):
        self.sql=sql

    def fetchall(self):
        return [{"request_id":9},{"request_id":11}]


def test_completion_emits_review_reminder_once_for_updated_rows(monkeypatch):
    from app import workspace_store
    cursor=CompletionCursor()
    calls=[]
    monkeypatch.setattr(workspace_store,"notify_requests",lambda cursor,kind,ids:calls.append((kind,ids)))
    workspace_store.complete_ended_collaborations(cursor)
    assert "WHERE status = 'ongoing'" in cursor.sql
    assert "RETURNING request_id" in cursor.sql
    assert calls == [("review_ready",[9,11])]


def test_review_publication_checks_7_day_hold_and_completed_only():
    import inspect
    source=inspect.getsource(review_store.public_expert_reviews)
    assert "c.status='done'" in source
    assert "interval '7 days'" in source
    assert "visibility='visible'" in source
    assert "reviewer_side='researcher'" in source
    assert '"author": "협업 연구회원"' in source


def test_migration_has_rls_and_duplicate_constraints():
    from pathlib import Path
    sql=Path(__file__).resolve().parents[1]/"migrations/sql/20261031_21/001_create_collaboration_reviews.sql"
    text=sql.read_text(encoding="utf-8")
    assert "uq_review_collaboration_side" in text
    assert "uq_review_collaboration_reviewer" in text
    assert "ENABLE ROW LEVEL SECURITY" in text
    assert "REVOKE ALL ON public.collaboration_review" in text
    assert "ck_notification_type" in text
    assert "review_ready" in text


def test_report_has_one_per_author_and_moderation_does_not_auto_hide():
    import inspect
    source=inspect.getsource(review_store.report_review)
    assert "ON CONFLICT (review_id,reporter_id) DO NOTHING" in source
    assert "UPDATE collaboration_review SET visibility" not in source
