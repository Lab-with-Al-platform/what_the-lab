"""알림 (헤더 알림 종·알림 화면). 로그인한 회원 누구나, 자기 알림만 봅니다."""

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import user_store
from app.discord_bot import DmBlocked, bot_ready, send_dm
from app.notification_store import (
    count_unread,
    load_notifications,
    load_setting,
    mark_all_read,
    mark_read,
    save_setting,
    set_dm_blocked,
)
from app.security import get_current_user_id

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("")
def list_notifications(user_id: int = Depends(get_current_user_id)) -> dict:
    """알림 목록과 안 읽은 수 (종을 눌렀을 때)."""
    return {"unread": count_unread(user_id), "items": load_notifications(user_id)}


@router.get("/unread-count")
def unread_count(user_id: int = Depends(get_current_user_id)) -> dict:
    """안 읽은 수만 (헤더 종 숫자를 30~60초마다 새로 가져올 때). 가벼운 요청이에요."""
    return {"count": count_unread(user_id)}


@router.post("/{notification_id}/read")
def read_one(notification_id: int, user_id: int = Depends(get_current_user_id)) -> dict:
    """알림 하나를 눌렀을 때 읽음으로. 남은 안 읽은 수를 돌려줍니다."""
    mark_read(user_id, notification_id)
    return {"count": count_unread(user_id)}


@router.post("/read-all")
def read_all(user_id: int = Depends(get_current_user_id)) -> dict:
    """[모두 읽음]"""
    mark_all_read(user_id)
    return {"count": 0}


# ---------- 알림 설정 (프로필 설정 > 디스코드 알림) ----------
class SettingBody(BaseModel):
    discord_dm: bool  # 디스코드 DM으로 받기
    notify_request: bool  # 협업 요청 알림을 DM으로
    notify_workspace: bool  # 협업공간 알림을 DM으로


TEST_MESSAGE = "**LabBridge 알림 테스트예요**\n이 메시지가 보이면 디스코드 알림이 잘 연결된 거예요."


def setting_view(user_id: int) -> dict:
    """설정 화면에 보낼 모양. status로 카드 3가지(연결됨 / 연결 안 됨 / DM 막힘) 중 무엇을 그릴지 정해요."""
    setting = load_setting(user_id)
    if setting["discord_joined_at"] is None:
        status = "not_connected"
    elif setting["discord_blocked_at"] is not None:
        status = "blocked"
    else:
        status = "connected"
    return {
        "status": status,
        "available": bot_ready(),  # 서버에 봇 설정이 없으면 False (개발 PC 등)
        "discord_dm": setting["discord_dm"],
        "notify_request": setting["notify_request"],
        "notify_workspace": setting["notify_workspace"],
        "blocked_at": setting["discord_blocked_at"],
    }


@router.get("/settings")
def get_settings(user_id: int = Depends(get_current_user_id)) -> dict:
    return setting_view(user_id)


@router.put("/settings")
def put_settings(body: SettingBody, user_id: int = Depends(get_current_user_id)) -> dict:
    """켜기/끄기를 저장해요. 사이트 안 알림(종)은 설정과 상관없이 항상 와요."""
    save_setting(user_id, body.discord_dm, body.notify_request, body.notify_workspace)
    return setting_view(user_id)


@router.post("/settings/test")
def send_test(user_id: int = Depends(get_current_user_id)) -> dict:
    """[다시 보내 보기] 테스트 DM을 바로 보내 봐요. 성공하면 'DM 막힘' 표시를 지워요."""
    if not bot_ready():
        raise HTTPException(status_code=503, detail="지금은 디스코드 알림을 쓸 수 없어요")
    if load_setting(user_id)["discord_joined_at"] is None:
        raise HTTPException(status_code=409, detail="먼저 디스코드 알림을 연결해 주세요")
    user = user_store.find_by_id(user_id)
    try:
        send_dm(user["discord_id"], TEST_MESSAGE)
    except DmBlocked:
        set_dm_blocked(user_id, True)
        raise HTTPException(
            status_code=409, detail="DM을 받을 수 없어요. 디스코드에서 DM 허용을 켜 주세요"
        ) from None
    except httpx.HTTPError:
        raise HTTPException(
            status_code=502, detail="디스코드에 잠깐 연결할 수 없어요. 잠시 후 다시 시도해 주세요"
        ) from None
    set_dm_blocked(user_id, False)
    return setting_view(user_id)