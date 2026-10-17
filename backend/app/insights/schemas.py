"""외부 입력의 자료형, 길이, 허용값과 필드 조합을 확인합니다."""

import re
from datetime import datetime
from typing import Annotated, Literal, Self
from urllib.parse import unquote

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    field_validator,
    model_validator,
)

ShortText = Annotated[str, Field(min_length=1, max_length=1000)]
ClaimField = Literal[
    "research_problem",
    "bottleneck",
    "ai_role",
    "researcher_role",
    "input_data",
    "validation_method",
    "outcomes",
    "limitations",
]
REQUIRED_CLAIMS = {
    "research_problem",
    "bottleneck",
    "ai_role",
    "researcher_role",
    "input_data",
    "validation_method",
    "outcomes",
    "limitations",
}
SCORE_MAXIMUMS = {
    "real_domain_problem": 2,
    "bottleneck_contribution": 2,
    "role_separation": 2,
    "validation": 2,
    "transferability": 2,
    "input_data": 1,
    "limitations": 1,
}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


def normalize_doi(value: str | None) -> str | None:
    if value is None:
        return None
    result = unquote(value.strip()).lower()
    result = re.sub(r"^(?:https?://(?:dx\.)?doi\.org/|doi:\s*)", "", result)
    if not re.fullmatch(r"10\.\d{4,9}/[^\s?#]+", result):
        raise ValueError("DOI 형식을 확인해 주세요.")
    return result


class SourceInput(StrictModel):
    title: Annotated[str, Field(min_length=1, max_length=500)]
    doi: Annotated[str | None, Field(max_length=255)] = None
    url: HttpUrl
    access_level: Literal["open_authorized", "metadata_only", "restricted", "unknown"]
    bibliography_checked: bool = False

    @field_validator("doi")
    @classmethod
    def validate_doi(cls, value: str | None) -> str | None:
        return normalize_doi(value)

    @field_validator("url")
    @classmethod
    def require_https(cls, value: HttpUrl) -> HttpUrl:
        if value.scheme != "https" or value.username or value.password:
            raise ValueError("출처에는 자격증명 없는 HTTPS 주소를 사용하세요.")
        return value


class Claim(StrictModel):
    field: ClaimField
    text: ShortText
    locator: Annotated[str, Field(max_length=300)] = ""
    verification: Literal["verified", "needs_review", "unsupported"] = "needs_review"
    evidence_level: Literal["fulltext", "abstract", "official", "unavailable"]


class Score(StrictModel):
    criterion: Literal[
        "real_domain_problem",
        "bottleneck_contribution",
        "role_separation",
        "validation",
        "transferability",
        "input_data",
        "limitations",
    ]
    value: Annotated[int, Field(strict=True, ge=0, le=2)]
    rationale: ShortText

    @model_validator(mode="after")
    def check_bounds(self) -> Self:
        if self.value > SCORE_MAXIMUMS[self.criterion]:
            raise ValueError("이 평가 항목의 점수 상한을 초과했습니다.")
        return self


class Draft(StrictModel):
    source: SourceInput
    title: Annotated[str, Field(min_length=1, max_length=180)]
    slug: Annotated[str, Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=100)]
    summary: Annotated[str, Field(min_length=1, max_length=600)]
    research_field: Annotated[str, Field(min_length=1, max_length=100)]
    case_type: Literal["research", "practical"]
    claims: Annotated[list[Claim], Field(min_length=1, max_length=8)]
    scores: Annotated[list[Score], Field(max_length=7)] = Field(default_factory=list)
    keyword_ids: Annotated[list[str], Field(max_length=5)] = Field(default_factory=list)
    image_policy: Literal["no_image", "rights_checked"] = "no_image"

    @model_validator(mode="after")
    def reject_duplicates(self) -> Self:
        fields = [claim.field for claim in self.claims]
        criteria = [score.criterion for score in self.scores]
        if len(set(fields)) != len(fields) or len(set(criteria)) != len(criteria):
            raise ValueError("같은 주장 항목이나 평가 항목을 중복해서 저장할 수 없습니다.")
        if len(set(self.keyword_ids)) != len(self.keyword_ids):
            raise ValueError("키워드 ID가 중복되었습니다.")
        return self


class RevisionInput(StrictModel):
    expected_version: Annotated[int, Field(strict=True, ge=1)]
    draft: Draft
    reason: ShortText


class VersionInput(StrictModel):
    expected_version: Annotated[int, Field(strict=True, ge=1)]
    reason: ShortText


class ApprovalInput(VersionInput):
    editorial_checked: Literal[True]
    rights_checked: Literal[True]
    scheduled_for: datetime | None = None

    @field_validator("scheduled_for")
    @classmethod
    def require_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.utcoffset() is None:
            raise ValueError("예약 시각에 시간대를 포함해 주세요.")
        return value


class PublishInput(VersionInput):
    idempotency_key: Annotated[str, Field(min_length=8, max_length=100)]
