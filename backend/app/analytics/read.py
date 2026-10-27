"""분석 표를 읽어 집계에 넘깁니다. 표가 없으면 빈 숫자 대신 없음으로 알립니다."""

from datetime import datetime, timedelta

import psycopg

from app.analytics.collect import AnalyticsEvent
from app.analytics.store import server_now
from app.db import transaction
from app.operations.periods import as_utc


class MemoryAnalyticsSource:
    """테스트용. 넘어온 사건만 돌려주고 실제 표는 열지 않습니다."""

    def __init__(self, events: list[AnalyticsEvent]) -> None:
        self.events = events

    def load(self, start: datetime, end: datetime, registration_start: datetime) -> tuple[bool, list[AnalyticsEvent], datetime | None]:
        del start, end, registration_start
        moments = [event.received_at for event in self.events if event.received_at is not None]
        started = min(moments) if moments else None
        return True, list(self.events), started


class PostgresAnalyticsSource:
    """운영 표. 없거나 연결이 안 되면 집계를 실패로 만들지 않고 없음으로 돌립니다."""

    def load(self, start: datetime, end: datetime, registration_start: datetime) -> tuple[bool, list[AnalyticsEvent], datetime | None]:
        try:
            with transaction() as cursor:
                cursor.execute("SELECT min(received_at) AS started_at FROM analytics_events")
                started = cursor.fetchone()["started_at"]
                cursor.execute(
                    """
                    SELECT event_id, event_name, target, session_id, attempt_id, mode,
                           result_code, reason_code, research_id, received_at
                    FROM analytics_events
                    WHERE (received_at >= %s AND received_at < %s)
                       OR (event_name LIKE 'registration%%' AND received_at >= %s AND received_at < %s)
                    """,
                    (start, end, registration_start, max(as_utc(end), server_now() + timedelta(minutes=1))),
                )
                rows = cursor.fetchall()
        except psycopg.Error:
            return False, [], None
        events = [
            AnalyticsEvent(
                event_id=row["event_id"],
                event_name=row["event_name"],
                target=row["target"],
                session_id=row["session_id"],
                attempt_id=row["attempt_id"],
                mode=row["mode"],
                result_code=row["result_code"],
                reason_code=row["reason_code"],
                research_id=row["research_id"],
                received_at=row["received_at"],
            )
            for row in rows
        ]
        return True, events, started
