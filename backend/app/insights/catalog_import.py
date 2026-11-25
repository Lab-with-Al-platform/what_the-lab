"""기존 화면의 공개 원고를 새 승인과 구분하여 빠짐없이 보관합니다."""

import hashlib
import json
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.insights.models import Candidate, Publication, Revision, Source
from app.insights.service import add_event, flush_changes

LEGACY_FORMAT = "legacy_article_v1"
IMPORT_ACTOR = "system:catalog-import"


def article_hash(article: dict) -> str:
    """본문뿐 아니라 용어·이미지 설명을 포함한 모든 항목의 일치를 확인합니다."""
    value = json.dumps(article, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def import_catalog(session: Session, articles: list[dict]) -> dict:
    """이미 공개 중인 원고만 보존합니다. 신규 후보의 승인·게시에는 사용하지 않습니다."""
    created = preserved = 0
    seen: set[str] = set()
    for article in articles:
        slug, kind = article["slug"], article["kind"]
        if slug in seen or kind not in {"case", "trend"}:
            raise ValueError("중복된 주소 또는 알 수 없는 원고 유형입니다.")
        seen.add(slug)
        existing = session.scalar(select(Publication).where(Publication.slug == slug))
        if existing:
            if existing.snapshot.get("article_hash") != article_hash(article):
                raise ValueError(f"{slug}: 기존 DB 원고와 다릅니다. 자동 덮어쓰지 않습니다.")
            preserved += 1
            continue
        # 이 출처는 논문이 아니라 '이관한 원고'의 식별자입니다.
        # 같은 논문을 다루는 여러 글·가상 설계 시나리오도 독립적으로 보존합니다.
        source = Source(
            title=f"기존 사이트 원고 보존본: {article['title']}",
            url=f"urn:labbridge:legacy-article:{slug}",
            doi=None,
            access_level="unknown",
            bibliography_checked=False,
        )
        session.add(source)
        flush_changes(session)
        candidate = Candidate(source_id=source.id, kind=kind, status="published")
        session.add(candidate)
        flush_changes(session)
        session.add(
            Revision(
                candidate_id=candidate.id,
                number=1,
                created_by=IMPORT_ACTOR,
                content={
                    "format": LEGACY_FORMAT,
                    "title": article["title"],
                    "summary": article["summary"],
                    "article": article,
                },
            )
        )
        # approved_by / approved_revision는 비워 두어 과거에 없던 승인 이력을 만들지 않습니다.
        session.add(
            Publication(
                candidate_id=candidate.id,
                revision=1,
                idempotency_key=f"legacy:{slug}",
                slug=slug,
                published_at=datetime.strptime(article["publishedOn"], "%Y.%m.%d").replace(
                    tzinfo=UTC
                ),
                snapshot={
                    "kind": kind,
                    "slug": slug,
                    "title": article["title"],
                    "summary": article["summary"],
                    "origin": "legacy_static",
                    "article_hash": article_hash(article),
                    "article": article,
                    "imported_at": datetime.now(UTC).isoformat(),
                    "review_notice": "기존 공개 원고 보존본이며 새 검증·승인 기록이 아닙니다.",
                },
            )
        )
        add_event(
            session,
            candidate,
            IMPORT_ACTOR,
            "legacy_imported",
            "사용자 요청: 기존 공개 원고 그대로 이관; 새 승인 아님",
        )
        flush_changes(session)
        created += 1
    return {"created": created, "preserved": preserved}
