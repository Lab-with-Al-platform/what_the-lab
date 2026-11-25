"""운영 조회 권한. 인사이트 수정 권한과는 따로 검사합니다."""

import os
from typing import Annotated

from fastapi import Depends, HTTPException

from app.security import get_current_user


def operations_admin_ids() -> set[str]:
    """환경 변수에 적힌 Discord 사용자 번호만 운영 조회자로 봅니다."""
    raw = os.getenv("OPERATIONS_ADMIN_DISCORD_IDS", "")
    return {item.strip() for item in raw.split(",") if item.strip()}


def can_read_operations(user: dict) -> bool:
    """공통 관리자 표시이거나, 운영 조회 목록에 있을 때만 회원·연구를 읽습니다.

    인사이트 허용 목록만으로는 열리지 않습니다. is_admin의 인사이트 권한은 바꾸지 않습니다.
    """
    if user.get("is_admin") is True:
        return True
    return user.get("discord_id") in operations_admin_ids()


def require_operations_reader(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    """화면 메뉴와 별개로 API에서 다시 검사합니다. 정지 계정은 공통 인증이 이미 막습니다."""
    if not can_read_operations(user):
        raise HTTPException(status_code=403, detail="운영 조회 권한이 필요합니다.")
    return user
