"""Safety/regression contracts for the public expert profile.

No real DB or user records are loaded. The public route must not disclose
private collaboration titles, partner identities or full agreement snapshots.
"""
from contextlib import contextmanager
from datetime import date

from app import expert_search_store


class Cursor:
    def __init__(self):
        self.calls = []
        self.sql = ""

    def execute(self, statement, params=()):
        self.sql = str(statement)
        self.calls.append((self.sql, params))

    def fetchall(self):
        if "FROM collaboration c" in self.sql:
            return [
                {
                    "collaboration_id": 31,
                    "start_date": date(2026, 3, 1),
                    "end_date": date(2026, 5, 31),
                    "field_ids": ["FIELD011", "FIELD020"],
                    "work_ids": ["UG04", "UG08"],
                },
                {
                    "collaboration_id": 30,
                    "start_date": date(2026, 1, 1),
                    "end_date": date(2026, 2, 28),
                    "field_ids": [],
                    "work_ids": [],
                },
            ]
        if "FROM research_field" in self.sql:
            return [
                {"field_id": "FIELD011", "field_category_id": "F02"},
                {"field_id": "FIELD020", "field_category_id": "F03"},
            ]
        return []


class Connection:
    def __init__(self, cursor):
        self._cursor = cursor

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    @contextmanager
    def cursor(self):
        yield self._cursor


def test_only_completed_and_redacted_profile_history(monkeypatch):
    cursor = Cursor()
    monkeypatch.setattr(expert_search_store, "get_connection", lambda: Connection(cursor))
    items = expert_search_store.load_collaborations(19)

    assert len(items) == 2
    assert all(item["private"] is True for item in items)
    assert all(item["ongoing"] is False for item in items)
    assert all(item["partner_nickname"] is None for item in items)
    assert all(item["title"] == "완료한 협업 연구" for item in items)
    assert items[0]["category_ids"] == ["F02", "F03"]
    assert items[0]["able_work_ids"] == ["UG04", "UG08"]

    history_sql = cursor.calls[0][0]
    assert "c.status = 'done'" in history_sql
    assert "c.expert_id = %s" in history_sql
    assert "LIMIT 50" in history_sql
    assert "u.nickname" not in history_sql
    assert "r.title" not in history_sql
    assert "SELECT c.collaboration_id" in history_sql
    assert cursor.calls[0][1] == (19,)


def test_engaged_sql_uses_real_collaboration_state():
    sql = expert_search_store.ENGAGED_SQL
    assert "FROM collaboration" in sql
    assert "status = 'ongoing'" in sql
    assert "collaboration_request" not in sql
    assert "Asia/Seoul" in sql
