"""디스코드 로그인 → 콜백(가입 또는 로그인) → JWT 쿠키 발급."""
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Cookie, HTTPException
from fastapi.responses import RedirectResponse

from app import user_store
from app.config import DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, FRONTEND_URL
from app.security import create_access_token, read_user_id

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

TOKEN_MAX_AGE = 7 * 24 * 60 * 60  # 7일(초)
NEXT_PATH_BY_STEP = {  # 가입 단계별로 보낼 화면
    "role": "/signup",
    "info": "/signup/researcher/info",
    "done": "/",
}

DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"
DISCORD_ME_URL = "https://discord.com/api/users/@me"
TOKEN_COOKIE = "access_token"
STATE_COOKIE = "oauth_state"
TOKEN_MAX_AGE = 7 * 24 * 60 * 60  # 7일(초)


@router.get("/discord/login")
def discord_login(access_token: str | None = Cookie(default=None)) -> RedirectResponse:
    """① 이미 로그인했으면 가입 단계 화면으로, 아니면 디스코드 승인 화면으로 보냅니다."""
    user_id = read_user_id(access_token) if access_token else None
    user = user_store.find_by_id(user_id) if user_id else None
    if user is not None:
        return RedirectResponse(f"{FRONTEND_URL}{next_path_for(user)}")

    state = secrets.token_urlsafe(16)
    params = {
        "client_id": DISCORD_CLIENT_ID,
        "redirect_uri": DISCORD_REDIRECT_URI,
        "response_type": "code",
        "scope": "identify",
        "state": state,
    }
    response = RedirectResponse(f"{DISCORD_AUTHORIZE_URL}?{urlencode(params)}")
    response.set_cookie(STATE_COOKIE, state, max_age=600, httponly=True, samesite="lax")
    return response


@router.get("/discord/callback")
def discord_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    oauth_state: str | None = Cookie(default=None),
) -> RedirectResponse:
    """② 디스코드가 돌려보내는 곳. 회원을 찾거나 만들고, JWT를 쿠키에 담아 프론트로 보냅니다."""
    if error or not code or state is None or state != oauth_state:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=denied")

    try:
        discord_user = fetch_discord_user(code)
    except httpx.HTTPError:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=discord")

    user = user_store.find_by_discord_id(discord_user["id"])
    if user is None:
        user = user_store.create_user(discord_user)  # 처음 온 사람 = 가입

    next_path = next_path_for(user)
    response = RedirectResponse(f"{FRONTEND_URL}{next_path}")
    response.set_cookie(
        TOKEN_COOKIE,
        create_access_token(user["user_id"]),
        max_age=TOKEN_MAX_AGE,
        httponly=True,
        samesite="lax",
    )
    response.delete_cookie(STATE_COOKIE)
    return response


@router.get("/me")
def me(access_token: str | None = Cookie(default=None)) -> dict:
    """③ 지금 로그인한 사람의 정보를 돌려줍니다."""
    user_id = read_user_id(access_token) if access_token else None
    user = user_store.find_by_id(user_id) if user_id else None
    if user is None:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    return user




def next_path_for(user: dict) -> str:
    """가입 진행 단계(signup_step)에 따라 보낼 화면을 정합니다. 모르는 값이면 회원 유형 선택으로."""
    return NEXT_PATH_BY_STEP.get(user["signup_step"], "/signup")

def fetch_discord_user(code: str) -> dict:
    """일회용 code → 디스코드 토큰 → 사용자 정보."""
    token_response = httpx.post(
        DISCORD_TOKEN_URL,
        data={"grant_type": "authorization_code", "code": code, "redirect_uri": DISCORD_REDIRECT_URI},
        auth=(DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET),
    )
    token_response.raise_for_status()
    discord_token = token_response.json()["access_token"]

    me_response = httpx.get(DISCORD_ME_URL, headers={"Authorization": f"Bearer {discord_token}"})
    me_response.raise_for_status()
    return me_response.json()