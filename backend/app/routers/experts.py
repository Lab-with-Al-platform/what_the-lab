"""AI 전문가 찾기(목록)와 공개 프로필. 로그인하지 않아도 볼 수 있고, 공개한 전문가만 나옵니다."""

from fastapi import APIRouter, HTTPException, Query

from app.db import get_connection
from app.expert_profile_store import load_profile
from app.expert_search_store import load_engagement, search_experts

router = APIRouter(prefix="/api/v1/experts", tags=["experts"])

PAGE_SIZE = 6  # 한 번에 보여 줄 카드 수 ([전문가 더 보기]로 이어서)


def split_ids(value: str, prefix: str) -> list[str]:
    """'UG01,UG04' → ['UG01', 'UG04']. 모양이 다른 값은 버립니다."""
    return [
        item
        for item in dict.fromkeys(value.split(","))
        if item.startswith(prefix) and len(item) <= 10
    ]


@router.get("")
def list_experts(
    q: str = Query("", max_length=50),  # 검색어
    works: str = Query("", max_length=200),  # 할 수 있는 일 UG ID, 쉼표로 여러 개
    fields: str = Query("", max_length=200),  # 연구 분야 대분류 ID(F01~F10), 쉼표로 여러 개
    offset: int = Query(0, ge=0, le=10_000),  # 몇 번째부터 (더 보기)
) -> dict:
    return search_experts(q, split_ids(works, "UG"), split_ids(fields, "F"), offset, PAGE_SIZE)


@router.get("/{user_id}")
def get_expert(user_id: int) -> dict:
    """공개 프로필 하나. 비공개·정지·없는 전문가는 똑같이 404."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            "SELECT 1 FROM expert e JOIN users u ON u.user_id = e.user_id"
            " WHERE e.user_id = %s AND e.is_public = TRUE AND u.status = 'active'",
            (user_id,),
        )
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="공개된 전문가를 찾을 수 없어요")
    profile = load_profile(user_id)
    profile.pop("is_public", None)
    return {"user_id": user_id, **profile, **load_engagement(user_id)}