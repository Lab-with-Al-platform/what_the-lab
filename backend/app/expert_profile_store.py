"""AI 전문가 내 이력(프로필) 읽기. 조회 API와 저장 API가 모두 이 함수로 최신 상태를 돌려줍니다."""

from fastapi import HTTPException

from app import upload_store
from app.db import get_connection


def load_profile(user_id: int) -> dict | None:
    """내 이력 전체를 화면(CareerProfile)과 같은 모양으로 돌려줍니다. 전문가가 아니면 None."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT u.nickname, u.user_photo, e.introduce, e.current_job, e.ai_career, e.is_public
            FROM `user` u
            JOIN expert e ON e.user_id = u.user_id
            WHERE u.user_id = %s
            """,
            (user_id,),
        )
        profile = cursor.fetchone()
        if profile is None:
            return None
        profile["is_public"] = bool(profile["is_public"])  # MySQL은 TRUE를 1로 돌려줘요.

        profile["able_work_ids"] = select_column(
            cursor,
            "SELECT expert_capability FROM expert_able_work"
            " WHERE user_id = %s ORDER BY expert_able_work_id",
            user_id,
        )
        profile["domain_ids"] = select_column(
            cursor, "SELECT field_id FROM domain WHERE user_id = %s ORDER BY domain_id", user_id
        )
        profile["collaboration"] = load_collaboration(cursor, user_id)
        profile["portfolios"] = load_portfolios(cursor, user_id)

        cursor.execute(
            "SELECT career_id, company, job, start_month, end_month FROM career"
            " WHERE user_id = %s ORDER BY start_month DESC, career_id DESC",
            (user_id,),
        )
        profile["careers"] = cursor.fetchall()
        cursor.execute(
            "SELECT education_id, school, major, graduated_year FROM education"
            " WHERE user_id = %s ORDER BY education_id",
            (user_id,),
        )
        profile["educations"] = cursor.fetchall()
        cursor.execute(
            "SELECT certificate_id, name, issuer, acquired_year FROM certificate"
            " WHERE user_id = %s ORDER BY certificate_id",
            (user_id,),
        )
        profile["certificates"] = cursor.fetchall()
    return profile


def require_profile(user_id: int) -> dict:
    """AI 전문가가 아니면 403. 모든 내 이력 API가 맨 처음 부릅니다."""
    profile = load_profile(user_id)
    if profile is None:
        raise HTTPException(status_code=403, detail="AI 전문가 회원만 쓸 수 있어요")
    return profile


def missing_required(profile: dict) -> list[str]:
    """공개하려면 꼭 채워야 하는 항목 중 비어 있는 것. 화면의 requiredChecks와 같은 기준이에요."""
    checks = [
        ("할 수 있는 일", bool(profile["able_work_ids"])),
        ("한 줄 소개", bool(profile["introduce"])),
        ("도메인", bool(profile["domain_ids"])),
        ("협업 조건", profile["collaboration"] is not None),
        ("포트폴리오 1개", bool(profile["portfolios"])),
    ]
    return [label for label, done in checks if not done]


def select_column(cursor, sql: str, *params) -> list:
    """결과 컬럼 하나만 리스트로 받습니다. 예: ['UG04', 'UG05']"""
    cursor.execute(sql, params)
    return [next(iter(row.values())) for row in cursor.fetchall()]


def load_collaboration(cursor, user_id: int) -> dict | None:
    """협업 조건 + 희망 보상. 아직 안 썼으면 None."""
    cursor.execute(
        "SELECT meeting_type, face_to_area, available_time FROM collaboration WHERE user_id = %s",
        (user_id,),
    )
    collaboration = cursor.fetchone()
    if collaboration is None:
        return None
    collaboration["rewards"] = select_column(
        cursor, "SELECT reward_type FROM reward WHERE user_id = %s ORDER BY reward_id", user_id
    )
    return collaboration


def load_portfolios(cursor, user_id: int) -> list[dict]:
    """포트폴리오 목록. AI로 한 일(able_work_ids), 사용 기술(skills), PDF 유무를 붙입니다."""
    cursor.execute(
        "SELECT portfolio_id, title, role, pdf_url FROM portfolio"
        " WHERE user_id = %s ORDER BY portfolio_id",
        (user_id,),
    )
    portfolios = cursor.fetchall()
    for portfolio in portfolios:
        portfolio["able_work_ids"] = select_column(
            cursor,
            "SELECT able_work_id FROM portfolio_able_work"
            " WHERE portfolio_id = %s ORDER BY portfolio_able_work_id",
            portfolio["portfolio_id"],
        )
        portfolio["skills"] = select_column(
            cursor,
            "SELECT skill_name FROM portfolio_skill"
            " WHERE portfolio_id = %s ORDER BY portfolio_skill_id",
            portfolio["portfolio_id"],
        )
        # 저장 위치(키)는 화면에 보내지 않고, 있는지·크기만 알려 줍니다.
        size = upload_store.file_size(portfolio.pop("pdf_url"))
        portfolio["has_pdf"] = size is not None
        portfolio["pdf_size"] = size
    return portfolios