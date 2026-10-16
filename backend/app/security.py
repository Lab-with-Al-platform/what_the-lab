"""우리 서비스용 JWT를 만들고 확인합니다."""
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Cookie, HTTPException

from app.config import JWT_SECRET

ALGORITHM = "HS256"
TOKEN_DAYS = 7


def create_access_token(user_id: int) -> str:
    """user_id를 담은 JWT를 만듭니다. 7일 뒤 만료됩니다."""
    expires_at = datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS)
    payload = {"sub": str(user_id), "exp": expires_at}  # JWT 규칙상 sub는 문자열이어야 합니다.
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def read_user_id(token: str) -> int | None:
    """JWT가 진짜이고 만료되지 않았으면 user_id(숫자)를, 아니면 None을 돌려줍니다."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def get_current_user_id(access_token: str | None = Cookie(default=None)) -> int:
    """로그인한 사람의 user_id. 로그인 안 했으면 401. 라우터에서 Depends로 씁니다."""
    user_id = read_user_id(access_token) if access_token else None
    if user_id is None:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    return user_id