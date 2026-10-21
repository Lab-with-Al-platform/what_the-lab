"""연구회원 소속 인증: 기관 찾기 → 인증번호 보내기 → 인증번호 확인 → (필요하면) 기관명 입력.

- 기관 목록에 있으면 기관명을 자동으로 채웁니다.
- 목록에 없지만 학교·연구기관 도메인(ac.kr, re.kr, .edu 등)이면 먼저 인증하고,
  인증이 끝난 뒤 기관명을 직접 입력받습니다. (institution_source='manual' → 관리자 확인 대상)

지금은 실제 메일을 보내지 않습니다(임시).
APP_ENV=development 일 때만 인증번호를 응답에 담아 화면에 보여 줍니다.
"""
import secrets
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import institution_store, user_store
from app.config import APP_ENV
from app.db import get_connection, transaction
from app.security import get_current_user_id

router = APIRouter(prefix="/api/v1/verification", tags=["verification"])

CODE_VALID_SECONDS = 5 * 60
MAX_NAME_LENGTH = 100  # researcher_profile.institution_name 길이와 같게
NOT_ACADEMIC_MESSAGE = "학교·연구기관 이메일(ac.kr, re.kr, edu)만 사용할 수 있어요"

# 보낸 인증번호를 잠깐 기억해 둡니다. {user_id: {"code", "institution_name", "source", "expires_at"}}
# 서버를 껐다 켜면 사라지지만, 5분짜리 임시 값이라 괜찮습니다. 이메일 주소는 저장하지 않습니다.
_pending_codes: dict[int, dict] = {}


class SendCodeRequest(BaseModel):
    email: str


class ConfirmCodeRequest(BaseModel):
    code: str


class InstitutionNameRequest(BaseModel):
    institution_name: str


@router.get("/institution")
def lookup_institution(email: str) -> dict:
    """① 이메일 칸에서 커서가 나가면 호출.

    - institution_name: 목록에서 찾은 기관명 (없으면 null)
    - manual_allowed: 목록에 없지만 학교·연구기관 도메인이라 인증은 할 수 있는지
    """
    institution_name, source = decide_institution(email)
    return {"institution_name": institution_name, "manual_allowed": source == "manual"}


@router.post("/email/send")
def send_code(body: SendCodeRequest, user_id: int = Depends(get_current_user_id)) -> dict:
    """② [인증번호 받기]·[다시 보내기]. 부를 때마다 새 6자리 번호를 만듭니다."""
    reject_if_expert(user_id)
    institution_name, source = decide_institution(body.email)
    code = f"{secrets.randbelow(1_000_000):06d}"  # 000000~999999, 예측하기 어려운 난수
    _pending_codes[user_id] = {  # 다시 보내면 이전 번호는 덮어써져서 더 이상 쓸 수 없습니다.
        "code": code,
        "institution_name": institution_name,
        "source": source,
        "expires_at": time.time() + CODE_VALID_SECONDS,
    }
    # TODO: 메일 발송이 생기면 여기서 code를 메일로 보냅니다.
    response = {"institution_name": institution_name, "expires_in": CODE_VALID_SECONDS}
    if APP_ENV == "development":
        response["dev_code"] = code  # 개발 중에만 화면에 보여 줄 번호
    return response


@router.post("/email/confirm")
def confirm_code(body: ConfirmCodeRequest, user_id: int = Depends(get_current_user_id)) -> dict:
    """③ [인증하기]. 번호가 맞으면 연구회원 정보를 저장합니다.

    institution_name이 null이면 화면은 기관명 입력 단계를 보여 줍니다.
    """
    pending = _pending_codes.get(user_id)
    if pending is None or time.time() > pending["expires_at"]:
        raise HTTPException(status_code=400, detail="인증 시간이 지났어요. 다시 보내 주세요")
    if not secrets.compare_digest(body.code, pending["code"]):
        raise HTTPException(status_code=400, detail="인증번호가 맞지 않아요")

    save_verified_researcher(user_id, pending["institution_name"], pending["source"])
    del _pending_codes[user_id]  # 다 쓴 번호는 바로 지웁니다.
    return {"institution_name": pending["institution_name"], "next": "/signup/researcher/info"}


@router.post("/institution-name")
def save_institution_name(body: InstitutionNameRequest, user_id: int = Depends(get_current_user_id)) -> dict:
    """④ 인증은 끝났는데 목록에 없던 기관일 때, 기관명을 직접 저장합니다."""
    name = body.institution_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="학교·기관 이름을 입력해 주세요")
    if len(name) > MAX_NAME_LENGTH:
        raise HTTPException(status_code=400, detail=f"기관 이름은 {MAX_NAME_LENGTH}자 이내로 입력해 주세요")
    with get_connection() as conn, conn.cursor() as cursor:
        # 목록에서 자동으로 정해진 기관명(source='list')은 바꿀 수 없게, manual인 경우만 고칩니다.
        cursor.execute(
            """
            SELECT 1 FROM researcher_profile
            WHERE user_id = %s AND is_verified = TRUE AND institution_source = 'manual'
            """,
            (user_id,),
        )
        if cursor.fetchone() is None:
            raise HTTPException(status_code=409, detail="기관명을 직접 입력할 수 없는 상태예요")
        cursor.execute("UPDATE researcher_profile SET institution_name = %s WHERE user_id = %s", (name, user_id))

    return {"institution_name": name, "next": "/signup/researcher/info"}


def decide_institution(email: str) -> tuple[str | None, str]:
    """(기관명, 출처). 목록에 있으면 (이름, 'list'), 목록에 없는 학교 도메인이면 (None, 'manual')."""
    if institution_store.is_personal_email(email):
        raise HTTPException(status_code=400, detail="개인 메일로는 인증할 수 없어요")
    listed_name = institution_store.find_institution_name(email)
    if listed_name:
        return listed_name, "list"
    if institution_store.is_academic_email(email):
        return None, "manual"
    raise HTTPException(status_code=400, detail=NOT_ACADEMIC_MESSAGE)


def reject_if_expert(user_id: int) -> None:
    """이미 AI 전문가로 가입한 사람은 연구회원 인증을 할 수 없습니다."""
    user = user_store.find_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    if user["user_role"] == "expert":
        raise HTTPException(status_code=409, detail="AI 전문가로 가입한 계정이에요")


def save_verified_researcher(user_id: int, institution_name: str | None, source: str) -> None:
    """연구회원 정보 저장 + 회원 유형 확정. 둘 중 하나만 저장되면 안 되므로 한 묶음(트랜잭션)으로 처리합니다."""
    with transaction() as cursor:  # 하나라도 실패하면 둘 다 취소
        # 이미 있으면(ON CONFLICT) 새 값(EXCLUDED)으로 바꿉니다.
        cursor.execute(
            """
            INSERT INTO researcher_profile
              (user_id, institution_name, institution_source, is_verified, verified_at)
            VALUES (%s, %s, %s, TRUE, now())
            ON CONFLICT (user_id) DO UPDATE SET
              institution_name = EXCLUDED.institution_name,
              institution_source = EXCLUDED.institution_source,
              is_verified = TRUE,
              verified_at = now()
            """,
            (user_id, institution_name, source),
        )
        cursor.execute(
            "UPDATE users SET user_role = 'researcher', signup_step = 'info' WHERE user_id = %s",
            (user_id,),
        )