"""재검토에서 발견한 개인정보·상호작용·동시 수정 문제의 회귀 검사."""

from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.community.models import WriteLimit
from app.routers import auth
from tests import test_community as shared
from tests.test_community import ORIGIN, create, login, payload


@pytest.fixture
def board(monkeypatch):
    # 같은 격리 DB·가상 계정 fixture를 두 회귀 검사 파일에서 재사용합니다.
    yield from shared.board.__wrapped__(monkeypatch)


def reply(client, post_id, text="가상 답변"):
    response = client.post(
        f"/api/v1/community/posts/{post_id}/comments",
        headers=ORIGIN,
        json={"body": text, "client_token": str(uuid4())},
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.parametrize(
    "path", ["/me", "/posts/not-a-uuid", "/posts?scope=mine", "/posts?scope=inbox", "/posts?page=0"]
)
def test_error_responses_never_cache_member_results(board, path):
    client, _ = board
    response = client.get("/api/v1/community" + path)
    assert response.status_code in {401, 403, 422}
    assert "no-store" in response.headers["cache-control"]
    assert {"Cookie", "Origin"}.issubset(set(response.headers["vary"].split(", ")))


def test_json_body_is_limited_before_parsing(board):
    client, _ = board
    login(client, 1)
    response = client.post("/api/v1/community/posts", headers=ORIGIN, content=b"x" * 131073)
    assert response.status_code == 413 and "no-store" in response.headers["cache-control"]


@pytest.mark.parametrize("tag", ["이미지 분석", "세포", 'RAG"질문', "100%", "a_b"])
def test_tag_search_matches_an_exact_json_element_including_korean(board, tag):
    client, _ = board
    login(client, 1)
    create(client, tags=[tag])
    create(client, tags=["다른 " + tag])
    assert client.get("/api/v1/community/posts", params={"tag": tag}).json()["total"] == 1


@pytest.mark.parametrize(
    "field,value",
    [
        ("title", "제어\x00문자"),
        ("body", "허용하지 않는\x01제어문자 내용"),
        ("tags", ["줄\r바꿈"]),
        ("tags", ["\ud800"]),
    ],
)
def test_invalid_postgres_text_returns_validation_error(board, field, value):
    client, _ = board
    login(client, 1)
    # ensure_ascii를 써서 잘못된 unicode 자체의 HTTP 인코딩 오류와 구분합니다.
    import json

    response = client.post(
        "/api/v1/community/posts",
        headers={**ORIGIN, "Content-Type": "application/json"},
        content=json.dumps(payload(**{field: value})),
    )
    assert response.status_code == 422


def test_deleting_comment_removes_only_its_notification_and_checks_version(board):
    client, _ = board
    login(client, 1)
    post = create(client, visibility="private")
    login(client, 3)
    first, second = reply(client, post["id"]), reply(client, post["id"], "또 다른 답변")
    route = f"/api/v1/community/posts/{post['id']}/comments/{first['id']}"
    assert (
        client.request("DELETE", route, headers=ORIGIN, json={"expected_version": 2}).status_code
        == 409
    )
    assert (
        client.request("DELETE", route, headers=ORIGIN, json={"expected_version": 1}).status_code
        == 200
    )
    login(client, 1)
    notifications = client.get("/api/v1/community/notifications").json()
    assert notifications["unread"] == 1
    assert [n["comment_id"] for n in notifications["items"]] == [second["id"]]


def test_latest_comment_must_be_read_before_acceptance_and_changed_question_reopens(board):
    client, _ = board
    login(client, 1)
    post = create(client)
    login(client, 2)
    comment = reply(client, post["id"])
    root = f"/api/v1/community/posts/{post['id']}"
    assert (
        client.put(
            root + f"/comments/{comment['id']}",
            headers=ORIGIN,
            json={"body": "나중에 바뀐 답변", "expected_version": 1},
        ).status_code
        == 200
    )
    login(client, 1)
    value = {
        "status": "resolved",
        "expected_version": 1,
        "accepted_comment_id": comment["id"],
        "accepted_comment_version": 1,
    }
    assert client.put(root + "/status", headers=ORIGIN, json=value).status_code == 409
    assert (
        client.put(
            root + "/status", headers=ORIGIN, json={**value, "accepted_comment_version": 2}
        ).status_code
        == 200
    )
    edit = {
        k: v
        for k, v in payload(body="질문 자체가 바뀌었으므로 답변을 다시 확인합니다.").items()
        if k != "client_token"
    }
    updated = client.put(root, headers=ORIGIN, json={**edit, "expected_version": 2}).json()
    assert updated["status"] == "open" and updated["accepted_comment_id"] is None


def test_comment_cursor_survives_deletion_and_returns_selected_answer_separately(board):
    client, _ = board
    login(client, 1)
    post = create(client)
    comments = [reply(client, post["id"], f"가상 댓글 {i}") for i in range(33)]
    route = f"/api/v1/community/posts/{post['id']}"
    client.put(
        route + "/status",
        headers=ORIGIN,
        json={
            "status": "resolved",
            "expected_version": 1,
            "accepted_comment_id": comments[-1]["id"],
            "accepted_comment_version": 1,
        },
    )
    first = client.get(route + "/comments").json()
    assert len(first["items"]) == 30 and first["accepted"]["id"] == comments[-1]["id"]
    client.request(
        "DELETE",
        route + f"/comments/{comments[0]['id']}",
        headers=ORIGIN,
        json={"expected_version": 1},
    )
    second = client.get(route + "/comments", params={"after": first["next_cursor"]}).json()
    assert [c["id"] for c in second["items"]] == [c["id"] for c in comments[30:]]
    assert second["next_cursor"] is None


def test_admin_comment_removal_needs_reason_and_ordinary_author_cannot_spoof_it(board):
    client, engine = board
    login(client, 1)
    post = create(client)
    login(client, 2)
    comment = reply(client, post["id"])
    route = f"/api/v1/community/posts/{post['id']}/comments/{comment['id']}"
    login(client, 1)
    assert (
        client.request(
            "DELETE", route, headers=ORIGIN, json={"expected_version": 1, "reason": "남의 댓글"}
        ).status_code
        == 403
    )
    login(client, 3)
    assert (
        client.request("DELETE", route, headers=ORIGIN, json={"expected_version": 1}).status_code
        == 422
    )
    assert (
        client.request(
            "DELETE",
            route,
            headers=ORIGIN,
            json={"expected_version": 1, "reason": "가상 신고 검토 후 조치"},
        ).status_code
        == 200
    )
    from app.community.models import ModerationEvent

    with Session(engine) as session:
        assert "가상 신고 검토" in session.scalar(select(ModerationEvent)).reason


def test_resolved_report_can_be_reopened_by_new_report(board):
    client, _ = board
    login(client, 1)
    post = create(client)
    route = f"/api/v1/community/posts/{post['id']}"
    login(client, 2)
    for _ in range(2):
        assert (
            client.post(route + "/reports", headers=ORIGIN, json={"reason": "privacy"}).status_code
            == 200
        )
    login(client, 3)
    client.post(
        f"/api/v1/community/admin/posts/{post['id']}/moderate",
        headers=ORIGIN,
        json={"action": "dismiss_reports", "reason": "가상 검토 완료", "expected_version": 1},
    )
    login(client, 2)
    client.post(
        route + "/reports", headers=ORIGIN, json={"reason": "privacy", "detail": "새 문제가 나타남"}
    )
    login(client, 3)
    reports = client.get(f"/api/v1/community/admin/reports/{post['id']}").json()["items"]
    assert (
        len(reports) == 1
        and not reports[0]["handled"]
        and reports[0]["detail"] == "새 문제가 나타남"
    )


def test_tenth_post_retry_is_allowed_but_eleventh_new_post_is_rejected(board):
    client, engine = board
    login(client, 1)
    for _ in range(9):
        create(client)
    last = payload()
    initial = client.post("/api/v1/community/posts", headers=ORIGIN, json=last).json()
    assert (
        client.post("/api/v1/community/posts", headers=ORIGIN, json=last).json()["id"]
        == initial["id"]
    )
    assert client.post("/api/v1/community/posts", headers=ORIGIN, json=payload()).status_code == 429
    with Session(engine) as session:
        assert session.get(WriteLimit, 1).count == 10


@pytest.mark.parametrize("https", [False, True])
def test_existing_oauth_cookie_is_secure_in_https_deployment(board, monkeypatch, https):
    client, _ = board
    monkeypatch.setattr(
        auth, "DISCORD_REDIRECT_URI", ("https" if https else "http") + "://api.example/callback"
    )
    response = client.get("/api/v1/auth/discord/login", follow_redirects=False)
    assert ("Secure" in response.headers["set-cookie"]) == https
    assert (
        "HttpOnly" in response.headers["set-cookie"]
        and "no-store" in response.headers["cache-control"]
    )
