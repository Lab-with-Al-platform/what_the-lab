"""[내 구글 캘린더에 추가]: 구글 로그인 → 이메일 한 번 받기 → 협업 캘린더 공유 → 구글 캘린더 화면으로.

- 우리 서비스 로그인은 디스코드 그대로예요. 구글 로그인은 이 연결에만 써요.
- 구글에서 받는 건 이메일뿐이고(openid email), 공유하는 데 한 번 쓰고 저장하지 않아요.
- 협업 캘린더가 아직 없으면 이때 서버(서비스 계정)가 만들어요. 기존 일정은 전부 구글로 복사해요.
"""

import secrets
from typing import Annotated
from urllib.parse import quote, urlencode

import httpx
import jwt
from fastapi import APIRouter, Cookie, Depends
from fastapi.responses import RedirectResponse

from app.config import FRONTEND_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
from app.db import transaction
from app.google_calendar import add_calendar_url, create_calendar, share_calendar
from app.security import get_current_user_id
from app.workspace_store import check_ongoing, find_collaboration, google_login_ready

router = APIRouter(prefix="/api/v1/google", tags=["google"])

GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
STATE_COOKIE = "google_state"  # 다른 사이트가 끼어들지 못하게 하는 1회용 확인값
COLLAB_COOKIE = "google_collab"  # 어느 협업 캘린더를 연결하는 중인지
TIMEOUT = 10


def back_to_workspace(result: str) -> RedirectResponse:
    """협업 공간으로 돌아가며 결과를 알려요. (?google=denied 등)"""
    return RedirectResponse(f"{FRONTEND_URL}/workspace?google={result}")


def cookie_secure() -> bool:
    return GOOGLE_REDIRECT_URI.startswith("https://")


@router.get("/connect")
def connect(collaboration_id: int, user_id: Annotated[int, Depends(get_current_user_id)]) -> RedirectResponse:
    """① [내 구글 캘린더에 추가]를 누르면 오는 곳. 내 협업인지 확인하고 구글 로그인 화면으로 보내요."""
    if not google_login_ready():
        return back_to_workspace("off")
    with transaction() as cursor:
        check_ongoing(find_collaboration(cursor, user_id, collaboration_id))  # 남의 협업이면 404, 끝난 협업이면 409
    state = secrets.token_urlsafe(16)
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email",  # 이메일만 받아요. 회원 캘린더를 읽거나 쓰는 권한은 받지 않아요
        "state": state,
        "prompt": "select_account",  # 구글 계정이 여러 개면 고르게 해요
    }
    response = RedirectResponse(f"{GOOGLE_AUTHORIZE_URL}?{urlencode(params)}")
    for name, value in ((STATE_COOKIE, state), (COLLAB_COOKIE, str(collaboration_id))):
        response.set_cookie(name, value, max_age=600, httponly=True, samesite="lax", secure=cookie_secure())
    return response


@router.get("/callback")
def callback(
    user_id: Annotated[int, Depends(get_current_user_id)],
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    google_state: str | None = Cookie(default=None),
    google_collab: str | None = Cookie(default=None),
) -> RedirectResponse:
    """② 구글이 돌려보내는 곳. 이메일을 받아 협업 캘린더를 공유하고, 구글 캘린더 '추가' 화면으로 보내요."""
    if error or not code or not state or state != google_state or not (google_collab or "").isdigit():
        return back_to_workspace("denied")
    try:
        email = fetch_google_email(code)
    except (httpx.HTTPError, KeyError, jwt.PyJWTError):
        return back_to_workspace("failed")
    if not email:
        return back_to_workspace("failed")

    collaboration_id = int(google_collab)
    try:
        with transaction() as cursor:
            collab = find_collaboration(cursor, user_id, collaboration_id, lock=True)
            check_ongoing(collab)
            calendar_id = collab["google_calendar_id"] or open_calendar(cursor, collaboration_id)
            share_calendar(calendar_id, email)  # 이메일은 여기서만 쓰고 저장하지 않아요
            column = "researcher_google_at" if collab["my_side"] == "researcher" else "expert_google_at"
            cursor.execute(f"UPDATE collaboration SET {column} = now() WHERE collaboration_id = %s", (collaboration_id,))
    except httpx.HTTPError:
        return back_to_workspace("failed")

    # 구글 캘린더의 '이 캘린더 추가' 화면. authuser: 방금 로그인한 그 구글 계정으로 열어요
    response = RedirectResponse(f"{add_calendar_url(calendar_id)}&authuser={quote(email)}")
    for name in (STATE_COOKIE, COLLAB_COOKIE):
        response.delete_cookie(name, httponly=True, samesite="lax", secure=cookie_secure())
    response.headers["Cache-Control"] = "private, no-store"
    return response


def open_calendar(cursor, collaboration_id: int) -> str:
    """이 협업의 구글 캘린더를 처음 만들고, 지금까지 잡은 일정을 전부 구글로 보낼 차례로 표시해요."""
    cursor.execute("SELECT agreement ->> 'title' AS title FROM collaboration WHERE collaboration_id = %s", (collaboration_id,))
    title = cursor.fetchone()["title"] or ""
    calendar_id = create_calendar(f"LabBridge · 협업-{collaboration_id}", f"{title}\n\nLabBridge 협업 공간 일정이에요. 수정은 LabBridge에서 해요.")
    cursor.execute("UPDATE collaboration SET google_calendar_id = %s WHERE collaboration_id = %s", (calendar_id, collaboration_id))
    cursor.execute(
        "UPDATE collaboration_schedule SET google_status = 'pending', google_attempts = 0, google_error = NULL"
        " WHERE collaboration_id = %s",
        (collaboration_id,),
    )
    return calendar_id


def fetch_google_email(code: str) -> str | None:
    """구글에서 받은 코드를 토큰으로 바꾸고, 그 안의 이메일을 꺼내요. (확인된 이메일만)

    id_token 은 우리 서버가 구글 토큰 주소(https)에서 직접 받은 거라 서명 확인 없이 읽어도 안전해요.
    받은 토큰은 이메일만 꺼내고 버려요. (저장하지 않아요)
    """
    response = httpx.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    claims = jwt.decode(response.json()["id_token"], options={"verify_signature": False})
    return claims.get("email") if claims.get("email_verified") else None