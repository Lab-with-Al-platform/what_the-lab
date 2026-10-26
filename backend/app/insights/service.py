"""본문 저장, 검토, 승인, 공개 규칙. HTTP나 스케줄러와 분리해 테스트합니다."""

import json
from datetime import UTC, datetime
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.insights.models import Candidate, Publication, ReviewEvent, Revision, Source, utc_now
from app.insights.schemas import REQUIRED_CLAIMS, SCORE_MAXIMUMS, ApprovalInput, Draft

SECTION_TITLES = {
    "research_problem": "연구 문제",
    "bottleneck": "기존 방식의 병목",
    "ai_role": "AI가 한 일",
    "researcher_role": "연구자가 한 일",
    "input_data": "입력 데이터와 준비 조건",
    "validation_method": "검증 방법",
    "outcomes": "확인된 결과",
    "limitations": "한계와 적용 조건",
}


def flush_changes(session: Session) -> None:
    try:
        session.flush()
    except IntegrityError:
        raise HTTPException(409, "이미 등록된 출처·후보·게시물과 충돌합니다.") from None


def get_candidate(session: Session, candidate_id: str, version: int | None = None) -> Candidate:
    candidate = session.scalar(
        select(Candidate).where(Candidate.id == candidate_id).with_for_update(),
    )
    if candidate is None:
        raise HTTPException(404, "후보를 찾을 수 없습니다.")
    if version is not None and candidate.version != version:
        raise HTTPException(409, "다른 작업으로 버전이 변경되었습니다. 다시 조회해 주세요.")
    return candidate


def current_draft(session: Session, candidate: Candidate) -> Draft:
    revision = session.scalar(
        select(Revision).where(
            Revision.candidate_id == candidate.id,
            Revision.number == candidate.current_revision,
        )
    )
    if revision is None:
        raise HTTPException(409, "본문 버전이 일치하지 않습니다.")
    if revision.content.get("format") == "legacy_article_v1":
        raise HTTPException(409, "이관한 기존 글은 게시 목록에서 읽기 전용으로 확인하세요.")
    return Draft.model_validate(revision.content.get("draft", revision.content))


def add_event(session: Session, candidate: Candidate, actor: str, action: str, reason: str) -> None:
    session.add(
        ReviewEvent(
            candidate_id=candidate.id,
            revision=candidate.current_revision,
            action=action,
            actor_discord_id=actor,
            reason=reason,
        )
    )


def create_candidate(session: Session, draft: Draft, actor: str) -> Candidate:
    source_query = select(Source).where(
        Source.doi == draft.source.doi if draft.source.doi else Source.url == str(draft.source.url),
    )
    source = session.scalar(source_query)
    if source is None:
        source = Source(**draft.source.model_dump(mode="json"))
        session.add(source)
        flush_changes(session)
    existing = session.scalar(
        select(Candidate).where(
            Candidate.source_id == source.id,
            Candidate.kind == draft.kind,
        )
    )
    if existing is not None:
        raise HTTPException(409, "같은 출처의 후보가 이미 있습니다.")
    candidate = Candidate(source_id=source.id, kind=draft.kind)
    session.add(candidate)
    flush_changes(session)
    session.add(
        Revision(
            candidate_id=candidate.id,
            number=1,
            content=draft.model_dump(mode="json"),
            created_by=actor,
        )
    )
    add_event(session, candidate, actor, "created", "수동 후보 등록")
    flush_changes(session)
    return candidate


def revise_candidate(
    session: Session,
    candidate_id: str,
    version: int,
    draft: Draft,
    actor: str,
    reason: str,
) -> Candidate:
    candidate = get_candidate(session, candidate_id, version)
    if candidate.status == "published":
        raise HTTPException(409, "게시 후 정정은 별도 정정 절차에서 처리해야 합니다.")
    previous = current_draft(session, candidate)
    revision = session.scalar(
        select(Revision).where(
            Revision.candidate_id == candidate.id, Revision.number == candidate.current_revision
        )
    )
    if revision.content.get("format") in {"article_review_v1", "article_draft_v1"}:
        raise HTTPException(409, "전체 원고 수정 API로 저장해야 기존 본문이 보존됩니다.")
    if draft.kind != candidate.kind:
        raise HTTPException(409, "원고 유형은 바꿀 수 없습니다. 다른 유형은 새 후보로 등록하세요.")
    if draft.source.doi != previous.source.doi or draft.source.url != previous.source.url:
        raise HTTPException(409, "출처 식별자는 바꿀 수 없습니다. 별도 후보로 등록해 주세요.")
    candidate.current_revision += 1
    candidate.version += 1
    candidate.status = "draft"
    candidate.approved_revision = None
    candidate.approved_by = None
    candidate.approved_at = None
    candidate.scheduled_for = None
    session.add(
        Revision(
            candidate_id=candidate.id,
            number=candidate.current_revision,
            content=draft.model_dump(mode="json"),
            created_by=actor,
        )
    )
    add_event(session, candidate, actor, "revised", reason)
    flush_changes(session)
    return candidate


def submit_candidate(
    session: Session,
    candidate_id: str,
    version: int,
    actor: str,
    reason: str,
) -> Candidate:
    candidate = get_candidate(session, candidate_id, version)
    if candidate.status != "draft":
        raise HTTPException(409, "초안만 검토 대기로 보낼 수 있습니다.")
    candidate.status = "pending_review"
    candidate.version += 1
    add_event(session, candidate, actor, "submitted", reason)
    flush_changes(session)
    return candidate


TAXONOMY_DIR = Path(__file__).resolve().parents[3] / "taxonomy/v4.0"
APPROVED_STATUSES = {"active", "verified"}


def approved_capabilities() -> list[dict[str, str]]:
    """분류체계에서 운영 승인된 CAP만 읽습니다. 선택 목록과 승인 검사가 같은 기준을 씁니다."""
    capabilities = json.loads((TAXONOMY_DIR / "capabilities.json").read_text(encoding="utf-8"))
    categories = json.loads((TAXONOMY_DIR / "categories.json").read_text(encoding="utf-8"))
    category_labels = {item["id"]: item["label_ko"] for item in categories}
    return [
        {
            "id": item["id"],
            "label": item["label_ko"],
            "category_id": item["category_id"],
            "category_label": category_labels.get(item["category_id"], ""),
        }
        for item in sorted(capabilities, key=lambda item: item["sort_order"])
        if item.get("status") in APPROVED_STATUSES
    ]


def approved_keyword_labels(keyword_ids: list[str]) -> list[dict[str, str]]:
    if not keyword_ids:
        return []
    by_id = {item["id"]: item for item in approved_capabilities()}
    result = []
    for keyword_id in keyword_ids:
        item = by_id.get(keyword_id)
        if item is None:
            raise HTTPException(422, "운영 승인된 기술 ID만 검색에 연결할 수 있습니다.")
        result.append({"id": keyword_id, "label": item["label"]})
    return result


def validate_evidence(draft: Draft) -> int:
    if draft.kind == "trend":
        raise HTTPException(
            422,
            "트렌드는 수집·수정·검토 대기까지 지원합니다. 전용 게시 검증 기준 연결 전에는 승인·게시할 수 없습니다.",
        )
    if not draft.source.bibliography_checked:
        raise HTTPException(422, "서지와 출처를 확인해야 합니다.")
    if {claim.field for claim in draft.claims} != REQUIRED_CLAIMS:
        raise HTTPException(422, "연구 문제부터 한계까지 필수 주장 8개를 채워 주세요.")
    for claim in draft.claims:
        if claim.verification != "verified" or not claim.locator:
            raise HTTPException(422, "모든 공개 주장에 검토된 근거와 위치가 필요합니다.")
        if claim.evidence_level == "unavailable":
            raise HTTPException(422, "접근할 수 없는 자료를 검증 완료로 사용할 수 없습니다.")
        if claim.evidence_level == "fulltext" and draft.source.access_level != "open_authorized":
            raise HTTPException(422, "원문 확인 수준과 출처 접근 수준이 일치하지 않습니다.")
        if claim.field in {
            "ai_role",
            "researcher_role",
            "validation_method",
        } and claim.evidence_level not in {"fulltext", "official"}:
            raise HTTPException(422, "초록만으로 방법·역할 검증을 완료할 수 없습니다.")
    if {score.criterion for score in draft.scores} != set(SCORE_MAXIMUMS):
        raise HTTPException(422, "7개 평가 항목을 모두 작성해 주세요.")
    total = sum(score.value for score in draft.scores)
    if total < 9:
        raise HTTPException(422, "추가 조사가 필요한 점수입니다. 근거를 보완해 주세요.")
    approved_keyword_labels(draft.keyword_ids)
    return total


def approve_candidate(
    session: Session,
    candidate_id: str,
    request: ApprovalInput,
    actor: str,
) -> Candidate:
    candidate = get_candidate(session, candidate_id, request.expected_version)
    if candidate.status != "pending_review":
        raise HTTPException(409, "검토 대기 중인 최신 본문만 승인할 수 있습니다.")
    draft = current_draft(session, candidate)
    validate_evidence(draft)
    from app.insights.editorial import READING_LABELS, validate_editorial

    validate_editorial(session, candidate)
    if not all(request.reading_checks.model_dump().values()):
        missing = [
            label
            for key, label in READING_LABELS.items()
            if not getattr(request.reading_checks, key)
        ]
        raise HTTPException(422, "독자 검수를 직접 확인해 주세요: " + "; ".join(missing))
    if request.scheduled_for is not None and request.scheduled_for <= utc_now():
        raise HTTPException(422, "예약 시각은 현재보다 나중이어야 합니다.")
    candidate.status = "approved"
    candidate.approved_revision = candidate.current_revision
    candidate.approved_by = actor
    candidate.approved_at = utc_now()
    candidate.scheduled_for = request.scheduled_for
    candidate.version += 1
    add_event(session, candidate, actor, "approved", request.reason + " | 독자 검수 6항목 확인")
    flush_changes(session)
    return candidate


def as_utc(value: datetime) -> datetime:
    # SQLite 테스트는 시간대 정보를 잃을 수 있어 UTC로 복원합니다.
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def publish_candidate(
    session: Session,
    candidate_id: str,
    version: int,
    key: str,
    actor: str,
    reason: str,
) -> Publication:
    candidate = get_candidate(session, candidate_id)
    existing = session.scalar(select(Publication).where(Publication.candidate_id == candidate.id))
    if existing is not None:
        if existing.idempotency_key == key:
            return existing
        if existing.revision >= candidate.current_revision:
            raise HTTPException(409, "이미 다른 게시 명령으로 발행되었습니다.")
    if candidate.version != version:
        raise HTTPException(409, "최신 후보 버전으로 다시 요청해 주세요.")
    if candidate.status != "approved" or candidate.approved_by is None:
        raise HTTPException(409, "관리자 승인 후에만 게시할 수 있습니다.")
    if candidate.approved_revision != candidate.current_revision:
        raise HTTPException(409, "승인된 본문 버전과 현재 버전이 다릅니다.")
    if candidate.scheduled_for is not None and as_utc(candidate.scheduled_for) > utc_now():
        raise HTTPException(409, "아직 예약한 게시 시각이 되지 않았습니다.")
    draft = current_draft(session, candidate)
    # 예약 후 기술 승인 상태가 바뀌었을 수 있어 발행 직전에 다시 확인합니다.
    total = validate_evidence(draft)
    from app.insights.editorial import validate_editorial

    editorial_article = validate_editorial(session, candidate)
    if existing is not None:
        revision = session.scalar(
            select(Revision).where(
                Revision.candidate_id == candidate.id, Revision.number == candidate.current_revision
            )
        )
        if revision.content.get("format") != "article_review_v1":
            raise HTTPException(
                409, "정식 수정 초안으로 작성한 원고만 공개본을 교체할 수 있습니다."
            )
        # 수정 중에는 건드리지 않았던 공개 스냅샷을 재승인·명시적 게시 때만 교체합니다.
        article = revision.content["article"]
        existing.snapshot = {
            "kind": article["kind"],
            "slug": article["slug"],
            "title": article["title"],
            "summary": article["summary"],
            "article": article,
            "origin": "reviewed_correction",
        }
        existing.revision = candidate.current_revision
        existing.idempotency_key = key
        candidate.status = "published"
        candidate.version += 1
        add_event(session, candidate, actor, "correction_published", reason)
        flush_changes(session)
        return existing
    public_content = {
        "kind": draft.kind,
        "case_type": draft.case_type,
        "title": draft.title,
        "slug": draft.slug,
        "summary": draft.summary,
        "glossary": [term.model_dump() for term in draft.glossary],
        "research_field": draft.research_field,
        "sections": [
            {
                "id": claim.field,
                "title": SECTION_TITLES[claim.field],
                "text": claim.text,
                "source_url": str(draft.source.url),
                "locator": claim.locator,
            }
            for claim in sorted(
                draft.claims, key=lambda item: list(SECTION_TITLES).index(item.field)
            )
        ],
        "source": {
            "title": draft.source.title,
            "url": str(draft.source.url),
            "doi": draft.source.doi,
        },
        "keywords": approved_keyword_labels(draft.keyword_ids),
        "score_total": total,
        # ID 기반 전문가 검색은 아직 없어 잘못된 skill=CAP...를 전달하지 않습니다.
        "expert_search_url": "/experts",
        # 새 게시에서도 근거 메모만 내보내지 않고 승인된 전체 본문을 보존합니다.
        "article": {**editorial_article, "publishedOn": utc_now().strftime("%Y.%m.%d")},
        "origin": "reviewed_article",
    }
    publication = Publication(
        candidate_id=candidate.id,
        revision=candidate.approved_revision,
        idempotency_key=key,
        slug=draft.slug,
        snapshot=public_content,
    )
    session.add(publication)
    candidate.status = "published"
    candidate.version += 1
    add_event(session, candidate, actor, "published", reason)
    flush_changes(session)
    return publication
