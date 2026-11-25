"""수집 메모와 게시용 본문을 나누고, 설명 검수의 누락을 표시합니다."""

from copy import deepcopy

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.insights.models import Candidate, Publication, Revision
from app.insights.schemas import Draft
from app.insights.workspace_schemas import ArticleDocument

ARTICLE_FORMATS = {"article_draft_v1", "article_review_v1"}
READING_LABELS = {
    "clear_question": "연구 질문과 독자가 얻는 도움이 분명함",
    "input_output": "입력 → AI 출력 → 사람의 확인을 설명함",
    "plain_language": "전문용어를 본문 문맥에서도 쉽게 설명함",
    "concrete_example": "구체적인 예시와 작은 평가 방법이 있음",
    "limitations": "실패 조건·적용 한계를 설명함",
    "source_separation": "원문 사실과 해석·적용 제안을 구분함",
}


def current_revision(session: Session, candidate: Candidate) -> Revision:
    revision = session.scalar(
        select(Revision).where(
            Revision.candidate_id == candidate.id, Revision.number == candidate.current_revision
        )
    )
    if revision is None:
        raise HTTPException(409, "현재 판본을 찾을 수 없습니다.")
    return revision


def content_stage(content: dict) -> str:
    if content.get("format") == "legacy_article_v1":
        return "legacy_public"
    return "article_draft" if content.get("format") in ARTICLE_FORMATS else "collection_note"


def editorial_report(content: dict) -> dict:
    """자동 검사는 구조의 누락만 찾습니다. 글자 수로 이해도·사실성을 판정하지 않습니다."""
    stage = content_stage(content)
    article = content.get("article") or {}
    paragraphs = [
        p for section in article.get("sections", []) for p in section.get("paragraphs", [])
    ]
    kinds = {p.get("kind", "body") for p in paragraphs if isinstance(p, dict)}
    issues = []
    if stage != "article_draft":
        issues.append("수집 메모가 아닌 별도 게시용 원고를 작성해야 합니다.")
    if not paragraphs:
        issues.append("게시용 본문이 없습니다.")
    if not article.get("glossary"):
        issues.append("용어 풀이를 보완해 주세요.")
    for kind, label in (
        ("interpretation", "쉬운 해설"),
        ("application", "적용 예시·작은 평가"),
        ("caution", "한계·주의점"),
    ):
        if kind not in kinds:
            issues.append(f"{label} 문단을 구분해 작성해 주세요.")
    return {
        "stage": stage,
        "ready": not issues,
        "issues": issues,
        "paragraph_count": len(paragraphs),
        "body_characters": sum(
            len(p if isinstance(p, str) else p.get("text", "")) for p in paragraphs
        ),
    }


def validate_editorial(session: Session, candidate: Candidate) -> dict:
    content = current_revision(session, candidate).content
    report = editorial_report(content)
    if not report["ready"]:
        raise HTTPException(422, "게시용 원고 보완 필요: " + " ".join(report["issues"]))
    ArticleDocument.model_validate(content["article"])
    return content["article"]


def notes_to_article(draft: Draft) -> dict:
    """메모를 편집 가능한 틀로 옮깁니다. 자동 집필·검증 완료 처리는 아닙니다."""
    from app.insights.service import SECTION_TITLES

    return {
        "slug": draft.slug,
        "kind": draft.kind,
        "title": draft.title,
        "summary": draft.summary,
        "field": draft.research_field,
        "topicId": "research",
        "topicLabel": draft.research_field,
        "domains": [draft.research_field],
        "tags": draft.classification_tags,
        "source": draft.source.title,
        "sourceUrl": str(draft.source.url),
        "doi": draft.source.doi,
        "publishedOn": "미게시",
        "readingMinutes": 1,
        "cover": "chart",
        "coverSrc": None,
        "sampleNotice": "미게시 초안 · 출처 검토·편집 검수·최종 승인은 별도입니다. 삽화는 아직 없습니다.",
        "highlights": [],
        "facts": [],
        "technologies": [],
        "relatedSlugs": [],
        "glossary": [
            {"id": f"term-{i}", **term.model_dump()} for i, term in enumerate(draft.glossary)
        ],
        "sections": [
            {
                "id": claim.field,
                "toc": SECTION_TITLES[claim.field],
                "title": SECTION_TITLES[claim.field],
                "paragraphs": [claim.text],
            }
            for claim in draft.claims
        ],
    }


def start_article_draft(
    session: Session,
    candidate_id: str,
    version: int,
    actor: str,
    reason: str,
    article: dict | None = None,
) -> Candidate:
    from app.insights import service

    candidate = service.get_candidate(session, candidate_id, version)
    if session.scalar(select(Publication.id).where(Publication.candidate_id == candidate.id)):
        raise HTTPException(409, "게시글은 공개본 보존 수정 초안 절차를 사용하세요.")
    previous = current_revision(session, candidate)
    if content_stage(previous.content) != "collection_note":
        raise HTTPException(409, "이미 게시용 원고가 있습니다. 기존 원고를 편집하세요.")
    draft = service.current_draft(session, candidate)
    document = ArticleDocument.model_validate(article or notes_to_article(draft)).model_dump(
        mode="json", exclude_none=True
    )
    if (
        document["slug"],
        document["kind"],
        document["title"],
        document["summary"],
        document["field"],
    ) != (draft.slug, draft.kind, draft.title, draft.summary, draft.research_field):
        raise HTTPException(422, "원고의 주소·유형·제목·요약·분야가 수집 메모와 일치해야 합니다.")
    if document["sourceUrl"] != str(draft.source.url) or document.get("doi") != draft.source.doi:
        raise HTTPException(422, "원고와 수집 메모의 출처가 다릅니다.")
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
                "format": "article_draft_v1",
                "title": document["title"],
                "summary": document["summary"],
                "article": document,
                "draft": deepcopy(draft.model_dump(mode="json")),
            },
        )
    )
    service.add_event(session, candidate, actor, "article_drafted", reason)
    service.flush_changes(session)
    return candidate
