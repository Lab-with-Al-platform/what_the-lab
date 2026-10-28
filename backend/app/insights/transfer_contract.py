"""외부 AI의 근거 메모와 전체 원고를 DB 접속 없이 검사합니다."""

import hashlib
import json
import re
from datetime import date
from pathlib import Path
from typing import Annotated, Literal, Self

from pydantic import AwareDatetime, ConfigDict, Field, ValidationError, model_validator

from app.insights.schemas import Draft, SourceInput, StrictModel, normalize_doi
from app.insights.workspace_schemas import ArticleDocument, ArticleSection

MAX_TRANSFER_BYTES = 2 * 1024 * 1024
MAX_TRANSFER_ITEMS = 10
Identifier = Annotated[str, Field(min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")]
Note = Annotated[str, Field(min_length=1, max_length=2000)]


class TransferError(ValueError):
    """입력 원문이나 비밀값을 포함하지 않는 검사 오류입니다."""


class PublicationDate(StrictModel):
    value: str | None
    precision: Literal["day", "month", "year", "unknown"]

    @model_validator(mode="after")
    def check_precision(self) -> Self:
        # 모르는 발표일을 수집일로 채우면 오래된 자료가 최신 자료처럼 보입니다.
        if self.precision == "unknown":
            if self.value is not None:
                raise ValueError("미상 발표일은 null이어야 합니다.")
            return self
        patterns = {"day": r"\d{4}-\d{2}-\d{2}", "month": r"\d{4}-\d{2}", "year": r"\d{4}"}
        if self.value is None or not re.fullmatch(patterns[self.precision], self.value):
            raise ValueError("발표일과 정밀도를 확인하세요.")
        suffix = {"day": "", "month": "-01", "year": "-01-01"}[self.precision]
        date.fromisoformat(self.value + suffix)
        return self


class GeneratorInfo(StrictModel):
    tool: Annotated[str, Field(min_length=1, max_length=100)]
    model: Annotated[str, Field(min_length=1, max_length=100)]
    prompt_version: Identifier


class TransferSection(ArticleSection):
    # 기존 편집기는 과거 속성을 보존하지만, 새 전송에서는 오타를 조용히 버리지 않습니다.
    model_config = ConfigDict(extra="forbid")


class TransferArticle(ArticleDocument):
    model_config = ConfigDict(extra="forbid")
    sections: Annotated[list[TransferSection], Field(min_length=1, max_length=50)]
    institution: str | None = None
    imageAlt: str | None = None
    imageCaption: str | None = None
    sampleNotice: str | None = None
    featured: bool = Field(default=False, strict=True)
    companionSlug: str | None = None

    @model_validator(mode="after")
    def check_term_references(self) -> Self:
        term_ids = [term.id for term in self.glossary]
        if len(set(term_ids)) != len(term_ids):
            raise ValueError("용어 ID가 중복되었습니다.")
        if any(term_id not in term_ids for section in self.sections for term_id in section.termIds):
            raise ValueError("본문이 참조한 용어 설명이 없습니다.")
        return self


class TransferItem(StrictModel):
    draft: Draft
    article: TransferArticle
    source_published: PublicationDate
    source_checked_at: AwareDatetime
    access_notes: Note
    rights_notes: Note

    @model_validator(mode="after")
    def check_consistency(self) -> Self:
        draft, article = self.draft, self.article
        pairs = (
            (draft.slug, article.slug),
            (draft.kind, article.kind),
            (draft.title, article.title),
            (draft.summary, article.summary),
            (draft.research_field, article.field),
        )
        if any(left != right for left, right in pairs):
            raise ValueError("근거 메모와 전체 원고의 식별·요약 정보가 다릅니다.")
        source = SourceInput(
            title=article.title, url=article.sourceUrl, doi=article.doi, access_level="unknown"
        )
        if source.url != draft.source.url or normalize_doi(article.doi) != draft.source.doi:
            raise ValueError("근거 메모와 전체 원고의 원출처가 다릅니다.")
        if article.coverSrc is not None or draft.image_policy != "no_image":
            raise ValueError("초기 전송은 이미지 없이 보내고 삽화는 별도 검토합니다.")
        return self


class TransferBundle(StrictModel):
    schema_version: Literal["insight_transfer_v1"]
    bundle_id: Identifier
    run_id: Identifier
    generated_at: AwareDatetime
    settings_version: Identifier
    generator: GeneratorInfo
    items: Annotated[list[TransferItem], Field(min_length=1, max_length=MAX_TRANSFER_ITEMS)]

    @model_validator(mode="after")
    def check_duplicates(self) -> Self:
        slugs: set[str] = set()
        sources: set[tuple[str, str]] = set()
        for item in self.items:
            draft = item.draft
            keys = {(draft.kind, str(draft.source.url))}
            if draft.source.doi:
                keys.add((draft.kind, draft.source.doi))
            if draft.slug in slugs or sources.intersection(keys):
                raise ValueError("묶음 안의 주소 또는 같은 유형의 원출처가 중복되었습니다.")
            if item.source_checked_at > self.generated_at:
                raise ValueError("출처 확인 시각이 묶음 생성 시각보다 늦습니다.")
            slugs.add(draft.slug)
            sources.update(keys)
        return self


def _unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise TransferError("JSON에 중복 필드가 있습니다.")
        result[key] = value
    return result


def _reject_non_finite(value: str) -> None:
    raise TransferError("JSON에는 NaN·Infinity를 사용할 수 없습니다.")


def validate_transfer_bytes(raw: bytes) -> TransferBundle:
    """용량·JSON 문법·데이터 계약을 순서대로 검사하며 네트워크를 사용하지 않습니다."""
    if len(raw) > MAX_TRANSFER_BYTES:
        raise TransferError("전송 파일은 2 MiB 이하여야 합니다.")
    try:
        payload = json.loads(
            raw.decode("utf-8"), object_pairs_hook=_unique_object, parse_constant=_reject_non_finite
        )
        return TransferBundle.model_validate(payload)
    except TransferError:
        raise
    except ValidationError as error:
        # Pydantic의 기본 오류 문자열에는 실제 입력값이 들어갈 수 있어 출력하지 않습니다.
        raise TransferError(f"전송 계약 검사 실패: {error.error_count()}개 항목.") from error
    except (ValueError, RecursionError) as error:
        # JSON 문법·문자 인코딩뿐 아니라 Python의 큰 정수 제한도 안전하게 처리합니다.
        raise TransferError("UTF-8 JSON 형식이나 중첩 깊이를 확인하세요.") from error


def load_transfer_file(path: Path, root: Path) -> tuple[TransferBundle, str]:
    """명시한 폴더 내부의 일반 JSON 파일만 읽고 원본 바이트의 SHA-256을 반환합니다."""
    if ".." in path.parts or ".." in root.parts:
        raise TransferError("상위 경로 이동은 허용하지 않습니다.")
    candidate = path if path.is_absolute() else root / path
    try:
        # 심볼릭 링크와 Windows junction을 따라 외부 파일을 읽지 않도록 먼저 검사합니다.
        if any(part.is_symlink() or part.is_junction() for part in (candidate, *candidate.parents)):
            raise TransferError("링크 경로는 허용하지 않습니다.")
        resolved_root = root.resolve(strict=True)
        resolved = candidate.resolve(strict=True)
        if not resolved.is_relative_to(resolved_root) or not resolved.is_file():
            raise TransferError("허용 폴더 안의 일반 파일을 지정하세요.")
        if resolved.suffix != ".json":
            raise TransferError(".json 파일만 허용합니다.")
        # stat 검사만으로 끝내지 않고 실제 읽기도 제한합니다.
        with resolved.open("rb") as stream:
            raw = stream.read(MAX_TRANSFER_BYTES + 1)
    except OSError as error:
        raise TransferError("전송 파일 또는 허용 폴더를 읽을 수 없습니다.") from error
    return validate_transfer_bytes(raw), hashlib.sha256(raw).hexdigest()
