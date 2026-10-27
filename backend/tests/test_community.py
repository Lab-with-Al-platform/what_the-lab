"""가상 회원과 격리 DB로 공개·비공개 권한, 재시도, 상태·운영 경계를 검증합니다."""

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app import user_store
from app.community.access import get_session
from app.community.models import Base, Comment, ModerationEvent, Post, WriteLimit
from app.main import app
from app.security import create_access_token

ORIGIN = {"Origin": "http://localhost:3000"}
USERS = {
    i: {
        "user_id": i,
        "discord_id": str(1000 + i),
        "nickname": f"가상회원{i}",
        "user_role": "expert" if i == 2 else "researcher",
        "signup_step": "done",
        "status": "active",
        "is_admin": i == 3,
    }
    for i in range(1, 5)
}


@pytest.fixture
def board(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        execution_options={"schema_translate_map": {"community_private": None}},
    )
    Base.metadata.create_all(engine)

    def temporary_session():
        with Session(engine) as session, session.begin():
            yield session

    monkeypatch.setattr(
        user_store, "find_by_id", lambda user_id: dict(USERS[user_id]) if user_id in USERS else None
    )
    app.dependency_overrides[get_session] = temporary_session
    with TestClient(app) as client:
        yield client, engine
    app.dependency_overrides.clear()
    engine.dispose()


def login(client, user_id):
    client.cookies.clear()
    if user_id:
        client.cookies.set(
            "access_token", create_access_token(user_id, USERS[user_id]["discord_id"])
        )


def payload(**overrides):
    return {
        "title": "가상 질문입니다",
        "body": "테스트를 위한 충분한 길이의 가상 내용입니다.",
        "category": "question",
        "visibility": "public",
        "client_token": str(uuid4()),
        **overrides,
    }


def create(client, **overrides):
    response = client.post("/api/v1/community/posts", headers=ORIGIN, json=payload(**overrides))
    assert response.status_code == 201, response.text
    return response.json()


def test_public_read_private_invisible_in_lists_search_counts_and_direct_urls(board):
    client, _ = board
    login(client, 1)
    public = create(client)
    private = create(
        client,
        visibility="private",
        title="비밀문의표식",
        body="비공개 원문 고유표식 절대 외부에 보내지 않습니다.",
    )
    for user_id in (None, 2):
        login(client, user_id)
        response = client.get("/api/v1/community/posts")
        assert response.json()["total"] == 1
        assert "비밀" not in response.text
        assert "no-store" in response.headers["Cache-Control"]
        assert client.get("/api/v1/community/posts?q=비밀문의표식").json()["total"] == 0
        assert client.get(f"/api/v1/community/posts/{private['id']}").status_code == 404
        assert client.get(f"/api/v1/community/posts/{private['id']}/comments").status_code == 404
        assert client.get(f"/api/v1/community/posts/{public['id']}").status_code == 200


def test_private_owner_and_admin_only_and_no_insight_allowlist_privilege(board, monkeypatch):
    client, _ = board
    login(client, 1)
    private = create(client, visibility="private")
    assert client.get("/api/v1/community/posts?scope=mine").json()["total"] == 1
    login(client, 2)
    monkeypatch.setenv("INSIGHT_ADMIN_DISCORD_IDS", USERS[2]["discord_id"])
    assert client.get("/api/v1/community/posts?scope=inbox").status_code == 403
    assert (
        client.post(
            f"/api/v1/community/posts/{private['id']}/comments",
            headers=ORIGIN,
            json={"body": "침입 시도", "client_token": str(uuid4())},
        ).status_code
        == 404
    )
    login(client, 3)
    assert client.get("/api/v1/community/posts?scope=inbox").json()["total"] == 1
    response = client.post(
        f"/api/v1/community/posts/{private['id']}/comments",
        headers=ORIGIN,
        json={"body": "관리자 가상 답변", "client_token": str(uuid4())},
    )
    assert response.status_code == 201 and response.json()["is_staff"] is True


@pytest.mark.parametrize(
    "origin", [None, "https://evil.example", "http://localhost:3000.evil.example"]
)
def test_write_origin_required(board, origin):
    client, _ = board
    login(client, 1)
    assert (
        client.post(
            "/api/v1/community/posts", json=payload(), headers={"Origin": origin} if origin else {}
        ).status_code
        == 403
    )


def test_authentication_and_signup_required(board, monkeypatch):
    client, _ = board
    assert client.post("/api/v1/community/posts", headers=ORIGIN, json=payload()).status_code == 401
    login(client, 1)
    monkeypatch.setattr(user_store, "find_by_id", lambda _: {**USERS[1], "signup_step": "info"})
    assert client.post("/api/v1/community/posts", headers=ORIGIN, json=payload()).status_code == 403


@pytest.mark.parametrize("status", ["suspended", "deleted"])
def test_inactive_account_blocked(board, monkeypatch, status):
    client, _ = board
    login(client, 1)
    monkeypatch.setattr(user_store, "find_by_id", lambda _: {**USERS[1], "status": status})
    assert client.post("/api/v1/community/posts", headers=ORIGIN, json=payload()).status_code == 403


def test_create_retry_does_not_duplicate_and_cannot_replace_original(board):
    client, engine = board
    login(client, 1)
    body = payload()
    first = client.post("/api/v1/community/posts", headers=ORIGIN, json=body).json()
    again = client.post("/api/v1/community/posts", headers=ORIGIN, json=body)
    assert again.status_code == 201 and again.json()["id"] == first["id"]
    assert (
        client.post(
            "/api/v1/community/posts", headers=ORIGIN, json={**body, "title": "다른 제목"}
        ).status_code
        == 409
    )
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Post)) == 1


def test_owner_edit_conflict_visibility_immutable_and_other_author_denied(board):
    client, _ = board
    login(client, 1)
    post = create(client, visibility="private")
    edit = {k: v for k, v in payload().items() if k != "client_token"}
    edit.update(expected_version=1, visibility="private")
    assert (
        client.put(
            f"/api/v1/community/posts/{post['id']}",
            headers=ORIGIN,
            json={**edit, "visibility": "public"},
        ).status_code
        == 422
    )
    assert (
        client.put(f"/api/v1/community/posts/{post['id']}", headers=ORIGIN, json=edit).status_code
        == 200
    )
    assert (
        client.put(f"/api/v1/community/posts/{post['id']}", headers=ORIGIN, json=edit).status_code
        == 409
    )
    login(client, 3)
    assert (
        client.put(
            f"/api/v1/community/posts/{post['id']}",
            headers=ORIGIN,
            json={**edit, "expected_version": 2},
        ).status_code
        == 403
    )


def test_comment_retry_acceptance_and_deleted_solution_reopens(board):
    client, engine = board
    login(client, 1)
    post = create(client)
    login(client, 2)
    body = {"body": "가상 해결 방법입니다", "client_token": str(uuid4())}
    comment = client.post(
        f"/api/v1/community/posts/{post['id']}/comments", headers=ORIGIN, json=body
    ).json()
    assert (
        client.post(
            f"/api/v1/community/posts/{post['id']}/comments", headers=ORIGIN, json=body
        ).json()["id"]
        == comment["id"]
    )
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Comment)) == 1
    login(client, 1)
    result = client.put(
        f"/api/v1/community/posts/{post['id']}/status",
        headers=ORIGIN,
        json={
            "expected_version": 1,
            "status": "resolved",
            "accepted_comment_id": comment["id"],
            "accepted_comment_version": comment["version"],
        },
    )
    assert result.status_code == 200
    login(client, 2)
    assert (
        client.request(
            "DELETE",
            f"/api/v1/community/posts/{post['id']}/comments/{comment['id']}",
            headers=ORIGIN,
            json={"expected_version": comment["version"]},
        ).status_code
        == 200
    )
    result = client.get(f"/api/v1/community/posts/{post['id']}").json()
    assert result["status"] == "open" and result["accepted_comment_id"] is None


def test_cannot_accept_comment_from_another_post(board):
    client, _ = board
    login(client, 1)
    a, b = create(client), create(client)
    comment = client.post(
        f"/api/v1/community/posts/{b['id']}/comments",
        headers=ORIGIN,
        json={"body": "다른 글의 댓글", "client_token": str(uuid4())},
    ).json()
    assert (
        client.put(
            f"/api/v1/community/posts/{a['id']}/status",
            headers=ORIGIN,
            json={
                "expected_version": 1,
                "status": "resolved",
                "accepted_comment_id": comment["id"],
                "accepted_comment_version": comment["version"],
            },
        ).status_code
        == 422
    )


def test_bookmark_and_helpful_are_idempotent_private_not_supported(board):
    client, _ = board
    login(client, 1)
    public, private = create(client), create(client, visibility="private")
    assert (
        client.put(
            f"/api/v1/community/posts/{private['id']}/bookmark",
            headers=ORIGIN,
            json={"enabled": True},
        ).status_code
        == 422
    )
    login(client, 2)
    for _ in range(2):
        assert (
            client.put(
                f"/api/v1/community/posts/{public['id']}/helpful",
                headers=ORIGIN,
                json={"enabled": True},
            ).status_code
            == 200
        )
        assert (
            client.put(
                f"/api/v1/community/posts/{public['id']}/bookmark",
                headers=ORIGIN,
                json={"enabled": True},
            ).status_code
            == 200
        )
    saved = client.get("/api/v1/community/posts?scope=saved").json()
    assert saved["total"] == 1 and saved["items"][0]["helpful_count"] == 1


def test_notifications_only_recipient_and_deleted_post_never_leaks(board):
    client, _ = board
    login(client, 1)
    post = create(client, visibility="private")
    login(client, 3)
    client.post(
        f"/api/v1/community/posts/{post['id']}/comments",
        headers=ORIGIN,
        json={"body": "비공개 가상 답변", "client_token": str(uuid4())},
    )
    assert client.get("/api/v1/community/notifications").json()["unread"] == 0
    login(client, 1)
    assert client.get("/api/v1/community/notifications").json()["unread"] == 1
    assert client.put("/api/v1/community/notifications/read", headers=ORIGIN).status_code == 200
    assert client.get("/api/v1/community/notifications").json()["unread"] == 0
    assert (
        client.request(
            "DELETE",
            f"/api/v1/community/posts/{post['id']}",
            headers=ORIGIN,
            json={"expected_version": 1},
        ).status_code
        == 200
    )
    assert client.get("/api/v1/community/notifications").json()["items"] == []


def test_moderation_keeps_audit_and_requires_common_admin(board):
    client, engine = board
    login(client, 1)
    post = create(client)
    login(client, 2)
    assert (
        client.post(
            f"/api/v1/community/posts/{post['id']}/reports",
            headers=ORIGIN,
            json={"reason": "privacy", "detail": "가상 신고 내용"},
        ).status_code
        == 200
    )
    action = {"action": "hide", "reason": "개인정보 노출 검토", "expected_version": 1}
    assert (
        client.post(
            f"/api/v1/community/admin/posts/{post['id']}/moderate", headers=ORIGIN, json=action
        ).status_code
        == 403
    )
    login(client, 3)
    assert client.get("/api/v1/community/posts?scope=moderation").json()["total"] == 1
    assert (
        client.post(
            f"/api/v1/community/admin/posts/{post['id']}/moderate", headers=ORIGIN, json=action
        ).status_code
        == 200
    )
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(ModerationEvent)) == 1
    login(client, None)
    assert client.get(f"/api/v1/community/posts/{post['id']}").status_code == 404
    assert client.get("/api/v1/community/posts").json()["total"] == 0


def test_notice_and_payload_author_spoof_rejected(board):
    client, _ = board
    login(client, 1)
    assert (
        client.post(
            "/api/v1/community/posts", headers=ORIGIN, json=payload(category="notice")
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/v1/community/posts", headers=ORIGIN, json=payload(author_id=3, is_admin=True)
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/community/posts", headers=ORIGIN, json=payload(insight_slug="../../private")
        ).status_code
        == 422
    )


def test_literal_search_pagination_unanswered_and_tag(board):
    client, _ = board
    login(client, 1)
    first = create(client, title="RAG% 문서 검색 질문", tags=["RAG"])
    create(client, title="이미지 분석 경험", category="story", tags=["이미지"])
    assert client.get("/api/v1/community/posts?q=%25").json()["total"] == 1
    assert client.get("/api/v1/community/posts?tag=RAG").json()["total"] == 1
    assert client.get("/api/v1/community/posts?unanswered=1").json()["total"] == 1
    assert client.get("/api/v1/community/posts?page_size=1&page=2").json()["total"] == 2
    client.post(
        f"/api/v1/community/posts/{first['id']}/comments",
        headers=ORIGIN,
        json={"body": "부연 설명", "client_token": str(uuid4())},
    )
    assert client.get("/api/v1/community/posts?unanswered=1").json()["total"] == 0


def test_rate_limit_persisted_and_input_safely_returned_as_text(board):
    client, engine = board
    login(client, 1)
    post = create(client, body="<script>alert('not executed')</script> 가상 자료")
    assert "<script>" in client.get(f"/api/v1/community/posts/{post['id']}").json()["body"]
    with Session(engine) as session, session.begin():
        session.get(WriteLimit, 1).count = 120
    assert client.post("/api/v1/community/posts", headers=ORIGIN, json=payload()).status_code == 429


def test_private_write_paths_never_allow_another_member(board):
    client, _ = board
    login(client, 1)
    post = create(client, visibility="private")
    login(client, 2)
    route = f"/api/v1/community/posts/{post['id']}"
    for path, body in (
        ("/helpful", {"enabled": True}),
        ("/bookmark", {"enabled": True}),
        ("/status", {"expected_version": 1, "status": "resolved"}),
    ):
        assert client.put(route + path, headers=ORIGIN, json=body).status_code == 404
    assert (
        client.post(route + "/reports", headers=ORIGIN, json={"reason": "other"}).status_code == 404
    )
    assert (
        client.request("DELETE", route, headers=ORIGIN, json={"expected_version": 1}).status_code
        == 404
    )


def test_editing_accepted_comment_requires_new_acceptance_and_detects_stale_version(board):
    client, _ = board
    login(client, 1)
    post = create(client)
    login(client, 2)
    route = f"/api/v1/community/posts/{post['id']}"
    comment = client.post(
        route + "/comments",
        headers=ORIGIN,
        json={"body": "처음 설명", "client_token": str(uuid4())},
    ).json()
    login(client, 1)
    assert (
        client.put(
            route + "/status",
            headers=ORIGIN,
            json={
                "status": "resolved",
                "expected_version": 1,
                "accepted_comment_id": comment["id"],
                "accepted_comment_version": comment["version"],
            },
        ).status_code
        == 200
    )
    login(client, 2)
    edit = {"body": "수정한 설명", "expected_version": 1}
    assert (
        client.put(route + f"/comments/{comment['id']}", headers=ORIGIN, json=edit).status_code
        == 200
    )
    assert (
        client.put(route + f"/comments/{comment['id']}", headers=ORIGIN, json=edit).status_code
        == 409
    )
    assert client.get(route).json()["accepted_comment_id"] is None
