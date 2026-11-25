"""공개 글 조회수(PV) 수집과 관리자 집계.

수집이 꺼져 있으면 과거 숫자를 만들지 않습니다. 일별 합으로 주·월 PV는 만들 수 있지만,
그 방법으로 방문자 수를 계산하지는 않습니다.
"""

import os
from datetime import date, datetime, timedelta
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.insights.models import InsightPageView, InsightPageViewDaily, Publication, utc_now
from app.insights.public_catalog import is_public_article
from app.operations.periods import SEOUL, as_utc, resolve_range, seoul_today

Grain = Literal["day", "week", "month"]
NOTES = {
    "not_collected": "조회수 수집이 꺼져 있습니다. 측정 전 과거 조회는 추정하지 않습니다.",
    "paused": "수집이 멈춰 있습니다. 표시된 수는 멈춤 전까지 받은 공개 조회입니다.",
    "ready": "공개 글 상세가 보인 횟수(PV)입니다. 방문자 수가 아닙니다.",
    "not_linked": "공개 경로와 게시본의 주소·유형이 일치하지 않아 연결하지 않습니다.",
}


def views_enabled() -> bool:
    """기본값은 꺼짐. 테스트와 운영 활성화는 이 환경 변수로만 구분합니다."""
    return os.getenv("INSIGHT_VIEWS_ENABLED", "false").lower() == "true"


def record_page_view(
    session: Session,
    *,
    event_id: str,
    slug: str,
    kind: str,
    received_at: datetime | None = None,
    admin: bool = False,
    purpose: str = "public",
) -> dict:
    """한 방문의 재시도는 같은 event_id라서 조회수를 늘리지 않습니다."""
    if purpose != "public":
        return {"accepted": False, "status": "excluded", "reason": purpose}
    if admin:
        return {"accepted": False, "status": "excluded", "reason": "admin"}
    if not views_enabled():
        return {"accepted": False, "status": "disabled"}
    publication = session.scalar(select(Publication).where(Publication.slug == slug))
    snapshot_kind = publication.snapshot.get("kind") if publication is not None else None
    # 정적 공개 경로와 DB 게시본이 둘 다 맞을 때만 저장합니다. 없는 글을 새로 만들지는 않습니다.
    if publication is None or snapshot_kind != kind or not is_public_article(kind, slug):
        return {"accepted": False, "status": "unlinked"}
    existing = session.get(InsightPageView, event_id)
    if existing is not None:
        return {"accepted": True, "duplicate": True, "content_id": existing.content_id}
    moment = as_utc(received_at or utc_now())
    view_day = moment.astimezone(SEOUL).date()
    try:
        with session.begin_nested():
            session.add(
                InsightPageView(event_id=event_id, content_id=publication.id, received_at=moment)
            )
            daily = session.get(InsightPageViewDaily, (publication.id, view_day))
            if daily is None:
                session.add(
                    InsightPageViewDaily(
                        content_id=publication.id, view_date=view_day, page_views=1
                    )
                )
            else:
                daily.page_views += 1
            session.flush()
    except IntegrityError:
        # 동시에 같은 event_id가 도착하면 먼저 저장된 한 건만 남깁니다.
        return {"accepted": True, "duplicate": True, "content_id": publication.id}
    return {"accepted": True, "duplicate": False, "content_id": publication.id}


def _collection(session: Session) -> dict:
    total = session.scalar(select(func.coalesce(func.sum(InsightPageViewDaily.page_views), 0))) or 0
    first = session.scalar(select(func.min(InsightPageView.received_at)))
    enabled = views_enabled()
    if not enabled and total == 0:
        status = "not_collected"
    elif not enabled:
        status = "paused"
    else:
        status = "ready"
    return {
        "status": status,
        "enabled": enabled,
        "started_at": as_utc(first).isoformat() if first else None,
        "timezone": "Asia/Seoul",
        "generated_at": utc_now().isoformat(),
        "note": NOTES[status],
        "has_events": total > 0,
    }


def _linked(publication: Publication) -> bool:
    return is_public_article(str(publication.snapshot.get("kind")), publication.slug)


def _days(start: datetime, end: datetime) -> tuple[date, date]:
    return start.astimezone(SEOUL).date(), end.astimezone(SEOUL).date()


def _daily_map(session: Session, content_ids: list[str]) -> dict[tuple[str, date], int]:
    if not content_ids:
        return {}
    rows = session.scalars(
        select(InsightPageViewDaily).where(InsightPageViewDaily.content_id.in_(content_ids))
    ).all()
    return {(row.content_id, row.view_date): row.page_views for row in rows}


def _sum_between(
    daily: dict[tuple[str, date], int], content_id: str, start: date, end: date
) -> int:
    return sum(
        count for (item, day), count in daily.items() if item == content_id and start <= day < end
    )


def _countable(collection: dict) -> bool:
    return collection["status"] != "not_collected"


def _metric(collection: dict, linked: bool, value: int, note: str) -> dict:
    if not linked:
        return {"status": "not_linked", "value": None, "note": NOTES["not_linked"]}
    if not _countable(collection):
        return {"status": "not_collected", "value": None, "note": collection["note"]}
    return {"status": "ready", "value": value, "note": note}


def _bucket_end(cursor: date, end: date, grain: Grain) -> date:
    """주는 다음 월요일, 월은 다음 달 1일. 기간의 양끝은 잘린 채로 둡니다."""
    if grain == "week":
        return min(cursor + timedelta(days=7 - cursor.weekday()), end)
    if cursor.month == 12:
        month_end = date(cursor.year + 1, 1, 1)
    else:
        month_end = date(cursor.year, cursor.month + 1, 1)
    return min(month_end, end)


def _series(
    daily_counts: dict[date, int], start: date, end: date, grain: Grain, fill: bool
) -> list[dict]:
    if not fill:
        return []
    if grain == "day":
        points = []
        day = start
        while day < end:
            points.append({"date": day.isoformat(), "count": daily_counts.get(day, 0)})
            day += timedelta(days=1)
        return points
    points = []
    cursor = start
    while cursor < end:
        bucket_end = _bucket_end(cursor, end, grain)
        count = 0
        day = cursor
        while day < bucket_end:
            count += daily_counts.get(day, 0)
            day += timedelta(days=1)
        label = cursor.isoformat() if grain == "week" else cursor.strftime("%Y-%m")
        points.append(
            {"date": label, "count": count, "until": (bucket_end - timedelta(days=1)).isoformat()}
        )
        cursor = bucket_end
    return points


def _range_counts(
    daily: dict[tuple[str, date], int], content_id: str, start: date, end: date
) -> dict[date, int]:
    return {
        day: count
        for (item, day), count in daily.items()
        if item == content_id and start <= day < end
    }


def statistics_report(
    session: Session,
    *,
    preset: str,
    start: date | None,
    end: date | None,
    kind: str | None,
    grain: Grain,
    query: str,
    page: int,
    order: str,
    page_size: int = 6,
) -> dict:
    """카드·그래프·목록이 같은 일별 합계를 쓰게 한곳에서 계산합니다."""
    range_start, range_end = resolve_range(preset, start, end)
    start_day, end_day = _days(range_start, range_end)
    collection = _collection(session)
    publications = session.scalars(
        select(Publication).order_by(Publication.published_at.desc(), Publication.id)
    ).all()
    if kind:
        publications = [item for item in publications if item.snapshot.get("kind") == kind]
    daily = _daily_map(session, [item.id for item in publications])
    rows = []
    for item in publications:
        linked = _linked(item)
        period = _sum_between(daily, item.id, start_day, end_day) if linked else 0
        cumulative = _sum_between(daily, item.id, date.min, date.max) if linked else 0
        rows.append(
            {"publication": item, "linked": linked, "period": period, "cumulative": cumulative}
        )
    countable = _countable(collection)
    linked_rows = [row for row in rows if row["linked"]]
    period_total = sum(row["period"] for row in linked_rows) if countable else None
    cumulative_total = sum(row["cumulative"] for row in linked_rows) if countable else None
    viewed = sum(row["period"] > 0 for row in linked_rows) if countable else None
    by_day: dict[date, int] = {}
    for row in linked_rows:
        for day, count in _range_counts(daily, row["publication"].id, start_day, end_day).items():
            by_day[day] = by_day.get(day, 0) + count
    today = seoul_today()
    includes_today = start_day <= today < end_day
    needle = query.strip().casefold()
    listed = rows
    if needle:
        listed = [
            row
            for row in listed
            if needle in str(row["publication"].snapshot.get("title", "")).casefold()
        ]
    listed.sort(key=lambda row: _sort_key(row, order))
    offset = (page - 1) * page_size
    page_rows = listed[offset : offset + page_size]
    top_pool = [row for row in rows if row["linked"]]
    top_pool.sort(
        key=lambda row: (-row["period"], str(row["publication"].snapshot.get("title", "")))
    )
    return {
        "collection": {key: value for key, value in collection.items() if key != "has_events"},
        "range": {
            "preset": preset,
            "start": start_day.isoformat(),
            "end": (end_day - timedelta(days=1)).isoformat(),
            "includes_today": includes_today,
            "timezone": "Asia/Seoul",
            "note": "오늘이 포함되어 집계가 진행 중입니다."
            if includes_today
            else "끝 시각은 포함하지 않습니다.",
        },
        "cards": {
            "published": {
                "status": "ready",
                "value": len(rows),
                "note": "현재 게시 원고 수입니다. 선택 기간에 게시된 수가 아닙니다.",
            },
            "period_views": _total_card(collection, period_total, "선택 기간의 공개 글 조회수(PV)"),
            "cumulative_views": _total_card(
                collection,
                cumulative_total,
                "수집을 시작한 뒤의 누적 조회수입니다. 기간과 무관합니다.",
            ),
            "viewed_articles": _total_card(
                collection, viewed, "기간 중 조회가 1회 이상인 글 수입니다. 방문자 수가 아닙니다."
            ),
        },
        "series": _series(by_day, start_day, end_day, grain, countable),
        "kinds": _kind_share(linked_rows, countable),
        "top": [_top_row(row, period_total) for row in top_pool[:5]] if countable else [],
        "articles": {
            "items": [_article_row(row, collection) for row in page_rows],
            "total": len(listed),
            "page": page,
            "page_size": page_size,
            "search_applies_to": "articles",
        },
    }


def _total_card(collection: dict, value: int | None, note: str) -> dict:
    if not _countable(collection):
        return {"status": "not_collected", "value": None, "note": collection["note"]}
    return {"status": "ready", "value": value, "note": note}


def _kind_share(rows: list[dict], countable: bool) -> list[dict]:
    if not countable:
        return []
    return [
        {
            "label": "협업사례",
            "value": sum(
                row["period"] for row in rows if row["publication"].snapshot.get("kind") == "case"
            ),
        },
        {
            "label": "AI 트렌드",
            "value": sum(
                row["period"] for row in rows if row["publication"].snapshot.get("kind") == "trend"
            ),
        },
    ]


def _sort_key(row: dict, order: str) -> tuple:
    title = str(row["publication"].snapshot.get("title", ""))
    if order == "period":
        return (not row["linked"], -row["period"], title)
    if order == "cumulative":
        return (not row["linked"], -row["cumulative"], title)
    published = as_utc(row["publication"].published_at or utc_now())
    return (0, -published.timestamp(), title)


def _article_row(row: dict, collection: dict) -> dict:
    item = row["publication"]
    metric_period = _metric(collection, row["linked"], row["period"], "선택 기간 조회수")
    metric_total = _metric(collection, row["linked"], row["cumulative"], "측정 이후 누적 조회수")
    return {
        "content_id": item.id,
        "candidate_id": item.candidate_id,
        "title": item.snapshot.get("title") or item.slug,
        "kind": item.snapshot.get("kind"),
        "slug": item.slug,
        "research_field": item.snapshot.get("research_field")
        or (item.snapshot.get("article") or {}).get("field")
        or "",
        "keywords": _labels(item.snapshot),
        "published_at": as_utc(item.published_at).isoformat(),
        "link_state": "linked" if row["linked"] else "needs_link",
        "public_path": _public_path(item) if row["linked"] else None,
        "period_views": metric_period,
        "cumulative_views": metric_total,
    }


def _top_row(row: dict, period_total: int | None) -> dict:
    share = None if not period_total else round(row["period"] / period_total, 4)
    return {**_article_row(row, {"status": "ready", "note": ""}), "share": share}


def _labels(snapshot: dict) -> list[str]:
    article = snapshot.get("article") or {}
    raw = article.get("tags") or snapshot.get("keywords") or []
    labels = []
    for value in raw:
        label = value.get("label") if isinstance(value, dict) else value
        if isinstance(label, str) and label.strip():
            labels.append(label.strip())
    return labels


def _public_path(item: Publication) -> str:
    section = "cases" if item.snapshot.get("kind") == "case" else "trends"
    return f"/{section}/{item.slug}"


def counts_for(
    session: Session, content_ids: list[str], preset: str, start: date | None, end: date | None
) -> dict:
    range_start, range_end = resolve_range(preset, start, end)
    start_day, end_day = _days(range_start, range_end)
    collection = _collection(session)
    publications = (
        session.scalars(select(Publication).where(Publication.id.in_(content_ids))).all()
        if content_ids
        else []
    )
    found = {item.id: item for item in publications}
    daily = _daily_map(session, list(found))
    items = {}
    for content_id in content_ids:
        publication = found.get(content_id)
        if publication is None:
            items[content_id] = {
                "link_state": "missing",
                "period_views": {
                    "status": "not_linked",
                    "value": None,
                    "note": "게시본이 없습니다.",
                },
                "cumulative_views": {
                    "status": "not_linked",
                    "value": None,
                    "note": "게시본이 없습니다.",
                },
            }
            continue
        linked = _linked(publication)
        period = _sum_between(daily, content_id, start_day, end_day)
        cumulative = _sum_between(daily, content_id, date.min, date.max)
        items[content_id] = {
            "link_state": "linked" if linked else "needs_link",
            "period_views": _metric(collection, linked, period, "선택 기간 조회수"),
            "cumulative_views": _metric(collection, linked, cumulative, "측정 이후 누적 조회수"),
        }
    return {
        "collection": {key: value for key, value in collection.items() if key != "has_events"},
        "items": items,
    }


def statistic_detail(
    session: Session,
    content_id: str,
    preset: str,
    start: date | None,
    end: date | None,
    grain: Grain,
) -> dict | None:
    publication = session.get(Publication, content_id)
    if publication is None:
        return None
    report = statistics_report(
        session,
        preset=preset,
        start=start,
        end=end,
        kind=None,
        grain=grain,
        query="",
        page=1,
        order="newest",
        page_size=1,
    )
    range_start, range_end = resolve_range(preset, start, end)
    start_day, end_day = _days(range_start, range_end)
    collection = _collection(session)
    linked = _linked(publication)
    daily = _daily_map(session, [publication.id])
    by_day = _range_counts(daily, publication.id, start_day, end_day) if linked else {}
    period = sum(by_day.values())
    cumulative = _sum_between(daily, publication.id, date.min, date.max) if linked else 0
    return {
        "content_id": publication.id,
        "candidate_id": publication.candidate_id,
        "title": publication.snapshot.get("title") or publication.slug,
        "kind": publication.snapshot.get("kind"),
        "slug": publication.slug,
        "published_at": as_utc(publication.published_at).isoformat(),
        "link_state": "linked" if linked else "needs_link",
        "public_path": _public_path(publication) if linked else None,
        "collection": report["collection"],
        "range": report["range"],
        "period_views": _metric(collection, linked, period, "선택 기간 조회수"),
        "cumulative_views": _metric(collection, linked, cumulative, "측정 이후 누적 조회수"),
        "series": _series(by_day, start_day, end_day, grain, _countable(collection) and linked),
    }
