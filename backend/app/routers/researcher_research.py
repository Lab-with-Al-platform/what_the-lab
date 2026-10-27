"""연구회원 내 연구: 목록·작성·수정·삭제·지정.

저장 API는 모두 저장이 끝난 최신 목록 전체를 돌려줍니다. 화면은 받은 값으로 그대로 다시 그려요.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.analytics.store import record_registration_completed
from app.db import transaction
from app.form_rules import bad_request, optional_text, required_text, unique_list
from app.research_store import CHILD_TABLES, load_researches, require_researcher
from app.routers.expert import check_able_works_exist, check_code
from app.routers.expert_profile import check_fields_exist
from app.security import get_current_user_id

router = APIRouter(prefix="/api/v1/researcher/researches", tags=["researcher-research"])

MAX_RESEARCHES = 20  # 한 사람이 가질 수 있는 연구 수
MAX_TITLE = 60
MAX_DESCRIPTION = 500
MAX_FIELDS = 3
MAX_ABLE_WORKS = 3
MAX_CONDITION = 100
MAX_AREA = 50

STATUS_CODES = {"draft", "registered"}
DATA_TYPE_CODES = {"image", "text", "table", "audio", "etc"}
DATA_STATUS_CODES = {"none", "collecting", "raw", "ready"}
SHARE_CODES = {"open", "conditional"}
OUTPUT_CODES = {"analysis", "model", "tool", "figure", "unknown"}
REWARD_CODES = {"research_fund", "authorship", "undecided"}
MEETING_CODES = {"online", "offline_ok"}


class ResearchRequest(BaseModel):
    status: str  # draft = 임시 저장 / registered = 등록
    title: str
    field_ids: list[str] = []  # 연구 분야 FIELD ID, 1~3개
    description: str = ""
    data_types: list[str] = []
    data_status: str | None = None
    share_policy: str | None = None
    share_condition: str | None = None  # share_policy가 conditional일 때만
    able_work_ids: list[str] = []  # AI에게 맡기고 싶은 일 UG ID, 0~3개
    task_unsure: bool = False  # "잘 모르겠어요"
    outputs: list[str] = []
    rewards: list[str] = []  # 선택
    meeting_type: str | None = None  # 선택
    face_to_area: str | None = None
    # 등록 창의 작성 시도 번호. 연구 표에는 넣지 않고, 수집이 켜진 경우의 완료 기록에만 씁니다.
    writing_attempt_id: str | None = None


@router.get("")
def list_researches(user_id: int = Depends(get_current_user_id)) -> list[dict]:
    require_researcher(user_id)
    return load_researches(user_id)

@router.get("/{research_id}")
def get_research(research_id: int, user_id: int = Depends(get_current_user_id)) -> dict:
    """연구 하나 (상세 화면용). 내 연구가 아니거나 없으면 404."""
    require_researcher(user_id)
    research = next(
        (item for item in load_researches(user_id) if item["research_id"] == research_id), None
    )
    if research is None:
        raise HTTPException(status_code=404, detail="연구를 찾을 수 없어요")
    return research

@router.post("")
def add_research(body: ResearchRequest, user_id: int = Depends(get_current_user_id)) -> list[dict]:
    """새 연구 작성 (임시 저장 또는 등록)."""
    require_researcher(user_id)
    values, children = clean_research(body)

    with transaction() as cursor:
        cursor.execute("SELECT COUNT(*) AS total FROM research WHERE user_id = %s", (user_id,))
        if cursor.fetchone()["total"] >= MAX_RESEARCHES:
            raise bad_request(f"연구는 {MAX_RESEARCHES}개까지 작성할 수 있어요")
        check_codes_exist(cursor, children)
        columns = ["user_id", *values]
        cursor.execute(
            f"INSERT INTO research ({', '.join(columns)}) VALUES ({', '.join(['%s'] * len(columns))})"
            " RETURNING research_id",  # 방금 만든 연구 번호를 바로 돌려받습니다.
            (user_id, *values.values()),
        )
        new_id = cursor.fetchone()["research_id"]
        insert_children(cursor, new_id, children)
        fix_primary(cursor, user_id)
    # 수집 기록은 저장이 끝난 뒤에 남깁니다. 표가 없어도 연구 등록은 유지됩니다.
    if values["status"] == "registered":
        record_registration_completed(body.writing_attempt_id, new_id, "create")
    return load_researches(user_id)


@router.put("/{research_id}")
def update_research(
    research_id: int, body: ResearchRequest, user_id: int = Depends(get_current_user_id)
) -> list[dict]:
    """연구 수정. 고른 값들은 '지우고 다시 넣기'로 바꿉니다."""
    require_researcher(user_id)
    values, children = clean_research(body)

    with transaction() as cursor:
        current = find_research(cursor, user_id, research_id)
        check_no_open_requests(cursor, research_id, "수정")
        previous_status = current["status"]
        if previous_status == "registered" and values["status"] == "draft":
            raise bad_request("등록한 연구는 임시 저장으로 되돌릴 수 없어요")
        check_codes_exist(cursor, children)
        assignments = ", ".join(f"{column} = %s" for column in values)
        cursor.execute(
            f"UPDATE research SET {assignments} WHERE research_id = %s",
            (*values.values(), research_id),
        )
        for table, _column, _order in CHILD_TABLES.values():
            cursor.execute(f"DELETE FROM {table} WHERE research_id = %s", (research_id,))
        insert_children(cursor, research_id, children)
        fix_primary(cursor, user_id)
    # 임시 저장에서 처음 등록으로 바뀐 경우만 완료로 셉니다. 이미 등록된 연구의 수정은 제외합니다.
    if previous_status != "registered" and values["status"] == "registered":
        record_registration_completed(body.writing_attempt_id, research_id, "resume")
    return load_researches(user_id)


@router.delete("/{research_id}")
def delete_research(research_id: int, user_id: int = Depends(get_current_user_id)) -> list[dict]:
    """연구 삭제. 지정한 연구를 지우면 가장 최근에 등록한 연구가 대신 지정돼요."""
    require_researcher(user_id)
    with transaction() as cursor:
        find_research(cursor, user_id, research_id)
        check_no_open_requests(cursor, research_id, "삭제")
        cursor.execute(
            "SELECT 1 FROM collaboration_request WHERE research_id = %s AND status = 'started'",
            (research_id,),
        )
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="협업한 기록이 있는 연구는 삭제할 수 없어요")
        # 고른 값들은 FK의 ON DELETE CASCADE로 같이 지워집니다.
        cursor.execute("DELETE FROM research WHERE research_id = %s", (research_id,))
        fix_primary(cursor, user_id)
    return load_researches(user_id)


@router.put("/{research_id}/primary")
def set_primary(research_id: int, user_id: int = Depends(get_current_user_id)) -> list[dict]:
    """이 연구를 '지정한 연구'로 바꿉니다. 한 사람당 1개만."""
    require_researcher(user_id)
    with transaction() as cursor:
        if find_research(cursor, user_id, research_id)["status"] != "registered":
            raise bad_request("임시 저장한 연구는 지정할 수 없어요. 먼저 등록해 주세요")
        cursor.execute("UPDATE research SET is_primary = FALSE WHERE user_id = %s", (user_id,))
        cursor.execute(
            "UPDATE research SET is_primary = TRUE WHERE research_id = %s", (research_id,)
        )
    return load_researches(user_id)


# ---------- 입력 검사 ----------
def clean_research(body: ResearchRequest) -> tuple[dict, dict]:
    """(research 표에 넣을 값, 고른 값 목록들)을 돌려줍니다.

    임시 저장은 제목만 있으면 되고, 등록은 필수 항목이 모두 있어야 해요.
    어느 쪽이든 넣은 값은 코드·길이를 검사합니다.
    """
    check_code(body.status, STATUS_CODES, "저장 상태")
    registered = body.status == "registered"

    title = required_text(body.title, MAX_TITLE, "연구 제목")
    description = optional_text(body.description, MAX_DESCRIPTION, "연구 내용")
    field_ids = unique_list(body.field_ids, 0, MAX_FIELDS, "분야")
    data_types = check_codes(body.data_types, DATA_TYPE_CODES, "데이터 종류")
    if body.data_status is not None:
        check_code(body.data_status, DATA_STATUS_CODES, "데이터 상태")
    if body.share_policy is not None:
        check_code(body.share_policy, SHARE_CODES, "데이터 공유 조건")
    share_condition = (
        optional_text(body.share_condition, MAX_CONDITION, "공유 조건 설명")
        if body.share_policy == "conditional"
        else None
    )

    able_work_ids = unique_list(body.able_work_ids, 0, MAX_ABLE_WORKS, "AI에게 맡기고 싶은 일")
    if body.task_unsure and able_work_ids:
        raise bad_request("'잘 모르겠어요'는 다른 일과 함께 고를 수 없어요")
    outputs = check_codes(
        body.outputs, OUTPUT_CODES, "원하는 결과물", exclusive=("unknown", "아직 모름")
    )
    rewards = check_codes(
        body.rewards, REWARD_CODES, "보상 형태", exclusive=("undecided", "상의 후 결정")
    )
    if body.meeting_type is not None:
        check_code(body.meeting_type, MEETING_CODES, "미팅 방식")
    area = (
        optional_text(body.face_to_area, MAX_AREA, "대면 가능 지역")
        if body.meeting_type == "offline_ok"
        else None
    )

    if registered:
        missing = [
            label
            for label, filled in [
                ("분야", field_ids),
                ("연구 내용", description),
                ("데이터 종류", data_types),
                ("데이터 상태", body.data_status),
                ("데이터 공유 조건", body.share_policy),
                ("공유 조건 설명", body.share_policy != "conditional" or share_condition),
                ("AI에게 맡기고 싶은 일", able_work_ids or body.task_unsure),
                ("원하는 결과물", outputs),
                ("대면 가능 지역", body.meeting_type != "offline_ok" or area),
            ]
            if not filled
        ]
        if missing:
            raise bad_request(f"등록하려면 채워 주세요: {', '.join(missing)}")

    values = {
        "status": body.status,
        "title": title,
        "description": description,
        "data_status": body.data_status,
        "share_policy": body.share_policy,
        "share_condition": share_condition,
        "task_unsure": body.task_unsure,
        "meeting_type": body.meeting_type,
        "face_to_area": area,
    }
    children = {
        "field_ids": field_ids,
        "able_work_ids": able_work_ids,
        "data_types": data_types,
        "outputs": outputs,
        "rewards": rewards,
    }
    return values, children


def check_codes(
    values: list[str], allowed: set[str], label: str, exclusive: tuple[str, str] | None = None
) -> list[str]:
    """여러 개 고르는 코드 검사.

    exclusive = (코드, 화면 이름): 혼자만 고를 수 있는 값. 예: ("unknown", "아직 모름")
    """
    unique = unique_list(values, 0, len(allowed), label)
    for value in unique:
        check_code(value, allowed, label)
    if exclusive and exclusive[0] in unique and len(unique) > 1:
        raise bad_request(f"'{exclusive[1]}'은 다른 {label}과 함께 고를 수 없어요")
    return unique


def check_codes_exist(cursor, children: dict) -> None:
    """분류표 기준표에 있는 ID인지 확인합니다. (없는 ID면 FK가 막기 전에 알맞은 문구로)"""
    if children["field_ids"]:
        check_fields_exist(cursor, children["field_ids"])
    if children["able_work_ids"]:
        check_able_works_exist(cursor, children["able_work_ids"])


# ---------- DB 도우미 ----------
def find_research(cursor, user_id: int, research_id: int) -> dict:
    """내 연구인지 확인합니다. 남의 것이거나 없으면 똑같이 404."""
    cursor.execute(
        "SELECT research_id, status FROM research WHERE research_id = %s AND user_id = %s",
        (research_id, user_id),
    )
    research = cursor.fetchone()
    if research is None:
        raise HTTPException(status_code=404, detail="연구를 찾을 수 없어요")
    return research


def insert_children(cursor, research_id: int, children: dict) -> None:
    for name, (table, column, _order) in CHILD_TABLES.items():
        if children[name]:  # 빈 목록이면 넣을 게 없어서 건너뜁니다.
            cursor.executemany(
                f"INSERT INTO {table} (research_id, {column}) VALUES (%s, %s)",
                [(research_id, value) for value in children[name]],
            )


def fix_primary(cursor, user_id: int) -> None:
    """'지정한 연구' 규칙을 맞춥니다.

    - 임시 저장한 연구는 지정될 수 없어요.
    - 등록한 연구가 있는데 지정된 게 없으면, 가장 최근에 등록한 연구를 지정해요.
      (등록한 연구가 1개뿐이면 자동으로 그 연구가 지정돼요)
    """
    cursor.execute(
        "UPDATE research SET is_primary = FALSE WHERE user_id = %s AND status = 'draft'", (user_id,)
    )
    cursor.execute(
        "SELECT COUNT(*) AS picked FROM research WHERE user_id = %s AND is_primary = TRUE",
        (user_id,),
    )
    if cursor.fetchone()["picked"] > 0:
        return
    cursor.execute(
        "SELECT research_id FROM research WHERE user_id = %s AND status = 'registered'"
        " ORDER BY created_at DESC, research_id DESC LIMIT 1",
        (user_id,),
    )
    latest = cursor.fetchone()
    if latest:
        cursor.execute(
            "UPDATE research SET is_primary = TRUE WHERE research_id = %s", (latest["research_id"],)
        )

def check_no_open_requests(cursor, research_id: int, action: str) -> None:
    """답을 기다리거나 수락된 요청이 있는 연구는 수정·삭제할 수 없어요. (요청을 모두 닫은 뒤 가능)

    action: "수정" / "삭제" (안내 문구에 들어가요)
    """
    cursor.execute(
        "SELECT count(*) AS count FROM collaboration_request"
        " WHERE research_id = %s AND status IN ('pending', 'accepted')",
        (research_id,),
    )
    count = cursor.fetchone()["count"]
    if count:
        raise HTTPException(
            status_code=409,
            detail=f"진행 중인 요청 {count}건이 있어 {action}할 수 없어요. 요청을 모두 취소한 뒤 {action}해 주세요",
        )        