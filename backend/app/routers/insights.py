"""첫 인사이트 API. 검토 자료는 관리자만, 공개 스냅샷은 누구나 조회합니다."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.insights import service
from app.insights.auth import require_admin, require_enabled, require_trusted_origin
from app.insights.database import get_session
from app.insights.models import Candidate, Publication, ReviewEvent, Revision
from app.insights.schemas import ApprovalInput, Draft, PublishInput, RevisionInput, VersionInput

router = APIRouter(prefix="/api/v1", tags=["insights"], dependencies=[Depends(require_enabled)])
admin_router = APIRouter(prefix="/admin/insights", dependencies=[Depends(require_admin)])
WriteGuard = Depends(require_trusted_origin)
DB = Annotated[Session, Depends(get_session, scope="function")]
Admin = Annotated[str, Depends(require_admin)]


def candidate_summary(candidate: Candidate) -> dict:
    return {
        "id": candidate.id,
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
    session: DB, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=50)
) -> dict:
    records = session.scalars(
        select(Candidate)
        .order_by(
            Candidate.created_at.desc(),
            Candidate.id,
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [candidate_summary(item) for item in records],
        "page": page,
        "total": session.scalar(select(func.count()).select_from(Candidate)),
    }


@admin_router.get("/candidates/{candidate_id}")
def detail(candidate_id: UUID, session: DB) -> dict:
    candidate = service.get_candidate(session, str(candidate_id))
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
    return {
        **candidate_summary(candidate),
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


router.include_router(admin_router)
