"""수집 설정과 기존 공개 원고의 비공개 수정본을 검증합니다."""

import ipaddress
import json
from typing import Annotated, Literal, Self
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.insights.collection_policy import DiscoveryPolicy
from app.insights.collection_sources import suggested_content_kinds
from app.insights.schemas import Draft, ShortText, SourceInput, StrictModel

Text = Annotated[str, Field(min_length=1, max_length=20000)]


class Paragraph(StrictModel):
    kind: Literal["body", "interpretation", "application", "caution"]
    text: Text


class ArticleStep(StrictModel):
    title: str
    detail: str


class ArticleTerm(StrictModel):
    id: str
    label: Annotated[str, Field(min_length=1, max_length=200)]
    definition: Text
    example: str | None = None
    caution: str | None = None


class ArticlePair(StrictModel):
    label: str
    value: str


class ArticleHighlight(StrictModel):
    label: str
    text: str


class ArticleTechnology(StrictModel):
    title: str
    description: str


class ArticleSection(BaseModel):
    model_config = ConfigDict(extra="allow")  # 이전 원고의 단계·칩·용어 참조도 보존합니다.
    id: Annotated[str, Field(pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_-]*$", max_length=100)]
    title: Annotated[str, Field(min_length=1, max_length=300)]
    toc: Annotated[str, Field(min_length=1, max_length=300)]
    paragraphs: Annotated[list[Text | Paragraph], Field(min_length=1, max_length=100)]
    termIds: list[str] = Field(default_factory=list)
    steps: list[ArticleStep] = Field(default_factory=list)
    chips: list[str] = Field(default_factory=list)


class ArticleDocument(BaseModel):
    """본문을 8개 짧은 주장으로 줄이지 않고 원래의 구조 그대로 보존합니다."""

    model_config = ConfigDict(extra="allow")
    slug: Annotated[str, Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=100)]
    kind: Literal["case", "trend"]
    title: Annotated[str, Field(min_length=1, max_length=180)]
    summary: Annotated[str, Field(min_length=1, max_length=600)]
    field: Annotated[str, Field(min_length=1, max_length=100)]
    sourceUrl: str
    doi: str | None = None
    sections: Annotated[list[ArticleSection], Field(min_length=1, max_length=50)]
    topicId: str
    topicLabel: str
    domains: list[str]
    tags: list[str]
    source: str
    publishedOn: str
    readingMinutes: Annotated[int, Field(ge=1, le=300)]
    cover: Literal[
        "cells",
        "biomass",
        "dental",
        "concrete",
        "coScientist",
        "mattergen",
        "alphaEvolve",
        "turbines",
        "brain",
        "protein",
        "climate",
        "battery",
        "flow",
        "molecule",
        "script",
        "solar",
        "audio",
        "agent",
        "food",
        "medical",
        "chart",
    ]
    coverSrc: str | None = None
    highlights: list[ArticleHighlight]
    facts: list[ArticlePair]
    technologies: list[ArticleTechnology]
    relatedSlugs: list[str]
    glossary: list[ArticleTerm] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_article(self) -> Self:
        SourceInput(title=self.title, url=self.sourceUrl, doi=self.doi, access_level="unknown")
        ids = [section.id for section in self.sections]
        if len(set(ids)) != len(ids):
            raise ValueError("본문 섹션 ID가 중복되었습니다.")
        if self.coverSrc and (
            not self.coverSrc.startswith("/")
            or self.coverSrc.startswith("//")
            or ".." in self.coverSrc
        ):
            raise ValueError("표지는 기존 사이트 내부 파일 경로만 사용할 수 있습니다.")
        if len(json.dumps(self.model_dump(mode="json"), ensure_ascii=False)) > 300000:
            raise ValueError("원고 크기가 300,000자를 초과했습니다.")
        return self


class ArticleRevisionInput(StrictModel):
    expected_version: Annotated[int, Field(strict=True, ge=1)]
    article: ArticleDocument
    draft: Draft
    reason: ShortText


class CollectionSource(StrictModel):
    name: Annotated[str, Field(min_length=1, max_length=100)]
    url: Annotated[str, Field(min_length=1, max_length=1000)]
    selected: bool = Field(default=True, strict=True)
    content_kinds: Annotated[list[Literal["case", "trend"]], Field(max_length=2)] = Field(
        default_factory=list
    )

    @model_validator(mode="before")
    @classmethod
    def legacy_content_kinds(cls, value: object) -> object:
        # 예전 설정에 필드가 없을 때만 알려진 출처의 제안을 보완합니다.
        # 사용자가 직접 비워 둔 []는 미분류라는 선택이므로 보존합니다.
        if isinstance(value, dict) and "content_kinds" not in value:
            return {**value, "content_kinds": suggested_content_kinds(str(value.get("url", "")))}
        return value

    @model_validator(mode="after")
    def validate_url(self) -> Self:
        if len(set(self.content_kinds)) != len(self.content_kinds):
            raise ValueError("출처 용도가 중복되었습니다.")
        # 아직 접속하지 않지만, 향후 수집기에 내부 서버 주소를 넘기지 않도록 제한합니다.
        parts = urlsplit(self.url)
        host = (parts.hostname or "").lower()
        if (
            parts.scheme != "https"
            or parts.username
            or parts.password
            or parts.fragment
            or parts.query
        ):
            raise ValueError("출처는 자격증명·검색 매개변수 없는 HTTPS 기본 주소여야 합니다.")
        if not host or "." not in host or host.endswith((".local", ".localhost", ".internal")):
            raise ValueError("외부 공개 출처의 도메인을 사용하세요.")
        try:
            ipaddress.ip_address(host)
        except ValueError:
            pass
        else:
            raise ValueError("출처에는 IP 주소 대신 공개 도메인을 사용하세요.")
        if parts.port not in (None, 443):
            raise ValueError("출처 포트는 HTTPS 기본 포트만 허용합니다.")
        return self


class CollectionConfig(StrictModel):
    interval_days: Annotated[int, Field(strict=True, ge=1, le=30)] = 7
    preferred_time: Annotated[str, Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")] = "09:00"
    timezone: Literal["Asia/Seoul"] = "Asia/Seoul"
    lookback_days: Annotated[int, Field(strict=True, ge=1, le=365)] = 30
    max_items: Annotated[int, Field(strict=True, ge=1, le=50)] = 6
    discovery_policy: DiscoveryPolicy = Field(default_factory=DiscoveryPolicy)
    keywords: Annotated[
        list[Annotated[str, Field(min_length=1, max_length=64)]], Field(max_length=20)
    ] = Field(default_factory=list)
    sources: Annotated[list[CollectionSource], Field(min_length=1, max_length=20)]

    @model_validator(mode="before")
    @classmethod
    def legacy_discovery_policy(cls, value: object) -> object:
        # 예전 설정을 조회했다는 이유로 자동 확장을 켜거나 저장 상한을 바꾸지 않습니다.
        if isinstance(value, dict) and "discovery_policy" not in value:
            maximum = value.get("max_items", 6)
            target = min(3, maximum) if type(maximum) is int and maximum >= 1 else 1
            return {**value, "discovery_policy": {"enabled": False, "target_candidates": target}}
        return value

    @model_validator(mode="after")
    def no_duplicates(self) -> Self:
        if self.discovery_policy.target_candidates > self.max_items:
            raise ValueError("기간 확장 기준 후보 수는 최대 저장 수를 넘을 수 없습니다.")
        if self.discovery_policy.enabled and self.lookback_days != 30:
            raise ValueError("단계별 확장을 사용할 때 우선 탐색 기간은 30일입니다.")
        urls = [source.url.rstrip("/").lower() for source in self.sources]
        if len(set(urls)) != len(urls) or len(set(self.keywords)) != len(self.keywords):
            raise ValueError("출처 URL 또는 검색 키워드가 중복되었습니다.")
        return self


class CollectionConfigInput(StrictModel):
    expected_version: Annotated[int, Field(strict=True, ge=0)]
    config: CollectionConfig
