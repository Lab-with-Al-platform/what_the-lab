"""협업 요청 규칙 (DB 없이): 시작일·기한 계산, 기간 조정 범위, 다시 보내기."""

from datetime import date, datetime

import pytest
from fastapi import HTTPException

from app import request_rules as rules

KST = rules.KST


def at(month: int, day: int, hour: int = 10) -> datetime:
    """2026년 한국 시간"""
    return datetime(2026, month, day, hour, tzinfo=KST)


def night(month: int, day: int) -> datetime:
    """그날 밤 끝 (= 다음 날 0시)"""
    return rules.night_of(date(2026, month, day))


# ---------- 요청 보낼 때 시작일 ----------
def test_normal_start_is_three_days_later_urgent_is_tomorrow():
    assert rules.earliest_start(at(10, 20), urgent=False) == date(2026, 10, 23)
    assert rules.earliest_start(at(10, 20), urgent=True) == date(2026, 10, 21)
    rules.check_request_period(at(10, 20), date(2026, 10, 23), date(2026, 12, 1), urgent=False)
    with pytest.raises(HTTPException) as error:
        rules.check_request_period(at(10, 20), date(2026, 10, 22), date(2026, 12, 1), urgent=False)
    assert "10.23부터" in error.value.detail
    rules.check_request_period(at(10, 20), date(2026, 10, 21), date(2026, 10, 30), urgent=True)


def test_end_before_start_is_rejected():
    with pytest.raises(HTTPException):
        rules.check_request_period(at(10, 20), date(2026, 11, 5), date(2026, 11, 1), urgent=False)


# ---------- 전문가 답 기한 ----------
def test_answer_deadline_is_five_days_when_start_is_far():
    assert rules.answer_deadline(at(10, 20), date(2026, 10, 30), urgent=False) == at(10, 25)


def test_answer_deadline_is_two_days_before_start_when_start_is_near():
    # 10.23 시작 → 10.21 밤까지 (연구자가 10.22에 고를 수 있게)
    assert rules.answer_deadline(at(10, 20), date(2026, 10, 23), urgent=False) == night(10, 21)


def test_urgent_answer_deadline_is_the_night_before_start():
    # 내일(10.21) 시작 → 오늘(10.20) 밤까지
    assert rules.answer_deadline(at(10, 20), date(2026, 10, 21), urgent=True) == night(10, 20)


# ---------- 연구자 선택 기한 ----------
def test_select_deadline_is_five_days_or_night_before_start():
    assert rules.select_deadline(at(10, 20), date(2026, 11, 30)) == at(10, 25)
    assert rules.select_deadline(at(10, 21), date(2026, 10, 23)) == night(10, 22)


# ---------- 전문가 기간 조정 ----------
@pytest.mark.parametrize(
    ("accepted", "start", "low", "high"),
    [
        (at(10, 20), date(2026, 10, 23), date(2026, 10, 22), date(2026, 10, 30)),  # 하루만 앞당길 수 있어요
        (at(10, 21), date(2026, 10, 23), date(2026, 10, 23), date(2026, 10, 30)),  # 앞당길 수 없어요
        (at(10, 20), date(2026, 10, 26), date(2026, 10, 22), date(2026, 11, 2)),
        (at(10, 22), date(2026, 11, 10), date(2026, 11, 3), date(2026, 11, 17)),  # 최대 7일
    ],
)
def test_adjust_range_shrinks_as_start_gets_close(accepted, start, low, high):
    assert rules.adjust_range(accepted, start) == (low, high)


def test_adjusted_period_checks_range_and_length():
    original = (date(2026, 10, 30), date(2026, 12, 30))  # 62일
    rules.check_adjusted_period(at(10, 20), original, date(2026, 11, 3), date(2027, 1, 3))
    with pytest.raises(HTTPException) as error:
        rules.check_adjusted_period(at(10, 20), original, date(2026, 11, 10), date(2027, 1, 10))
    assert "10.23 ~ 11.06" in error.value.detail
    with pytest.raises(HTTPException) as error:
        rules.check_adjusted_period(at(10, 20), original, date(2026, 11, 3), date(2026, 11, 20))
    assert "절반에서 2배" in error.value.detail


# ---------- 같은 전문가에게 다시 보내기 ----------
def ended(status: str, responded: bool = False, reason: str | None = None) -> dict:
    return {"status": status, "responded_at": "x" if responded else None, "cancel_reason": reason}


def test_second_try_only_after_no_answer_or_my_cancel():
    assert rules.second_try_block([]) is None
    assert rules.second_try_block([ended("expired")]) is None
    assert rules.second_try_block([ended("canceled", reason="withdrawn")]) is None
    assert "거절" in rules.second_try_block([ended("rejected", responded=True)])
    assert rules.second_try_block([ended("canceled", responded=True, reason="expert_withdrew")])
    assert rules.second_try_block([ended("canceled", responded=True, reason="declined")])
    assert rules.second_try_block([ended("expired", responded=True)])  # 수락 후 시작 안 해서 만료


def test_no_third_try():
    assert "두 번까지" in rules.second_try_block([ended("expired"), ended("expired")])