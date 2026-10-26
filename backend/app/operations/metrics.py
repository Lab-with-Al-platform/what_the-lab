"""현재 상태와 계정 생성 시각으로 계산할 수 있는 집계만 만듭니다."""

from datetime import date, datetime

from app.operations.periods import each_day, in_range, previous_range, seoul_day
from app.operations.records import MemberRow, OperationsSnapshot, ResearchRow

PAGE_SIZE = 20

ROLE_LABELS = {None: "미선택", "researcher": "연구자", "expert": "AI 전문가"}
STEP_LABELS = {"role": "회원 유형", "verify": "소속 인증", "info": "기본 정보", "done": "가입 완료"}
STATUS_LABELS = {"active": "정상", "suspended": "정지", "deleted": "탈퇴"}
RESEARCH_STATUS = {"draft": "임시저장", "registered": "등록"}
DATA_STATUS = {
    "none": "데이터 없음",
    "collecting": "수집 중",
    "raw": "원본 보유",
    "ready": "분석 준비",
}
SHARE_POLICY = {"open": "외부 공유 가능", "conditional": "조건이 있음"}
DATA_TYPE = {"image": "이미지", "text": "텍스트", "table": "표", "audio": "음성", "etc": "기타"}


def _label(table: dict, code: str | None) -> str | None:
    if code is None:
        return None
    return table.get(code, code)


def _flow(count: int, previous: int) -> dict:
    """이전 값이 0이면 비율을 만들지 않고 절대 증감만 남깁니다."""
    return {
        "previous": previous,
        "absolute": count - previous,
        "rate": None if previous == 0 else round((count - previous) / previous, 4),
    }


def _series(dates: list[date], values: list[datetime]) -> list[dict]:
    counts = {day: 0 for day in dates}
    for value in values:
        day = seoul_day(value)
        if day in counts:
            counts[day] += 1
    return [{"date": day.isoformat(), "count": counts[day]} for day in dates]


def _page(rows: list, page: int) -> dict:
    start = (page - 1) * PAGE_SIZE
    return {
        "total": len(rows),
        "page": page,
        "page_size": PAGE_SIZE,
        "items": rows[start : start + PAGE_SIZE],
    }


def _created_matches(value: datetime, start_at: datetime | None, end_at: datetime | None) -> bool:
    """목록의 생성일 필터. 시작 포함, 끝 제외이며 둘 중 하나만 있어도 됩니다."""
    if start_at is None and end_at is None:
        return True
    if start_at is not None and end_at is not None:
        return in_range(value, start_at, end_at)
    day = seoul_day(value)
    if start_at is not None:
        return day >= start_at.astimezone(start_at.tzinfo).date()
    assert end_at is not None
    return day < end_at.astimezone(end_at.tzinfo).date()


def _member_matches(row: MemberRow, query: dict) -> bool:
    text = query["q"].strip()
    if text:
        id_match = text.isdigit() and str(row.user_id) == text
        name_match = text.casefold() in row.nickname.casefold()
        if not id_match and not name_match:
            return False
    if query["role"] == "unset" and row.user_role is not None:
        return False
    if query["role"] in {"researcher", "expert"} and row.user_role != query["role"]:
        return False
    if query["signup_step"] and row.signup_step != query["signup_step"]:
        return False
    if query["status"] == "":
        if row.status == "deleted":
            return False
    elif query["status"] != "any" and row.status != query["status"]:
        return False
    return _created_matches(row.created_at, query["created_start"], query["created_end"])


def filter_members(members: tuple[MemberRow, ...], query: dict, page: int) -> dict:
    """서버에서 거른 뒤 한 페이지만 돌려줍니다. 정렬은 최근 계정 생성, 같은 시각이면 번호 내림차순입니다."""
    matched = [row for row in members if _member_matches(row, query)]
    matched.sort(key=lambda row: (row.created_at, row.user_id), reverse=True)
    visible = [_member_item(row) for row in matched]
    return _page(visible, page)


def _member_item(row: MemberRow) -> dict:
    return {
        "user_id": row.user_id,
        "nickname": row.nickname,
        "role": row.user_role,
        "role_label": ROLE_LABELS.get(row.user_role, row.user_role),
        "affiliation": row.affiliation,
        "signup_step": row.signup_step,
        "signup_step_label": STEP_LABELS.get(row.signup_step, row.signup_step),
        "status": row.status,
        "status_label": STATUS_LABELS.get(row.status, row.status),
        "created_at": row.created_at.isoformat(),
    }


def member_detail(snapshot: OperationsSnapshot, user_id: int) -> dict | None:
    member = next((row for row in snapshot.members if row.user_id == user_id), None)
    if member is None:
        return None
    researches = [
        {
            "research_id": row.research_id,
            "title": row.title,
            "status": row.status,
            "status_label": RESEARCH_STATUS.get(row.status, row.status),
            "created_at": row.created_at.isoformat(),
        }
        for row in snapshot.researches
        if row.user_id == user_id
    ]
    body = _member_item(member)
    body["is_admin"] = member.is_admin
    body["researches"] = researches
    body["actions"] = _status_action(member.status, member.is_admin)
    body["audit"] = {
        "status": "not_collected",
        "note": "성공한 조치만 기록합니다. 과거 이력을 만들어 넣지 않습니다.",
        "items": [],
    }
    return body


def _status_action(status: str, is_admin: bool) -> dict:
    """버튼 가능 여부만 알려 줍니다. 실제 변경은 저장 시점에 다시 검사합니다."""
    if status == "deleted":
        return {
            "status": "not_available",
            "next_status": None,
            "note": "탈퇴 계정은 복구하거나 지우지 않습니다.",
        }
    if is_admin:
        return {
            "status": "not_available",
            "next_status": None,
            "note": "관리자 계정은 이 단계에서 정지하지 않습니다.",
        }
    if status == "active":
        return {
            "status": "ready",
            "next_status": "suspended",
            "note": "정지는 로그인만 막습니다. 연구와 협업 기록은 지우지 않습니다.",
        }
    if status == "suspended":
        return {
            "status": "ready",
            "next_status": "active",
            "note": "정지를 해제하면 다시 로그인할 수 있습니다.",
        }
    return {"status": "not_available", "next_status": None, "note": "바꿀 수 없는 상태입니다."}


def _research_matches(row: ResearchRow, query: dict) -> bool:
    text = query["q"].strip()
    if text:
        id_match = text.isdigit() and str(row.research_id) == text
        title_match = text.casefold() in row.title.casefold()
        owner_match = text.casefold() in row.owner_nickname.casefold()
        if not id_match and not title_match and not owner_match:
            return False
    if query["status"] and row.status != query["status"]:
        return False
    if query.get("progress_status") and _research_progress(row)["code"] != query["progress_status"]:
        return False
    if query["field_id"] and query["field_id"] not in row.field_ids:
        return False
    if query["able_work_id"] and query["able_work_id"] not in row.able_work_ids:
        return False
    return _created_matches(row.created_at, query["created_start"], query["created_end"])


def filter_researches(researches: tuple[ResearchRow, ...], query: dict, page: int) -> dict:
    matched = [row for row in researches if _research_matches(row, query)]
    matched.sort(key=lambda row: (row.created_at, row.research_id), reverse=True)
    items = [_research_item(row) for row in matched]
    return _page(items, page)


def _research_progress(row: ResearchRow) -> dict[str, str]:
    """작성 완료는 모집 시작이 아닙니다. 협업 모듈 연결 전에는 실제 진행을 추정하지 않습니다."""
    if row.status == "draft":
        return {
            "code": "not_applicable",
            "note": "임시저장 연구는 모집·진행 상태의 대상이 아닙니다.",
        }
    return {
        "code": "not_linked",
        "note": "모집·완료 상태가 없습니다. 협업 요청의 현재 상태는 협업 요청 탭에서 따로 봅니다.",
    }


def _research_item(row: ResearchRow) -> dict:
    return {
        "research_id": row.research_id,
        "title": row.title,
        "user_id": row.user_id,
        "owner_nickname": row.owner_nickname,
        "status": row.status,
        "status_label": RESEARCH_STATUS.get(row.status, row.status),
        "status_note": "작성 상태입니다. 공개 모집 중이 아닙니다.",
        "progress": _research_progress(row),
        "fields": [
            {"id": field_id, "name": name}
            for field_id, name in zip(row.field_ids, row.field_names, strict=True)
        ],
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
    }


def research_detail(snapshot: OperationsSnapshot, research_id: int) -> dict | None:
    row = next((item for item in snapshot.researches if item.research_id == research_id), None)
    if row is None:
        return None
    body = _research_item(row)
    body["is_primary"] = row.is_primary
    body["task_unsure"] = row.task_unsure
    body["able_works"] = [
        {"id": work_id, "name": name}
        for work_id, name in zip(row.able_work_ids, row.able_work_names, strict=True)
    ]
    body["data_types"] = [
        {"code": code, "label": _label(DATA_TYPE, code)} for code in row.data_types
    ]
    body["data_status"] = {"code": row.data_status, "label": _label(DATA_STATUS, row.data_status)}
    body["share_policy"] = {
        "code": row.share_policy,
        "label": _label(SHARE_POLICY, row.share_policy),
        "note": "데이터 공유 조건입니다. 연구 글의 공개 여부가 아닙니다.",
    }
    body["body_access"] = {
        "status": "hidden",
        "note": "초안 본문과 공유 조건 문장은 보여 주지 않습니다.",
    }
    return body


def _active(members: tuple[MemberRow, ...]) -> list[MemberRow]:
    return [row for row in members if row.status != "deleted"]


def build_summary(
    snapshot: OperationsSnapshot, start_at: datetime, end_at: datetime, today: date
) -> dict:
    """가입 완료 수는 현재 상태입니다. 기간 숫자는 계정 생성 시각이며 완료 수가 아닙니다."""
    members = snapshot.members
    living = _active(members)
    completed = [row for row in living if row.signup_step == "done"]
    created = [row.created_at for row in members if in_range(row.created_at, start_at, end_at)]
    previous_start, previous_end = previous_range(start_at, end_at)
    previous_created = [
        row for row in members if in_range(row.created_at, previous_start, previous_end)
    ]
    researches = snapshot.researches
    registered = [row for row in researches if row.status == "registered"]
    created_research = [
        row.created_at for row in researches if in_range(row.created_at, start_at, end_at)
    ]
    previous_research = [
        row for row in researches if in_range(row.created_at, previous_start, previous_end)
    ]
    days = each_day(start_at, end_at)
    roles = {"researcher": 0, "expert": 0, "unset": 0}
    for row in living:
        if row.user_role == "researcher":
            roles["researcher"] += 1
        elif row.user_role == "expert":
            roles["expert"] += 1
        else:
            roles["unset"] += 1
    steps = {step: 0 for step in STEP_LABELS}
    for row in living:
        steps[row.signup_step] = steps.get(row.signup_step, 0) + 1
    return {
        "generated_at": datetime.now().astimezone().isoformat(),
        "members": {
            "completed": {
                "status": "ready",
                "value": len(completed),
                "active": sum(row.status == "active" for row in completed),
                "suspended": sum(row.status == "suspended" for row in completed),
                "note": "현재 signup_step=done 이고 탈퇴가 아닌 계정. 정지를 포함합니다.",
            },
            "in_progress": {
                "status": "ready",
                "value": sum(row.signup_step != "done" for row in living),
                "note": "현재 가입을 끝내지 않은 계정. 과거에 어디서 멈췄는지는 알 수 없습니다.",
            },
            "suspended": {
                "status": "ready",
                "value": sum(row.status == "suspended" for row in members),
            },
            "roles": {
                "status": "ready",
                "counts": roles,
                "note": "탈퇴를 제외하며 한 계정을 두 역할로 세지 않습니다.",
            },
            "steps": {
                "status": "ready",
                "counts": steps,
                "labels": STEP_LABELS,
                "note": "지금 어느 단계에 있는지의 분포입니다. 기간 전환율이 아닙니다.",
            },
            "accounts_created": {
                "status": "ready",
                "value": len(created),
                "comparison": _flow(len(created), len(previous_created)),
                "series": _series(days, created),
                "note": "users.created_at 기준. 가입 완료 수가 아니고 탈퇴 계정도 포함합니다.",
            },
            "signup_completed_in_period": {
                "status": "not_collected",
                "value": None,
                "note": "최초 가입 완료 시각이 없어 기간 완료 수를 계산하지 않습니다.",
            },
        },
        "researches": _research_metrics(
            registered, created_research, previous_research, days, len(researches)
        ),
        "unavailable": [
            {
                "id": "visits",
                "status": "not_collected",
                "label": "방문·조회",
                "note": "방문 통계 화면에서 봅니다. 수집 전에는 숫자를 만들지 않습니다.",
            },
            {
                "id": "collaboration",
                "status": "not_linked",
                "label": "협업 프로젝트",
                "note": "참여 신청·마일스톤·완료는 없습니다. 협업 요청의 현재 상태는 연구 등록 화면에서 봅니다.",
            },
            {
                "id": "pending_reviews",
                "status": "not_linked",
                "label": "검토 대기 원고",
                "note": "인사이트 목록에서 확인합니다. 여기 숫자로 복제하지 않습니다.",
            },
            {
                "id": "audit",
                "status": "not_collected",
                "label": "운영 이력",
                "note": "성공한 정지·해제만 기록합니다. 과거 이력을 만들어 넣지 않습니다.",
            },
        ],
        "today": today.isoformat(),
    }


def _research_metrics(
    registered, created_research, previous_research, days, total_records: int
) -> dict:
    field_counts: dict[str, dict] = {}
    for row in registered:
        for field_id, name in zip(row.field_ids, row.field_names, strict=True):
            item = field_counts.setdefault(field_id, {"id": field_id, "name": name, "count": 0})
            item["count"] += 1
    return {
        "registered": {
            "status": "ready",
            "value": len(registered),
            "note": "research.status=registered. 공개 모집 상태가 아닙니다.",
        },
        "records": {
            "status": "ready",
            "value": total_records,
            "note": "임시저장을 포함한 연구 레코드 수입니다.",
        },
        "created": {
            "status": "ready",
            "value": len(created_research),
            "comparison": _flow(len(created_research), len(previous_research)),
            "series": _series(days, created_research),
            "note": "기간에 생성된 연구 레코드. 임시저장이 포함되며 최초 등록 수가 아닙니다.",
        },
        "first_registered_in_period": {
            "status": "not_collected",
            "value": None,
            "note": "등록 상태에 처음 도달한 시각이 없습니다. updated_at으로 대신하지 않습니다.",
        },
        "fields": {
            "status": "ready",
            "items": sorted(field_counts.values(), key=lambda item: (-item["count"], item["id"])),
            "note": "한 연구가 분야를 여러 개 고를 수 있어 합계가 등록 연구 수보다 클 수 있습니다.",
        },
        "abandonment": {
            "status": "not_collected",
            "note": "저장 전 작성과 임시저장을 구분하는 기록이 없습니다. 이미 등록된 연구의 수정은 모수에 넣지 않습니다.",
        },
    }


def research_summary(snapshot: OperationsSnapshot, start_at: datetime, end_at: datetime) -> dict:
    body = build_summary(snapshot, start_at, end_at, seoul_day(start_at))
    return body["researches"]
