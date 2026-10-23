"""관리자가 준비한 후보 묶음을 미리 확인하고, 새 초안만 저장합니다."""

from dataclasses import asdict, dataclass

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.insights import service
from app.insights.models import Candidate, Publication, Revision, Source
from app.insights.schemas import CandidateImportInput, Draft


@dataclass
class ImportItem:
    index: int
    action: str
    candidate_id: str | None = None
    duplicate_of: int | None = None


def unverified_draft(draft: Draft) -> Draft:
    """파일에 적힌 검증 완료·점수·키워드 승인을 실제 검토로 신뢰하지 않습니다."""
    content = draft.model_dump(mode="json")
    content["source"]["bibliography_checked"] = False
    content["source"]["access_level"] = "unknown"
    for claim in content["claims"]:
        claim["verification"] = "needs_review"
    content["scores"] = []
    content["keyword_ids"] = []
    content["image_policy"] = "no_image"
    return Draft.model_validate(content)


def existing_candidate(session: Session, draft: Draft, index: int) -> Candidate | None:
    """DOI 또는 URL이 기존 출처와 맞는지 확인하되, 다른 출처를 합치지 않습니다."""
    conditions = [Source.url == str(draft.source.url)]
    if draft.source.doi:
        conditions.append(Source.doi == draft.source.doi)
    sources = session.scalars(select(Source).where(or_(*conditions))).all()
    if len(sources) > 1:
        raise HTTPException(409, f"{index}번 DOI와 URL이 서로 다른 출처를 가리킵니다.")
    if not sources:
        return None
    source = sources[0]
    if draft.source.doi and source.doi != draft.source.doi:
        raise HTTPException(409, f"{index}번 기존 URL의 DOI가 다릅니다. 수동 확인이 필요합니다.")
    return session.scalar(
        select(Candidate).where(
            Candidate.source_id == source.id,
            Candidate.kind == draft.kind,
        )
    )


def plan_import(session: Session, drafts: list[Draft]) -> list[ImportItem]:
    """먼저 전체를 조회·검사합니다. 뒤쪽 자료가 잘못되어도 앞쪽을 저장하지 않습니다."""
    items: list[ImportItem] = []
    seen_dois: dict[tuple[str, str], int] = {}
    seen_urls: dict[tuple[str, str], int] = {}
    seen_slugs: dict[str, int] = {}
    for index, draft in enumerate(drafts):
        doi, url = draft.source.doi, str(draft.source.url)
        matches: set[int] = set()
        if (doi, draft.kind) in seen_dois:
            matches.add(seen_dois[doi, draft.kind])
        if (url, draft.kind) in seen_urls:
            matches.add(seen_urls[url, draft.kind])
        if len(matches) > 1:
            raise HTTPException(409, f"{index}번 DOI와 URL이 묶음의 다른 출처를 가리킵니다.")
        candidate = existing_candidate(session, draft, index)
        if matches:
            first = matches.pop()
            previous_doi = drafts[first].source.doi
            if doi and previous_doi != doi:
                raise HTTPException(409, f"{index}번 같은 URL에 다른 DOI가 있습니다.")
            item = ImportItem(index, "duplicate_in_batch", duplicate_of=first)
        elif candidate:
            item = ImportItem(index, "existing_preserved", candidate_id=candidate.id)
        else:
            slug_owner = session.scalar(
                select(Candidate.id)
                .join(
                    Revision,
                    (
                        (Revision.candidate_id == Candidate.id)
                        & (Revision.number == Candidate.current_revision)
                    ),
                )
                .where(Revision.content["slug"].as_string() == draft.slug)
            )
            published = session.scalar(select(Publication.id).where(Publication.slug == draft.slug))
            if draft.slug in seen_slugs or slug_owner or published:
                raise HTTPException(409, f"{index}번 글 주소(slug)가 다른 후보와 겹칩니다.")
            item = ImportItem(index, "would_create")
            seen_slugs[draft.slug] = index
        items.append(item)
        first = item.duplicate_of if item.duplicate_of is not None else index
        if doi:
            seen_dois[doi, draft.kind] = first
        seen_urls[url, draft.kind] = first
    return items


def import_candidates(session: Session, request: CandidateImportInput, actor: str) -> dict:
    """기존 등록 규칙을 재사용하며 승인·게시 함수는 호출하지 않습니다."""
    items = plan_import(session, request.drafts)
    for item in items:
        if not request.dry_run and item.action == "would_create":
            candidate = service.create_candidate(
                session,
                unverified_draft(request.drafts[item.index]),
                actor,
            )
            service.add_event(session, candidate, actor, "imported", "일괄 입력: 근거 재검토 필요")
            item.action = "created"
            item.candidate_id = candidate.id
        if item.duplicate_of is not None:
            item.candidate_id = items[item.duplicate_of].candidate_id
    # 트랜잭션 확정은 기존 요청 세션이 담당합니다. 충돌/실패하면 묶음 전체를 취소합니다.
    return {
        "dry_run": request.dry_run,
        "created": sum(item.action == "created" for item in items),
        "would_create": sum(item.action == "would_create" for item in items),
        "existing_preserved": sum(item.action == "existing_preserved" for item in items),
        "duplicate_in_batch": sum(item.action == "duplicate_in_batch" for item in items),
        "items": [asdict(item) for item in items],
    }
