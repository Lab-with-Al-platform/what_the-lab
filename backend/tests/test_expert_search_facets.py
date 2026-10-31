"""Sidebar filter contracts. Uses a stub PostgreSQL cursor; never touches a live DB."""
from contextlib import contextmanager

from app import expert_search_store


class FakeCursor:
    def __init__(self):
        self.statements = []
        self.latest = ""

    def execute(self, sql, params=()):
        self.latest = str(sql)
        self.statements.append((self.latest, params))

    def fetchone(self):
        return {"total": 1}

    def fetchall(self):
        if "SELECT e.user_id" in self.latest:
            return [{
                "user_id": 17,
                "nickname": "Demo Expert",
                "user_photo": None,
                "introduce": "AI researcher",
                "affiliation": "Demo Institute",
                "current_job": "researcher",
                "ai_career": "5_10",
                "engaged": False,
                "engaged_until": None,
            }]
        return []


class FakeConnection:
    def __init__(self, cursor):
        self._cursor = cursor

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    @contextmanager
    def cursor(self):
        yield self._cursor


def fixture_db(monkeypatch):
    cursor = FakeCursor()
    monkeypatch.setattr(expert_search_store, "get_connection", lambda: FakeConnection(cursor))
    return cursor


def test_engagement_idle_filters_count_and_page(monkeypatch):
    cursor = fixture_db(monkeypatch)
    response = expert_search_store.search_experts("", [], [], 0, 6, engagement="idle")
    assert response["total"] == 1
    assert len(response["items"]) == 1
    assert "g.expert_id IS NULL" in cursor.statements[0][0]
    assert "g.expert_id IS NULL" in cursor.statements[1][0]
    assert response["items"][0]["affiliation"] == "Demo Institute"


def test_engagement_engaged_filters_count_and_page(monkeypatch):
    cursor = fixture_db(monkeypatch)
    expert_search_store.search_experts("", [], [], 0, 6, engagement="engaged")
    assert "g.expert_id IS NOT NULL" in cursor.statements[0][0]
    assert "g.expert_id IS NOT NULL" in cursor.statements[1][0]


def test_newest_uses_genuine_created_at_sort_even_if_personalized(monkeypatch):
    cursor = fixture_db(monkeypatch)
    expert_search_store.search_experts(
        "", [], [], 0, 6,
        prefer_work_ids=["UG04"], prefer_category_ids=["F01"], sort="newest",
    )
    query, params = cursor.statements[1]
    assert "ORDER BY e.created_at DESC, e.user_id DESC" in query
    assert "CASE WHEN" not in query
    assert params == [6, 0]


def test_default_sort_preserves_existing_preference_logic(monkeypatch):
    cursor = fixture_db(monkeypatch)
    expert_search_store.search_experts("", [], [], 0, 6, prefer_work_ids=["UG04"])
    query, params = cursor.statements[1]
    assert "CASE WHEN" in query
    assert "g.expert_id IS NOT NULL" in query
    assert params == [["UG04"], 6, 0]
