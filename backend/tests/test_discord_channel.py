"""협업 전용 디스코드 채널 만들기 (실제 디스코드에 접속하지 않고 응답만 흉내 내요)."""

import httpx
import pytest

from app import collab_channel, discord_bot


@pytest.fixture(autouse=True)
def bot_settings(monkeypatch):
    """테스트용 가짜 봇 설정: 서버 999, 봇(앱) 777, 협업 카테고리 888"""
    monkeypatch.setattr(discord_bot, "DISCORD_BOT_TOKEN", "bot-token")
    monkeypatch.setattr(discord_bot, "DISCORD_GUILD_ID", "999")
    monkeypatch.setattr(discord_bot, "DISCORD_CLIENT_ID", "777")
    monkeypatch.setattr(discord_bot, "DISCORD_COLLAB_CATEGORY_ID", "888")


def fake(status: int, body, calls: list):
    """부르면 calls 에 기록하고 정해 둔 응답을 돌려줘요."""

    def call(url, headers, timeout, json=None):
        calls.append({"url": url, "json": json})
        return httpx.Response(status, json=body, request=httpx.Request("GET", url))

    return call


def test_channel_name_and_url():
    assert discord_bot.channel_name(12) == "협업-12"
    assert discord_bot.channel_url("555") == "https://discord.com/channels/999/555"


def test_create_private_channel_hides_from_everyone(monkeypatch):
    calls: list = []
    monkeypatch.setattr(discord_bot.httpx, "post", fake(201, {"id": "555"}, calls))
    assert discord_bot.create_private_channel("협업-12", "세포 수 세기") == "555"
    body = calls[0]["json"]
    assert calls[0]["url"].endswith("/guilds/999/channels")
    assert (body["name"], body["type"], body["topic"], body["parent_id"]) == ("협업-12", 0, "세포 수 세기", "888")
    everyone, bot = body["permission_overwrites"]
    assert everyone == {"id": "999", "type": 0, "deny": str(discord_bot.VIEW_CHANNEL), "allow": "0"}  # 모두에게 안 보임
    assert bot["id"] == "777" and int(bot["allow"]) & discord_bot.VIEW_CHANNEL  # 봇은 보임


def test_create_without_category(monkeypatch):
    monkeypatch.setattr(discord_bot, "DISCORD_COLLAB_CATEGORY_ID", "")
    calls: list = []
    monkeypatch.setattr(discord_bot.httpx, "post", fake(201, {"id": "555"}, calls))
    discord_bot.create_private_channel("협업-12", "제목")
    assert "parent_id" not in calls[0]["json"]


def test_create_raises_for_retry(monkeypatch):
    monkeypatch.setattr(discord_bot.httpx, "post", fake(403, {"code": 50013}, []))  # 봇 권한 없음
    with pytest.raises(httpx.HTTPError):
        discord_bot.create_private_channel("협업-12", "제목")


def test_add_member_allows_view_and_send(monkeypatch):
    calls: list = []
    monkeypatch.setattr(discord_bot.httpx, "put", fake(204, None, calls))
    assert discord_bot.add_member("555", "123") is True
    assert calls[0]["url"].endswith("/channels/555/permissions/123")
    allow = int(calls[0]["json"]["allow"])
    assert calls[0]["json"]["type"] == 1
    assert allow & discord_bot.VIEW_CHANNEL and allow & discord_bot.SEND_MESSAGES


def test_add_member_false_when_not_in_server(monkeypatch):
    monkeypatch.setattr(discord_bot.httpx, "put", fake(404, {"code": 10013}, []))  # Unknown Member
    assert discord_bot.add_member("555", "123") is False


def test_find_channel_by_name(monkeypatch):
    channels = [{"id": "1", "name": "공지"}, {"id": "555", "name": "협업-12"}]
    monkeypatch.setattr(discord_bot.httpx, "get", fake(200, channels, []))
    assert discord_bot.find_channel("협업-12") == "555"
    assert discord_bot.find_channel("협업-13") is None


# ---------- 협업 하나 → 채널 하나 ----------
ROW = {"collaboration_id": 12, "title": "세포 수 세기", "researcher_discord_id": "111", "expert_discord_id": "222"}


def test_open_channel_creates_and_adds_both(monkeypatch):
    added: list = []
    monkeypatch.setattr(collab_channel, "find_channel", lambda name: None)
    monkeypatch.setattr(collab_channel, "create_private_channel", lambda name, topic: f"new:{name}:{topic}")
    monkeypatch.setattr(collab_channel, "add_member", lambda channel_id, discord_id: added.append(discord_id) or True)
    assert collab_channel.open_channel(ROW) == ("new:협업-12:세포 수 세기", None)
    assert added == ["111", "222"]


def test_open_channel_reuses_existing_and_reports_missing(monkeypatch):
    monkeypatch.setattr(collab_channel, "find_channel", lambda name: "555")  # 지난번에 만들고 저장 전에 멈춤
    monkeypatch.setattr(collab_channel, "create_private_channel", lambda name, topic: pytest.fail("두 번 만들면 안 돼요"))
    monkeypatch.setattr(collab_channel, "add_member", lambda channel_id, discord_id: discord_id == "111")
    assert collab_channel.open_channel(ROW) == ("555", "서버 미참가: AI 전문가")