"""시작 전 협업 API: [협업 취소] · [시작일 미루기] 요청 · 답하기 · 철회. 규칙은 app/collab_waiting.py

저장한 뒤 협업 상세 전체(load_detail)를 돌려주고, 채널 메시지 · 채널 잠그기 · 구글 정리는 응답 뒤에 해요 (BackgroundTasks).
"""

from fastapi import APIRouter, BackgroundTasks, Depends

from app import collab_waiting as waiting
from app.security import get_current_user_id
from app.workspace_detail import load_detail

router = APIRouter(prefix="/api/v1/workspace", tags=["workspace"])


@router.post("/{collaboration_id}/cancel")
def cancel(
    collaboration_id: int,
    body: waiting.CancelInput,
    background: BackgroundTasks,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    """[협업 취소]: 시작 전에만, 둘 중 누구나. 사유 + 남길 말 필수. 상대에게 알리고 채널을 잠가요 (2일 뒤 삭제)."""
    notice = waiting.cancel_collaboration(user_id, collaboration_id, body)
    background.add_task(waiting.after_cancel, notice)
    return load_detail(user_id, collaboration_id)


@router.post("/{collaboration_id}/postpone")
def postpone(
    collaboration_id: int,
    body: waiting.PostponeInput,
    background: BackgroundTasks,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    """[시작일 미루기] 요청: 최대 14일 · 한 번만. 상대가 수락하면 시작일 · 종료일이 같이 밀려요."""
    notice = waiting.request_postpone(user_id, collaboration_id, body)
    background.add_task(waiting.after_postpone, notice)
    return load_detail(user_id, collaboration_id)


@router.post("/changes/{change_id}/accept")
def accept_postpone(change_id: int, background: BackgroundTasks, user_id: int = Depends(get_current_user_id)) -> dict:
    """시작일 미루기 [수락]: 요청을 받은 사람만."""
    notice = waiting.answer_postpone(user_id, change_id, True, waiting.AnswerInput())
    background.add_task(waiting.after_postpone, notice)
    return load_detail(user_id, notice["collaboration_id"])


@router.post("/changes/{change_id}/decline")
def decline_postpone(
    change_id: int,
    body: waiting.AnswerInput,
    background: BackgroundTasks,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    """시작일 미루기 [다시 얘기해요]: 요청을 받은 사람만. 한 줄 이유는 선택."""
    notice = waiting.answer_postpone(user_id, change_id, False, body)
    background.add_task(waiting.after_postpone, notice)
    return load_detail(user_id, notice["collaboration_id"])


@router.post("/changes/{change_id}/withdraw")
def withdraw_postpone(change_id: int, user_id: int = Depends(get_current_user_id)) -> dict:
    """시작일 미루기 [요청 철회]: 요청한 사람만."""
    collaboration_id = waiting.withdraw_postpone(user_id, change_id)
    return load_detail(user_id, collaboration_id)