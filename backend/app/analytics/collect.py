"""방문·공개 글·등록 과정의 허용 사건만 검사합니다.

세션 번호는 페이지 방문과 글 조회에만 둡니다. 등록 사건에는 넣지 않습니다.
회원 번호, Discord, 이메일, 연구 본문은 이 기록에 없습니다.
주간 고유 세션은 일별 고유 수를 더해 만들지 않고, 기간 안 원본의 세션 번호로 셉니다.
"""

import os
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID, uuid5

from app.insights.public_catalog import is_public_article
from app.operations.periods import SEOUL

# 서버가 만드는 등록 완료 사건의 고정 이름공간. 같은 연구는 한 번만 완료로 남깁니다.
COMPLETED_NAMESPACE = UUID("6f4e2a10-7c3b-4d8e-9a1f-2b6c8d0e4f71")

PAGE_KEYS = frozenset({"home", "cases", "trends", "experts", "expert", "case", "trend"})
SESSION_EVENTS = frozenset({"page_view", "article_view"})
CLIENT_EVENTS = SESSION_EVENTS | frozenset(
    {
        "expert_search_click",
        "related_article_open",
        "registration_open",
        "registration_step",
        "registration_advance",
        "registration_validation_failed",
        "registration_save",
        "registration_close",
    }
)
REGISTRATION_EVENTS = frozenset(
    {
        "registration_open",
        "registration_step",
        "registration_advance",
        "registration_validation_failed",
        "registration_save",
        "registration_close",
        "registration_completed",
    }
)
STEPS = frozenset({"research", "data", "collaboration", "review"})
MODES = frozenset({"create", "resume", "edit"})
VALIDATION_CODES = frozenset(
    {
        "title_required",
        "field_required",
        "description_required",
        "data_type_required",
        "data_status_required",
        "share_required",
        "share_condition_required",
        "work_required",
        "output_required",
        "area_required",
    }
)
SAVE_CODES = frozenset({"draft_ok", "draft_failed", "register_failed", "edit_ok", "edit_failed"})
REASONS = frozenset(
    {"later", "explain_hard", "data_not_ready", "security", "input_hard", "error", "unanswered"}
)


def collection_enabled() -> bool:
    """기본값은 꺼짐. 사용자 환경 파일은 이 작업에서 바꾸지 않습니다."""
    return os.getenv("ANALYTICS_COLLECTION_ENABLED", "false").lower() == "true"


@dataclass(frozen=True)
class AnalyticsEvent:
    """저장 직전에 검사된 사건. 시각은 서버가 받은 시각만 씁니다."""

    event_id: str
    event_name: str
    target: str
    session_id: str | None = None
    attempt_id: str | None = None
    mode: str | None = None
    result_code: str | None = None
    reason_code: str | None = None
    research_id: int | None = None
    received_at: datetime | None = None


class EventRejected(Exception):
    """허용 목록에 없는 조합. 저장하지 않습니다."""

    def __init__(self, detail: str) -> None:
        self.detail = detail


def prepare_client_event(raw: dict) -> AnalyticsEvent | dict:
    """클라이언트가 보낼 수 있는 사건만 통과시킵니다.

    글 주소가 공개 목록에 없으면 저장하지 않고 unlinked를 돌려줍니다.
    등록 완료는 서버 저장이 성공한 뒤에만 만들어, 이 함수로는 받지 않습니다.
    """
    name = raw.get("event_name")
    if name == "registration_completed":
        raise EventRejected("등록 완료는 연구 저장 결과로만 기록합니다.")
    if name not in CLIENT_EVENTS:
        raise EventRejected("허용되지 않은 기록입니다.")
    target = _plain_target(str(raw.get("target") or ""))
    session_id = _optional_uuid(raw.get("session_id"), "세션 번호")
    attempt_id = _optional_uuid(raw.get("attempt_id"), "작성 시도 번호")
    mode = raw.get("mode")
    result_code = raw.get("result_code")
    reason_code = raw.get("reason_code")
    research_id = raw.get("research_id")
    try:
        if name in SESSION_EVENTS:
            target = _session_event(name, target, session_id, attempt_id, mode, research_id)
        else:
            target = _action_event(
                name, target, session_id, attempt_id, mode, result_code, reason_code, research_id
            )
    except _Unlinked:
        return {"accepted": False, "status": "unlinked", "duplicate": False}
    keep_result = name in {"registration_validation_failed", "registration_save"}
    return AnalyticsEvent(
        event_id=_required_uuid(raw.get("event_id"), "사건 번호"),
        event_name=name,
        target=target,
        session_id=session_id if name in SESSION_EVENTS else None,
        attempt_id=attempt_id if name in REGISTRATION_EVENTS else None,
        mode=mode if name in REGISTRATION_EVENTS else None,
        result_code=result_code if keep_result else None,
        reason_code=reason_code if name == "registration_close" else None,
        research_id=research_id if name in REGISTRATION_EVENTS else None,
    )


def completed_registration(
    attempt_id: str | None, research_id: int, mode: str, received_at: datetime
) -> AnalyticsEvent:
    """최초 등록이 서버에서 확정됐을 때의 사건. 클라이언트 클릭만으로는 만들지 않습니다."""
    if mode not in {"create", "resume"}:
        raise EventRejected("이미 등록된 연구의 수정은 신규 등록으로 세지 않습니다.")
    if research_id < 1:
        raise EventRejected("연구 번호를 확인해 주세요.")
    parsed_attempt = _optional_uuid(attempt_id, "작성 시도 번호") if attempt_id else None
    return AnalyticsEvent(
        event_id=str(uuid5(COMPLETED_NAMESPACE, f"registration-completed:{research_id}")),
        event_name="registration_completed",
        target="registered",
        attempt_id=parsed_attempt,
        mode=mode,
        research_id=research_id,
        received_at=received_at,
    )


def period_session_count(events: list[AnalyticsEvent], start: datetime, end: datetime) -> int:
    """기간에 페이지를 연 세션 수. 하루 단위 고유 수를 더한 값이 아닙니다."""
    return len(
        {
            event.session_id
            for event in events
            if event.event_name == "page_view"
            and event.session_id
            and event.received_at is not None
            and start <= event.received_at < end
        }
    )


def _session_event(
    name: str,
    target: str,
    session_id: str | None,
    attempt_id: str | None,
    mode: str | None,
    research_id: int | None,
) -> str:
    if session_id is None:
        raise EventRejected("방문과 글 조회에는 세션 번호가 필요합니다.")
    if attempt_id or mode or research_id:
        raise EventRejected("방문 기록에는 작성 시도나 연구를 붙이지 않습니다.")
    if name == "page_view":
        if target not in PAGE_KEYS:
            raise EventRejected("허용되지 않은 페이지입니다.")
        return target
    return _article_target(target)


def _action_event(
    name: str,
    target: str,
    session_id: str | None,
    attempt_id: str | None,
    mode: str | None,
    result_code: str | None,
    reason_code: str | None,
    research_id: int | None,
) -> str:
    if session_id is not None:
        raise EventRejected("세션 번호는 방문과 글 조회에만 씁니다.")
    if name in {"expert_search_click", "related_article_open"}:
        if attempt_id or mode or result_code or reason_code or research_id:
            raise EventRejected("글 이동 기록에는 계정·작성 정보를 넣지 않습니다.")
        return _article_target(target)
    if attempt_id is None or mode not in MODES:
        raise EventRejected("등록 과정에는 작성 시도와 모드가 필요합니다.")
    if not isinstance(research_id, int | type(None)) or (research_id is not None and research_id < 1):
        raise EventRejected("연구 번호를 확인해 주세요.")
    if name in {"registration_open", "registration_step", "registration_advance"}:
        if target not in STEPS or result_code or reason_code:
            raise EventRejected("등록 단계를 확인해 주세요.")
        return target
    if name == "registration_validation_failed":
        if target not in STEPS or result_code not in VALIDATION_CODES or reason_code:
            raise EventRejected("검증 코드를 확인해 주세요.")
        return target
    if name == "registration_save":
        if target not in STEPS or result_code not in SAVE_CODES or reason_code:
            raise EventRejected("저장 결과를 확인해 주세요.")
        return target
    if target not in STEPS or reason_code not in REASONS or result_code:
        raise EventRejected("닫기 사유를 확인해 주세요.")
    return target


def _article_target(target: str) -> str:
    """정적 공개 목록에 있는 유형/slug만 글 사건으로 받습니다."""
    kind, _, slug = target.partition("/")
    if not slug or not is_public_article(kind, slug):
        raise _Unlinked()
    return target


class _Unlinked(Exception):
    """공개 목록에 없는 글. prepare에서 unlinked 응답으로 바꿉니다."""


def _plain_target(target: str) -> str:
    if not target or len(target) > 80 or any(char in target for char in "?&=@# \n\r"):
        raise EventRejected("기록 대상을 확인해 주세요.")
    return target


def _required_uuid(value: object, label: str) -> str:
    parsed = _optional_uuid(value, label)
    if parsed is None:
        raise EventRejected(f"{label}를 확인해 주세요.")
    return parsed


def _optional_uuid(value: object, label: str) -> str | None:
    if value is None or value == "":
        return None
    try:
        return str(UUID(str(value)))
    except (TypeError, ValueError):
        raise EventRejected(f"{label}를 확인해 주세요.") from None


def day_key(moment: datetime) -> object:
    """일별 합의 날짜. 화면 경계는 한국 시간입니다."""
    return moment.astimezone(SEOUL).date()
