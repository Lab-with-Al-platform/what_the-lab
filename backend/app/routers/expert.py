"""AI 전문가 가입: 할 수 있는 일 목록 조회 → 간단 프로필 저장."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import user_store
from app.db import get_connection, transaction
from app.security import get_current_user_id

router = APIRouter(prefix="/api/v1/expert", tags=["expert"])

MAX_ABLE_WORKS = 3
MAX_AFFILIATION_LENGTH = 100  # expert.affiliation 길이와 같게
# 저장 값 → 화면 문구는 프론트에서 바꿔 보여 줍니다.
JOB_CODES = {"grad_student", "researcher", "employee", "freelancer", "professor", "etc"}
CAREER_CODES = {"lt1", "1_3", "3_5", "5_10", "gt10"}


class ExpertSignupRequest(BaseModel):
    able_works: list[str]  # 할 수 있는 일 ID (UG01 ~ UG11), 1~3개
    current_job: str  # 지금 하는 일 코드
    ai_career: str  # AI 관련 경력 코드
    affiliation: str | None = None  # 소속 (선택)


@router.get("/able-works")
def list_able_works() -> list[dict]:
    """가입 화면에 띄울 '할 수 있는 일' 목록. 폐기(retired)된 항목은 빼고 순서대로 돌려줍니다."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT able_work_id, name, show_default
            FROM able_work
            WHERE status <> 'retired'
            ORDER BY sort_order
            """
        )
        return cursor.fetchall()


@router.post("/signup")
def signup_expert(body: ExpertSignupRequest, user_id: int = Depends(get_current_user_id)) -> dict:
    """[가입 완료]. 전문가 정보 + 할 수 있는 일을 저장하고 가입을 끝냅니다."""
    reject_if_not_new(user_id)
    able_works = clean_able_works(body.able_works)
    check_code(body.current_job, JOB_CODES, "지금 하는 일")
    check_code(body.ai_career, CAREER_CODES, "AI 관련 경력")
    affiliation = clean_affiliation(body.affiliation)

    with transaction() as cursor:  # 하나라도 실패하면 전부 취소
        check_able_works_exist(cursor, able_works)
        cursor.execute(
            "INSERT INTO expert (user_id, current_job, ai_career, affiliation) VALUES (%s, %s, %s, %s)",
            (user_id, body.current_job, body.ai_career, affiliation),
        )
        cursor.executemany(
            "INSERT INTO expert_able_work (user_id, able_work_id) VALUES (%s, %s)",
            [(user_id, able_work_id) for able_work_id in able_works],
        )
        cursor.execute(
            "UPDATE users SET user_role = 'expert', signup_step = 'done' WHERE user_id = %s",
            (user_id,),
        )
    return {"next": "/signup/expert/done"}

class ExpertBasicRequest(BaseModel):
    current_job: str  # 지금 하는 일 코드
    ai_career: str  # AI 관련 경력 코드
    affiliation: str | None = None  # 소속 (선택)


@router.get("/basic")
def get_basic(user_id: int = Depends(get_current_user_id)) -> dict:
    """프로필 설정 > 가입 정보. 가입 때 고른 지금 하는 일·AI 경력·소속."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            "SELECT current_job, ai_career, affiliation FROM expert WHERE user_id = %s", (user_id,)
        )
        basic = cursor.fetchone()
    if basic is None:
        raise HTTPException(status_code=404, detail="AI 전문가 회원만 쓸 수 있어요")
    return basic


@router.put("/basic")
def update_basic(body: ExpertBasicRequest, user_id: int = Depends(get_current_user_id)) -> dict:
    """가입 정보 고치기. 가입 때와 같은 규칙으로 확인해요."""
    check_code(body.current_job, JOB_CODES, "지금 하는 일")
    check_code(body.ai_career, CAREER_CODES, "AI 관련 경력")
    affiliation = clean_affiliation(body.affiliation)
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            "UPDATE expert SET current_job = %s, ai_career = %s, affiliation = %s WHERE user_id = %s",
            (body.current_job, body.ai_career, affiliation, user_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="AI 전문가 회원만 쓸 수 있어요")
    return get_basic(user_id)



def reject_if_not_new(user_id: int) -> None:
    """회원 유형을 아직 정하지 않은 사람만 전문가로 가입할 수 있습니다."""
    user = user_store.find_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    if user["user_role"] is not None or user["signup_step"] != "role":
        raise HTTPException(status_code=409, detail="이미 회원 유형이 정해진 계정이에요")


def clean_able_works(able_works: list[str]) -> list[str]:
    """중복을 지우고 1~3개인지 확인합니다."""
    unique = list(dict.fromkeys(able_works))  # 순서를 지키면서 중복 제거
    if not 1 <= len(unique) <= MAX_ABLE_WORKS:
        raise HTTPException(status_code=400, detail=f"할 수 있는 일을 1~{MAX_ABLE_WORKS}개 골라 주세요")
    return unique


def check_able_works_exist(cursor, able_works: list[str]) -> None:
    """기준표(able_work)에 있는 ID만 받습니다. FK가 있지만, 사용자에게 알맞은 문구를 주려고 먼저 확인합니다."""
    placeholders = ", ".join(["%s"] * len(able_works))  # 개수만큼 %s 만들기
    cursor.execute(
        f"SELECT COUNT(*) AS found FROM able_work WHERE status <> 'retired' AND able_work_id IN ({placeholders})",
        able_works,
    )
    if cursor.fetchone()["found"] != len(able_works):
        raise HTTPException(status_code=400, detail="할 수 있는 일 값이 올바르지 않아요")


def check_code(value: str, allowed: set[str], label: str) -> None:
    if value not in allowed:
        raise HTTPException(status_code=400, detail=f"{label} 값이 올바르지 않아요")


def clean_affiliation(affiliation: str | None) -> str | None:
    """앞뒤 공백을 지우고, 비어 있으면 None(= 입력 안 함)으로 저장합니다."""
    affiliation = (affiliation or "").strip()
    if len(affiliation) > MAX_AFFILIATION_LENGTH:
        raise HTTPException(status_code=400, detail=f"소속은 {MAX_AFFILIATION_LENGTH}자 이내로 입력해 주세요")
    return affiliation or None