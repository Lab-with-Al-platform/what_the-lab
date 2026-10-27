"""디스코드 DM 보내기 (실제 디스코드에 접속하지 않고 응답만 흉내 내요)."""

from datetime import UTC, datetime

import httpx
import pytest

from app import discord_bot
from app.notification_sender import dm_text, skip_reason
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