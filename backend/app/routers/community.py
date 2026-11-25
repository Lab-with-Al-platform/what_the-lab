"""기존 JWT 쿠키·공통 DB에 연결하는 자유게시판 API."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, cast, func, or_, select, update
from sqlalchemy import delete as sql_delete
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session

from app.community import service as s
from app.community.access import (
    admin,
    get_session,
    member,
    no_store,
    optional_member,
    trusted_origin,
)
from app.community.models import (
    Bookmark,
    Comment,
    ModerationEvent,
    Notification,
    Post,
    Reaction,
    Report,
    now,
)
from app.community.schemas import (
    CommentInput,
    CreatePost,
    DeleteComment,
    EditComment,
    EditPost,
    ModerationInput,
    ReportInput,
    StatusInput,
    ToggleInput,
    VersionInput,
)

router = APIRouter(prefix="/api/v1/community", tags=["community"], dependencies=[Depends(no_store)])
DB = Annotated[Session, Depends(get_session)]
Member = Annotated[dict, Depends(member)]
Viewer = Annotated[dict | None, Depends(optional_member)]
Admin = Annotated[dict, Depends(admin)]
Write = Depends(trusted_origin)


@router.get("/meta")
def metadata() -> dict:
    return {
        "categories": s.CATEGORIES,
        "areas": {k: {"label": v[0], "href": v[1]} for k, v in s.AREAS.items()},
        "insights": s.insight_links(),
    }


@router.get("/me")
def me(user: Member) -> dict:
    return {
        "user_id": user["user_id"],
        "nickname": user["nickname"],
        "user_role": user.get("user_role"),
        "is_admin": user.get("is_admin") is True,
    }


@router.get("/posts")
def posts(
    session: DB,
    user: Viewer,
    scope: Literal["public", "mine", "saved", "inbox", "moderation"] = "public",
    q: str = Query("", max_length=200),
    category: str = Query("", max_length=30),
    tag: str = Query("", max_length=20),
    status: Literal["", "open", "in_progress", "resolved"] = "",
    unanswered: bool = False,
    order: Literal["latest", "helpful", "oldest"] = "latest",
    page: int = Query(1, ge=1, le=10000),
    page_size: int = Query(12, ge=1, le=30),
) -> dict:
    filters = [s.readable(user)]
    if scope == "public":
        filters += [Post.visibility == "public", Post.hidden.is_(False)]
    elif not user:
        raise HTTPException(401, "로그인이 필요합니다.")
    elif scope == "mine":
        filters.append(Post.author_id == user["user_id"])
    elif scope == "saved":
        filters.append(
            Post.id.in_(select(Bookmark.post_id).where(Bookmark.user_id == user["user_id"]))
        )
    elif user.get("is_admin") is not True:
        raise HTTPException(403, "게시판 운영 권한이 필요합니다.")
    elif scope == "inbox":
        filters.append(Post.visibility == "private")
    else:
        filters.append(
            or_(
                Post.hidden.is_(True),
                Post.id.in_(select(Report.post_id).where(Report.handled.is_(False))),
            )
        )
    if category:
        if category not in s.CATEGORIES:
            raise HTTPException(422, "글 종류를 다시 선택해 주세요.")
        filters.append(Post.category == category)
    if status:
        filters.append(Post.status == status)
    if q:
        filters.append(
            or_(Post.title.icontains(q, autoescape=True), Post.body.icontains(q, autoescape=True))
        )
    if tag:
        if session.get_bind().dialect.name == "postgresql":
            filters.append(cast(Post.tags, JSONB).contains([tag]))
        else:
            values = func.json_each(Post.tags).table_valued("value")
            filters.append(select(1).select_from(values).where(values.c.value == tag).exists())
    replies = (
        select(func.count())
        .select_from(Comment)
        .where(Comment.post_id == Post.id, Comment.deleted.is_(False))
        .correlate(Post)
        .scalar_subquery()
    )
    if unanswered:
        filters.extend(
            [replies == 0, Post.status != "resolved", Post.category.in_(["question", "support"])]
        )
    helpful = (
        select(func.count())
        .select_from(Reaction)
        .where(Reaction.post_id == Post.id)
        .correlate(Post)
        .scalar_subquery()
    )
    sorting = [Post.pinned.desc()]
    sorting += (
        [helpful.desc(), Post.created_at.desc()]
        if order == "helpful"
        else [Post.created_at.asc() if order == "oldest" else Post.created_at.desc()]
    )
    query = select(Post).where(*filters)
    total = session.scalar(select(func.count()).select_from(Post).where(*filters))
    records = list(
        session.scalars(
            query.order_by(*sorting, Post.id).offset((page - 1) * page_size).limit(page_size)
        )
    )
    return {
        "items": s.post_cards(session, records, user),
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/posts", dependencies=[Write], status_code=201)
def create(body: CreatePost, session: DB, user: Member) -> dict:
    return s.post_cards(session, [s.create_post(session, body, user)], user, detail=True)[0]


@router.get("/posts/{post_id}")
def detail(post_id: UUID, session: DB, user: Viewer) -> dict:
    return s.post_cards(session, [s.require_post(session, str(post_id), user)], user, detail=True)[
        0
    ]


@router.put("/posts/{post_id}", dependencies=[Write])
def edit(post_id: UUID, body: EditPost, session: DB, user: Member) -> dict:
    post = s.require_post(session, str(post_id), user, lock=True)
    s.edit_post(session, post, body, user)
    return s.post_cards(session, [post], user, detail=True)[0]


@router.delete("/posts/{post_id}", dependencies=[Write])
def delete(post_id: UUID, body: VersionInput, session: DB, user: Member) -> dict:
    post = s.require_post(session, str(post_id), user, lock=True)
    s.require_owner(post, user)
    s.check_version(post, body.expected_version)
    post.deleted, post.version, post.body, post.title = True, post.version + 1, "", "삭제한 글"
    # 작성자가 지운 원문을 알림·검색·보고서에서 다시 노출하지 않습니다.
    return {"deleted": True}


@router.get("/posts/{post_id}/comments")
def comments(
    post_id: UUID, session: DB, user: Viewer, page: int = Query(1, ge=1), after: UUID | None = None
) -> dict:
    post = s.require_post(session, str(post_id), user)
    query = select(Comment).where(Comment.post_id == post.id, Comment.deleted.is_(False))
    if after:
        cursor = session.get(Comment, str(after))
        if cursor is None or cursor.post_id != post.id:
            raise HTTPException(422, "댓글 목록을 처음부터 다시 확인해 주세요.")
        query = query.where(
            or_(
                Comment.created_at > cursor.created_at,
                and_(Comment.created_at == cursor.created_at, Comment.id > cursor.id),
            )
        )
    rows = list(
        session.scalars(
            query.order_by(Comment.created_at, Comment.id)
            .offset(0 if after else (page - 1) * 30)
            .limit(31)
        )
    )
    accepted = session.get(Comment, post.accepted_comment_id) if post.accepted_comment_id else None
    return {
        "items": [s.comment_dict(c, user) for c in rows[:30]],
        "page": page,
        "next_cursor": rows[29].id if len(rows) > 30 else None,
        "accepted": s.comment_dict(accepted, user)
        if accepted and not accepted.deleted and accepted.post_id == post.id
        else None,
    }


@router.post("/posts/{post_id}/comments", dependencies=[Write], status_code=201)
def reply(post_id: UUID, body: CommentInput, session: DB, user: Member) -> dict:
    post = s.require_post(session, str(post_id), user, lock=True)
    return s.comment_dict(s.add_comment(session, post, body, user), user)


@router.put("/posts/{post_id}/comments/{comment_id}", dependencies=[Write])
def edit_comment(
    post_id: UUID, comment_id: UUID, body: EditComment, session: DB, user: Member
) -> dict:
    post = s.require_post(session, str(post_id), user, lock=True)
    comment = session.scalar(
        select(Comment).where(
            Comment.id == str(comment_id), Comment.post_id == post.id, Comment.deleted.is_(False)
        )
    )
    if comment is None:
        raise HTTPException(404, "댓글을 찾을 수 없습니다.")
    if comment.author_id != user["user_id"]:
        raise HTTPException(403, "작성자만 댓글을 수정할 수 있습니다.")
    if comment.version != body.expected_version:
        raise HTTPException(
            409, "댓글이 변경되었습니다. 입력을 보관하고 최신 댓글을 확인해 주세요."
        )
    s.limited_write(session, user["user_id"])
    comment.body, comment.version = body.body, comment.version + 1
    if post.accepted_comment_id == comment.id:
        post.accepted_comment_id, post.status, post.version = None, "open", post.version + 1
    return s.comment_dict(comment, user)


@router.delete("/posts/{post_id}/comments/{comment_id}", dependencies=[Write])
def delete_comment(
    post_id: UUID, comment_id: UUID, body: DeleteComment, session: DB, user: Member
) -> dict:
    post = s.require_post(session, str(post_id), user, lock=True)
    comment = session.scalar(
        select(Comment).where(
            Comment.id == str(comment_id), Comment.post_id == post.id, Comment.deleted.is_(False)
        )
    )
    if not comment:
        raise HTTPException(404, "댓글을 찾을 수 없습니다.")
    if comment.author_id != user["user_id"] and user.get("is_admin") is not True:
        raise HTTPException(403, "이 댓글을 삭제할 수 없습니다.")
    if comment.version != body.expected_version:
        raise HTTPException(409, "댓글이 변경되었습니다. 최신 내용을 읽고 삭제해 주세요.")
    if user.get("is_admin") is True and comment.author_id != user["user_id"]:
        if len(body.reason) < 3:
            raise HTTPException(422, "타인의 댓글을 삭제하는 운영 사유를 3자 이상 입력해 주세요.")
        session.add(
            ModerationEvent(
                post_id=post.id,
                actor_id=user["user_id"],
                action="remove_comment",
                reason=f"댓글 {comment.id}: {body.reason}",
            )
        )
    comment.deleted, comment.body, comment.version = True, "", comment.version + 1
    session.execute(sql_delete(Notification).where(Notification.comment_id == comment.id))
    if post.accepted_comment_id == comment.id:
        post.accepted_comment_id, post.status, post.version = None, "open", post.version + 1
    return {"deleted": True}


@router.put("/posts/{post_id}/status", dependencies=[Write])
def status(post_id: UUID, body: StatusInput, session: DB, user: Member) -> dict:
    post = s.require_post(session, str(post_id), user, lock=True)
    s.require_manager(post, user)
    s.check_version(post, body.expected_version)
    if body.accepted_comment_id:
        comment = session.scalar(
            select(Comment).where(
                Comment.id == str(body.accepted_comment_id),
                Comment.post_id == post.id,
                Comment.deleted.is_(False),
            )
        )
        if comment is None or body.status != "resolved":
            raise HTTPException(422, "이 글의 댓글만 해결 답변으로 선택할 수 있습니다.")
        if body.accepted_comment_version != comment.version:
            raise HTTPException(
                409, "답변 내용이 변경되었습니다. 최신 답변을 읽고 다시 채택해 주세요."
            )
    elif body.accepted_comment_version is not None:
        raise HTTPException(422, "채택할 댓글을 함께 선택해 주세요.")
    post.status, post.accepted_comment_id = (
        body.status,
        str(body.accepted_comment_id) if body.accepted_comment_id else None,
    )
    post.version, post.updated_at = post.version + 1, now()
    return {"version": post.version}


@router.put("/posts/{post_id}/{action}", dependencies=[Write])
def toggle(
    post_id: UUID,
    action: Literal["helpful", "bookmark"],
    body: ToggleInput,
    session: DB,
    user: Member,
) -> dict:
    post = s.require_post(session, str(post_id), user, lock=True)
    if post.visibility != "public" or post.hidden:
        raise HTTPException(422, "공개 글에서만 사용할 수 있습니다.")
    if action == "helpful" and post.author_id == user["user_id"]:
        raise HTTPException(422, "다른 회원의 글에 공감해 주세요.")
    model = Reaction if action == "helpful" else Bookmark
    row = session.get(model, (post.id, user["user_id"]))
    if body.enabled and not row:
        s.limited_write(session, user["user_id"])
        session.add(model(post_id=post.id, user_id=user["user_id"]))
    if not body.enabled and row:
        session.delete(row)
    return {"enabled": body.enabled}


@router.post("/posts/{post_id}/reports", dependencies=[Write])
def report(post_id: UUID, body: ReportInput, session: DB, user: Member) -> dict:
    post = s.require_post(session, str(post_id), user, lock=True)
    existing = session.scalar(
        select(Report).where(Report.post_id == post.id, Report.reporter_id == user["user_id"])
    )
    if not existing:
        s.limited_write(session, user["user_id"])
        session.add(Report(post_id=post.id, reporter_id=user["user_id"], **body.model_dump()))
    elif existing.handled:
        s.limited_write(session, user["user_id"])
        existing.handled, existing.reason, existing.detail, existing.created_at = (
            False,
            body.reason,
            body.detail,
            now(),
        )
    return {"received": True}


@router.get("/notifications")
def notifications(session: DB, user: Member) -> dict:
    rows = session.execute(
        select(Notification, Post.title)
        .join(Post, Post.id == Notification.post_id)
        .join(Comment, Comment.id == Notification.comment_id)
        .where(
            Notification.user_id == user["user_id"], s.readable(user), Comment.deleted.is_(False)
        )
        .order_by(Notification.created_at.desc())
        .limit(30)
    ).all()
    unread = session.scalar(
        select(func.count())
        .select_from(Notification)
        .join(Post, Post.id == Notification.post_id)
        .join(Comment, Comment.id == Notification.comment_id)
        .where(
            Notification.user_id == user["user_id"],
            Notification.read.is_(False),
            s.readable(user),
            Comment.deleted.is_(False),
        )
    )
    return {
        "items": [
            {
                "id": n.id,
                "post_id": n.post_id,
                "comment_id": n.comment_id,
                "title": title,
                "read": n.read,
                "created_at": n.created_at,
            }
            for n, title in rows
        ],
        "unread": unread,
    }


@router.put("/notifications/read", dependencies=[Write])
def read_notifications(session: DB, user: Member) -> dict:
    session.execute(
        update(Notification)
        .where(Notification.user_id == user["user_id"], Notification.read.is_(False))
        .values(read=True)
    )
    return {"read": True}


@router.get("/admin/reports/{post_id}")
def reports(post_id: UUID, session: DB, user: Admin) -> dict:
    post = s.require_post(session, str(post_id), user)
    rows = session.scalars(
        select(Report).where(Report.post_id == post.id).order_by(Report.created_at.desc())
    )
    events = session.scalars(
        select(ModerationEvent)
        .where(ModerationEvent.post_id == post.id)
        .order_by(ModerationEvent.created_at.desc())
        .limit(20)
    )
    return {
        "items": [
            {
                "reason": r.reason,
                "detail": r.detail,
                "handled": r.handled,
                "created_at": r.created_at,
            }
            for r in rows
        ],
        "history": [
            {"action": e.action, "reason": e.reason, "created_at": e.created_at} for e in events
        ],
    }


@router.post("/admin/posts/{post_id}/moderate", dependencies=[Write])
def moderate(post_id: UUID, body: ModerationInput, session: DB, user: Admin) -> dict:
    post = s.require_post(session, str(post_id), user, lock=True)
    s.check_version(post, body.expected_version)
    if body.action in {"hide", "restore"}:
        post.hidden = body.action == "hide"
    if body.action in {"pin", "unpin"}:
        if post.visibility != "public":
            raise HTTPException(422, "비공개 문의는 공지로 고정할 수 없습니다.")
        post.pinned = body.action == "pin"
    if body.action in {"hide", "dismiss_reports"}:
        for row in session.scalars(select(Report).where(Report.post_id == post.id)):
            row.handled = True
    post.version += 1
    session.add(
        ModerationEvent(
            post_id=post.id, actor_id=user["user_id"], action=body.action, reason=body.reason
        )
    )
    return {"version": post.version}
