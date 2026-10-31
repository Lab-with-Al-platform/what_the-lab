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
    monkeypatch.setattr(sync, "last_event", lambda task_id, kind: state.get(kind))  # 기록 (없으면 None)
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

def test_due_talk_calls_requester_with_reason(calls, monkeypatch):
    """[기한 얘기하기]: 상태는 그대로, 보낸 사람(111)을 새 메시지로 불러요"""
    log, state = calls
    state["task"] = {**TASK, "discord_message_id": "555"}
    event = {"old_due": date(2026, 11, 10), "new_due": date(2026, 11, 14), "note": "사진까지 보려면 더 걸려요"}
    monkeypatch.setattr(sync, "last_event", lambda task_id, kind: event if kind == "due_talk" else None)
    sync.after_web_change(12, "due_talk")
    sent = [entry for entry in log if entry[0] == "send"]
    assert sent == [("send", "🗓 <@111> outsider_lee 님이 기한 수정을 요청했어요: 11.10 (화) → **11.14 (토)**", ["111"], False)]

def test_due_talk_without_date_says_hard(calls, monkeypatch):
    from app.task_text import talk_line

    line = talk_line(TASK, {"old_due": date(2026, 11, 10), "new_due": None, "note": "이번 주는 어려워요"})
    assert "지금 기한(11.10 (화))으로는 어렵대요" in line and "이유: 이번 주는 어려워요" in line


def test_returned_calls_assignee(calls, monkeypatch):
    log, state = calls
    state["task"] = {**TASK, "discord_message_id": "555", "due_date": date(2026, 11, 12)}
    event = {"old_due": date(2026, 11, 10), "new_due": date(2026, 11, 12), "note": "축 단위가 빠졌어요"}
    monkeypatch.setattr(sync, "last_event", lambda task_id, kind: event if kind == "returned" else None)
    sync.after_web_change(12, "returned")
    assert any(entry[:2] == ("edit", "555") and entry[2].startswith("📌 **요청**") for entry in log)  # 다시 진행 중 모양
    assert ("send", "↩️ <@222> jiwoo_lab 님이 다시 요청했어요 · 기한 11.10 (화) → **11.12 (목)**", ["222"], False) in log
    assert ("google_put", "lbt00012", "[요청] 학습 곡선 그래프를 보내 주세요") in log  # 다시 진행 중 → ✅ 빠짐

@pytest.mark.parametrize(
    ("event", "record", "first_line", "who"),
    [
        ("canceled", None, "🚫 <@222> jiwoo_lab 님이 요청을 취소했어요", ["222"]),
        ("due_kept", {"note": "회의 전에 필요해요"}, "📌 <@222> jiwoo_lab 님이 지금 기한(**11.10 (화)**)을 유지하기로 했어요", ["222"]),
        ("reopened", {"actor_id": 2}, "↩️ <@111> outsider_lee 님이 완료를 되돌렸어요 (다시 진행 중)", ["111"]),  # 받은 사람이 되돌림
        ("reopened", {"actor_id": 1}, "↩️ <@222> jiwoo_lab 님이 취소한 요청을 되돌렸어요 (다시 진행 중)", ["222"]),  # 보낸 사람이 되돌림
    ],
)
def test_partner_is_called_for_each_event(calls, event, record, first_line, who):
    """한 사람이 한 일은 새 메시지 + 멘션으로 상대를 불러요 (휴대폰 푸시)"""
    log, state = calls
    state["task"] = {**TASK, "discord_message_id": "555", "requested_by": 1, "assignee": 2}
    state[event] = record
    sync.after_web_change(12, event)
    assert ("send", first_line, who, False) in log


def test_retry_once_only_for_temporary_errors(monkeypatch):
    import httpx

    monkeypatch.setattr(sync.time, "sleep", lambda seconds: None)
    tries = []

    def flaky(code):
        tries.append(code)
        if len(tries) == 1:
            raise httpx.HTTPStatusError("x", request=httpx.Request("GET", "http://x"), response=httpx.Response(code))
        return "ok"

    assert sync.retry_once(flaky, 503) == "ok" and len(tries) == 2  # 5xx → 한 번 더
    tries.clear()
    with pytest.raises(httpx.HTTPStatusError):
        sync.retry_once(flaky, 403)  # 권한 없음은 다시 해도 같아요
    assert len(tries) == 1

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