"""협업 요청 규칙: 날짜·기한 계산과 '다시 보낼 수 있는지' 판단. (DB 없이 계산만 해요)

날짜는 모두 한국 시간 기준이에요. "○일 밤까지" = 그다음 날 0시(한국 시간)가 되기 전까지.
"""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException

KST = ZoneInfo("Asia/Seoul")

NORMAL_LEAD_DAYS = 3  # 일반 요청: 오늘부터 3일 뒤부터 시작일로 고를 수 있어요
URGENT_LEAD_DAYS = 1  # 급해요: 내일부터
ANSWER_DAYS = 5  # 전문가가 답할 수 있는 최대 날 수
SELECT_DAYS = 5  # 전문가가 수락한 뒤 연구자가 고를 수 있는 최대 날 수
ADJUST_DAYS = 7  # 전문가가 시작일을 앞뒤로 옮길 수 있는 최대 날 수
ADJUST_GAP_DAYS = 2  # 앞당길 때 가장 이른 시작일 = 수락한 날 + 2일 (연구자가 고를 시간)
MAX_TRIES = 2  # 같은 연구로 같은 전문가에게 보낼 수 있는 횟수
MAX_OPEN = 3  # 한 연구로 동시에 답을 기다리거나 수락된 요청 수
MAX_ACTIVE = 3  # 한 연구로 동시에 진행하는 협업 수


def today_kst(now: datetime) -> date:
    return now.astimezone(KST).date()


def night_of(day: date) -> datetime:
    """그날 밤 끝 = 다음 날 0시 (한국 시간). 기한을 'day까지'로 보여 줄 때 써요."""
    return datetime.combine(day + timedelta(days=1), time(0), KST)


def earliest_start(now: datetime, urgent: bool) -> date:
    """고를 수 있는 가장 빠른 시작일."""
    return today_kst(now) + timedelta(days=URGENT_LEAD_DAYS if urgent else NORMAL_LEAD_DAYS)


def check_request_period(now: datetime, start: date, end: date, urgent: bool) -> None:
    """요청 보낼 때 기간 확인. 잘못됐으면 400."""
    first = earliest_start(now, urgent)
    if start < first:
        rule = "급한 요청은 내일부터" if urgent else "시작일은 오늘부터 3일 뒤부터"
        raise HTTPException(status_code=400, detail=f"{rule} 고를 수 있어요 ({first:%m.%d}부터)")
    if end < start:
        raise HTTPException(status_code=400, detail="희망 종료일은 시작일보다 빠를 수 없어요")


def answer_deadline(now: datetime, start: date, urgent: bool) -> datetime:
    """전문가 답 기한.

    일반: 보낸 지 5일 / 시작일 2일 전 밤 중 빠른 때
    급해요: 시작일 전날 밤 (= 내일 시작이면 오늘 밤)
    """
    if urgent:
        return night_of(start - timedelta(days=1))
    return min(now + timedelta(days=ANSWER_DAYS), night_of(start - timedelta(days=2)))


def select_deadline(now: datetime, start: date) -> datetime:
    """연구자가 수락자를 고를(협업 시작) 기한: 수락 후 5일 / 시작일 전날 밤 중 빠른 때."""
    return min(now + timedelta(days=SELECT_DAYS), night_of(start - timedelta(days=1)))


def adjust_range(now: datetime, original_start: date) -> tuple[date, date]:
    """전문가가 고를 수 있는 시작일 범위 (원래 시작일 ±7일, 가장 이른 날은 오늘 + 2일)."""
    earliest = max(original_start - timedelta(days=ADJUST_DAYS), today_kst(now) + timedelta(days=ADJUST_GAP_DAYS))
    return earliest, original_start + timedelta(days=ADJUST_DAYS)


def check_adjusted_period(
    now: datetime, original: tuple[date, date], new_start: date, new_end: date
) -> None:
    """전문가가 조정한 기간 확인. 시작일은 범위 안, 기간 길이는 원래의 절반~2배."""
    low, high = adjust_range(now, original[0])
    if not low <= new_start <= high:
        raise HTTPException(
            status_code=400, detail=f"시작일은 {low:%m.%d} ~ {high:%m.%d} 중에서 골라 주세요"
        )
    if new_end < new_start:
        raise HTTPException(status_code=400, detail="종료일은 시작일보다 빠를 수 없어요")
    days = (original[1] - original[0]).days + 1
    new_days = (new_end - new_start).days + 1
    if not days / 2 <= new_days <= days * 2:
        raise HTTPException(
            status_code=400,
            detail=f"기간은 원래 기간({days}일)의 절반에서 2배 사이로 정해 주세요",
        )


def second_try_block(previous: list[dict]) -> str | None:
    """같은 연구·같은 전문가로 예전에 보낸 요청들을 보고, 또 보낼 수 없으면 이유를 돌려줘요.

    previous: 예전 요청들 (status, responded_at, cancel_reason)
    다시 보낼 수 있는 경우 = 예전 요청이 1개뿐이고, '답이 없어 만료' 또는 '내가 답 전에 취소'로 끝났을 때
    """
    if not previous:
        return None
    if len(previous) >= MAX_TRIES:
        return "같은 연구로 이 전문가에게는 두 번까지만 요청할 수 있어요"
    last = previous[0]
    status = last["status"]
    if status == "pending":
        return "이 전문가에게 이미 보낸 요청이 있어요"
    if status == "accepted":
        return "이 전문가가 이미 수락한 요청이 있어요"
    if status == "started":
        return "이 전문가와 이미 협업을 시작했어요"
    if status == "rejected":
        return "거절한 전문가에게는 같은 연구로 다시 보낼 수 없어요"
    no_answer = status == "expired" and last["responded_at"] is None
    withdrawn = status == "canceled" and last["cancel_reason"] == "withdrawn"
    if no_answer or withdrawn:
        return None
    return "수락 후 끝난 요청이라 같은 연구로 다시 보낼 수 없어요"