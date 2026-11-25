"""관리자가 준비한 후보 묶음을 미리 확인하고, 새 초안만 저장합니다."""

from dataclasses import asdict, dataclass, field

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
    # 새로 만들 후보에만 채웁니다. 승인 목록에 있어 남길 기술 ID와 버린 기술 ID입니다.
    keyword_ids: list[str] = field(default_factory=list)
    dropped_keyword_ids: list[str] = field(default_factory=list)


def suggested_keywords(draft: Draft) -> tuple[list[str], list[str]]:
    """수집이 고른 기술 ID 중 분류체계에서 운영 승인된 CAP만 제안값으로 남깁니다."""
    approved = {item["id"] for item in service.approved_capabilities()}
    kept = [keyword_id for keyword_id in draft.keyword_ids if keyword_id in approved]
    dropped = [keyword_id for keyword_id in draft.keyword_ids if keyword_id not in approved]
    return kept, dropped


def unverified_draft(draft: Draft) -> Draft:
    """파일에 적힌 검증 완료·점수·이미지 권리를 실제 검토로 신뢰하지 않습니다.

    기술 ID는 승인된 CAP 목록에 있는 것만 '수집 제안값'으로 남깁니다(2026-10-23 합의).
    관리자가 승인 전에 확인·수정하며, 서버는 승인할 때 다시 검사합니다.
    """
    content = draft.model_dump(mode="json")
    content["source"]["bibliography_checked"] = False
    content["source"]["access_level"] = "unknown"
    for claim in content["claims"]:
        claim["verification"] = "needs_review"
    content["scores"] = []
    content["keyword_ids"] = suggested_keywords(draft)[0]
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
                .where(
                    or_(
                        Revision.content["slug"].as_string() == draft.slug,
                        # 게시용 판본은 주소를 article 안에 보관하므로 두 구조를 함께 검사합니다.
                        Revision.content["article"]["slug"].as_string() == draft.slug,
                    )
                )
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
        if item.action == "would_create":
            # 미리 보기에서도 어떤 기술 ID가 남고 빠지는지 관리자에게 보여 줍니다.
            item.keyword_ids, item.dropped_keyword_ids = suggested_keywords(
                request.drafts[item.index]
            )
        if not request.dry_run and item.action == "would_create":
            candidate = service.create_candidate(
                session,
                unverified_draft(request.drafts[item.index]),
                actor,
            )
            note = "일괄 입력: 근거 재검토 필요"
            if item.keyword_ids:
                note += f" · 기술 ID {len(item.keyword_ids)}개는 수집 제안값(승인 전 확인)"
            service.add_event(session, candidate, actor, "imported", note)
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
