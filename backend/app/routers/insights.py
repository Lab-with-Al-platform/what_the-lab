"""첫 인사이트 API. 검토 자료는 관리자만, 공개 스냅샷은 누구나 조회합니다."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.insights import corrections, editorial, service
from app.insights.auth import require_admin, require_enabled, require_trusted_origin
from app.insights.database import get_session
from app.insights.importing import import_candidates
from app.insights.models import Candidate, Publication, ReviewEvent, Revision, Source
from app.insights.schemas import (
    ApprovalInput,
    CandidateImportInput,
    Draft,
    PublishInput,
    RevisionInput,
    VersionInput,
)
from app.routers.insight_workspace import router as workspace_router

router = APIRouter(prefix="/api/v1", tags=["insights"], dependencies=[Depends(require_enabled)])
admin_router = APIRouter(prefix="/admin/insights", dependencies=[Depends(require_admin)])
WriteGuard = Depends(require_trusted_origin)
DB = Annotated[Session, Depends(get_session, scope="function")]
Admin = Annotated[str, Depends(require_admin)]


@admin_router.get("/access")
def admin_access(actor: Admin) -> dict[str, bool]:
    """메뉴 표시도 서버 권한을 재사용합니다. 화면의 역할 이름을 신뢰하지 않습니다."""
    return {"can_manage_insights": True}


def candidate_summary(candidate: Candidate) -> dict:
    return {
        "id": candidate.id,
        "kind": candidate.kind,
        "status": candidate.status,
        "version": candidate.version,
        "current_revision": candidate.current_revision,
        "approved_revision": candidate.approved_revision,
        "scheduled_for": candidate.scheduled_for,
    }


def public_article(publication: Publication) -> dict:
    return {
        "id": publication.id,
        **publication.snapshot,
        "published_at": service.as_utc(publication.published_at),
    }


@admin_router.post("/candidates", status_code=201, dependencies=[WriteGuard])
def create(draft: Draft, session: DB, actor: Admin) -> dict:
    return candidate_summary(service.create_candidate(session, draft, actor))


@admin_router.get("/candidates")
def candidates(
    session: DB,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    q: str = Query("", max_length=200),
    status: Literal["draft", "pending_review", "approved", "published"] | None = None,
    kind: Literal["case", "trend"] | None = None,
    collection_only: bool = False,
) -> dict:
    # 현재 판본을 한 번에 연결해 제목을 보여줍니다. 후보마다 별도 조회하지 않습니다.
    query = (
        select(Candidate, Revision.content)
        .join(
            Revision,
            (Revision.candidate_id == Candidate.id)
            & (Revision.number == Candidate.current_revision),
        )
        .join(Source, Source.id == Candidate.source_id)
    )
    if status:
        query = query.where(Candidate.status == status)
    if collection_only:
        query = query.where(Candidate.status != "published")
    if kind:
        query = query.where(Candidate.kind == kind)
    if q.strip():
        escaped = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        query = query.where(
            or_(
                Revision.content["title"].as_string().ilike(pattern, escape="\\"),
                Source.doi.ilike(pattern, escape="\\"),
            )
        )
    total = session.scalar(select(func.count()).select_from(query.subquery()))
    records = session.execute(
        query.order_by(
            Candidate.created_at.desc(),
            Candidate.id,
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [
            {
                **candidate_summary(candidate),
                "title": content["title"],
                "summary": content["summary"],
                "research_field": content.get(
                    "research_field", content.get("article", {}).get("field", "")
                ),
                "doi": content.get("source", {}).get("doi"),
            }
            for candidate, content in records
        ],
        "page": page,
        "total": total,
    }


@admin_router.post("/candidates/import", dependencies=[WriteGuard])
def import_batch(body: CandidateImportInput, session: DB, actor: Admin) -> dict:
    return import_candidates(session, body, actor)


@admin_router.get("/publications")
def published_catalog(
    session: DB,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    q: str = Query("", max_length=200),
    kind: Literal["case", "trend"] | None = None,
) -> dict:
    """게시 보존본과 새 승인 게시물을 조회합니다. 미게시 후보는 섞지 않습니다."""
    query = select(Publication)
    if kind:
        query = query.where(Publication.snapshot["kind"].as_string() == kind)
    if q.strip():
        escaped = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.where(
            Publication.snapshot["title"]
            .as_string()
            .ilike(
                f"%{escaped}%",
                escape="\\",
            )
        )
    total = session.scalar(select(func.count()).select_from(query.subquery()))
    records = session.scalars(
        query.order_by(Publication.published_at.desc(), Publication.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [
            {
                "id": item.id,
                "slug": item.slug,
                "kind": item.snapshot["kind"],
                "title": item.snapshot["title"],
                "summary": item.snapshot["summary"],
                "origin": item.snapshot.get("origin", "reviewed_publication"),
                "published_at": service.as_utc(item.published_at),
            }
            for item in records
        ],
        "page": page,
        "total": total,
    }


@admin_router.get("/publications/{publication_id}")
def published_detail(publication_id: UUID, session: DB) -> dict:
    publication = session.get(Publication, str(publication_id))
    if publication is None:
        raise HTTPException(404, "게시된 글을 찾을 수 없습니다.")
    return {
        **public_article(publication),
        "article": corrections.article_from_publication(publication),
    }


@admin_router.get("/candidates/{candidate_id}")
def detail(candidate_id: UUID, session: DB) -> dict:
    candidate = service.get_candidate(session, str(candidate_id))
    publication_id = session.scalar(
        select(Publication.id).where(Publication.candidate_id == candidate.id)
    )
    versions = session.scalars(
        select(Revision)
        .where(
            Revision.candidate_id == candidate.id,
        )
        .order_by(Revision.number)
    ).all()
    events = session.scalars(
        select(ReviewEvent)
        .where(
            ReviewEvent.candidate_id == candidate.id,
        )
        .order_by(ReviewEvent.created_at, ReviewEvent.id)
    ).all()
    if versions and versions[-1].content.get("format") == "legacy_article_v1":
        return {
            **candidate_summary(candidate),
            "publication_id": publication_id,
            "legacy_article": versions[-1].content["article"],
            "approval_check": {
                "ready": False,
                "message": "기존 공개 원고 보존본: 새 승인으로 간주하지 않습니다.",
            },
            "revisions": [{"number": item.number, "content": item.content} for item in versions],
            "events": [
                {
                    "action": item.action,
                    "revision": item.revision,
                    "actor_discord_id": item.actor_discord_id,
                    "reason": item.reason,
                    "created_at": service.as_utc(item.created_at),
                }
                for item in events
            ],
        }
    try:
        service.validate_evidence(service.current_draft(session, candidate))
        editorial.validate_editorial(session, candidate)
        approval_check = {"ready": True, "message": "현재 판본의 근거 조건을 통과했습니다."}
    except HTTPException as error:
        if error.status_code != 422:
            raise
        approval_check = {"ready": False, "message": error.detail}
    return {
        **candidate_summary(candidate),
        "publication_id": publication_id,
        "article": versions[-1].content.get("article"),
        "review_draft": versions[-1].content.get("draft"),
        "editorial_check": editorial.editorial_report(versions[-1].content),
        "approval_check": approval_check,
        "revisions": [{"number": item.number, "content": item.content} for item in versions],
        "events": [
            {
                "action": item.action,
                "revision": item.revision,
                "actor_discord_id": item.actor_discord_id,
                "reason": item.reason,
                "created_at": service.as_utc(item.created_at),
            }
            for item in events
        ],
    }


@admin_router.post("/candidates/{candidate_id}/revisions", dependencies=[WriteGuard])
def revise(candidate_id: UUID, body: RevisionInput, session: DB, actor: Admin) -> dict:
    return candidate_summary(
        service.revise_candidate(
            session,
            str(candidate_id),
            body.expected_version,
            body.draft,
            actor,
            body.reason,
        )
    )


@admin_router.post("/candidates/{candidate_id}/submit", dependencies=[WriteGuard])
def submit(candidate_id: UUID, body: VersionInput, session: DB, actor: Admin) -> dict:
    return candidate_summary(
        service.submit_candidate(
            session,
            str(candidate_id),
            body.expected_version,
            actor,
            body.reason,
        )
    )


@admin_router.post("/candidates/{candidate_id}/approve", dependencies=[WriteGuard])
def approve(candidate_id: UUID, body: ApprovalInput, session: DB, actor: Admin) -> dict:
    return candidate_summary(service.approve_candidate(session, str(candidate_id), body, actor))


@admin_router.post("/candidates/{candidate_id}/publish", dependencies=[WriteGuard])
def publish(candidate_id: UUID, body: PublishInput, session: DB, actor: Admin) -> dict:
    publication = service.publish_candidate(
        session,
        str(candidate_id),
        body.expected_version,
        body.idempotency_key,
        actor,
        body.reason,
    )
    return public_article(publication)


@router.get("/insights")
def articles(
    session: DB, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=50)
) -> dict:
    records = session.scalars(
        select(Publication)
        .order_by(
            Publication.published_at.desc(),
            Publication.id,
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [public_article(item) for item in records],
        "page": page,
        "total": session.scalar(select(func.count()).select_from(Publication)),
    }


@router.get("/insights/{slug}")
def article(slug: str, session: DB) -> dict:
    publication = session.scalar(select(Publication).where(Publication.slug == slug))
    if publication is None:
        raise HTTPException(404, "게시된 글을 찾을 수 없습니다.")
    return public_article(publication)


admin_router.include_router(workspace_router)
router.include_router(admin_router)
