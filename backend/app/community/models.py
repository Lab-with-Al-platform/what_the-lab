"""게시판 전용 테이블. 사용자 FK는 공통 users를 참조하도록 migration에서 추가합니다."""

from datetime import UTC, datetime
from typing import ClassVar
from uuid import uuid4

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

SCHEMA = "community_private"


def now() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    return str(uuid4())


class Base(DeclarativeBase):
    pass


class Post(Base):
    __tablename__ = "posts"
    __table_args__ = (
        UniqueConstraint("author_id", "client_token", name="uq_community_post_retry"),
        CheckConstraint("visibility IN ('public','private')", name="ck_community_visibility"),
        CheckConstraint("status IN ('open','in_progress','resolved')", name="ck_community_status"),
        CheckConstraint("version >= 1", name="ck_community_post_version"),
        {"schema": SCHEMA},
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    author_id: Mapped[int] = mapped_column(BigInteger, index=True)
    author_name: Mapped[str] = mapped_column(String(100))
    author_role: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(30), index=True)
    visibility: Mapped[str] = mapped_column(String(10), index=True)
    status: Mapped[str] = mapped_column(String(20), default="open")
    tags: Mapped[list] = mapped_column(JSON, default=list)
    area: Mapped[str] = mapped_column(String(30), default="general")
    insight_slug: Mapped[str | None] = mapped_column(String(100))
    accepted_comment_id: Mapped[str | None] = mapped_column(String(36))
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    client_token: Mapped[str] = mapped_column(String(36))
    payload_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Comment(Base):
    __tablename__ = "comments"
    __table_args__ = (
        UniqueConstraint("author_id", "client_token", name="uq_community_comment_retry"),
        {"schema": SCHEMA},
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    post_id: Mapped[str] = mapped_column(ForeignKey(f"{SCHEMA}.posts.id"), index=True)
    author_id: Mapped[int] = mapped_column(BigInteger)
    author_name: Mapped[str] = mapped_column(String(100))
    author_role: Mapped[str] = mapped_column(String(20))
    is_staff: Mapped[bool] = mapped_column(Boolean, default=False)
    body: Mapped[str] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, default=1)
    deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    client_token: Mapped[str] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Reaction(Base):
    __tablename__ = "reactions"
    __table_args__: ClassVar[dict[str, str]] = {"schema": SCHEMA}
    post_id: Mapped[str] = mapped_column(ForeignKey(f"{SCHEMA}.posts.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)


class Bookmark(Base):
    __tablename__ = "bookmarks"
    __table_args__: ClassVar[dict[str, str]] = {"schema": SCHEMA}
    post_id: Mapped[str] = mapped_column(ForeignKey(f"{SCHEMA}.posts.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__: ClassVar[dict[str, str]] = {"schema": SCHEMA}
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    post_id: Mapped[str] = mapped_column(ForeignKey(f"{SCHEMA}.posts.id"), index=True)
    comment_id: Mapped[str | None] = mapped_column(ForeignKey(f"{SCHEMA}.comments.id"), index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (
        UniqueConstraint("post_id", "reporter_id", name="uq_community_report"),
        {"schema": SCHEMA},
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    post_id: Mapped[str] = mapped_column(ForeignKey(f"{SCHEMA}.posts.id"), index=True)
    reporter_id: Mapped[int] = mapped_column(BigInteger)
    reason: Mapped[str] = mapped_column(String(30))
    detail: Mapped[str] = mapped_column(String(500), default="")
    handled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ModerationEvent(Base):
    __tablename__ = "moderation_events"
    __table_args__: ClassVar[dict[str, str]] = {"schema": SCHEMA}
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    post_id: Mapped[str] = mapped_column(ForeignKey(f"{SCHEMA}.posts.id"))
    actor_id: Mapped[int] = mapped_column(BigInteger)
    action: Mapped[str] = mapped_column(String(30))
    reason: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class WriteLimit(Base):
    __tablename__ = "write_limits"
    __table_args__: ClassVar[dict[str, str]] = {"schema": SCHEMA}
    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    count: Mapped[int] = mapped_column(Integer, default=0)
