"""운영 화면의 기간. 저장 시각은 UTC로 비교하고, 날짜 경계만 한국 시간입니다."""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

SEOUL = ZoneInfo("Asia/Seoul")
MAX_RANGE_DAYS = 366


def seoul_today() -> date:
    """테스트에서 오늘을 고정할 수 있게 함수로 둡니다."""
    return datetime.now(SEOUL).date()


def as_utc(value: datetime) -> datetime:
    """시간대 표시가 없는 값은 UTC로 봅니다. 가입 완료 시각의 대용으로 쓰지 않습니다."""
    if value.tzinfo is None:
        return value.replace(tzinfo=ZoneInfo("UTC"))
    return value.astimezone(ZoneInfo("UTC"))


def seoul_day(value: datetime) -> date:
    return as_utc(value).astimezone(SEOUL).date()


def resolve_range(
    preset: str,
    start: date | None = None,
    end: date | None = None,
    today: date | None = None,
) -> tuple[datetime, datetime]:
    """시작 포함, 끝 제외. end는 다음 날 0시라서 자정 사건이 두 날에 들어가지 않습니다."""
    current = today or seoul_today()
    if preset == "today":
        start_date, end_date = current, current + timedelta(days=1)
    elif preset == "7d":
        start_date, end_date = current - timedelta(days=6), current + timedelta(days=1)
    elif preset == "30d":
        start_date, end_date = current - timedelta(days=29), current + timedelta(days=1)
    elif preset == "month":
        # 이번 달 1일부터 내일 0시 전까지. 지난달 전체와 길이를 맞추지 않습니다.
        start_date, end_date = current.replace(day=1), current + timedelta(days=1)
    elif preset == "custom":
        if start is None or end is None or end <= start:
            raise ValueError("직접 선택은 시작일보다 끝일이 뒤여야 합니다.")
        if (end - start).days > MAX_RANGE_DAYS:
            raise ValueError("기간은 366일 이하로 선택해 주세요.")
        start_date, end_date = start, end
    else:
        raise ValueError("알 수 없는 기간입니다.")
    start_at = datetime.combine(start_date, time.min, SEOUL)
    end_at = datetime.combine(end_date, time.min, SEOUL)
    return start_at, end_at


def previous_range(start_at: datetime, end_at: datetime) -> tuple[datetime, datetime]:
    """같은 길이의 바로 앞 구간. 이번 달이 26일이면 이전 구간도 26일입니다."""
    length = end_at - start_at
    return start_at - length, start_at


def each_day(start_at: datetime, end_at: datetime) -> list[date]:
    days: list[date] = []
    cursor = start_at.astimezone(SEOUL).date()
    last = end_at.astimezone(SEOUL).date()
    while cursor < last:
        days.append(cursor)
        cursor += timedelta(days=1)
    return days


def in_range(value: datetime, start_at: datetime, end_at: datetime) -> bool:
    moment = as_utc(value)
    return as_utc(start_at) <= moment < as_utc(end_at)


def describe_range(start_at: datetime, end_at: datetime, today: date) -> dict:
    start_day = start_at.astimezone(SEOUL).date()
    end_day = end_at.astimezone(SEOUL).date()
    includes_today = start_day <= today < end_day
    return {
        "start": start_day.isoformat(),
        "end": end_day.isoformat(),
        "includes_today": includes_today,
        "today_in_progress": includes_today,
        "timezone": "Asia/Seoul",
    }
