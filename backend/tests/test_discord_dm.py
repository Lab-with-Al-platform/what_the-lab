"""디스코드 DM 보내기 (실제 디스코드에 접속하지 않고 응답만 흉내 내요)."""

from datetime import UTC, datetime

import httpx
import pytest

from app import discord_bot, notification_sender
from app.notification_sender import dm_text, skip_reason, waiting_for_channel
from app.request_rules import KST


def fake_post(responses: list, calls: list):
    """부를 때마다 responses에서 하나씩 꺼내 돌려줘요."""

    def post(url, headers, json, timeout):
        calls.append({"url": url, "json": json})
        status, body = responses.pop(0)
        return httpx.Response(status, json=body, request=httpx.Request("POST", url))

    return post


def test_send_dm_opens_channel_then_sends(monkeypatch):
    calls: list = []
    responses = [(200, {"id": "555"}), (200, {"id": "m1"})]
    monkeypatch.setattr(discord_bot.httpx, "post", fake_post(responses, calls))
    discord_bot.send_dm("123", "안녕하세요")
    assert calls[0]["url"].endswith("/users/@me/channels")
    assert calls[0]["json"] == {"recipient_id": "123"}
    assert calls[1]["url"].endswith("/channels/555/messages")
    assert calls[1]["json"]["content"] == "안녕하세요"
    assert calls[1]["json"]["allowed_mentions"] == {"parse": []}


def test_send_dm_blocked_when_user_closed_dm(monkeypatch):
    responses = [(200, {"id": "555"}), (403, {"code": 50007})]
    monkeypatch.setattr(discord_bot.httpx, "post", fake_post(responses, []))
    with pytest.raises(discord_bot.DmBlocked):
        discord_bot.send_dm("123", "안녕하세요")


def test_send_dm_raises_for_retry_on_server_error(monkeypatch):
    responses = [(200, {"id": "555"}), (500, {})]
    monkeypatch.setattr(discord_bot.httpx, "post", fake_post(responses, []))
    with pytest.raises(httpx.HTTPError):
        discord_bot.send_dm("123", "안녕하세요")


def pending(**extra) -> dict:
    base = {
        "user_id": 10,
        "type": "request_received",
        "too_old": False,
        "discord_dm": True,
        "notify_request": True,
        "notify_workspace": True,
        "discord_joined_at": datetime.now(UTC),
        "actor_nickname": "cell_jung",
        "research_title": "세포 이미지 자동 계수",
        "reject_reason": None,
        "expert_id": 10,
        "request_status": "pending",
        "is_urgent": False,
        "expires_at": datetime(2026, 10, 26, tzinfo=KST),  # 10.25 밤까지
        "accepted_start_date": None,
        "cancel_reason": None,
        "responded_at": None,
    }
    return {**base, **extra}


def test_skip_reasons():
    assert skip_reason(pending()) is None
    assert skip_reason(pending(too_old=True)) == "오래된 알림"
    assert skip_reason(pending(discord_dm=False)) == "DM 받기 꺼짐"
    assert skip_reason(pending(notify_request=False)) == "이 종류 알림 꺼짐"
    assert skip_reason(pending(discord_joined_at=None)) == "LabBridge 서버 미참가"


def test_dm_text_has_title_detail_and_link():
    text = dm_text(pending())
    assert text.startswith("**cell_jung 님이 협업을 요청했어요**\n")
    assert "세포 이미지 자동 계수 · 10.25 밤까지 답해 주세요" in text
    assert text.endswith("/requests")


# ---------- "협업 시작" DM: 채널 링크 ----------
def started(**extra) -> dict:
    return pending(**{"type": "collab_started", "request_status": "started", "just_made": True, **extra})


def test_collab_started_dm_has_channel_link_and_workspace(monkeypatch):
    monkeypatch.setattr(notification_sender, "channel_url", lambda channel_id: f"https://discord.com/channels/999/{channel_id}")
    text = dm_text(started(channel_status="ready", discord_channel_id="555"))
    assert text.startswith("**cell_jung 님과 협업을 시작했어요**\n")
    assert "https://discord.com/channels/999/555" in text
    assert text.endswith("/workspace")


def test_collab_started_dm_without_channel_still_goes():
    text = dm_text(started(channel_status="failed", discord_channel_id=None))
    assert "discord.com/channels" not in text  # 채널이 없으면 링크만 빠지고
    assert text.endswith("/workspace")  # 협업 시작 안내는 그대로 가요


def test_waits_for_channel_only_for_a_while():
    assert waiting_for_channel(started(channel_status="pending")) is True  # 채널 만드는 중 → 잠깐 기다림
    assert waiting_for_channel(started(channel_status="pending", just_made=False)) is False  # 3분 지나면 그냥 보냄
    assert waiting_for_channel(started(channel_status="ready")) is False
    assert waiting_for_channel(pending(channel_status="pending", just_made=True)) is False  # 다른 알림은 안 기다림