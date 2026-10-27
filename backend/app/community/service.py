"""공개·비공개 경계를 모든 조회·쓰기 경로에서 같은 규칙으로 검사합니다."""

import hashlib
import json
from datetime import UTC, timedelta
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.community.models import Bookmark, Comment, Notification, Post, Reaction, WriteLimit, now
from app.community.schemas import PostContent

CATEGORIES = {
    "question": "질문·도움",
    "story": "경험 공유",
    "idea": "아이디어·제안",
    "support": "오류·문의",
    "chat": "자유 이야기",
    "notice": "공지",
}
AREAS = {
    "general": ("일반", "/community"),
    "account": ("가입·계정", "/faq?category=account"),
    "experts": ("전문가 찾기", "/experts"),
    "research": ("내 연구", "/my-research"),
    "insights": ("사례·트렌드", "/cases"),
    "community": ("게시판", "/community"),
}


def insight_links() -> list[dict]:
    path = Path(__file__).resolve().parents[3] / "data/community/insight-links.json"
    return json.loads(path.read_text(encoding="utf-8"))


def readable(user: dict | None):
    public = and_(Post.visibility == "public", Post.hidden.is_(False))
    if user and user.get("is_admin") is True:
        return Post.deleted.is_(False)
    visible = or_(public, Post.author_id == user["user_id"]) if user else public
    return and_(Post.deleted.is_(False), visible)


def require_post(session: Session, post_id: str, user: dict | None, *, lock: bool = False) -> Post:
    query = select(Post).where(Post.id == post_id, readable(user))
    if lock:
        query = query.with_for_update()
    post = session.scalar(query)
    if post is None:
        # 비공개 글이 존재하는지조차 다른 계정에 알려주지 않습니다.
        raise HTTPException(404, "글을 찾을 수 없거나 접근할 수 없습니다.")
    return post


def require_owner(post: Post, user: dict) -> None:
    if post.author_id != user["user_id"]:
        raise HTTPException(403, "작성자만 원문을 수정·삭제할 수 있습니다.")


def require_manager(post: Post, user: dict) -> None:
    if post.author_id != user["user_id"] and user.get("is_admin") is not True:
        raise HTTPException(403, "작성자 또는 관리자만 상태를 바꿀 수 있습니다.")


def check_version(post: Post, version: int) -> None:
    if post.version != version:
        raise HTTPException(409, "다른 변경이 있습니다. 입력을 보관하고 최신 글을 확인해 주세요.")


def validate_content(body: PostContent, user: dict) -> None:
    if body.category == "notice" and user.get("is_admin") is not True:
        raise HTTPException(403, "공지는 관리자만 작성할 수 있습니다.")
    if body.category == "notice" and body.visibility != "public":
        raise HTTPException(422, "공지는 공개로 작성해 주세요.")
    if body.insight_slug and body.insight_slug not in {x["slug"] for x in insight_links()}:
        raise HTTPException(422, "연결할 사례·트렌드를 목록에서 다시 선택해 주세요.")


def lock_write_bucket(session: Session, user_id: int) -> WriteLimit:
    """회원 단위 잠금은 글 재시도와 작성 한도 계산에 같은 순서로 사용합니다."""
    dialect = session.get_bind().dialect.name
    insert = pg_insert if dialect == "postgresql" else sqlite_insert
    session.execute(
        insert(WriteLimit)
        .values(user_id=user_id, window_start=now(), count=0)
        .on_conflict_do_nothing(index_elements=["user_id"])
    )
    return session.scalar(select(WriteLimit).where(WriteLimit.user_id == user_id).with_for_update())


def limited_write(session: Session, user_id: int, *, new_post: bool = False) -> None:
    """DB 행 잠금으로 여러 서버에서도 회원별 시간당 작성량을 함께 계산합니다."""
    bucket = lock_write_bucket(session, user_id)
    start = bucket.window_start
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    if now() - start >= timedelta(hours=1):
        bucket.window_start, bucket.count = now(), 0
    if bucket.count >= 120:
        raise HTTPException(
            429,
            "잠시 쉬었다 다시 작성해 주세요. 시간당 작성 한도에 도달했습니다.",
            headers={"Retry-After": "3600"},
        )
    if new_post:
        recent = session.scalar(
            select(func.count())
            .select_from(Post)
            .where(Post.author_id == user_id, Post.created_at >= now() - timedelta(hours=1))
        )
        if recent >= 10:
            raise HTTPException(
                429,
                "새 글은 한 시간에 10개까지 작성할 수 있습니다.",
                headers={"Retry-After": "3600"},
            )
    bucket.count += 1


def fingerprint(body: PostContent) -> str:
    value = body.model_dump(exclude={"client_token", "expected_version"}, mode="json")
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()


def post_cards(
    session: Session, posts: list[Post], user: dict | None, *, detail: bool = False
) -> list[dict]:
    if not posts:
        return []
    ids = [p.id for p in posts]
    replies = dict(
        session.execute(
            select(Comment.post_id, func.count())
            .where(Comment.post_id.in_(ids), Comment.deleted.is_(False))
            .group_by(Comment.post_id)
        ).all()
    )
    helpful = dict(
        session.execute(
            select(Reaction.post_id, func.count())
            .where(Reaction.post_id.in_(ids))
            .group_by(Reaction.post_id)
        ).all()
    )
    bookmarks, reactions = set(), set()
    if user:
        bookmarks = set(
            session.scalars(
                select(Bookmark.post_id).where(
                    Bookmark.post_id.in_(ids), Bookmark.user_id == user["user_id"]
                )
            )
        )
        reactions = set(
            session.scalars(
                select(Reaction.post_id).where(
                    Reaction.post_id.in_(ids), Reaction.user_id == user["user_id"]
                )
            )
        )
    links = {x["slug"]: x for x in insight_links()}
    items = []
    for post in posts:
        mine = bool(user and user["user_id"] == post.author_id)
        manager = bool(user and (mine or user.get("is_admin") is True))
        item = {
            "id": post.id,
            "title": post.title,
            "excerpt": post.body[:160],
            "author_name": post.author_name,
            "author_role": post.author_role,
            "category": post.category,
            "visibility": post.visibility,
            "status": post.status,
            "tags": post.tags,
            "area": post.area,
            "insight": links.get(post.insight_slug),
            "accepted_comment_id": post.accepted_comment_id,
            "pinned": post.pinned,
            "hidden": post.hidden,
            "version": post.version,
            "reply_count": replies.get(post.id, 0),
            "helpful_count": helpful.get(post.id, 0),
            "bookmarked": post.id in bookmarks,
            "reacted": post.id in reactions,
            "is_mine": mine,
            "can_manage": manager,
            "created_at": post.created_at,
            "updated_at": post.updated_at,
        }
        if detail:
            item["body"] = post.body
        items.append(item)
    return items


def create_post(session: Session, body, user: dict) -> Post:
    token = str(body.client_token)
    lock_write_bucket(session, user["user_id"])
    existing = session.scalar(
        select(Post).where(Post.author_id == user["user_id"], Post.client_token == token)
    )
    if existing:
        if existing.payload_hash != fingerprint(body) or existing.deleted:
            raise HTTPException(409, "이미 사용된 등록 요청입니다. 새 글로 다시 작성해 주세요.")
        return existing
    validate_content(body, user)
    limited_write(session, user["user_id"], new_post=True)
    post = Post(
        **body.model_dump(exclude={"client_token"}),
        author_id=user["user_id"],
        author_name=user["nickname"],
        author_role=user.get("user_role") or "member",
        client_token=token,
        payload_hash=fingerprint(body),
    )
    session.add(post)
    session.flush()
    return post


def edit_post(session: Session, post: Post, body, user: dict) -> None:
    require_owner(post, user)
    check_version(post, body.expected_version)
    if body.visibility != post.visibility:
        raise HTTPException(
            422, "댓글 작성자의 공개 범위를 보호하기 위해 등록 후 공개 범위는 바꿀 수 없습니다."
        )
    validate_content(body, user)
    limited_write(session, user["user_id"])
    if (
        body.title != post.title or body.body != post.body or body.category != post.category
    ) and post.status == "resolved":
        post.accepted_comment_id, post.status = None, "open"
    for name, value in body.model_dump(exclude={"expected_version"}).items():
        setattr(post, name, value)
    post.version += 1
    post.updated_at = now()
    session.flush()


def comment_dict(comment: Comment, user: dict | None) -> dict:
    return {
        "id": comment.id,
        "body": comment.body,
        "author_name": comment.author_name,
        "author_role": comment.author_role,
        "version": comment.version,
        "is_staff": comment.is_staff,
        "is_mine": bool(user and user["user_id"] == comment.author_id),
        "created_at": comment.created_at,
    }


def add_comment(session: Session, post: Post, body, user: dict) -> Comment:
    if post.hidden:
        raise HTTPException(409, "운영 검토 중인 글에는 댓글을 작성할 수 없습니다.")
    existing = session.scalar(
        select(Comment).where(
            Comment.author_id == user["user_id"], Comment.client_token == str(body.client_token)
        )
    )
    if existing:
        if existing.post_id != post.id or existing.body != body.body or existing.deleted:
            raise HTTPException(409, "이미 사용된 댓글 요청입니다.")
        return existing
    limited_write(session, user["user_id"])
    comment = Comment(
        post_id=post.id,
        author_id=user["user_id"],
        author_name=user["nickname"],
        author_role=user.get("user_role") or "member",
        is_staff=user.get("is_admin") is True,
        body=body.body,
        client_token=str(body.client_token),
    )
    session.add(comment)
    session.flush()
    if post.author_id != user["user_id"]:
        session.add(Notification(post_id=post.id, comment_id=comment.id, user_id=post.author_id))
    session.flush()
    return comment
