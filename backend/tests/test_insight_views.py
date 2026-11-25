"""공개 글 조회수는 가상 게시본과 SQLite에서만 확인합니다. 운영 DB에는 쓰지 않습니다."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.insights.database import get_session
from app.insights.models import Candidate, Publication, Revision, Source
from app.insights.views import record_page_view
from app.main import app
from app.operations.periods import seoul_today
from tests.test_insight_workflow import ADMIN_ID, ORIGIN, login
from tests.test_insight_workflow import client as client  # noqa: PLC0414

LINKED = "lettuce-biomass-estimation"
OTHER = "periodontal-bone-loss-analysis"


def _commit(session_gen) -> None:
    try:
        next(session_gen)
    except StopIteration:
        return


def seed_publication(slug: str, kind: str = "case", title: str = "가상 게시본") -> str:
    """승인 절차 없이 조회수 연결에 필요한 게시본만 넣습니다."""
    gen = app.dependency_overrides[get_session]()
    session = next(gen)
    source = Source(
        title="조회수 테스트 출처",
        url=f"https://example.org/view-tests/{uuid4()}",
        doi=f"10.9999/view-{uuid4().hex[:12]}",
        access_level="open_authorized",
        bibliography_checked=True,
    )
    session.add(source)
    session.flush()
    candidate = Candidate(
        source_id=source.id, kind=kind, status="published", version=1, current_revision=1
    )
    session.add(candidate)
    session.flush()
    session.add(
        Revision(
            candidate_id=candidate.id,
            number=1,
            content={"title": title, "summary": "조회수 정렬 확인", "format": "article"},
            created_by="100000000000000001",
        )
    )
    publication = Publication(
        candidate_id=candidate.id,
        revision=1,
        idempotency_key=str(uuid4()),
        slug=slug,
        snapshot={"kind": kind, "title": title, "slug": slug},
        published_at=datetime(2026, 10, 1, tzinfo=UTC),
    )
    session.add(publication)
    session.flush()
    publication_id = publication.id
    _commit(gen)
    return publication_id


def live_range() -> str:
    today = seoul_today()
    start = (today - timedelta(days=1)).isoformat()
    end = (today + timedelta(days=1)).isoformat()
    return f"preset=custom&start={start}&end={end}"


def post_view(client, slug: str, event_id: str | None = None, **headers):
    return client.post(
        "/api/v1/insights/views",
        headers={**ORIGIN, **headers},
        json={
            "event_id": event_id or str(uuid4()),
            "kind": "case",
            "slug": slug,
            "purpose": "public",
        },
    )


def test_disabled_collection_is_not_zero(client, monkeypatch):
    monkeypatch.delenv("INSIGHT_VIEWS_ENABLED", raising=False)
    login(client)
    seed_publication(LINKED)
    recorded = post_view(client, LINKED)
    assert recorded.status_code == 200
    assert recorded.json()["accepted"] is False
    stats = client.get("/api/v1/admin/insights/statistics")
    assert stats.status_code == 200
    body = stats.json()
    assert body["collection"]["status"] == "not_collected"
    assert body["cards"]["period_views"]["value"] is None
    assert body["cards"]["published"]["value"] == 1


def test_view_is_counted_once_and_admin_preview_are_excluded(client, monkeypatch):
    monkeypatch.setenv("INSIGHT_VIEWS_ENABLED", "true")
    publication_id = seed_publication(LINKED, title="상추 생체중")
    first = post_view(client, LINKED, event_id="11111111-1111-4111-8111-111111111111")
    second = post_view(client, LINKED, event_id="11111111-1111-4111-8111-111111111111")
    assert first.json()["duplicate"] is False
    assert second.json()["duplicate"] is True
    login(client)
    admin_view = post_view(client, LINKED)
    assert admin_view.json()["status"] == "excluded"
    preview = post_view(client, LINKED, Referer="http://localhost:3000/admin/insights/preview")
    assert preview.json()["status"] == "excluded"
    client.cookies.clear()
    missing = post_view(client, "not-a-public-slug")
    assert missing.json()["status"] == "unlinked"
    stats = client.get("/api/v1/admin/insights/statistics?" + live_range())
    assert stats.status_code == 401
    login(client)
    body = client.get("/api/v1/admin/insights/statistics?" + live_range()).json()
    assert body["cards"]["period_views"]["value"] == 1
    assert body["cards"]["cumulative_views"]["value"] == 1
    assert body["cards"]["viewed_articles"]["value"] == 1
    assert body["series"]
    detail = client.get(f"/api/v1/admin/insights/statistics/{publication_id}?" + live_range())
    assert detail.status_code == 200
    assert detail.json()["period_views"]["value"] == 1
    assert detail.json()["link_state"] == "linked"


def test_slug_change_keeps_the_same_content_and_unlinked_is_not_guessed(client, monkeypatch):
    monkeypatch.setenv("INSIGHT_VIEWS_ENABLED", "true")
    publication_id = seed_publication(LINKED, title="주소가 바뀌어도 같은 글")
    post_view(client, LINKED)
    gen = app.dependency_overrides[get_session]()
    session = next(gen)
    publication = session.get(Publication, publication_id)
    publication.slug = OTHER
    publication.snapshot = {**publication.snapshot, "slug": OTHER}
    _commit(gen)
    post_view(client, OTHER)
    old = post_view(client, LINKED)
    assert old.json()["status"] == "unlinked"
    unrelated = seed_publication("test-case-unlinked", title="상추 생체중")
    login(client)
    counts = client.get(
        f"/api/v1/admin/insights/statistics/counts?ids={publication_id},{unrelated}&" + live_range()
    ).json()
    assert counts["items"][publication_id]["cumulative_views"]["value"] == 2
    assert counts["items"][unrelated]["link_state"] == "needs_link"
    assert counts["items"][unrelated]["period_views"]["value"] is None


def test_seoul_midnight_week_and_month_boundaries(client, monkeypatch):
    monkeypatch.setenv("INSIGHT_VIEWS_ENABLED", "true")
    publication_id = seed_publication(LINKED)
    gen = app.dependency_overrides[get_session]()
    session = next(gen)
    record_page_view(
        session,
        event_id=str(uuid4()),
        slug=LINKED,
        kind="case",
        received_at=datetime(2026, 10, 25, 14, 59, tzinfo=UTC),
    )
    record_page_view(
        session,
        event_id=str(uuid4()),
        slug=LINKED,
        kind="case",
        received_at=datetime(2026, 10, 25, 15, 0, tzinfo=UTC),
    )
    record_page_view(
        session,
        event_id=str(uuid4()),
        slug=LINKED,
        kind="case",
        received_at=datetime(2026, 1, 31, 15, 0, tzinfo=UTC),
    )
    _commit(gen)
    login(client)
    week = client.get(
        f"/api/v1/admin/insights/statistics/{publication_id}?preset=custom&start=2026-10-25&end=2026-10-27&grain=week"
    ).json()
    assert [point["count"] for point in week["series"]] == [1, 1]
    month = client.get(
        f"/api/v1/admin/insights/statistics/{publication_id}?preset=custom&start=2026-01-31&end=2026-02-02&grain=month"
    ).json()
    assert [point["date"] for point in month["series"]] == ["2026-01", "2026-02"]
    assert [point["count"] for point in month["series"]] == [0, 1]


def test_operations_reader_cannot_open_insight_statistics(client, monkeypatch):
    monkeypatch.setenv("INSIGHT_VIEWS_ENABLED", "true")
    monkeypatch.setenv("OPERATIONS_ADMIN_DISCORD_IDS", "300000000000000003")
    login(client, "300000000000000003")
    assert client.get("/api/v1/admin/insights/statistics").status_code == 403
    assert client.get("/api/v1/admin/operations/access").status_code == 200
    login(client, ADMIN_ID)
    assert client.get("/api/v1/admin/insights/statistics").status_code == 200


def test_published_workspace_sorts_views_before_paging(client, monkeypatch):
    """조회수 정렬은 현재 페이지 6건만 다시 섞지 않고, 걸러진 전체에서 순서를 정합니다."""
    monkeypatch.setenv("INSIGHT_VIEWS_ENABLED", "true")
    low = seed_publication(LINKED, title="낮은 조회")
    high = seed_publication(OTHER, title="높은 조회")
    post_view(client, LINKED)
    post_view(client, OTHER)
    post_view(client, OTHER)
    login(client)
    first = client.get(
        "/api/v1/admin/insights/workspace?scope=published&order=period&view_preset=30d&page=1&page_size=1"
    )
    second = client.get(
        "/api/v1/admin/insights/workspace?scope=published&order=period&view_preset=30d&page=2&page_size=1"
    )
    assert first.status_code == 200
    assert first.json()["items"][0]["publication_id"] == high
    assert second.json()["items"][0]["publication_id"] == low
    assert "scope=stats" not in first.request.url.path

