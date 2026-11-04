"""구글은 "앞으로 볼 것"만 (DB · 구글 없이): 지난 일정 빼기, 협업 시작일 · 종료일."""

from contextlib import contextmanager
from datetime import date

from app import google_sync as gs
from app.google_calendar import mark_body, mark_id

TODAY = date(2026, 11, 4)


def fake_db(monkeypatch, rows_by_sql):
    """SQL 앞부분으로 돌려줄 줄을 고르는 가짜 DB"""

    class Cursor:
        def execute(self, sql, params=None):
            self.rows = next(rows for key, rows in rows_by_sql.items() if key in sql)

        def fetchall(self):
            return self.rows

    @contextmanager
    def connection():
        class Conn:
            def cursor(self):
                @contextmanager
                def make():
                    yield Cursor()

                return make()

        yield Conn()

    monkeypatch.setattr(gs, "get_connection", connection)


def fake_google(monkeypatch):
    calls = []
    monkeypatch.setattr(gs, "google_ready", lambda: True)
    monkeypatch.setattr(gs, "delete_event", lambda cal, eid: calls.append(("delete", eid)))
    monkeypatch.setattr(gs, "put_event", lambda cal, eid, body: calls.append(("put", eid, body["summary"], body["start"]["date"])))
    return calls


def test_mark_ids_and_body():
    assert (mark_id(3, "start"), mark_id(3, "end")) == ("lbc00003a", "lbc00003b")  # 구글 규칙: 소문자 a~v · 숫자
    body = mark_body(3, "end", date(2026, 11, 17), "세포 이미지")
    assert body["summary"] == "[협업] 협업 종료일"
    assert body["start"] == {"date": "2026-11-17"} and body["end"] == {"date": "2026-11-18"}


def test_tidy_removes_recent_past_and_syncs_marks(monkeypatch):
    calls = fake_google(monkeypatch)
    fake_db(
        monkeypatch,
        {
            "s.end_date BETWEEN": [{"schedule_id": 12, "google_calendar_id": "cal"}],  # 어제 끝난 일정
            "FROM collaboration WHERE status": [
                {"collaboration_id": 3, "google_calendar_id": "cal", "start_date": date(2026, 10, 29), "end_date": date(2026, 11, 17), "title": "A"},
                {"collaboration_id": 5, "google_calendar_id": "cal", "start_date": date(2026, 11, 9), "end_date": date(2026, 12, 9), "title": "B"},
            ],
        },
    )
    gs.tidy_google(TODAY)
    assert ("delete", "lbs00012") in calls  # 지난 일정은 구글에서 빼요
    assert ("delete", "lbc00003a") in calls  # 시작일이 지난 협업은 시작일을 빼요
    assert ("put", "lbc00003b", "[협업] 협업 종료일", "2026-11-17") in calls
    assert ("put", "lbc00005a", "[협업] 협업 시작", "2026-11-09") in calls  # 시작 전이면 시작일도 보여요
    assert ("put", "lbc00005b", "[협업] 협업 종료일", "2026-12-09") in calls