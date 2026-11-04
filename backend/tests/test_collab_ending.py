"""진행 중 협업 마무리 (DB · 디스코드 없이): 연장 범위, 조기 완료 조건, 답 기한, 채널 글자, 평가 규칙(중단)."""

from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi import HTTPException

from app import collab_ending as e
from app import review_store
from app.reputation_store import REPUTATION_SQL
from app.task_text import KST, brief_text

TODAY = date(2026, 12, 2)
END = date(2026, 12, 9)


def test_check_active():
    e.check_active({"status": "ongoing", "start_date": date(2026, 11, 9)}, TODAY)
    for collab in ({"status": "ongoing", "start_date": date(2026, 12, 5)}, {"status": "done", "start_date": date(2026, 11, 9)}):
        with pytest.raises(HTTPException) as error:
            e.check_active(collab, TODAY)
        assert error.value.status_code == 409


@pytest.mark.parametrize(
    ("new_end", "ok"),
    [(date(2026, 12, 10), True), (date(2027, 1, 8), True), (date(2027, 1, 9), False), (END, False), (date(2026, 12, 1), False)],
)
def test_check_extend(new_end, ok):
    if ok:
        e.check_extend(END, new_end)
        return
    with pytest.raises(HTTPException):
        e.check_extend(END, new_end)


def test_answer_deadline_is_three_days_or_day_after_end():
    now = datetime(2026, 12, 2, 15, 0, tzinfo=KST)
    assert e.answer_deadline(now, END) == datetime(2026, 12, 5, 15, 0, tzinfo=KST)
    assert e.answer_deadline(now, date(2026, 12, 3)) == datetime(2026, 12, 4, 0, 0, tzinfo=KST)  # 종료일이 더 빨라요


def test_blockers_text():
    assert e.blockers_text({"open_tasks": 0, "upcoming_schedules": 0}) is None
    assert e.blockers_text({"open_tasks": 2, "upcoming_schedules": 3}) == "진행 중인 요청 2개 · 남은 일정 3개를 먼저 끝내거나 지워 주세요"


def test_channel_texts_link_to_web():
    notice = {
        "type": "extend_requested", "to": "222", "actor": "jiwoo_lab", "note": "12.9 → 12.23 · 데이터 추가 수집",
        "collaboration_id": 12, "deadline": datetime(2026, 12, 5, 15, 0, tzinfo=KST),
    }
    text = e.request_text(notice)
    assert text.startswith("⏩ <@222> jiwoo_lab 님이 기간 연장을 요청했어요 · 12.9 → 12.23")
    assert "12.5 15:00까지 웹에서 답해 주세요 → " in text and text.endswith("/workspace/12")
    row = {
        "collaboration_id": 12, "status": "ended_early", "end_reason": "기타 · 사정", "ended_by": 4, "researcher_id": 1,
        "expert_id": 4, "researcher_discord_id": "111", "expert_discord_id": "222", "researcher_name": "jiwoo_lab",
        "expert_name": "outsider_lee",
    }
    stopped = e.finished_text(row, date(2026, 12, 4))
    assert stopped.startswith("⛔ <@111> <@222> outsider_lee 님이 협업을 중단했어요\n사유: 기타 · 사정")
    assert "중단한 분은 제외" in stopped and "**12.4 (금)**에 삭제돼요" in stopped
    assert e.finished_text({**row, "status": "done"}, date(2026, 12, 4)).startswith("🎉 <@111> <@222> 협업이 완료됐어요!")


def test_brief_week_left_line():
    text = brief_text(TODAY, [{"type": "collab_week_left", "to": ["1", "2"], "end_date": END}])
    assert "🗓 <@1> <@2> 협업이 12.9 (수)에 끝나요 (7일 남음)" in text


# ---------- 평가: 중단한 협업은 중단당한 사람만 ----------
def project(**fields):
    base = {
        "collaboration_id": 47, "status": "ended_early", "ended_at": datetime(2026, 12, 2, tzinfo=UTC),
        "researcher_id": 10, "expert_id": 20, "researcher_name": "연구회원", "expert_name": "AI 전문가",
        "research_title": "연구", "ended_by": 20, "end_reason": "개인 사정 · 회사 일",
    }
    return {**base, **fields}


def test_only_the_stopped_person_reviews():
    now = datetime(2026, 12, 3, tzinfo=UTC)
    researcher = review_store.review_window(project(), 10, now)
    expert = review_store.review_window(project(), 20, now)
    assert researcher["eligible"] and researcher["stopped_by_partner"] and researcher["end_reason"] == "개인 사정 · 회사 일"
    assert not expert["eligible"] and expert["stopped_by_me"]
    done = review_store.review_window(project(status="done", ended_by=None), 20, now)
    assert done["eligible"] and not done["stopped_by_me"]  # 완료는 두 사람 다


def test_public_rating_counts_expert_stopped_collaborations():
    clause = "(c.status='done' OR (c.status='ended_early' AND c.ended_by=c.expert_id))"
    assert clause in REPUTATION_SQL
    import inspect

    assert clause in inspect.getsource(review_store.public_expert_reviews)
    assert clause in inspect.getsource(review_store.report_review)
    assert e.MAX_EXTEND_DAYS == 30 and timedelta(days=e.ANSWER_DAYS) == timedelta(days=3)