"""인사이트 통합 목록·수집 설정 저장·공개본 보존 수정 API입니다."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.insights import corrections, editorial, service
from app.insights.auth import require_admin, require_trusted_origin
from app.insights.collection_policy import recommended_discovery_policy
from app.insights.collection_sources import recommended_sources
from app.insights.database import get_session
from app.insights.models import Candidate, CollectionSetting, Publication, Revision, Source, utc_now
from app.insights.schemas import VersionInput
from app.insights.views import counts_for
from app.insights.workspace_schemas import (
    ArticleRevisionInput,
    CollectionConfig,
    CollectionConfigInput,
)

router = APIRouter()
DB = Annotated[Session, Depends(get_session, scope="function")]
Admin = Annotated[str, Depends(require_admin)]
WriteGuard = Depends(require_trusted_origin)


def published_facets(session: Session) -> tuple[list[str], list[str]]:
    """필터 선택지는 공개본의 분류만 사용하고, 수정 중인 초안은 섞지 않습니다."""
    rows = session.execute(
        select(
            Publication.snapshot["article"]["field"].as_string(),
            Publication.snapshot["research_field"].as_string(),
            Publication.snapshot["article"]["tags"],
            Publication.snapshot["keywords"],
        )
    ).all()
    categories: set[str] = set()
    keywords: set[str] = set()
    for article_field, field, tags, approved_keywords in rows:
        category = article_field or field
        if category and category.strip():
            categories.add(category.strip())
        # 기존 사이트 보존본은 tags, 첫 게시 API는 승인된 {id, label} 목록입니다.
        for value in tags or approved_keywords or []:
            label = value.get("label") if isinstance(value, dict) else value
            if isinstance(label, str) and label.strip():
                keywords.add(label.strip())
    return sorted(categories), sorted(keywords)


@router.get("/workspace")
def workspace(
    session: DB,
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    scope: Literal["all", "collected", "published"] = "all",
    kind: Literal["case", "trend"] | None = None,
    status: Literal["draft", "pending_review", "approved", "published"] | None = None,
    q: str = Query("", max_length=200),
    category: str = Query("", max_length=100),
    keyword: str = Query("", max_length=64),
    order: Literal["newest", "oldest", "period", "cumulative"] = "newest",
    view_preset: str = Query("30d", max_length=20),
) -> dict:
    # 전체 본문 대신 목록·분류에 필요한 JSON 조각만 받습니다. 현재 판본만 연결합니다.
    rows = session.execute(
        select(
            Candidate,
            Publication.id,
            Publication.revision,
            Publication.published_at,
            Revision.content["title"].as_string(),
            Revision.content["summary"].as_string(),
            Revision.content["research_field"].as_string(),
            Revision.content["article"]["field"].as_string(),
            Revision.content["draft"]["research_field"].as_string(),
            Revision.content["article"]["tags"],
            Revision.content["classification_tags"],
            Revision.content["draft"]["classification_tags"],
            Revision.content["glossary"],
            Source.title,
            Source.doi,
            Revision.content["article"]["doi"].as_string(),
            Revision.content["draft"]["source"]["doi"].as_string(),
            Revision.content["format"].as_string(),
        )
        .join(
            Revision,
            (Revision.candidate_id == Candidate.id)
            & (Revision.number == Candidate.current_revision),
        )
        .join(Source, Source.id == Candidate.source_id)
        .outerjoin(Publication, Publication.candidate_id == Candidate.id)
        .order_by(
            Candidate.created_at.desc() if order == "newest" else Candidate.created_at.asc(),
            Candidate.id,
        )
    ).all()
    items = []
    for row in rows:
        (
            candidate,
            publication_id,
            published_revision,
            published_at,
            title,
            summary,
            field,
            article_field,
            draft_field,
            tags,
            plain_tags,
            draft_tags,
            glossary,
            source_title,
            doi,
            article_doi,
            draft_doi,
            revision_format,
        ) = row
        labels = list(
            dict.fromkeys(
                (tags or plain_tags or draft_tags or [])
                + [term["label"] for term in (glossary or [])]
            )
        )
        items.append(
            {
                "id": candidate.id,
                "publication_id": publication_id,
                "kind": candidate.kind,
                "title": title,
                "summary": summary,
                "research_field": field or article_field or draft_field or "미분류",
                "keywords": labels,
                "source_title": source_title.removeprefix("기존 사이트 원고 보존본: "),
                "doi": doi or article_doi or draft_doi,
                "status": candidate.status,
                "version": candidate.version,
                "current_revision": candidate.current_revision,
                "content_stage": editorial.content_stage({"format": revision_format}),
                "is_published": publication_id is not None,
                "has_correction": publication_id is not None
                and candidate.current_revision > published_revision,
                "registered_at": service.as_utc(candidate.created_at),
                "published_at": service.as_utc(published_at) if published_at else None,
            }
        )
    categories, keywords = published_facets(session)
    counts = {
        "all": len(items),
        "collected": sum(not item["is_published"] or item["has_correction"] for item in items),
        "published": sum(item["is_published"] for item in items),
    }
    filtered = []
    for item in items:
        if scope == "published" and not item["is_published"]:
            continue
        if scope == "collected" and item["is_published"] and not item["has_correction"]:
            continue
        if kind and item["kind"] != kind:
            continue
        if status and (
            not item["is_published"] if status == "published" else item["status"] != status
        ):
            continue
        if category and item["research_field"] != category:
            continue
        if keyword and keyword not in item["keywords"]:
            continue
        searchable = " ".join(
            [item["title"], item["research_field"], item["doi"] or "", *item["keywords"]]
        )
        if q.strip().casefold() not in searchable.casefold():
            continue
        filtered.append(item)
    if order in {"period", "cumulative"}:
        filtered = _sort_by_views(session, filtered, order, view_preset)
    offset = (page - 1) * page_size
    return {
        "items": filtered[offset : offset + page_size],
        "total": len(filtered),
        "page": page,
        "counts": counts,
        "categories": categories,
        "keywords": keywords,
    }


def _sort_by_views(session: Session, items: list[dict], order: str, preset: str) -> list[dict]:
    """현재 페이지만 재정렬하지 않도록, 걸러진 전체 목록을 한 번의 집계로 정렬합니다."""
    ids = [item["publication_id"] for item in items if item["publication_id"]]
    try:
        metrics = counts_for(session, ids, preset, None, None)["items"]
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    key = "period_views" if order == "period" else "cumulative_views"

    def value_of(item: dict) -> int:
        metric = metrics.get(item["publication_id"] or "", {}).get(key, {})
        value = metric.get("value")
        return value if isinstance(value, int) else -1

    return sorted(items, key=value_of, reverse=True)


def default_collection_config() -> dict:
    return CollectionConfig(
        sources=recommended_sources(), discovery_policy=recommended_discovery_policy(6)
    ).model_dump(mode="json")


@router.get("/collection-settings")
def collection_settings(session: DB) -> dict:
    row = session.get(CollectionSetting, "collection")
    return {
        "version": row.version if row else 0,
        # 구버전 설정도 같은 응답 구조로 읽되, GET 요청은 DB에 쓰지 않습니다.
        "config": CollectionConfig.model_validate(row.content).model_dump(mode="json")
        if row
        else default_collection_config(),
        "updated_at": service.as_utc(row.updated_at) if row else None,
        "execution_available": False,
        "saved": row is not None,
    }


@router.put("/collection-settings", dependencies=[WriteGuard])
def save_collection_settings(body: CollectionConfigInput, session: DB, actor: Admin) -> dict:
    row = session.scalar(
        select(CollectionSetting).where(CollectionSetting.id == "collection").with_for_update()
    )
    if (row.version if row else 0) != body.expected_version:
        raise HTTPException(
            409, "다른 관리자가 수집 설정을 변경했습니다. 입력을 보존한 뒤 최신 설정을 확인하세요."
        )
    if row is None:
        row = CollectionSetting(
            id="collection",
            version=1,
            content=body.config.model_dump(mode="json"),
            updated_by=actor,
        )
        session.add(row)
    else:
        row.version += 1
        row.content = body.config.model_dump(mode="json")
        row.updated_by, row.updated_at = actor, utc_now()
    service.flush_changes(session)
    return collection_settings(session)


@router.post("/publications/{publication_id}/correction", dependencies=[WriteGuard])
def correction(publication_id: UUID, body: VersionInput, session: DB, actor: Admin) -> dict:
    candidate = corrections.start_correction(
        session, str(publication_id), body.expected_version, actor, body.reason
    )
    return {"id": candidate.id, "version": candidate.version}


@router.post("/candidates/{candidate_id}/article-revisions", dependencies=[WriteGuard])
def article_revision(
    candidate_id: UUID, body: ArticleRevisionInput, session: DB, actor: Admin
) -> dict:
    candidate = corrections.save_correction(session, str(candidate_id), body, actor)
    return {"id": candidate.id, "version": candidate.version}


@router.post("/candidates/{candidate_id}/article-draft", dependencies=[WriteGuard])
def article_draft(candidate_id: UUID, body: VersionInput, session: DB, actor: Admin) -> dict:
    candidate = editorial.start_article_draft(
        session, str(candidate_id), body.expected_version, actor, body.reason
    )
    return {"id": candidate.id, "version": candidate.version}
