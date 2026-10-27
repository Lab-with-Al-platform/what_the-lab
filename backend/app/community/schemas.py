"""브라우저가 전달하는 값은 권한·승인 정보로 사용하지 않습니다."""

import unicodedata
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

Category = Literal["question", "story", "idea", "support", "chat", "notice"]
Area = Literal["general", "account", "experts", "research", "insights", "community"]


class StrictInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("*", mode="after")
    @classmethod
    def reject_invalid_text(cls, value):
        if isinstance(value, str) and any(
            (ord(char) < 32 and char not in "\n\r\t") or 0xD800 <= ord(char) <= 0xDFFF
            for char in value
        ):
            raise ValueError("저장할 수 없는 제어 문자가 포함되어 있습니다.")
        return value


class PostContent(StrictInput):
    title: str = Field(min_length=3, max_length=120)
    body: str = Field(min_length=10, max_length=15000)
    category: Category
    visibility: Literal["public", "private"]
    tags: list[str] = Field(default_factory=list, max_length=5)
    area: Area = "general"
    insight_slug: str | None = Field(default=None, max_length=100)

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, tags: list[str]) -> list[str]:
        cleaned = list(
            dict.fromkeys(
                unicodedata.normalize("NFKC", tag).strip().lstrip("#").strip()
                for tag in tags
                if tag.strip()
            )
        )
        if any(
            not tag
            or len(tag) > 20
            or any(c in tag for c in "<>/\\")
            or any(ord(c) < 32 or 0xD800 <= ord(c) <= 0xDFFF for c in tag)
            for tag in cleaned
        ):
            raise ValueError("태그는 1~20자의 일반 텍스트로 입력해 주세요.")
        return cleaned


class CreatePost(PostContent):
    client_token: UUID


class EditPost(PostContent):
    expected_version: int = Field(ge=1, strict=True)


class VersionInput(StrictInput):
    expected_version: int = Field(ge=1, strict=True)


class CommentInput(StrictInput):
    body: str = Field(min_length=1, max_length=5000)
    client_token: UUID


class EditComment(VersionInput):
    body: str = Field(min_length=1, max_length=5000)


class DeleteComment(VersionInput):
    reason: str = Field(default="", max_length=450)


class ToggleInput(StrictInput):
    enabled: bool = Field(strict=True)


class StatusInput(VersionInput):
    status: Literal["open", "in_progress", "resolved"]
    accepted_comment_id: UUID | None = None
    accepted_comment_version: int | None = Field(default=None, ge=1, strict=True)


class ReportInput(StrictInput):
    reason: Literal["privacy", "spam", "abuse", "other"]
    detail: str = Field(default="", max_length=500)


class ModerationInput(VersionInput):
    action: Literal["hide", "restore", "pin", "unpin", "dismiss_reports"]
    reason: str = Field(min_length=3, max_length=500)
