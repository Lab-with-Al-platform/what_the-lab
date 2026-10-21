"""연구회원 정보: 기본 정보 화면과 가입 완료 화면에서 씁니다."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_connection, transaction
from app.security import get_current_user_id

router = APIRouter(prefix="/api/v1/researcher", tags=["researcher"])

# 직위 저장 값 (화면 문구는 프론트에서 바꿔 보여 줍니다)
POSITION_CODES = {"undergrad", "master", "phd", "postdoc", "professor", "researcher"}
MAX_DEPARTMENT_LENGTH = 100  # researcher_profile.department 길이와 같게


class ProfileRequest(BaseModel):
    department: str | None = None  # 학과·부서 (선택)
    position: str | None = None  # 직위 코드 (선택)


@router.get("/profile")
def get_profile(user_id: int = Depends(get_current_user_id)) -> dict:
    """내 연구회원 정보. 소속 인증을 아직 안 했으면 404."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT institution_name, institution_source, department, position, is_verified
            FROM researcher_profile
            WHERE user_id = %s
            """,
            (user_id,),
        )
        profile = cursor.fetchone()
    if profile is None:
        raise HTTPException(status_code=404, detail="소속 인증을 먼저 해 주세요")
    return profile


@router.post("/profile")
def save_profile(body: ProfileRequest, user_id: int = Depends(get_current_user_id)) -> dict:
    """[가입 완료]. 학과·직위를 저장하고 가입을 끝냅니다 (signup_step = 'done')."""
    department = clean_department(body.department)
    position = clean_position(body.position)
    with transaction() as cursor:  # 하나라도 실패하면 둘 다 취소
        # 소속 인증을 마치고 기관명까지 있는 사람만 가입을 끝낼 수 있습니다.
        if not is_ready_to_finish(cursor, user_id):
            raise HTTPException(status_code=409, detail="소속 인증을 먼저 해 주세요")
        cursor.execute(
            "UPDATE researcher_profile SET department = %s, position = %s WHERE user_id = %s",
            (department, position, user_id),
        )
        cursor.execute("UPDATE users SET signup_step = 'done' WHERE user_id = %s", (user_id,))
    return {"next": "/signup/researcher/done"}


def is_ready_to_finish(cursor, user_id: int) -> bool:
    """소속 인증이 끝났고 기관명도 있는지 확인합니다."""
    cursor.execute(
        """
        SELECT 1 FROM researcher_profile
        WHERE user_id = %s AND is_verified = TRUE AND institution_name IS NOT NULL
        """,
        (user_id,),
    )
    return cursor.fetchone() is not None


def clean_department(department: str | None) -> str | None:
    """앞뒤 공백을 지우고, 비어 있으면 None(= 입력 안 함)으로 저장합니다."""
    department = (department or "").strip()
    if len(department) > MAX_DEPARTMENT_LENGTH:
        raise HTTPException(status_code=400, detail=f"학과·부서는 {MAX_DEPARTMENT_LENGTH}자 이내로 입력해 주세요")
    return department or None


def clean_position(position: str | None) -> str | None:
    """정해진 직위 코드만 받습니다."""
    if position is None:
        return None
    if position not in POSITION_CODES:
        raise HTTPException(status_code=400, detail="직위 값이 올바르지 않아요")
    return position