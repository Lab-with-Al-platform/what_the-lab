"""요청 → 디스코드 채널 · 구글 캘린더 반영 (웹에서 바꿨을 때). 디스코드 · 구글에 연결하지 않고 확인해요."""

from datetime import date

import pytest

from app import task_sync as sync
from app.google_calendar import task_event_body, task_event_id

TASK = {
    "task_id": 12,
    "collaboration_id": 3,
    "content": "학습 곡선 그래프를 보내 주세요",
    "due_date": date(2026, 11, 10),
    "status": "open",
    "discord_message_id": None,
    "closed_on": None,
    "requested_by_nickname": "jiwoo_lab",
    "requested_by_discord_id": "111",
    "assignee_nickname": "outsider_lee",
    "assignee_discord_id": "222",
    "discord_channel_id": "900",
    "google_calendar_id": "cal@group",
}


@pytest.fixture
def calls(monkeypatch):
    """디스코드 · 구글 대신 무엇을 불렀는지 모아요."""
    log: list[tuple] = []
    state = {"task": dict(TASK), "edit_ok": True}
    monkeypatch.setattr(sync, "task_card", lambda task_id: state["task"])
    monkeypatch.setattr(sync, "bot_ready", lambda: True)
    monkeypatch.setattr(sync, "google_ready", lambda: True)
    monkeypatch.setattr(sync, "save_message_id", lambda task_id, mid: log.append(("save", task_id, mid)))
    monkeypatch.setattr(sync, "put_event", lambda cal, eid, body: log.append(("google_put", eid, body["summary"])))
    monkeypatch.setattr(sync, "delete_event", lambda cal, eid: log.append(("google_delete", eid)))

    def send(channel, content, *, components=None, mentions=None):
        log.append(("send", content.split("\n")[0], mentions["users"], bool(components)))
        return "555"

    def edit(channel, message_id, content, components):
        log.append(("edit", message_id, content.split("\n")[0]))
        return state["edit_ok"]

    monkeypatch.setattr(sync, "send_message", send)
    monkeypatch.setattr(sync, "edit_message", edit)
    return log, state


def test_created_on_web_posts_message_with_mention(calls):
    log, _ = calls
    sync.after_web_change(12, "created")
    assert ("google_put", "lbt00012", "[요청] 학습 곡선 그래프를 보내 주세요") in log
    sent = next(item for item in log if item[0] == "send")
    assert sent[1].startswith("📌 **요청** · jiwoo_lab → <@222>")
    assert sent[2] == ["222"] and sent[3]  # 받은 사람 멘션 + [요청 관리] 버튼
    assert ("save", 12, "555") in log


def test_done_edits_message_and_calls_requester(calls):
    log, state = calls
    state["task"] = {**TASK, "status": "done", "discord_message_id": "555", "closed_on": date(2026, 11, 8)}
    sync.after_web_change(12, "done")
    assert ("edit", "555", "✅ **요청 완료** · jiwoo_lab → outsider_lee · 11.8 완료") in log
    assert ("send", "✅ <@111> 요청을 완료했어요", ["111"], False) in log  # 보낸 사람에게 알림
    assert ("google_put", "lbt00012", "✅ [요청] 학습 곡선 그래프를 보내 주세요") in log


def test_due_change_calls_assignee(calls):
    log, state = calls
    state["task"] = {**TASK, "discord_message_id": "555", "due_date": date(2026, 11, 12)}
    sync.after_web_change(12, "due", date(2026, 11, 10))
    assert ("send", "📅 <@222> 요청 기한이 바뀌었어요: 11.10 (화) → **11.12 (목)**", ["222"], False) in log


def test_missing_message_is_posted_again(calls):
    """메시지가 지워졌거나(404) 예전에 웹에서만 남긴 요청이면 새로 올려요."""
    log, state = calls
    state["task"] = {**TASK, "discord_message_id": "555"}
    state["edit_ok"] = False
    sync.after_web_change(12, "reopened")
    assert [item[0] for item in log if item[0] in ("edit", "send")] == ["edit", "send"]


@pytest.mark.parametrize("change", [{"status": "canceled"}, {"due_date": None}])
def test_google_deletes_canceled_or_no_due(calls, change):
    log, state = calls
    state["task"] = {**TASK, **change, "discord_message_id": "555"}
    sync.after_web_change(12, "canceled")
    assert ("google_delete", "lbt00012") in log


def test_skips_discord_without_channel_and_google_without_calendar(calls):
    log, state = calls
    state["task"] = {**TASK, "discord_channel_id": None, "google_calendar_id": None}
    sync.after_web_change(12, "created")
    assert log == []


def test_task_event_is_all_day_on_due():
    body = task_event_body({**TASK, "status": "open"})
    assert body["start"] == {"date": "2026-11-10"} and body["end"] == {"date": "2026-11-11"}
    assert "/workspace/3" in body["description"]
    assert task_event_id(12) == "lbt00012"