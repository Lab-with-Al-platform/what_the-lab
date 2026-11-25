"""기간 확장의 설정·계획만 정의합니다. 검색·수집·게시를 실행하지 않습니다."""

from typing import Annotated, Literal

from pydantic import Field

from app.insights.schemas import StrictModel

WINDOW_STAGES = {
    "case": [30, 60, 90, 180, 365],
    "news": [30, 60, 90],
    "explanation": [30, 90, 365],
}


class DiscoveryPolicy(StrictModel):
    enabled: bool = Field(default=False, strict=True)
    target_candidates: Annotated[int, Field(strict=True, ge=1, le=50)] = 1
    case_max_days: Literal[30, 60, 90, 180, 365] = 365
    news_max_days: Literal[30, 60, 90] = 90
    explanation_max_days: Literal[30, 90, 365] = 365
    max_source_requests: Annotated[int, Field(strict=True, ge=1, le=100)] = 30
    max_run_seconds: Annotated[int, Field(strict=True, ge=10, le=600)] = 120
    date_basis: Literal["published"] = "published"
    historical_discovery: Literal["separate_manual"] = "separate_manual"


def recommended_discovery_policy(max_items: int) -> DiscoveryPolicy:
    """최대 저장 수를 올리지 않고, 소규모 검토를 위한 확장 기준을 제안합니다."""
    return DiscoveryPolicy(enabled=True, target_candidates=min(3, max_items))


def discovery_windows(
    profile: Literal["case", "news", "explanation"],
    policy: DiscoveryPolicy,
    lookback_days: int = 30,
) -> list[tuple[int, int]]:
    """발표일의 경과 일수 구간입니다. 첫 구간 뒤부터는 앞 구간 끝을 제외합니다.

    예: (0, 30), (30, 60)은 최근 30일을 재조회하지 않는 두 구간입니다.
    실제 날짜·출처별 포함 경계 변환은 수집기 연결 단계에서 검증해야 합니다.
    """
    if not policy.enabled:
        return [(0, lookback_days)]
    maximum = getattr(policy, f"{profile}_max_days")
    ends = [days for days in WINDOW_STAGES[profile] if days <= maximum]
    starts = [0, *ends[:-1]]
    return list(zip(starts, ends, strict=True))
