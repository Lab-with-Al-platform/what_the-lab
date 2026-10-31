"""아침 요청 브리핑 (DB · 디스코드 없이): 글자 모양 · 채널별 묶기 · 하루 한 번 · 9시 전에는 안 돎."""

from datetime import date, datetime

from app import task_daily as daily
from app.task_text import KST, brief_text

TODAY = date(2026, 11, 2)  # 월요일


def item(kind, to, **fields):
    return {"type": kind, "to": to, "content": "그래프 정리", "due_date": None, "actor": "outsider_lee", **fields}


def test_brief_text_orders_and_mentions_only_who_must_act():
    text = brief_text(
        TODAY,
        [
            item("task_due_soon", ["222"], due_date=date(2026, 11, 3)),
            item("task_talk_waiting", ["111"]),
            item("task_overdue", ["222"], due_date=date(2026, 10, 30)),
            item("collab_ending", ["111", "222"], end_date=date(2026, 11, 5), open_count=2),
            item("task_due_soon", ["222"], due_date=TODAY),
        ],
    )
    lines = text.split("\n")
    assert lines[0] == "☀️ **오늘 챙길 요청** · 11.2 (월)"
    assert lines[1].startswith("📅 <@111> <@222> 협업이 11.5 (목)에 끝나요 · 열린 요청 2개")  # 종료 임박이 맨 위
    assert lines[2] == "⚠️ <@222> 기한 10.30 (금)이 3일 지났어요 · 그래프 정리"
    assert lines[3] == "⏰ <@222> 오늘까지예요 · 그래프 정리" and lines[4] == "⏰ <@222> 내일까지예요 · 그래프 정리"
    assert lines[5].startswith("🗓 <@111> outsider_lee 님의 기한 수정 요청에 아직 답하지 않았어요")


def test_group_by_channel_merges_collab_ending_and_skips_no_channel():
    rows = [
        {"type": "collab_ending", "discord_channel_id": "900", "discord_id": "111"},
        {"type": "collab_ending", "discord_channel_id": "900", "discord_id": "222"},
        {"type": "task_due_soon", "discord_channel_id": "900", "discord_id": "222"},
        {"type": "task_due_soon", "discord_channel_id": None, "discord_id": "333"},  # 채널 없는 협업은 종만
    ]
    channels = daily.group_by_channel(rows)
    assert list(channels) == ["900"]
    assert [entry["to"] for entry in channels["900"]] == [["111", "222"], ["222"]]


def test_runs_once_a_day_after_nine(monkeypatch):
    ran = []
    monkeypatch.setattr(daily, "run_daily", lambda today: ran.append(today))
    monkeypatch.setattr(daily, "LAST_RUN", None)
    assert daily.run_if_due(datetime(2026, 11, 2, 8, 59, tzinfo=KST)) is False  # 9시 전
    assert daily.run_if_due(datetime(2026, 11, 2, 9, 0, tzinfo=KST)) is True
    assert daily.run_if_due(datetime(2026, 11, 2, 15, 0, tzinfo=KST)) is False  # 오늘 이미
    assert daily.run_if_due(datetime(2026, 11, 3, 9, 1, tzinfo=KST)) is True
    assert ran == [date(2026, 11, 2), date(2026, 11, 3)]