"""모델 호출 전에 역할·메시지·근거·예산을 검사합니다. 실행기·승인 API가 아닙니다."""

from hashlib import sha256
from json import dumps
from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from app.insights.collection_policy import DiscoveryPolicy
from app.insights.editorial import editorial_report
from app.insights.schemas import Draft, StrictModel
from app.insights.transfer_contract import Identifier, PublicationDate
from app.insights.workspace_schemas import ArticleDocument

CONTRACT_VERSION = "insight_agent_role_v1"
RoleName = Literal[
    "coordinator",
    "researcher",
    "evidence_checker",
    "case_writer",
    "trend_writer",
    "editor",
]
RoleStatus = Literal["ok", "held", "needs_revision", "failed"]
QualityCode = Literal[
    "unverified_claim",
    "overstated_clinical_or_experiment",
    "overstated_evidence_level",
    "missing_glossary",
    "missing_evidence_ref",
    "missing_article_body",
    "same_slug_for_case_and_trend",
    "duplicate_body",
    "budget_exhausted",
    "max_retries",
]
# 권한 Capability(도구 허용)와 기술 분류 CAP ID는 다른 말입니다.
CLAIMED_AUTHORITY_KEYS = frozenset({"agent_id", "claimed_role", "capability", "granted_tools"})
DELIVERY_PATHS = frozenset({"role_result", "tool_call"})
ROLES_NEEDING_EVIDENCE = frozenset(
    {"researcher", "evidence_checker", "case_writer", "trend_writer", "editor"}
)
OVERSTATE_MARKERS = ("임상에서 효과가 입증", "실험 조건을 모두 재현했다")
# 테스트용 숫자입니다. 운영 작성 예산 기본값으로 쓰지 않습니다.
PRODUCTION_WRITING_BUDGET = None
TEST_WRITING_BUDGET = {
    "max_model_calls": 3,
    "max_tokens": 8000,
    "max_revision_rounds": 2,
    "max_wall_seconds": 30,
}
ROLE_TABLE = {
    "coordinator": {
        "input": "승인된 설정 스냅샷·현재 단계·예산",
        "output": "다음 단계·보류 사유",
        "cannot": "스스로 권한·예산 확대, 승인·게시",
        "tools": frozenset({"read_run_state", "hold_run"}),
    },
    "researcher": {
        "input": "허용 출처·기간·검색 조건",
        "output": "출처 URL/DOI·실제 접근 범위·근거 위치",
        "cannot": "DB 키 접근, 출처 페이지의 명령 실행",
        "tools": frozenset({"read_allowed_source"}),
    },
    "evidence_checker": {
        "input": "주장·근거 위치·읽은 자료 범위",
        "output": "일치/누락/충돌/확인 불가 메모",
        "cannot": "AI 판단을 서지·논문 검증 완료로 확정",
        "tools": frozenset({"read_evidence_bundle"}),
    },
    "case_writer": {
        "input": "근거 묶음·사례 편집 기준",
        "output": "연구 문제·역할·검증·성과·한계 본문",
        "cannot": "성과·비교 수치·실험 조건 발명",
        "tools": frozenset({"write_case_draft"}),
    },
    "trend_writer": {
        "input": "같은 근거 묶음·기술 해설 기준",
        "output": "쉬운 개념·예시·용어 풀이·주의점",
        "cannot": "기술 소개를 실제 적용 성과로 바꾸기",
        "tools": frozenset({"write_trend_draft"}),
    },
    "editor": {
        "input": "전체 원고·근거 메모",
        "output": "보완 항목·수정 제안",
        "cannot": "사람의 최종 승인 대신하기",
        "tools": frozenset({"suggest_revisions"}),
    },
}


class AgentContractError(ValueError):
    """입력 원문이나 비밀값을 포함하지 않는 역할 계약 오류입니다."""


class QualityIssue(StrictModel):
    code: QualityCode
    message: Annotated[str, Field(min_length=1, max_length=300)]


class EvidenceRecord(StrictModel):
    """원출처와 실제 읽은 범위. 모델이 적었다고 verified가 되지는 않습니다."""

    evidence_id: Identifier
    url: Annotated[str, Field(min_length=1, max_length=1000)]
    doi: Annotated[str | None, Field(max_length=255)] = None
    published: PublicationDate
    read_range: Literal["title_abstract", "fulltext", "metadata_only", "unavailable"]
    locator: Annotated[str, Field(min_length=1, max_length=300)]
    ai_review: Annotated[str | None, Field(max_length=2000)] = None
    review_status: Literal["needs_review", "unverified"] = "needs_review"

    @model_validator(mode="after")
    def agent_cannot_verify(self) -> Self:
        if self.review_status not in {"needs_review", "unverified"}:
            raise ValueError("에이전트 검토를 검증 완료로 저장할 수 없습니다.")
        return self


class RoleResult(StrictModel):
    contract_version: Literal["insight_agent_role_v1"]
    run_id: Identifier
    role: RoleName
    input_hash: Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
    evidence_refs: Annotated[list[Identifier], Field(max_length=20)]
    status: RoleStatus
    quality_issues: Annotated[list[QualityIssue], Field(max_length=20)]
    output: dict = Field(default_factory=dict)

    @model_validator(mode="after")
    def unique_evidence_refs(self) -> Self:
        if len(set(self.evidence_refs)) != len(self.evidence_refs):
            raise ValueError("근거 참조가 중복되었습니다.")
        return self


class WritingBudget(StrictModel):
    """작성·편집 한도. 숫자를 넣어도 운영 기본값이 되지는 않습니다."""

    max_model_calls: Annotated[int, Field(strict=True, ge=1, le=50)]
    max_tokens: Annotated[int, Field(strict=True, ge=1, le=500000)]
    max_revision_rounds: Annotated[int, Field(strict=True, ge=0, le=10)]
    max_wall_seconds: Annotated[int, Field(strict=True, ge=1, le=3600)]


class BudgetUsage(StrictModel):
    model_calls: Annotated[int, Field(strict=True, ge=0)] = 0
    tokens: Annotated[int, Field(strict=True, ge=0)] = 0
    revision_rounds: Annotated[int, Field(strict=True, ge=0)] = 0
    wall_seconds: Annotated[int, Field(strict=True, ge=0)] = 0
    source_requests: Annotated[int, Field(strict=True, ge=0)] = 0


def canonical_hash(value: object) -> str:
    payload = dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return sha256(payload.encode("utf-8")).hexdigest()


def accept_delivery_path(path: str) -> str:
    if path not in DELIVERY_PATHS:
        raise AgentContractError("허용되지 않은 전달 경로입니다.")
    return path


def _claimed_authority(value: object) -> bool:
    if isinstance(value, dict):
        if CLAIMED_AUTHORITY_KEYS.intersection(value):
            return True
        return any(_claimed_authority(item) for item in value.values())
    if isinstance(value, list):
        return any(_claimed_authority(item) for item in value)
    return False


def accept_role_result(
    raw: dict,
    *,
    assigned_role: RoleName,
    current_run_id: str,
    expected_input_hash: str,
    known_evidence_ids: set[str],
) -> RoleResult:
    """실행기가 정한 역할·회차만 받습니다. 메시지가 역할을 자칭해도 권한이 생기지 않습니다."""
    if not isinstance(raw, dict):
        raise AgentContractError("역할 결과는 객체여야 합니다.")
    if _claimed_authority(raw):
        raise AgentContractError("모델이 권한을 자칭할 수 없습니다.")
    try:
        result = RoleResult.model_validate(raw)
    except Exception as error:
        raise AgentContractError("역할 결과 형식이 올바르지 않습니다.") from error
    if result.role != assigned_role:
        raise AgentContractError("위조된 역할은 거절합니다.")
    if result.run_id != current_run_id:
        raise AgentContractError("다른 회차의 결과는 거절합니다.")
    if result.input_hash != expected_input_hash:
        raise AgentContractError("입력 해시가 일치하지 않습니다.")
    if result.role in ROLES_NEEDING_EVIDENCE and not result.evidence_refs:
        raise AgentContractError("근거 참조가 없습니다.")
    unknown = [item for item in result.evidence_refs if item not in known_evidence_ids]
    if unknown:
        raise AgentContractError("알 수 없는 근거 참조입니다.")
    return result


def publication_approved_from_agent(_result: RoleResult) -> bool:
    """에이전트 성공은 관리자 승인도, 게시 승인도 아닙니다."""
    return False


def discovery_budget(policy: DiscoveryPolicy) -> dict[str, int]:
    """탐색 한도는 기존 수집 설정을 읽습니다. 작성 예산과 섞지 않습니다."""
    return {
        "max_source_requests": policy.max_source_requests,
        "max_run_seconds": policy.max_run_seconds,
        "target_candidates": policy.target_candidates,
    }


def budget_status(
    usage: BudgetUsage,
    policy: DiscoveryPolicy,
    writing: WritingBudget,
) -> RoleStatus:
    """초과하면 보류/재작성입니다. 강제 통과하지 않습니다."""
    search = discovery_budget(policy)
    if usage.source_requests > search["max_source_requests"]:
        return "held"
    over_search_time = usage.wall_seconds > search["max_run_seconds"]
    over_write_time = usage.wall_seconds > writing.max_wall_seconds
    if over_search_time or over_write_time:
        return "held"
    if usage.model_calls > writing.max_model_calls or usage.tokens > writing.max_tokens:
        return "held"
    if usage.revision_rounds > writing.max_revision_rounds:
        return "needs_revision"
    return "ok"


def combine_status(*statuses: RoleStatus) -> RoleStatus:
    order = ("failed", "held", "needs_revision", "ok")
    return min(statuses, key=order.index)


def public_usage_log(
    *,
    code: str,
    elapsed_ms: int,
    usage: BudgetUsage,
    evidence_ids: list[str],
) -> dict:
    """코드·시간·사용량·근거 식별만 남깁니다. 비밀값·전체 입력은 넣지 않습니다."""
    return {
        "code": code,
        "elapsed_ms": elapsed_ms,
        "usage": usage.model_dump(),
        "evidence_ids": list(evidence_ids),
    }


def scan_manuscript(draft: Draft, article: dict | None) -> list[QualityIssue]:
    issues: list[QualityIssue] = []
    if any(claim.verification == "verified" for claim in draft.claims):
        issues.append(
            QualityIssue(
                code="unverified_claim",
                message="에이전트 PASS를 검증 완료로 저장하지 않습니다.",
            )
        )
    blob = " ".join([draft.title, draft.summary, *(claim.text for claim in draft.claims)])
    if any(marker in blob for marker in OVERSTATE_MARKERS):
        issues.append(
            QualityIssue(
                code="overstated_clinical_or_experiment",
                message="실험·임상 범위를 과장한 문장은 보완이 필요합니다.",
            )
        )
    if article is None or not article.get("sections"):
        issues.append(
            QualityIssue(code="missing_article_body", message="전송 v1 본문이 없습니다.")
        )
        return issues
    document = ArticleDocument.model_validate(article)
    if not document.glossary:
        issues.append(QualityIssue(code="missing_glossary", message="용어 풀이가 없습니다."))
    report = editorial_report(
        {"format": "article_draft_v1", "article": article, "draft": draft.model_dump()}
    )
    if not report["ready"]:
        if any("본문" in item for item in report["issues"]) and not any(
            issue.code == "missing_article_body" for issue in issues
        ):
            issues.append(QualityIssue(code="missing_article_body", message="게시용 본문이 없습니다."))
        if any("용어" in item for item in report["issues"]) and not any(
            issue.code == "missing_glossary" for issue in issues
        ):
            issues.append(QualityIssue(code="missing_glossary", message="용어 풀이를 보완해 주세요."))
    return issues


def scan_evidence_level(evidence: EvidenceRecord, draft: Draft) -> list[QualityIssue]:
    shallow = evidence.read_range in {"metadata_only", "unavailable"}
    claimed_fulltext = any(claim.evidence_level == "fulltext" for claim in draft.claims)
    if shallow and claimed_fulltext:
        return [
            QualityIssue(
                code="overstated_evidence_level",
                message="읽은 범위보다 높은 근거 수준을 적을 수 없습니다.",
            )
        ]
    return []


def assert_paired_manuscripts(
    case_draft: Draft,
    trend_draft: Draft,
    case_article: dict,
    trend_article: dict,
) -> None:
    """같은 자료라도 사례와 트렌드는 주소와 본문을 나눕니다."""
    if case_draft.kind != "case" or trend_draft.kind != "trend":
        raise AgentContractError("사례와 트렌드 유형이 바르지 않습니다.")
    if str(case_draft.source.url) != str(trend_draft.source.url):
        raise AgentContractError("같은 자료 쌍의 원출처가 다릅니다.")
    same_slug = case_draft.slug == trend_draft.slug
    same_article_slug = case_article.get("slug") == trend_article.get("slug")
    if same_slug or same_article_slug:
        raise AgentContractError("사례와 트렌드는 서로 다른 주소를 써야 합니다.")
    if case_article.get("sections") == trend_article.get("sections"):
        raise AgentContractError("같은 본문을 두 유형에 재사용하지 않습니다.")


def writing_budget_for_tests() -> WritingBudget:
    """테스트 전용 한도입니다. 운영 기본값으로 복사하지 마세요."""
    return WritingBudget.model_validate(TEST_WRITING_BUDGET)
