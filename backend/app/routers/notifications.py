"""알림 (헤더 알림 종·알림 화면). 로그인한 회원 누구나, 자기 알림만 봅니다."""

from fastapi import APIRouter, Depends

from app.notification_store import count_unread, load_notifications, mark_all_read, mark_read
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