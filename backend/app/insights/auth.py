"""기존 로그인과 인사이트 관리자 권한을 연결합니다."""

import os

from fastapi import Cookie, Depends, HTTPException, Request

from app import user_store
from app.security import read_user_id


def require_enabled() -> None:
    if os.getenv("INSIGHTS_ENABLED", "false").lower() != "true":
        raise HTTPException(404, "인사이트 기능이 활성화되지 않았습니다.")


def current_discord_id(access_token: str | None = Cookie(default=None)) -> str:
    user_id = read_user_id(access_token) if access_token else None
    user = user_store.find_by_id(user_id) if user_id else None
    if user is None:
        raise HTTPException(401, "로그인이 필요합니다.")
    return user["discord_id"]


def require_admin(discord_id: str = Depends(current_discord_id)) -> str:
    allowed = {
        item.strip()
        for item in os.getenv("INSIGHT_ADMIN_DISCORD_IDS", "").split(",")
        if item.strip()
    }
    if discord_id not in allowed:
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
