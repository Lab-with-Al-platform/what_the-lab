"""방문·글 성과·등록 과정의 집계.

조회수처럼 더할 수 있는 횟수는 일별 합을 씁니다.
세션 수는 고른 기간의 원본에서 세션 번호를 세어 만듭니다.
하루 세션 수를 더해 주·월 세션 수로 만들지 않습니다.
사람 수, 유입 주소, 기기 유형은 수집하지 않았으므로 0으로 채우지 않습니다.
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from app.analytics.collect import AnalyticsEvent
from app.operations.periods import as_utc, each_day, in_range, seoul_day

ARTICLE_COUNT_EVENTS = frozenset({"article_view", "expert_search_click", "related_article_open"})


@dataclass(frozen=True)
class DailyCount:
    """하루·대상·사건 종류의 횟수. 고유 세션 수가 아닙니다."""

    event_name: str
    target: str
    event_date: date
    event_count: int


def daily_from_events(events: list[AnalyticsEvent]) -> list[DailyCount]:
    """테스트나 일별 표가 없을 때, 원본과 같은 횟수를 만듭니다."""
    buckets: dict[tuple[str, str, date], int] = {}
    for event in events:
        if event.received_at is None:
            continue
        key = (event.event_name, event.target, seoul_day(event.received_at))
        buckets[key] = buckets.get(key, 0) + 1
    return [
        DailyCount(event_name, target, event_date, count)
        for (event_name, target, event_date), count in buckets.items()
    ]

STEPS = ("research", "data", "collaboration", "review")
STEP_LABELS = {"research": "01 연구", "data": "02 데이터", "collaboration": "03 협업", "review": "04 확인"}
REASON_LABELS = {
    "later": "나중에 이어서 작성",
    "explain_hard": "설명을 어떻게 할지 모름",
    "data_not_ready": "데이터가 아직 없음",
    "security": "공유·보안이 걱정됨",
    "input_hard": "입력이 많거나 어려움",
    "error": "오류가 남",
    "unanswered": "답하지 않음",
}
PAGE_LABELS = {
    "home": "홈",
    "cases": "사례 목록",
    "trends": "트렌드 목록",
    "experts": "전문가 목록",
    "expert": "전문가 상세",
    "case": "사례 글",
    "trend": "트렌드 글",
}


def build_analytics_report(
    events: list[AnalyticsEvent],
    *,
    enabled: bool,
    table_ready: bool,
    start: datetime,
    end: datetime,
    now: datetime,
    started_at: datetime | None,
    grain: str = "day",
    daily: list[DailyCount] | None = None,
) -> dict:
    """수집 상태에 따라 숫자를 숨기거나, 있는 기록만 집계합니다."""
    collection = _collection(enabled, table_ready, started_at, events)
    show = collection["status"] in {"ready", "paused"}
    counts = daily if daily is not None else daily_from_events(events)
    visits = _visits(events, counts, start, end, grain) if show else _hidden_visits(collection["note"])
    return {
        "generated_at": as_utc(now).isoformat(),
        "timezone": "Asia/Seoul",
        "collection": collection,
        "visits": visits,
        "articles": _articles(events, counts, start, end) if show else [],
        "registration": _registration(events, now) if show else _hidden_registration(collection["note"]),
    }


def _collection(
    enabled: bool, table_ready: bool, started_at: datetime | None, events: list[AnalyticsEvent]
) -> dict:
    if not table_ready:
        status = "unavailable"
        note = "수집 표가 아직 없습니다. 표를 만들기 전에는 방문 수를 추정하지 않습니다."
    elif not enabled and not events and started_at is None:
        status = "not_collected"
        note = "수집이 꺼져 있고 기록이 없습니다. 측정 전 방문은 0으로 채우지 않습니다."
    elif not enabled:
        status = "paused"
        note = "수집이 멈춰 있습니다. 아래 수는 멈추기 전까지 받은 기록입니다."
    else:
        status = "ready"
        note = "수집이 켜져 있습니다. 이 기간에 사건이 없으면 0입니다."
    return {
        "status": status,
        "enabled": enabled,
        "started_at": as_utc(started_at).isoformat() if started_at else None,
        "note": note,
    }


def _metric(value: int | None, note: str, status: str = "ready") -> dict:
    return {"status": status, "value": value, "note": note}


def _hidden_visits(note: str) -> dict:
    empty = _metric(None, note, "not_collected")
    return {
        "visitors": _metric(None, "사람 수는 세지 않습니다. 세션 수와 다른 값입니다.", "not_collected"),
        "sessions": empty,
        "page_views": empty,
        "series": [],
        "pages": [],
        "referrer": _metric(None, "유입 주소는 수집하지 않았습니다.", "not_collected"),
        "device": _metric(None, "기기 유형은 수집하지 않았습니다.", "not_collected"),
    }


def _visits(
    events: list[AnalyticsEvent],
    counts: list[DailyCount],
    start: datetime,
    end: datetime,
    grain: str,
) -> dict:
    pages = [event for event in events if event.event_name == "page_view" and _inside(event, start, end)]
    session_ids = {event.session_id for event in pages if event.session_id}
    by_day = _events_by_day(pages, start, end)
    days = set(each_day(start, end))
    page_views = _count_named(counts, "page_view", days)
    return {
        "visitors": _metric(None, "사람 수는 세지 않습니다. 세션 수와 다른 값입니다.", "not_collected"),
        "sessions": _metric(
            len(session_ids),
            "선택 기간에 페이지를 연 세션 수입니다. 하루 세션을 더해 만든 값이 아닙니다.",
        ),
        "page_views": _metric(page_views, "페이지가 보인 횟수입니다. 같은 세션의 다른 페이지도 각각 셉니다."),
        "series": _series(by_day, counts, start, end, grain),
        "pages": _page_rows(pages, counts, days),
        "referrer": _metric(None, "유입 주소는 수집하지 않았습니다.", "not_collected"),
        "device": _metric(None, "기기 유형은 수집하지 않았습니다.", "not_collected"),
    }


def _series(
    by_day: dict[date, list[AnalyticsEvent]],
    counts: list[DailyCount],
    start: datetime,
    end: datetime,
    grain: str,
) -> list[dict]:
    """조회수는 일별 합을 더하고, 세션은 그 묶음의 원본을 다시 셉니다."""
    days = each_day(start, end)
    daily_views = _named_by_day(counts, "page_view", set(days))
    if grain == "day":
        buckets = [(day, day + timedelta(days=1)) for day in days]
    else:
        buckets = _span_buckets(days, grain)
    points = []
    for bucket_start, bucket_end in buckets:
        grouped: list[AnalyticsEvent] = []
        page_views = 0
        cursor = bucket_start
        while cursor < bucket_end:
            grouped.extend(by_day.get(cursor, []))
            page_views += daily_views.get(cursor, 0)
            cursor += timedelta(days=1)
        sessions = {event.session_id for event in grouped if event.session_id}
        label = bucket_start.isoformat() if grain != "month" else bucket_start.strftime("%Y-%m")
        points.append(
            {
                "date": label,
                "page_views": page_views,
                "sessions": len(sessions),
                "until": (bucket_end - timedelta(days=1)).isoformat(),
            }
        )
    return points


def _span_buckets(days: list[date], grain: str) -> list[tuple[date, date]]:
    if not days:
        return []
    buckets: list[tuple[date, date]] = []
    cursor = days[0]
    last = days[-1] + timedelta(days=1)
    while cursor < last:
        if grain == "week":
            # 월요일 시작. 기간 밖 날짜는 넣지 않습니다.
            bucket_end = cursor + timedelta(days=7 - cursor.weekday())
        elif cursor.month == 12:
            bucket_end = date(cursor.year + 1, 1, 1)
        else:
            bucket_end = date(cursor.year, cursor.month + 1, 1)
        buckets.append((cursor, min(bucket_end, last)))
        cursor = min(bucket_end, last)
    return buckets


def _page_rows(pages: list[AnalyticsEvent], counts: list[DailyCount], days: set[date]) -> list[dict]:
    views: dict[str, int] = {}
    for row in counts:
        if row.event_name == "page_view" and row.event_date in days:
            views[row.target] = views.get(row.target, 0) + row.event_count
    sessions: dict[str, set[str]] = {}
    for event in pages:
        if event.session_id:
            sessions.setdefault(event.target, set()).add(event.session_id)
    rows = []
    for target in set(views) | set(sessions):
        rows.append(
            {
                "target": target,
                "label": PAGE_LABELS.get(target, target),
                "page_views": views.get(target, 0),
                "sessions": len(sessions.get(target, set())),
            }
        )
    return sorted(rows, key=lambda item: (-item["page_views"], item["target"]))


def _articles(
    events: list[AnalyticsEvent], counts: list[DailyCount], start: datetime, end: datetime
) -> list[dict]:
    days = set(each_day(start, end))
    grouped: dict[str, dict] = {}
    for row in counts:
        if row.event_name not in ARTICLE_COUNT_EVENTS or row.event_date not in days:
            continue
        item = grouped.setdefault(
            row.target,
            {"target": row.target, "page_views": 0, "read_sessions": set(), "expert_clicks": 0, "related_opens": 0},
        )
        if row.event_name == "article_view":
            item["page_views"] += row.event_count
        elif row.event_name == "expert_search_click":
            item["expert_clicks"] += row.event_count
        else:
            item["related_opens"] += row.event_count
    for event in events:
        if event.event_name != "article_view" or not _inside(event, start, end) or not event.session_id:
            continue
        item = grouped.setdefault(
            event.target,
            {"target": event.target, "page_views": 0, "read_sessions": set(), "expert_clicks": 0, "related_opens": 0},
        )
        item["read_sessions"].add(event.session_id)
    result = []
    for row in grouped.values():
        kind, _, slug = row["target"].partition("/")
        result.append(
            {
                "target": row["target"],
                "kind": kind,
                "slug": slug,
                "page_views": row["page_views"],
                "read_sessions": len(row["read_sessions"]),
                "expert_clicks": row["expert_clicks"],
                "related_opens": row["related_opens"],
                "note": "전문가 찾기 클릭은 횟수입니다. 협업 확정이 아니고, 세션 비율로 나누지 않습니다.",
            }
        )
    return sorted(result, key=lambda item: (-item["page_views"], item["target"]))


def _count_named(counts: list[DailyCount], event_name: str, days: set[date]) -> int:
    return sum(row.event_count for row in counts if row.event_name == event_name and row.event_date in days)


def _named_by_day(counts: list[DailyCount], event_name: str, days: set[date]) -> dict[date, int]:
    by_day: dict[date, int] = {}
    for row in counts:
        if row.event_name != event_name or row.event_date not in days:
            continue
        by_day[row.event_date] = by_day.get(row.event_date, 0) + row.event_count
    return by_day


def _hidden_registration(note: str) -> dict:
    return {"status": "not_collected", "note": note, "create": None, "resume": None, "edit": None, "reasons": [], "signals": []}


def _registration(events: list[AnalyticsEvent], now: datetime) -> dict:
    completed_attempts = {
        event.attempt_id
        for event in events
        if event.event_name == "registration_completed" and event.attempt_id
    }
    completed_research = {
        event.research_id
        for event in events
        if event.event_name == "registration_completed" and event.research_id
    }
    unlinked = sum(
        1
        for event in events
        if event.event_name == "registration_completed" and not event.attempt_id
    )
    return {
        "status": "ready",
        "note": "신규 작성과 임시저장 재개, 이미 등록된 연구의 수정은 모수를 섞지 않습니다. 닫기 기록이 없어도 등록 성공이 아닙니다.",
        "create": _mode_funnel(events, "create", now, timedelta(hours=24), completed_attempts, completed_research),
        "resume": _draft_watch(events, now, completed_attempts, completed_research),
        "edit": _edit_count(events),
        "completed_without_attempt": unlinked,
        "reasons": _reasons(events),
        "signals": _signals(events, "create", completed_attempts),
    }


def _mode_funnel(
    events: list[AnalyticsEvent],
    mode: str,
    now: datetime,
    wait: timedelta,
    completed_attempts: set[str],
    completed_research: set[int],
) -> dict:
    attempts = _attempts(events, mode)
    reached = {step: 0 for step in STEPS}
    incomplete = 0
    watching = 0
    done = 0
    for attempt_id, rows in attempts.items():
        opened = [row for row in rows if row.event_name == "registration_open" and row.received_at]
        if not opened:
            continue
        opened_at = min(row.received_at for row in opened if row.received_at is not None)
        for step in _reached_steps(rows):
            reached[step] += 1
        if _is_done(attempt_id, rows, completed_attempts, completed_research):
            done += 1
            continue
        if opened_at <= as_utc(now) - wait:
            incomplete += 1
        else:
            watching += 1
    opened_count = sum(1 for rows in attempts.values() if any(row.event_name == "registration_open" for row in rows))
    return {
        "opened": opened_count,
        "reached": [{"step": step, "label": STEP_LABELS[step], "count": reached[step]} for step in STEPS],
        "completed": done,
        "watching": watching,
        "incomplete": incomplete,
        "completion_rate": None if opened_count == 0 else done / opened_count,
        "window": "24h",
    }


def _draft_watch(
    events: list[AnalyticsEvent],
    now: datetime,
    completed_attempts: set[str],
    completed_research: set[int],
) -> dict:
    """임시저장 성공만 7일 관찰의 모수입니다. 저장 전 창 열기와 섞지 않습니다."""
    saves: dict[str, list[AnalyticsEvent]] = {}
    for event in events:
        if event.event_name != "registration_save" or event.result_code != "draft_ok":
            continue
        if event.mode not in {"create", "resume"} or not event.attempt_id or event.received_at is None:
            continue
        saves.setdefault(event.attempt_id, []).append(event)
    incomplete = 0
    watching = 0
    done = 0
    cutoff = as_utc(now) - timedelta(days=7)
    for attempt_id, rows in saves.items():
        saved_at = min(row.received_at for row in rows if row.received_at is not None)
        if _is_done(attempt_id, rows, completed_attempts, completed_research):
            done += 1
        elif saved_at <= cutoff:
            incomplete += 1
        else:
            watching += 1
    total = len(saves)
    return {
        "saved": total,
        "completed": done,
        "watching": watching,
        "incomplete": incomplete,
        "completion_rate": None if total == 0 else done / total,
        "window": "7d",
        "note": "임시저장에 성공한 작성 시도입니다. 창만 연 시도와 이미 등록된 연구의 수정은 넣지 않습니다.",
    }


def _edit_count(events: list[AnalyticsEvent]) -> dict:
    opened = {
        event.attempt_id
        for event in events
        if event.event_name == "registration_open" and event.mode == "edit" and event.attempt_id
    }
    return {"opened": len(opened), "note": "이미 등록된 연구의 수정이라 신규 등록 비율에 넣지 않습니다."}


def _reasons(events: list[AnalyticsEvent]) -> list[dict]:
    counts: dict[str, int] = {}
    for event in events:
        if event.event_name != "registration_close" or not event.reason_code:
            continue
        counts[event.reason_code] = counts.get(event.reason_code, 0) + 1
    return [
        {"code": code, "label": REASON_LABELS.get(code, code), "count": counts[code], "kind": "answer" if code != "unanswered" else "skipped"}
        for code in sorted(counts, key=lambda code: (-counts[code], code))
    ]


def _signals(events: list[AnalyticsEvent], mode: str, completed_attempts: set[str]) -> list[dict]:
    counts: dict[str, int] = {}
    for event in events:
        if event.event_name != "registration_validation_failed" or event.mode != mode or not event.result_code:
            continue
        counts[event.result_code] = counts.get(event.result_code, 0) + 1
    rows = [{"code": code, "label": code, "count": counts[code], "kind": "validation"} for code in sorted(counts)]
    last_steps: dict[str, int] = {}
    for attempt_id, grouped in _attempts(events, mode).items():
        if attempt_id in completed_attempts:
            continue
        steps = _reached_steps(grouped)
        if not steps:
            continue
        last = steps[-1]
        last_steps[last] = last_steps.get(last, 0) + 1
    rows.extend(
        {"code": step, "label": STEP_LABELS[step] + "에서 마지막 기록", "count": last_steps[step], "kind": "last_step"}
        for step in STEPS
        if step in last_steps
    )
    return rows


def _attempts(events: list[AnalyticsEvent], mode: str) -> dict[str, list[AnalyticsEvent]]:
    grouped: dict[str, list[AnalyticsEvent]] = {}
    for event in events:
        if event.mode != mode or not event.attempt_id or not event.event_name.startswith("registration_"):
            continue
        if event.event_name == "registration_completed":
            continue
        grouped.setdefault(event.attempt_id, []).append(event)
    return grouped


def _reached_steps(rows: list[AnalyticsEvent]) -> list[str]:
    found = []
    for step in STEPS:
        if any(row.target == step and row.event_name in {"registration_open", "registration_step", "registration_advance"} for row in rows):
            found.append(step)
    return found


def _is_done(
    attempt_id: str,
    rows: list[AnalyticsEvent],
    completed_attempts: set[str],
    completed_research: set[int],
) -> bool:
    if attempt_id in completed_attempts:
        return True
    return any(row.research_id in completed_research for row in rows if row.research_id)


def _events_by_day(
    events: list[AnalyticsEvent], start: datetime, end: datetime
) -> dict[date, list[AnalyticsEvent]]:
    grouped = {day: [] for day in each_day(start, end)}
    for event in events:
        if event.received_at is None:
            continue
        day = seoul_day(event.received_at)
        if day in grouped:
            grouped[day].append(event)
    return grouped


def _inside(event: AnalyticsEvent, start: datetime, end: datetime) -> bool:
    return event.received_at is not None and in_range(event.received_at, start, end)
