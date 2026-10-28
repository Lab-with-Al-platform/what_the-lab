"""2026-10-26 협업 요청·알림·사진 기능과 게시판의 결합 경계를 검증합니다."""

from io import BytesIO
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from PIL import Image

from app import main
from app.routers import auth, profile_photo
from tests import test_community as shared
from tests.test_community import ORIGIN, USERS, create, login


@pytest.fixture
def board(monkeypatch):
    yield from shared.board.__wrapped__(monkeypatch)


def test_private_board_reply_does_not_wake_discord_outbox(board, monkeypatch):
    client, _ = board
    calls = []
    monkeypatch.setattr(main, "wake_up", lambda: calls.append("discord"))
    login(client, 1)
    private = create(client, visibility="private")
    login(client, 3)
    from uuid import uuid4

    response = client.post(
        f"/api/v1/community/posts/{private['id']}/comments",
        headers=ORIGIN,
        json={"body": "개인 문의에 대한 관리자 답변", "client_token": str(uuid4())},
    )
    assert response.status_code == 201
    login(client, 1)
    assert client.get("/api/v1/community/notifications").json()["unread"] == 1
    assert calls == []


def test_large_profile_photo_is_not_subject_to_board_json_limit(board, monkeypatch, tmp_path):
    client, _ = board
    login(client, 1)
    photo = BytesIO()
    Image.new("RGB", (640, 480), "navy").save(photo, "JPEG")
    content = photo.getvalue() + b"\0" * 200_000
    saved = []
    monkeypatch.setattr(profile_photo.upload_store, "path_of", lambda key: tmp_path / key)
    monkeypatch.setattr(profile_photo, "set_user_photo", lambda *args: saved.append(args))
    response = client.put("/api/v1/me/photo", content=content, headers={"Content-Type": "image/jpeg"})
    assert response.status_code == 200, response.text
    assert saved == [(1, response.json()["user_photo"])]
    with Image.open(tmp_path / "profile/1.jpg") as image:
        assert image.size == (400, 400)
        assert image.format == "JPEG"


def test_discord_settings_reconnect_keeps_scope_and_secure_cookies(board, monkeypatch):
    client, _ = board
    login(client, 1)
    monkeypatch.setattr(auth, "DISCORD_REDIRECT_URI", "https://api.example.test/api/v1/auth/discord/callback")
    response = client.get("/api/v1/auth/discord/connect", follow_redirects=False)
    query = parse_qs(urlparse(response.headers["location"]).query)
    assert query["scope"] == ["identify guilds.join"]
    cookies = response.headers.get_list("set-cookie")
    assert len(cookies) == 2
    assert all("Secure" in cookie and "HttpOnly" in cookie for cookie in cookies)
    assert any("oauth_next=settings" in cookie for cookie in cookies)


@pytest.mark.parametrize("joined", [True, False])
def test_discord_settings_callback_preserves_join_result_and_session(board, monkeypatch, joined):
    client, _ = board
    client.cookies.clear()
    client.cookies.set("oauth_state", "test-state")
    client.cookies.set("oauth_next", "settings")
    calls = []
    monkeypatch.setattr(auth, "fetch_discord_user", lambda _: {"id": USERS[1]["discord_id"], "access_token": "provider-secret"})
    monkeypatch.setattr(auth.user_store, "find_by_discord_id", lambda _: USERS[1])
    monkeypatch.setattr(auth, "join_guild", lambda *args: calls.append(args) or joined)
    monkeypatch.setattr(auth, "mark_discord_joined", lambda user_id: calls.append(user_id))
    response = client.get("/api/v1/auth/discord/callback?code=one-use&state=test-state", follow_redirects=False)
    assert response.headers["location"].endswith("/settings/profile?discord=" + ("connected" if joined else "failed"))
    assert calls == [(USERS[1]["discord_id"], "provider-secret")] + ([1] if joined else [])
    assert "provider-secret" not in response.text + str(response.headers)
    assert client.get("/api/v1/auth/me").json()["user_id"] == 1
    assert "no-store" in response.headers["cache-control"]


def test_existing_routes_and_single_migration_head_are_preserved():
    paths = set(main.app.openapi()["paths"])
    assert {
        "/api/v1/experts", "/api/v1/experts/{user_id}",
        "/api/v1/researcher/requests", "/api/v1/expert/requests",
        "/api/v1/notifications", "/api/v1/notifications/settings",
        "/api/v1/me/photo", "/api/v1/auth/discord/connect",
        "/api/v1/community/posts",
    } <= paths
    root = Path(__file__).resolve().parents[2]
    scripts = ScriptDirectory.from_config(Config(str(root / "backend/alembic.ini")))
    assert scripts.get_heads() == ["20261028_15"]
    assert [r.revision for r in scripts.walk_revisions()] == [
        "20261028_15", "20261028_14", "20261028_13", "20261027_12", "20261026_11", "20261026_10", "20261026_09", "20261026_08", "20261026_07",
        "20261025_06", "20261022_05", "20261022_04", "20261021_03", "20261021_02", "20261016_01",
    ]
    for number, name in [("009_create_community.sql", "20261026_10_community.sql"), ("010_community_integrity.sql", "20261026_11_community_integrity.sql")]:
        assert (root / "database/init" / number).read_bytes() == (root / "backend/migrations/sql" / name).read_bytes()
