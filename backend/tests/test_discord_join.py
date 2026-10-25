"""디스코드 서버 참가 (실제 디스코드에 접속하지 않고 응답만 흉내 내요)."""

import httpx
from fastapi.testclient import TestClient

from app import discord_bot
from app.main import app


def fake_put(status: int, calls: list):
    def put(url, headers, json, timeout):
        calls.append({"url": url, "headers": headers, "json": json})
        return httpx.Response(status)

    return put


def test_join_guild_ok_when_added_or_already_member(monkeypatch):
    monkeypatch.setattr(discord_bot, "DISCORD_BOT_TOKEN", "bot-token")
    monkeypatch.setattr(discord_bot, "DISCORD_GUILD_ID", "999")
    for status in (201, 204):
        calls: list = []
        monkeypatch.setattr(discord_bot.httpx, "put", fake_put(status, calls))
        assert discord_bot.join_guild("123", "user-token") is True
        assert calls[0]["url"].endswith("/guilds/999/members/123")
        assert calls[0]["headers"] == {"Authorization": "Bot bot-token"}
        assert calls[0]["json"] == {"access_token": "user-token"}


def test_join_guild_false_when_refused(monkeypatch):
    monkeypatch.setattr(discord_bot, "DISCORD_BOT_TOKEN", "bot-token")
    monkeypatch.setattr(discord_bot, "DISCORD_GUILD_ID", "999")
    monkeypatch.setattr(discord_bot.httpx, "put", fake_put(403, []))
    assert discord_bot.join_guild("123", "user-token") is False


def test_join_guild_skipped_without_bot_settings(monkeypatch):
    monkeypatch.setattr(discord_bot, "DISCORD_BOT_TOKEN", "")
    calls: list = []
    monkeypatch.setattr(discord_bot.httpx, "put", fake_put(201, calls))
    assert discord_bot.join_guild("123", "user-token") is False
    assert calls == []  # 디스코드를 부르지도 않아요


def test_login_asks_for_server_join_permission():
    with TestClient(app) as client:
        response = client.get("/api/v1/auth/discord/login", follow_redirects=False)
    assert response.status_code == 307
    assert "scope=identify+guilds.join" in response.headers["location"]