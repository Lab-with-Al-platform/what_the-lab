"""AI 전문가 내 이력: 경력·학력·자격증 추가·수정·삭제. (모두 선택 항목)

세 가지는 모양이 같아서(내 것 한 줄 추가/수정/삭제) 아래 공통 함수 3개를 함께 씁니다.
표 이름·컬럼 이름은 코드에 고정된 값만 쓰고, 사용자가 보낸 값은 항상 %s 로 넘깁니다.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import transaction
from app.expert_profile_store import load_profile, require_profile
from app.form_rules import (
    MONTH,
    YEAR,
    bad_request,
    check_pattern,
    optional_pattern,
    optional_text,
    required_text,
)
from app.security import get_current_user_id

router = APIRouter(prefix="/api/v1/expert", tags=["expert-history"])

MAX_SHORT = 50  # career.company / career.job / education.school ... 컬럼 길이


class CareerRequest(BaseModel):
    company: str | None = None  # 회사·기관명 (선택)
    job: str  # 직무
    start_month: str  # YYYY-MM
    end_month: str | None = None  # None = 지금 다니는 중


class EducationRequest(BaseModel):
    school: str
    major: str
    graduated_year: str | None = None  # YYYY (선택)


class CertificateRequest(BaseModel):
    name: str
    issuer: str | None = None  # 발급 기관 (선택)
    acquired_year: str | None = None  # YYYY (선택)


def clean_career(body: CareerRequest) -> dict:
    start_month = check_pattern(body.start_month, MONTH, "시작한 달")
    end_month = optional_pattern(body.end_month, MONTH, "끝난 달")
    if end_month and end_month < start_month:  # 'YYYY-MM'은 글자 비교가 날짜 순서와 같아요.
        raise bad_request("끝난 달이 시작한 달보다 빨라요")
    return {
        "company": optional_text(body.company, MAX_SHORT, "회사·기관명"),
        "job": required_text(body.job, MAX_SHORT, "직무"),
        "start_month": start_month,
        "end_month": end_month,
    }


def clean_education(body: EducationRequest) -> dict:
    return {
        "school": required_text(body.school, MAX_SHORT, "학교"),
        "major": required_text(body.major, MAX_SHORT, "전공"),
        "graduated_year": optional_pattern(body.graduated_year, YEAR, "졸업 연도"),
    }


def clean_certificate(body: CertificateRequest) -> dict:
    return {
        "name": required_text(body.name, MAX_SHORT, "자격증 이름"),
        "issuer": optional_text(body.issuer, MAX_SHORT, "발급 기관"),
        "acquired_year": optional_pattern(body.acquired_year, YEAR, "취득 연도"),
    }


# ---------- 경력 ----------
@router.post("/careers")
def add_career(body: CareerRequest, user_id: int = Depends(get_current_user_id)) -> dict:
    return add_row(user_id, "career", clean_career(body))


@router.put("/careers/{career_id}")
def update_career(
    career_id: int, body: CareerRequest, user_id: int = Depends(get_current_user_id)
) -> dict:
    return update_row(user_id, "career", "career_id", career_id, clean_career(body), "경력")


@router.delete("/careers/{career_id}")
def delete_career(career_id: int, user_id: int = Depends(get_current_user_id)) -> dict:
    return delete_row(user_id, "career", "career_id", career_id, "경력")


# ---------- 학력 ----------
@router.post("/educations")
def add_education(body: EducationRequest, user_id: int = Depends(get_current_user_id)) -> dict:
    return add_row(user_id, "education", clean_education(body))


@router.put("/educations/{education_id}")
def update_education(
    education_id: int, body: EducationRequest, user_id: int = Depends(get_current_user_id)
) -> dict:
    values = clean_education(body)
    return update_row(user_id, "education", "education_id", education_id, values, "학력")


@router.delete("/educations/{education_id}")
def delete_education(education_id: int, user_id: int = Depends(get_current_user_id)) -> dict:
    return delete_row(user_id, "education", "education_id", education_id, "학력")


# ---------- 자격증 ----------
@router.post("/certificates")
def add_certificate(body: CertificateRequest, user_id: int = Depends(get_current_user_id)) -> dict:
    return add_row(user_id, "certificate", clean_certificate(body))


@router.put("/certificates/{certificate_id}")
def update_certificate(
    certificate_id: int, body: CertificateRequest, user_id: int = Depends(get_current_user_id)
) -> dict:
    values = clean_certificate(body)
    return update_row(user_id, "certificate", "certificate_id", certificate_id, values, "자격증")


@router.delete("/certificates/{certificate_id}")
def delete_certificate(certificate_id: int, user_id: int = Depends(get_current_user_id)) -> dict:
    return delete_row(user_id, "certificate", "certificate_id", certificate_id, "자격증")


# ---------- 공통 ----------
def add_row(user_id: int, table: str, values: dict) -> dict:
    """values = {컬럼: 값}. user_id를 붙여 한 줄 넣습니다."""
    require_profile(user_id)
    columns = ["user_id", *values]
    placeholders = ", ".join(["%s"] * len(columns))
    with transaction() as cursor:
        cursor.execute(
            f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})",
            (user_id, *values.values()),
        )
    return load_profile(user_id)


def update_row(
    user_id: int, table: str, id_column: str, row_id: int, values: dict, label: str
) -> dict:
    require_profile(user_id)
    assignments = ", ".join(f"{column} = %s" for column in values)  # job = %s, start_month = %s ...
    with transaction() as cursor:
        check_owner(cursor, user_id, table, id_column, row_id, label)
        cursor.execute(
            f"UPDATE {table} SET {assignments} WHERE {id_column} = %s",
            (*values.values(), row_id),
        )
    return load_profile(user_id)


def delete_row(user_id: int, table: str, id_column: str, row_id: int, label: str) -> dict:
    require_profile(user_id)
    with transaction() as cursor:
        check_owner(cursor, user_id, table, id_column, row_id, label)
        cursor.execute(f"DELETE FROM {table} WHERE {id_column} = %s", (row_id,))
    return load_profile(user_id)


def check_owner(cursor, user_id: int, table: str, id_column: str, row_id: int, label: str) -> None:
    """내 것인지 확인합니다. 남의 것이거나 없으면 똑같이 404."""
    cursor.execute(
        f"SELECT 1 FROM {table} WHERE {id_column} = %s AND user_id = %s", (row_id, user_id)
    )
    if cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail=f"{label} 항목을 찾을 수 없어요")