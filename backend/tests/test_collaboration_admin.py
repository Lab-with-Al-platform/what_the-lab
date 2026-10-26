"""협업 요청 집계는 가상 행으로만 확인합니다. 실제 요청 표는 열지 않습니다."""

from datetime import timedelta

import pytest

from app.main import app
from app.operations.collaboration import (
    REQUEST_SQL,
    MemoryCollaborationSource,
    RequestRow,
    build_collaboration_report,
)
from app.operations.periods import resolve_range
from app.routers.operations import get_collaboration_source
from tests.test_insight_workflow import client as client  # noqa: PLC0414
from tests.test_operations_admin import at, login_ops

PATH = "/api/v1/admin/operations/collaboration"
NOW = at("2026-10-26")


@pytest.fixture(autouse=True)
def clear_source():
    yield
    app.dependency_overrides.pop(get_collaboration_source, None)


def row(request_id: int, status: str, created: str) -> RequestRow:
    moment = at(created)
    return RequestRow(
        request_id=request_id,
        research_id=7,
        title="가상 연구",
        owner_nickname="연구자",
        expert_id=12,
        expert_nickname="전문가",
        status=status,
        created_at=moment,
        responded_at=moment + timedelta(days=1) if status != "pending" else None,
        started_at=moment + timedelta(days=2) if status == "started" else None,
        expires_at=moment + timedelta(days=7),
    )


def test_sql_does_not_read_messages():
    for word in ("message", "reply_message", "reject_text", "reject_reason", "discord_id", "description"):
        assert word not in REQUEST_SQL


def test_current_counts_are_not_a_success_rate_and_started_is_not_completion():
    rows = [row(1, "started", "2026-10-01"), row(2, "pending", "2026-10-26"), row(3, "pending", "2026-09-01")]
    start, end = resolve_range("today", today=NOW.date())
    body = build_collaboration_report(rows, table_ready=True, start=start, end=end, status="", page=1)
    started = next(item for item in body["counts"] if item["status"] == "started")
    pending = next(item for item in body["counts"] if item["status"] == "pending")
    assert started["value"] == 1
    assert started["label"] == "협업 시작"
    assert pending["value"] == 2
    assert body["created_in_period"]["value"] == 1
    assert body["created_in_period"]["comparison"]["previous"] == 0
    assert body["created_in_period"]["comparison"]["rate"] is None
    assert "success_rate" not in body
    assert body["missing"][2]["value"] is None
    assert body["items"][0]["status_label"] != "완료"
    filtered = build_collaboration_report(rows, table_ready=True, start=start, end=end, status="pending", page=1)
    assert filtered["total"] == 2
    assert next(item for item in filtered["counts"] if item["status"] == "started")["value"] == 1


def test_missing_table_does_not_become_zero_requests():
    start, end = resolve_range("7d", today=NOW.date())
    body = build_collaboration_report([], table_ready=False, start=start, end=end, status="", page=1)
    assert body["counts"][0]["value"] is None
    assert body["created_in_period"]["value"] is None
    assert body["items"] == []


def test_reader_gets_requests_without_message_fields(client, monkeypatch):
    monkeypatch.setenv("OPERATIONS_ADMIN_DISCORD_IDS", "300000000000000003")
    login_ops(client)
    app.dependency_overrides[get_collaboration_source] = lambda: MemoryCollaborationSource([row(9, "accepted", "2026-10-20")])
    response = client.get(PATH, params={"preset": "30d"})
    assert response.status_code == 200, response.text
    item = response.json()["items"][0]
    assert item["status_label"] == "전문가 수락"
    assert "message" not in item
    assert "reply_message" not in item
    unknown = client.get(PATH, params={"status": "completed"})
    assert unknown.status_code == 422
    client.cookies.clear()
    assert client.get(PATH).status_code == 401
