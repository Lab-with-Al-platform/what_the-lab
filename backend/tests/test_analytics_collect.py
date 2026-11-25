"""방문·등록 수집은 가상 저장소로만 확인합니다. 실제 DB에는 쓰지 않습니다."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.analytics.collect import (
    AnalyticsEvent,
    EventRejected,
    completed_registration,
    period_session_count,
    prepare_client_event,
)
from app.analytics.store import MemoryAnalyticsStore
from app.insights.public_catalog import public_articles
from app.main import app
from app.routers.analytics import get_analytics_store
from app.routers.researcher_research import ResearchRequest, clean_research
from tests.test_insight_workflow import ORIGIN
from tests.test_insight_workflow import client as client  # noqa: PLC0414

PATH = "/api/v1/analytics/events"
NOW = datetime(2026, 10, 26, 1, tzinfo=UTC)


@pytest.fixture(autouse=True)
def clear_analytics_override():
    yield
    app.dependency_overrides.pop(get_analytics_store, None)


def article_target() -> str:
    kind, slug = min(public_articles())
    return f"{kind}/{slug}"


def page_body(event_id: str | None = None, **extra: object) -> dict:
    body = {
        "event_id": event_id or str(uuid4()),
        "event_name": "page_view",
        "target": "home",
        "session_id": str(uuid4()),
    }
    body.update(extra)
    return body


def bind(store: MemoryAnalyticsStore) -> None:
    app.dependency_overrides[get_analytics_store] = lambda: store


def test_collection_off_keeps_the_store_empty(client, monkeypatch):
    monkeypatch.delenv("ANALYTICS_COLLECTION_ENABLED", raising=False)
    store = MemoryAnalyticsStore()
    bind(store)
    response = client.post(PATH, json=page_body(), headers=ORIGIN)
    assert response.status_code == 200, response.text
    assert response.json() == {"accepted": False, "status": "disabled", "duplicate": False}
    assert store.events == {}


def test_page_view_is_deduped_and_client_cannot_complete_registration(client, monkeypatch):
    monkeypatch.setenv("ANALYTICS_COLLECTION_ENABLED", "true")
    store = MemoryAnalyticsStore()
    bind(store)
    event_id = str(uuid4())
    first = client.post(PATH, json=page_body(event_id), headers=ORIGIN)
    second = client.post(PATH, json=page_body(event_id), headers=ORIGIN)
    assert first.json()["duplicate"] is False
    assert second.json()["duplicate"] is True
    assert len(store.events) == 1
    assert sum(store.daily.values()) == 1
    forged = client.post(
        PATH,
        json={
            "event_id": str(uuid4()),
            "event_name": "registration_completed",
            "target": "registered",
            "attempt_id": str(uuid4()),
            "mode": "create",
            "research_id": 1,
        },
        headers=ORIGIN,
    )
    assert forged.status_code == 422
    assert len(store.events) == 1


def test_session_stays_off_registration_and_unknown_article_is_not_stored(client, monkeypatch):
    monkeypatch.setenv("ANALYTICS_COLLECTION_ENABLED", "true")
    store = MemoryAnalyticsStore()
    bind(store)
    mixed = client.post(
        PATH,
        json={
            "event_id": str(uuid4()),
            "event_name": "registration_open",
            "target": "research",
            "attempt_id": str(uuid4()),
            "mode": "create",
            "session_id": str(uuid4()),
        },
        headers=ORIGIN,
    )
    assert mixed.status_code == 422
    missing = client.post(
        PATH,
        json={
            "event_id": str(uuid4()),
            "event_name": "article_view",
            "target": "case/not-a-real-article",
            "session_id": str(uuid4()),
        },
        headers=ORIGIN,
    )
    assert missing.json()["status"] == "unlinked"
    titled = client.post(PATH, json=page_body(title="세포 사진"), headers=ORIGIN)
    assert titled.status_code == 422
    admin = client.post(
        PATH,
        json=page_body(),
        headers={**ORIGIN, "Referer": "http://localhost:3000/admin/insights"},
    )
    assert admin.json()["status"] == "excluded"
    assert store.events == {}


def test_week_session_count_is_not_the_sum_of_daily_uniques():
    session_id = str(uuid4())
    events = [
        AnalyticsEvent(
            event_id="day-1",
            event_name="page_view",
            target="home",
            session_id=session_id,
            received_at=NOW,
        ),
        AnalyticsEvent(
            event_id="day-2",
            event_name="page_view",
            target="cases",
            session_id=session_id,
            received_at=NOW + timedelta(days=1),
        ),
    ]
    assert period_session_count(events, NOW, NOW + timedelta(days=7)) == 1


def test_registration_completion_is_server_only_and_not_a_research_column():
    first = completed_registration(None, 15, "create", NOW)
    again = completed_registration(str(uuid4()), 15, "resume", NOW)
    assert first.event_id == again.event_id
    assert first.session_id is None
    values, _children = clean_research(
        ResearchRequest(status="draft", title="가상 연구", writing_attempt_id=str(uuid4()))
    )
    assert "writing_attempt_id" not in values
    assert "title" in values
    stored = prepare_client_event(
        {
            "event_id": str(uuid4()),
            "event_name": "article_view",
            "target": article_target(),
            "session_id": str(uuid4()),
        }
    )
    assert isinstance(stored, AnalyticsEvent)
    assert stored.research_id is None
    try:
        completed_registration(None, 15, "edit", NOW)
    except EventRejected:
        return
    raise AssertionError("수정 모드는 신규 등록 완료가 되면 안 됩니다.")
