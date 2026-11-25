"""분석 사건의 저장. 가상 저장소는 테스트용이고, 운영은 PostgreSQL입니다."""

from datetime import UTC, datetime

import psycopg

from app.analytics.collect import (
    AnalyticsEvent,
    EventRejected,
    collection_enabled,
    completed_registration,
    day_key,
)
from app.db import transaction


def server_now() -> datetime:
    return datetime.now(UTC)


class MemoryAnalyticsStore:
    """테스트가 실제 회원·연구 표에 닿지 않게 메모리에만 남깁니다."""

    def __init__(self) -> None:
        self.events: dict[str, AnalyticsEvent] = {}
        self.daily: dict[tuple[str, str, object], int] = {}

    def save(self, event: AnalyticsEvent) -> bool:
        """같은 사건 번호는 횟수를 올리지 않습니다. 새 기록이면 True입니다."""
        if event.event_id in self.events:
            return False
        if event.received_at is None:
            raise ValueError("서버 시각이 없습니다.")
        self.events[event.event_id] = event
        key = (event.event_name, event.target, day_key(event.received_at))
        self.daily[key] = self.daily.get(key, 0) + 1
        return True


class PostgresAnalyticsStore:
    """브라우저가 표에 직접 쓰지 않고, 이 서버 경로로만 한 줄씩 넣습니다."""

    def save(self, event: AnalyticsEvent) -> bool:
        if event.received_at is None:
            raise ValueError("서버 시각이 없습니다.")
        with transaction() as cursor:
            cursor.execute(
                """
                INSERT INTO analytics_events (
                    event_id, event_name, target, session_id, attempt_id, mode,
                    result_code, reason_code, research_id, received_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (event_id) DO NOTHING
                RETURNING event_id
                """,
                (
                    event.event_id,
                    event.event_name,
                    event.target,
                    event.session_id,
                    event.attempt_id,
                    event.mode,
                    event.result_code,
                    event.reason_code,
                    event.research_id,
                    event.received_at,
                ),
            )
            if cursor.fetchone() is None:
                return False
            event_day = day_key(event.received_at)
            cursor.execute(
                """
                INSERT INTO analytics_event_daily (event_name, target, event_date, event_count)
                VALUES (%s, %s, %s, 1)
                ON CONFLICT (event_name, target, event_date)
                DO UPDATE SET event_count = analytics_event_daily.event_count + 1
                """,
                (event.event_name, event.target, event_day),
            )
        return True


def record_registration_completed(attempt_id: str | None, research_id: int, mode: str) -> None:
    """연구 저장이 이미 끝난 뒤에 호출합니다. 수집 실패가 등록을 되돌리지 않습니다."""
    if not collection_enabled():
        return
    try:
        event = completed_registration(attempt_id, research_id, mode, server_now())
        PostgresAnalyticsStore().save(event)
    # 표가 없거나 연결이 실패해도 이미 끝난 연구 저장을 실패로 바꾸지 않습니다.
    except (psycopg.Error, OSError, ValueError, EventRejected):
        return
