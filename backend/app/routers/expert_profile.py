"""AI 전문가 내 이력: 조회, 소개 카드, 협업 조건 카드, 공개 여부.

저장 API는 모두 저장이 끝난 최신 내 이력 전체를 돌려줍니다. 화면은 받은 값으로 그대로 다시 그려요.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.db import transaction
from app.expert_profile_store import load_profile, missing_required, require_profile
from app.form_rules import bad_request, required_text, unique_list
from app.routers.expert import MAX_ABLE_WORKS, check_able_works_exist, check_code
from app.security import get_current_user_id

router = APIRouter(prefix="/api/v1/expert", tags=["expert-profile"])

MAX_INTRODUCE = 40
MAX_DOMAINS = 5
MAX_AREA = 50  # collaboration.face_to_area
MEETING_CODES = {"online", "offline_ok"}
TIME_CODES = {"lt5", "5_10", "gt10"}
REWARD_CODES = {"research_fund", "authorship", "undecided"}


class IntroRequest(BaseModel):
    introduce: str  # 한 줄 소개 (40자)
    domain_ids: list[str]  # 연구 분야 FIELD ID, 1~5개
    able_work_ids: list[str]  # 할 수 있는 일 UG ID, 1~3개


class CollaborationRequest(BaseModel):
    meeting_type: str  # online / offline_ok
    face_to_area: str | None = None  # offline_ok일 때 필수
    available_time: str  # lt5 / 5_10 / gt10 (주당 시간)
    rewards: list[str]  # research_fund / authorship / undecided


class VisibilityRequest(BaseModel):
    is_public: bool  # true = 찾기 목록에 공개, false = 숨김


@router.get("/profile")
def get_profile(user_id: int = Depends(get_current_user_id)) -> dict:
    """내 이력 전체. AI 전문가로 가입하지 않았으면 403."""
    return require_profile(user_id)


@router.put("/profile/intro")
def save_intro(body: IntroRequest, user_id: int = Depends(get_current_user_id)) -> dict:
    """소개 카드: 한 줄 소개 + 도메인 + 할 수 있는 일을 통째로 바꿉니다."""
    require_profile(user_id)
    introduce = required_text(body.introduce, MAX_INTRODUCE, "한 줄 소개")
    domain_ids = unique_list(body.domain_ids, 1, MAX_DOMAINS, "도메인")
    able_work_ids = unique_list(body.able_work_ids, 1, MAX_ABLE_WORKS, "할 수 있는 일")

    with transaction() as cursor:
        check_able_works_exist(cursor, able_work_ids)
        check_fields_exist(cursor, domain_ids)
        cursor.execute("UPDATE expert SET introduce = %s WHERE user_id = %s", (introduce, user_id))
        # 목록은 '지우고 다시 넣기'로 바꿉니다. 고른 순서대로 남아요.
        cursor.execute("DELETE FROM expert_domain WHERE user_id = %s", (user_id,))
        cursor.executemany(
            "INSERT INTO expert_domain (user_id, field_id) VALUES (%s, %s)",
            [(user_id, field_id) for field_id in domain_ids],
        )
        cursor.execute("DELETE FROM expert_able_work WHERE user_id = %s", (user_id,))
        cursor.executemany(
            "INSERT INTO expert_able_work (user_id, able_work_id) VALUES (%s, %s)",
            [(user_id, able_work_id) for able_work_id in able_work_ids],
        )
    return load_profile(user_id)


@router.put("/collaboration")
def save_collaboration(
    body: CollaborationRequest, user_id: int = Depends(get_current_user_id)
) -> dict:
    """협업 조건 카드: 처음이면 만들고, 있으면 바꿉니다."""
    require_profile(user_id)
    check_code(body.meeting_type, MEETING_CODES, "미팅 방식")
    check_code(body.available_time, TIME_CODES, "주당 가능 시간")
    if body.meeting_type == "offline_ok":
        area = required_text(body.face_to_area, MAX_AREA, "대면 가능 지역")
    else:
        area = None  # 온라인만이면 지역은 저장하지 않습니다.
    rewards = unique_list(body.rewards, 1, len(REWARD_CODES), "희망 보상")
    for reward in rewards:
        check_code(reward, REWARD_CODES, "희망 보상")
    if "undecided" in rewards and len(rewards) > 1:
        raise bad_request("'상의 후 결정'은 다른 보상과 함께 고를 수 없어요")

    with transaction() as cursor:
        # user_id가 PK라서, 이미 있으면(ON CONFLICT) 같은 줄을 새 값(EXCLUDED)으로 바꿉니다.
        cursor.execute(
            """
            INSERT INTO expert_collab_condition (user_id, meeting_type, face_to_area, available_time)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id) DO UPDATE SET meeting_type = EXCLUDED.meeting_type,
                                                face_to_area = EXCLUDED.face_to_area,
                                                available_time = EXCLUDED.available_time
            """,
            (user_id, body.meeting_type, area, body.available_time),
        )
        cursor.execute("DELETE FROM expert_reward WHERE user_id = %s", (user_id,))
        cursor.executemany(
            "INSERT INTO expert_reward (user_id, reward_type) VALUES (%s, %s)",
            [(user_id, reward) for reward in rewards],
        )
    return load_profile(user_id)


@router.put("/profile/visibility")
def save_visibility(body: VisibilityRequest, user_id: int = Depends(get_current_user_id)) -> dict:
    """공개 켜기/끄기. 켤 때는 필수 항목이 모두 있어야 해요. 끄는 건 언제든 됩니다."""
    profile = require_profile(user_id)
    if body.is_public:
        missing = missing_required(profile)
        if missing:
            raise bad_request(f"공개하려면 먼저 채워 주세요: {', '.join(missing)}")

    with transaction() as cursor:
        cursor.execute(
            "UPDATE expert SET is_public = %s WHERE user_id = %s", (body.is_public, user_id)
        )
    return load_profile(user_id)


def check_fields_exist(cursor, field_ids: list[str]) -> None:
    """연구 분야 기준표(research_field)에 있는 ID만 받습니다."""
    placeholders = ", ".join(["%s"] * len(field_ids))
    cursor.execute(
        "SELECT COUNT(*) AS found FROM research_field"
        f" WHERE status <> 'retired' AND field_id IN ({placeholders})",
        field_ids,
    )
    if cursor.fetchone()["found"] != len(field_ids):
        raise bad_request("도메인 값이 올바르지 않아요")