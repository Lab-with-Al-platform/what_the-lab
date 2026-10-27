"""게시판 조회·작성·운영 권한. 인사이트 관리자 허용목록과 공유하지 않습니다."""

import os
from collections.abc import Iterator
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, Request, Response
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import CORS_ORIGINS
from app.insights.database import get_engine
from app.security import ensure_active_user, find_user_from_token, get_current_user


def optional_member(access_token: str | None = Cookie(default=None)) -> dict | None:
    user = find_user_from_token(access_token)
    return ensure_active_user(user) if user else None


def member(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    if user.get("signup_step") != "done" and not user.get("is_admin"):
        raise HTTPException(403, "가입을 완료한 뒤 글을 작성해 주세요.")
    return user


def admin(user: Annotated[dict, Depends(member)]) -> dict:
    if user.get("is_admin") is not True:
        raise HTTPException(403, "게시판 운영 권한이 필요합니다.")
    return user


def trusted_origin(request: Request) -> None:
    origins = os.getenv("COMMUNITY_ALLOWED_ORIGINS", ",".join(CORS_ORIGINS))
    if request.headers.get("origin") not in {x.strip() for x in origins.split(",")}:
        raise HTTPException(403, "허용된 웹 화면에서 다시 시도해 주세요.")


def no_store(response: Response) -> None:
    # 같은 URL이라도 로그인 사용자별 결과가 다르므로 공유 캐시에 저장하지 않습니다.
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Vary"] = "Cookie, Origin"


def get_session() -> Iterator[Session]:
    try:
        with Session(get_engine()) as session, session.begin():
            yield session
    except IntegrityError:
        raise HTTPException(409, "동시에 변경된 내용이 있습니다. 새로 조회해 주세요.") from None
    except SQLAlchemyError:
        raise HTTPException(
            503, "게시판에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요."
        ) from None
