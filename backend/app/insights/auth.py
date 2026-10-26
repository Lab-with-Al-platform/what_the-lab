"""기존 로그인과 인사이트 관리자 권한을 연결합니다."""

import os
from typing import Annotated

from fastapi import Depends, HTTPException, Request

from app.security import get_current_user


def require_enabled() -> None:
    if os.getenv("INSIGHTS_ENABLED", "false").lower() != "true":
        raise HTTPException(404, "인사이트 기능이 활성화되지 않았습니다.")


def is_insight_admin(user: dict | None) -> bool:
    """인사이트 통계는 이 권한만 통과합니다. 운영 조회 권한과는 별개입니다."""
    if user is None:
        return False
    allowed = {
        item.strip()
        for item in os.getenv("INSIGHT_ADMIN_DISCORD_IDS", "").split(",")
        if item.strip()
    }
    return user.get("is_admin") is True or user.get("discord_id") in allowed


def require_admin(user: Annotated[dict, Depends(get_current_user)]) -> str:
    discord_id = user["discord_id"]
    # 공통 관리자 필드를 사용하되 기존 인사이트 전용 지정도 호환합니다.
    # 허용 목록은 users.is_admin을 변경하거나 다른 기능의 권한을 부여하지 않습니다.
    if not is_insight_admin(user):
        raise HTTPException(403, "인사이트 관리자 권한이 필요합니다.")
    return discord_id


def require_trusted_origin(request: Request) -> None:
    """쿠키 로그인 쓰기 요청은 허용한 화면에서 시작한 경우에만 받습니다."""
    allowed = {
        item.strip()
        for item in os.getenv(
            "INSIGHT_ALLOWED_ORIGINS",
            "http://localhost:3000,http://localhost:8000",
        ).split(",")
        if item.strip()
    }
    if request.headers.get("origin") not in allowed:
        raise HTTPException(403, "허용된 화면에서 다시 요청해 주세요.")
