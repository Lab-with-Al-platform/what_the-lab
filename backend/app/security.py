"""우리 서비스용 JWT를 만들고 확인합니다."""
from datetime import datetime, timedelta, timezone

import jwt

from app.config import JWT_SECRET

ALGORITHM = "HS256"
TOKEN_DAYS = 7


def create_access_token(user_id: str) -> str:
    """user_id를 담은 JWT를 만듭니다. 7일 뒤 만료됩니다."""
    expires_at = datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS)
    payload = {"sub": user_id, "exp": expires_at}
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def read_user_id(token: str) -> str | None:
    """JWT가 진짜이고 만료되지 않았으면 user_id를, 아니면 None을 돌려줍니다."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
    return payload.get("sub")