"""방문 통계는 가상 사건으로만 확인합니다. 실제 분석 표는 열지 않습니다."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.analytics.collect import AnalyticsEvent
from app.analytics.read import MemoryAnalyticsSource
from app.analytics.report import build_analytics_report
from app.main import app
from app.operations.periods import resolve_range
from app.routers.operations import get_analytics_source
from tests.test_insight_workflow import client as client  # noqa: PLC0414
from tests.test_operations_admin import login_ops

PATH = "/api/v1/admin/operations/analytics"
NOW = datetime(2026, 10, 8, 3, tzinfo=UTC)


@pytest.fixture(autouse=True)
def clear_source():
    yield
    app.dependency_overrides.pop(get_analytics_source, None)


def page(event_id: str, when: datetime, session_id: str, target: str = "home") -> AnalyticsEvent:
    return AnalyticsEvent(event_id, "page_view", target, session_id=session_id, received_at=when)


def test_period_sessions_are_not_the_sum_of_daily_sessions():
    session_id = str(uuid4())
    events = [
        page("day-1", NOW, session_id, "home"),
        page("day-2", NOW + timedelta(days=1), session_id, "cases"),
    ]
    start, end = resolve_range("custom", start=NOW.date(), end=(NOW + timedelta(days=7)).date(), today=NOW.date())
    daily = build_analytics_report(
        events, enabled=True, table_ready=True, start=start, end=end, now=NOW, started_at=NOW, grain="day"
    )
    week = build_analytics_report(
        events, enabled=True, table_ready=True, start=start, end=end, now=NOW, started_at=NOW, grain="week"
    )
    assert daily["visits"]["sessions"]["value"] == 1
    assert daily["visits"]["page_views"]["value"] == 2
    assert sum(point["sessions"] for point in daily["visits"]["series"]) == 2
    filled = [point for point in week["visits"]["series"] if point["page_views"]]
    assert filled[0]["sessions"] == 1
    assert filled[0]["page_views"] == 2
    assert daily["visits"]["visitors"]["value"] is None
    assert daily["visits"]["device"]["value"] is None
    assert daily["articles"] == []


def test_registration_modes_stay_separate_and_open_windows_are_not_finished():
    old = NOW - timedelta(hours=30)
    fresh = NOW - timedelta(hours=2)
    draft_at = NOW - timedelta(days=8)
    events = [
        AnalyticsEvent("open-old", "registration_open", "research", attempt_id="old", mode="create", received_at=old),
        AnalyticsEvent("step-old", "registration_step", "data", attempt_id="old", mode="create", received_at=old),
        AnalyticsEvent("close-old", "registration_close", "data", attempt_id="old", mode="create", reason_code="later", received_at=old),
        AnalyticsEvent("fail-old", "registration_validation_failed", "research", attempt_id="old", mode="create", result_code="title_required", received_at=old),
        AnalyticsEvent("open-new", "registration_open", "research", attempt_id="new", mode="create", received_at=fresh),
        AnalyticsEvent("open-edit", "registration_open", "research", attempt_id="edit", mode="edit", received_at=old),
        AnalyticsEvent("save-draft", "registration_save", "research", attempt_id="draft", mode="create", result_code="draft_ok", received_at=draft_at),
        AnalyticsEvent("done", "registration_completed", "registered", attempt_id="done", mode="create", research_id=9, received_at=old),
        AnalyticsEvent("open-done", "registration_open", "research", attempt_id="done", mode="create", received_at=old),
    ]
    start, end = resolve_range("custom", start=old.date(), end=(NOW + timedelta(days=1)).date(), today=NOW.date())
    body = build_analytics_report(
        events, enabled=True, table_ready=True, start=start, end=end, now=NOW, started_at=old
    )
    create = body["registration"]["create"]
    assert create["opened"] == 3
    assert create["completed"] == 1
    assert create["incomplete"] == 1
    assert create["watching"] == 1
    assert create["completion_rate"] == 1 / 3
    assert body["registration"]["edit"]["opened"] == 1
    assert body["registration"]["resume"]["saved"] == 1
    assert body["registration"]["resume"]["incomplete"] == 1
    assert body["registration"]["reasons"][0]["code"] == "later"
    assert body["registration"]["reasons"][0]["kind"] == "answer"
    assert any(item["kind"] == "validation" for item in body["registration"]["signals"])


def test_disabled_collection_hides_numbers_and_missing_table_is_not_zero():
    start, end = resolve_range("7d", today=NOW.date())
    off = build_analytics_report([], enabled=False, table_ready=True, start=start, end=end, now=NOW, started_at=None)
    missing = build_analytics_report([], enabled=True, table_ready=False, start=start, end=end, now=NOW, started_at=None)
    assert off["collection"]["status"] == "not_collected"
    assert off["visits"]["page_views"]["value"] is None
    assert missing["collection"]["status"] == "unavailable"
    assert missing["visits"]["sessions"]["value"] is None
    ready = build_analytics_report([], enabled=True, table_ready=True, start=start, end=end, now=NOW, started_at=None)
    assert ready["collection"]["status"] == "ready"
    assert ready["visits"]["page_views"]["value"] == 0
    assert ready["registration"]["create"]["completion_rate"] is None


def test_operations_reader_gets_the_report_and_anonymous_does_not(client, monkeypatch):
    monkeypatch.setenv("OPERATIONS_ADMIN_DISCORD_IDS", "300000000000000003")
    monkeypatch.setenv("ANALYTICS_COLLECTION_ENABLED", "true")
    login_ops(client)
    session_id = str(uuid4())
    app.dependency_overrides[get_analytics_source] = lambda: MemoryAnalyticsSource(
        [
            page("view", NOW, session_id),
            AnalyticsEvent(
                "click",
                "expert_search_click",
                "case/lettuce-biomass-estimation",
                received_at=NOW,
            ),
        ]
    )
    response = client.get(PATH, params={"preset": "custom", "start": "2026-10-01", "end": "2026-10-09"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["visits"]["sessions"]["value"] == 1
    assert body["articles"][0]["expert_clicks"] == 1
    assert body["articles"][0]["read_sessions"] == 0
    assert "discord" not in response.text
    client.cookies.clear()
    anonymous = client.get(PATH)
    assert anonymous.status_code == 401
