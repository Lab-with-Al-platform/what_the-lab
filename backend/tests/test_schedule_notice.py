"""일정 알림 (DB · 디스코드 없이): 날짜·시각 글자, 무엇이 바뀌었는지, 채널 한 줄 · 멘션, 종 글자, 아침 브리핑."""

from datetime import date, time

from app import schedule_notice as notice
from app import task_daily as daily
from app.task_text import brief_text

MEETING = {
    "kind": "meeting",
    "title": "주간 미팅",
    "start_date": date(2026, 11, 5),
    "end_date": date(2026, 11, 5),
    "start_time": time(14),
    "end_time": time(15, 30),
    "memo": None,
}
WORK = {**MEETING, "kind": "work", "title": "라벨링", "end_date": date(2026, 11, 12), "start_time": None, "end_time": None}


def test_when_text_by_shape():
    assert notice.when_text(MEETING) == "11.5 (목) 14:00~15:30"
    assert notice.when_text({**MEETING, "end_time": None}) == "11.5 (목) 14:00"
    assert notice.when_text({**MEETING, "start_time": None, "end_time": None}) == "11.5 (목)"
    assert notice.when_text(WORK) == "11.5 (목) ~ 11.12 (목)"
    assert notice.when_text({**MEETING, "start_time": "09:00:00", "end_time": None}) == "11.5 (목) 09:00"  # DB 글자


def test_moved_means_date_or_time_changed():
    assert notice.is_moved(MEETING, {**MEETING, "start_date": date(2026, 11, 6), "end_date": date(2026, 11, 6)})
    assert notice.is_moved(MEETING, {**MEETING, "start_time": time(16)})
    assert notice.is_moved(MEETING, {**MEETING, "end_time": None})
    assert not notice.is_moved(MEETING, {**MEETING, "title": "킥오프", "memo": "링크"})  # 제목·메모만 → 종에만
    assert notice.is_edited(MEETING, {**MEETING, "memo": "링크"})
    assert not notice.is_edited(MEETING, {**MEETING, "memo": ""})  # 빈 메모 = 없음
    assert not notice.is_moved(MEETING, dict(MEETING)) and not notice.is_edited(MEETING, dict(MEETING))


def test_notes():
    assert notice.created_note(MEETING, 1) == "주간 미팅 · 미팅 · 11.5 (목) 14:00~15:30"
    assert notice.created_note(MEETING, 3).endswith("· 매주 반복 3번")
    moved = {**MEETING, "start_date": date(2026, 11, 6), "end_date": date(2026, 11, 6), "start_time": time(10), "end_time": None}
    assert notice.changed_note(MEETING, moved) == "주간 미팅 · 11.5 (목) 14:00~15:30 → 11.6 (금) 10:00"
    assert notice.deleted_note(MEETING, 4).endswith("· 이 날짜부터 매주 4개")


PEOPLE = {
    "collaboration_id": 3,
    "discord_channel_id": "900",
    "researcher_id": 1,
    "researcher_discord_id": "111",
    "researcher_name": "jiwoo_lab",
    "expert_id": 4,
    "expert_discord_id": "444",
    "expert_name": "outsider_lee",
}


class Saved:
    def __init__(self) -> None:
        self.params = []

    def execute(self, sql, params=None):
        self.params.append(params)


def test_notify_goes_to_the_other_person():
    cursor = Saved()
    sent = notice.notify_schedule(cursor, PEOPLE, 1, "schedule_created", 42, "주간 미팅")
    assert cursor.params[0][:5] == (4, "schedule_created", 1, 3, 42)  # 연구자가 추가 → 전문가에게
    assert sent == {
        "channel": "900",
        "to": "444",
        "actor": "jiwoo_lab",
        "type": "schedule_created",
        "note": "주간 미팅",
        "schedule_id": 42,
    }
    sent = notice.notify_schedule(Saved(), PEOPLE, 4, "schedule_deleted", 42, "주간 미팅")
    assert sent["to"] == "111" and sent["actor"] == "outsider_lee"


def test_announce_mentions_the_other_person(monkeypatch):
    calls = []
    monkeypatch.setattr(notice, "bot_ready", lambda: True)
    monkeypatch.setattr(
        notice, "send_message", lambda channel, text, components, mentions: calls.append((channel, text, components, mentions))
    )
    notice.announce(
        {"channel": "900", "to": "444", "actor": "jiwoo_lab", "type": "schedule_changed", "note": "주간 미팅 · A → B", "schedule_id": 7}
    )
    channel, text, components, mentions = calls[0]
    assert (channel, text) == ("900", "🔁 <@444> jiwoo_lab 님이 일정을 바꿨어요 · 주간 미팅 · A → B")
    assert mentions == {"parse": [], "users": ["444"]}  # 상대만 멘션 → 폰 알림
    assert components[0]["components"][0]["custom_id"] == "schedule:manage:7"  # [일정 관리]
    notice.announce({"channel": "900", "to": "444", "actor": "jiwoo_lab", "type": "schedule_edited", "note": "x"})
    notice.announce(None)
    assert len(calls) == 1  # 제목·메모만 바뀐 것은 채널에 안 올려요 (종에만)

def test_bell_text_survives_deleted_schedule():
    title, detail = notice.schedule_message(
        {"type": "schedule_deleted", "actor_nickname": "jiwoo_lab", "note": "주간 미팅 · 미팅 · 11.5 (목)", "collab_title": "세포 이미지"}
    )
    assert title == "jiwoo_lab 님이 일정을 지웠어요"
    assert detail == "주간 미팅 · 미팅 · 11.5 (목) · 세포 이미지"


def test_brief_text_with_schedules_mentions_both():
    today = date(2026, 11, 5)
    text = brief_text(
        today,
        [
            {"type": "schedule_tomorrow", "to": ["111", "444"], "schedule": {**WORK, "start_date": date(2026, 11, 6)}},
            {"type": "task_due_soon", "to": ["444"], "content": "그래프 정리", "due_date": today},
            {"type": "schedule_today", "to": ["111", "444"], "schedule": MEETING},
            {"type": "schedule_ending", "to": ["111", "444"], "schedule": {**WORK, "start_date": date(2026, 11, 1), "end_date": date(2026, 11, 6)}},
        ],
    )
    lines = text.split("\n")
    assert lines[0] == "☀️ **오늘 챙길 일** · 11.5 (목)"
    assert lines[1] == "📅 <@111> <@444> 오늘 · 주간 미팅 · 미팅 · 11.5 (목) 14:00~15:30"
    assert lines[2] == "⏰ <@444> 오늘까지예요 · 그래프 정리"
    assert lines[3] == "🏁 <@111> <@444> 내일 끝나요 · 라벨링 · 작업 기간 · 11.1 (일) ~ 11.6 (금)"
    assert lines[4] == "🔔 <@111> <@444> 내일부터 · 라벨링 · 작업 기간 · 11.6 (금) ~ 11.12 (목)"


def test_group_by_channel_merges_two_people_per_schedule():
    rows = [
        {"type": "schedule_today", "schedule_id": 7, "schedule": MEETING, "discord_channel_id": "900", "discord_id": "111"},
        {"type": "schedule_today", "schedule_id": 7, "schedule": MEETING, "discord_channel_id": "900", "discord_id": "444"},
        {"type": "schedule_today", "schedule_id": 8, "schedule": MEETING, "discord_channel_id": "900", "discord_id": "111"},
    ]
    channels = daily.group_by_channel(rows)
    assert [entry["to"] for entry in channels["900"]] == [["111", "444"], ["111"]]

def test_deleted_message_has_no_manage_button():
    assert notice.manage_components({"type": "schedule_deleted", "schedule_id": 7}) is None
    assert notice.manage_components({"type": "schedule_created", "schedule_id": 7}) is not None