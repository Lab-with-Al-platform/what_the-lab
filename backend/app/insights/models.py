"""DB에 저장할 객체. 검토 자료와 공개 스냅샷은 서로 다른 테이블입니다."""

from datetime import UTC, date, datetime
from typing import ClassVar
from uuid import uuid4

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.insights.database import SCHEMA, Base


def new_id() -> str:
    return str(uuid4())


def utc_now() -> datetime:
    return datetime.now(UTC)


class Source(Base):
    __tablename__ = "sources"
    __table_args__: ClassVar[dict[str, str]] = {"schema": SCHEMA}

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    doi: Mapped[str | None] = mapped_column(String(255), unique=True)
    title: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(Text, unique=True)
    access_level: Mapped[str] = mapped_column(String(30))
    bibliography_checked: Mapped[bool]


class Candidate(Base):
    __tablename__ = "candidates"
    __table_args__ = (
        UniqueConstraint("source_id", "kind", name="uq_candidate_source_kind"),
        CheckConstraint("version >= 1", name="ck_candidate_version"),
        CheckConstraint(
            "status IN ('draft','pending_review','approved','published')",
            name="ck_candidate_status",
        ),
        {"schema": SCHEMA},
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    source_id: Mapped[str] = mapped_column(ForeignKey(f"{SCHEMA}.sources.id"))
    kind: Mapped[str] = mapped_column(String(10), default="case")
    status: Mapped[str] = mapped_column(String(30), default="draft")
    version: Mapped[int] = mapped_column(Integer, default=1)
    current_revision: Mapped[int] = mapped_column(Integer, default=1)
    approved_revision: Mapped[int | None] = mapped_column(Integer)
    approved_by: Mapped[str | None] = mapped_column(String(32))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Revision(Base):
    __tablename__ = "revisions"
    __table_args__ = (
        UniqueConstraint("candidate_id", "number", name="uq_candidate_revision"),
        {"schema": SCHEMA},
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    candidate_id: Mapped[str] = mapped_column(ForeignKey(f"{SCHEMA}.candidates.id"))
    number: Mapped[int] = mapped_column(Integer)
    # 첫 단계에서는 본문·근거·키워드·출처를 한 불변 JSON 버전으로 저장합니다.
    # 이후 정규화 테이블을 추가해도 승인된 이 스냅샷은 보존합니다.
    content: Mapped[dict] = mapped_column(JSON)
    created_by: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ReviewEvent(Base):
    __tablename__ = "review_events"
    __table_args__: ClassVar[dict[str, str]] = {"schema": SCHEMA}

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    candidate_id: Mapped[str] = mapped_column(ForeignKey(f"{SCHEMA}.candidates.id"))
    revision: Mapped[int] = mapped_column(Integer)
    action: Mapped[str] = mapped_column(String(30))
    actor_discord_id: Mapped[str] = mapped_column(String(32))
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Publication(Base):
    __tablename__ = "publications"
    __table_args__: ClassVar[dict[str, str]] = {"schema": SCHEMA}

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    candidate_id: Mapped[str] = mapped_column(
        ForeignKey(f"{SCHEMA}.candidates.id"),
        unique=True,
    )
    revision: Mapped[int] = mapped_column(Integer)
    idempotency_key: Mapped[str] = mapped_column(String(100), unique=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    snapshot: Mapped[dict] = mapped_column(JSON)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class CollectionSetting(Base):
    """팀 공통 설정만 보관합니다. 이 테이블 자체는 수집 작업을 실행하지 않습니다."""

    __tablename__ = "collection_settings"
    __table_args__ = (
        CheckConstraint("version >= 1", name="ck_collection_settings_version"),
        {"schema": SCHEMA},
    )

    id: Mapped[str] = mapped_column(String(30), primary_key=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    content: Mapped[dict] = mapped_column(JSON)
    updated_by: Mapped[str] = mapped_column(String(32))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class InsightPageView(Base):
    """공개 글 상세가 실제로 보인 한 번의 방문. 같은 event_id는 재시도로 한 번만 셉니다."""

    __tablename__ = "insight_page_views"
    __table_args__: ClassVar[dict[str, str]] = {"schema": SCHEMA}

    event_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    content_id: Mapped[str] = mapped_column(ForeignKey(f"{SCHEMA}.publications.id"))
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class InsightPageViewDaily(Base):
    """콘텐츠·한국 날짜별 조회수. 주·월 합은 이 일별 값을 더해 만들며 방문자 수에는 쓰지 않습니다."""

    __tablename__ = "insight_page_view_daily"
    __table_args__: ClassVar[dict[str, str]] = {"schema": SCHEMA}

    content_id: Mapped[str] = mapped_column(
        ForeignKey(f"{SCHEMA}.publications.id"), primary_key=True
    )
    view_date: Mapped[date] = mapped_column(Date, primary_key=True)
    page_views: Mapped[int] = mapped_column(Integer)


class TransferReceipt(Base):
    """한 신뢰 범위에서 받은 전송 묶음의 최초 접수. 후보 상태 enum과 섞지 않습니다."""

    __tablename__ = "transfer_receipts"
    __table_args__ = (
        UniqueConstraint("trust_scope", "bundle_id", name="uq_transfer_receipt_scope_bundle"),
        CheckConstraint(
            "outcome IN ('imported','existing_preserved')",
            name="ck_transfer_receipt_outcome",
        ),
        {"schema": SCHEMA},
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    # 서버/호출자가 정한 범위입니다. 외부 JSON이나 actor 문자열로 고르지 않습니다.
    trust_scope: Mapped[str] = mapped_column(String(64))
    bundle_id: Mapped[str] = mapped_column(String(100))
    # 한 회차에 여러 묶음이 있을 수 있어 run_id는 유일하지 않습니다.
    run_id: Mapped[str] = mapped_column(String(100))
    sha256: Mapped[str] = mapped_column(String(64))
    outcome: Mapped[str] = mapped_column(String(30))
    first_result: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class TransferReceiptItem(Base):
    """최초 접수 당시의 후보·판본 매핑. replay 때 현재 판본으로 바꾸지 않습니다."""

    __tablename__ = "transfer_receipt_items"
    __table_args__ = (
        UniqueConstraint("receipt_id", "item_index", name="uq_transfer_receipt_item_index"),
        CheckConstraint(
            "action IN ('created','existing_preserved','duplicate_in_batch')",
            name="ck_transfer_receipt_item_action",
        ),
        {"schema": SCHEMA},
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    receipt_id: Mapped[str] = mapped_column(ForeignKey(f"{SCHEMA}.transfer_receipts.id"))
    item_index: Mapped[int] = mapped_column(Integer)
    candidate_id: Mapped[str | None] = mapped_column(String(36))
    revision_number: Mapped[int | None] = mapped_column(Integer)
    action: Mapped[str] = mapped_column(String(30))
