"""우리 서비스용 JWT를 만들고 확인합니다."""
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import Cookie, Depends, HTTPException

from app import user_store
from app.config import JWT_SECRET

ALGORITHM = "HS256"
TOKEN_DAYS = 7


def create_access_token(user_id: int, discord_id: str) -> str:
    """내부 번호와 Discord 고유 번호를 함께 담습니다. 7일 뒤 만료됩니다."""
    expires_at = datetime.now(UTC) + timedelta(days=TOKEN_DAYS)
    # DB를 옮긴 뒤 같은 user_id가 다른 사람에게 배정되어도 혼동하지 않도록 합니다.
    payload = {"sub": str(user_id), "discord_id": discord_id, "exp": expires_at}
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def find_user_from_token(token: str | None) -> dict | None:
    """서명·만료·DB 회원의 두 식별자가 모두 일치할 때만 회원을 반환합니다."""
    if not token:
        return None
    try:
        payload = jwt.decode(
            token, JWT_SECRET, algorithms=[ALGORITHM],
            options={"require": ["sub", "exp", "discord_id"]},
        )
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError, TypeError):
        return None
    user = user_store.find_by_id(user_id)
    if user is None or user["discord_id"] != payload["discord_id"]:
        return None
    return user


def ensure_active_user(user: dict) -> dict:
    """서명된 쿠키가 남아 있어도 정지·탈퇴한 계정은 사용할 수 없습니다."""
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail="사용할 수 없는 계정입니다")
    return user


def get_current_user(access_token: str | None = Cookie(default=None)) -> dict:
    """회원·인사이트가 같은 쿠키와 users 테이블로 현재 사용자를 확인합니다."""
    user = find_user_from_token(access_token)
    if user is None:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    return ensure_active_user(user)


def get_current_user_id(user: Annotated[dict, Depends(get_current_user)]) -> int:
    """기존 회원 API는 함수 이름을 유지하면서 공통 로그인 검사를 사용합니다."""
    return user["user_id"]
