"""공개 스냅샷을 보존하면서 같은 원고의 비공개 수정 판본을 만듭니다."""

from copy import deepcopy

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.insights import service
from app.insights.models import Candidate, Publication, Revision
from app.insights.schemas import Draft, SourceInput
from app.insights.workspace_schemas import ArticleDocument, ArticleRevisionInput


def article_from_publication(publication: Publication) -> dict:
    """이관본은 전체 원고를 그대로, 초기 API 게시본은 같은 화면 데이터로 변환합니다."""
    snapshot = publication.snapshot
    if "article" in snapshot:
        return deepcopy(snapshot["article"])
    return {
        "slug": publication.slug,
        "kind": snapshot["kind"],
        "title": snapshot["title"],
        "summary": snapshot["summary"],
        "field": snapshot["research_field"],
        "topicId": "research",
        "topicLabel": snapshot["research_field"],
        "domains": [snapshot["research_field"]],
        "tags": [item["label"] for item in snapshot.get("keywords", [])],
        "source": snapshot["source"]["title"],
        "sourceUrl": snapshot["source"]["url"],
        "doi": snapshot["source"].get("doi"),
        "publishedOn": service.as_utc(publication.published_at).strftime("%Y.%m.%d"),
        "readingMinutes": 1,
        "cover": "chart",
        "coverSrc": None,
        "sampleNotice": "DB 공개 API 게시본입니다. 일반 사이트의 정적 원고 연동과는 구분됩니다.",
        "highlights": [],
        "facts": [],
        "technologies": [],
        "relatedSlugs": [],
        "glossary": [
            {"id": f"term-{i}", **term} for i, term in enumerate(snapshot.get("glossary", []))
        ],
        "sections": [
            {
                "id": item["id"],
                "toc": item["title"],
                "title": item["title"],
                "paragraphs": [item["text"]],
            }
            for item in snapshot["sections"]
        ],
    }


def start_correction(
    session: Session, publication_id: str, version: int, actor: str, reason: str
) -> Candidate:
    publication = session.get(Publication, publication_id)
    if publication is None:
        raise HTTPException(404, "게시 글을 찾을 수 없습니다.")
    candidate = service.get_candidate(session, publication.candidate_id, version)
    if candidate.current_revision > publication.revision:
        return candidate  # 작업 중인 수정본은 새로 만들거나 덮어쓰지 않습니다.
    article = article_from_publication(publication)
    ArticleDocument.model_validate(article)
    source = SourceInput(
        title=article["title"],
        url=article["sourceUrl"],
        doi=article.get("doi"),
        access_level="unknown",
    )
    draft = Draft(
        source=source,
        kind=candidate.kind,
        title=article["title"],
        slug=article["slug"],
        summary=article["summary"],
        research_field=article["field"],
        case_type="research",
        claims=[
            {
                "field": "research_problem",
                "text": article["summary"],
                "locator": "",
                "verification": "needs_review",
                "evidence_level": "unavailable",
            }
        ],
        classification_tags=article.get("tags", [])[:10],
    )
    candidate.current_revision += 1
    candidate.version += 1
    candidate.status = "draft"
    candidate.approved_revision = candidate.approved_by = candidate.approved_at = (
        candidate.scheduled_for
    ) = None
    session.add(
        Revision(
            candidate_id=candidate.id,
            number=candidate.current_revision,
            created_by=actor,
            content={
                "format": "article_review_v1",
                "title": article["title"],
                "summary": article["summary"],
                "article": article,
                "draft": draft.model_dump(mode="json"),
                "base_publication_snapshot": deepcopy(publication.snapshot),
                "base_publication_revision": publication.revision,
            },
        )
    )
    service.add_event(session, candidate, actor, "correction_started", reason)
    service.flush_changes(session)
    return candidate


def save_correction(
    session: Session, candidate_id: str, body: ArticleRevisionInput, actor: str
) -> Candidate:
    candidate = service.get_candidate(session, candidate_id, body.expected_version)
    if candidate.status == "published":
        raise HTTPException(409, "수정 초안을 먼저 만들어 주세요. 공개본은 직접 수정하지 않습니다.")
    previous = session.scalar(
        select(Revision).where(
            Revision.candidate_id == candidate.id, Revision.number == candidate.current_revision
        )
    )
    if previous.content.get("format") not in {"article_review_v1", "article_draft_v1"}:
        raise HTTPException(409, "전체 원고 수정 초안이 아닙니다.")
    article = body.article.model_dump(mode="json", exclude_none=True)
    before = previous.content["article"]
    if article["slug"] != before["slug"] or article["kind"] != candidate.kind:
        raise HTTPException(409, "공개 글의 주소와 유형은 수정본에서 바꿀 수 없습니다.")
    # 이미지·권리 설명·시나리오 표시는 이번 편집에서 지우거나 바꾸지 않습니다.
    for key in ("cover", "coverSrc", "imageAlt", "imageCaption", "sampleNotice", "companionSlug"):
        if article.get(key) != before.get(key):
            raise HTTPException(
                422, "표지·권리 설명·시나리오 표시는 별도 검토 없이 변경할 수 없습니다."
            )
    draft = body.draft
    source = SourceInput(
        title=draft.source.title,
        url=article["sourceUrl"],
        doi=article.get("doi"),
        access_level=draft.source.access_level,
    )
    if source.url != draft.source.url or source.doi != draft.source.doi:
        raise HTTPException(422, "원고와 근거 검토의 출처가 다릅니다.")
    previous_source = SourceInput(
        title=before["title"],
        url=before["sourceUrl"],
        doi=before.get("doi"),
        access_level="unknown",
    )
    if source.url != previous_source.url or source.doi != previous_source.doi:
        raise HTTPException(409, "출처 식별자를 바꾸려면 별도 원고로 등록해야 합니다.")
    if (draft.title, draft.slug, draft.summary, draft.research_field, draft.kind) != (
        article["title"],
        article["slug"],
        article["summary"],
        article["field"],
        candidate.kind,
    ):
        raise HTTPException(422, "수정 원고와 검토 원고의 제목·유형·요약·분야가 일치해야 합니다.")
    candidate.current_revision += 1
    candidate.version += 1
    candidate.status = "draft"
    candidate.approved_revision = candidate.approved_by = candidate.approved_at = (
        candidate.scheduled_for
    ) = None
    content = {
        **previous.content,
        "article": article,
        "draft": draft.model_dump(mode="json"),
        "title": article["title"],
        "summary": article["summary"],
    }
    session.add(
        Revision(
            candidate_id=candidate.id,
            number=candidate.current_revision,
            created_by=actor,
            content=content,
        )
    )
    service.add_event(session, candidate, actor, "revised", body.reason)
    service.flush_changes(session)
    return candidate
