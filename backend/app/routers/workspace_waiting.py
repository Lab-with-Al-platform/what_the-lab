"""협업 기간 API (웹)
- 시작 전: [협업 취소] · [시작일 미루기] 요청 · 철회 (규칙: app/collab_waiting.py)
- 진행 중: [기간 연장 요청] · [조기 완료 요청] · [협업 중단] (규칙: app/collab_ending.py)
- 받은 요청에 [수락] · [다시 얘기해요]: 요청 종류(start · extend · complete)를 보고 맞는 함수로 보내요

저장한 뒤 협업 상세 전체(load_detail)를 돌려주고, 채널 메시지 · 채널 잠그기 · 구글 정리는 응답 뒤에 해요 (BackgroundTasks).
"""

from fastapi import APIRouter, BackgroundTasks, Depends

from app import collab_ending as ending
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


def answer(user_id: int, change_id: int, accept: bool, note: str, background: BackgroundTasks) -> dict:
    """[수락] / [다시 얘기해요] 공통: 시작일 미루기는 collab_waiting, 연장 · 조기 완료는 collab_ending"""
    if ending.change_kind(change_id) == "start":
        notice = waiting.answer_postpone(user_id, change_id, accept, waiting.AnswerInput(note=note))
        background.add_task(waiting.after_postpone, notice)
    else:
        notice = ending.answer_change(user_id, change_id, accept, note)
        background.add_task(ending.after_change, notice)
    return load_detail(user_id, notice["collaboration_id"])


@router.post("/changes/{change_id}/accept")
def accept_change(change_id: int, background: BackgroundTasks, user_id: int = Depends(get_current_user_id)) -> dict:
    """받은 요청 [수락]: 시작일 미루기 · 기간 연장 · 조기 완료(수락하면 바로 완료). 요청을 받은 사람만."""
    return answer(user_id, change_id, True, "", background)


@router.post("/changes/{change_id}/decline")
def decline_change(
    change_id: int,
    body: waiting.AnswerInput,
    background: BackgroundTasks,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    """받은 요청 [다시 얘기해요] (= 거절): 요청을 받은 사람만. 한 줄 이유는 선택."""
    return answer(user_id, change_id, False, body.note, background)


@router.post("/{collaboration_id}/extend")
def extend(
    collaboration_id: int,
    body: ending.ExtendInput,
    background: BackgroundTasks,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    """[기간 연장 요청]: 새 종료일(+30일까지) + 사유. 상대가 수락하면 종료일이 바뀌어요."""
    notice = ending.request_extend(user_id, collaboration_id, body)
    background.add_task(ending.after_change, notice)
    return load_detail(user_id, collaboration_id)


@router.post("/{collaboration_id}/complete")
def complete(
    collaboration_id: int,
    body: ending.CompleteInput,
    background: BackgroundTasks,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    """[조기 완료 요청]: 진행 중인 요청 · 남은 일정이 없을 때만. 상대가 수락하면 바로 완료."""
    notice = ending.request_complete(user_id, collaboration_id, body)
    background.add_task(ending.after_change, notice)
    return load_detail(user_id, collaboration_id)


@router.post("/{collaboration_id}/stop")
def stop(collaboration_id: int, body: ending.StopInput, user_id: int = Depends(get_current_user_id)) -> dict:
    """[협업 중단]: 한 명이 바로. 사유 + 남길 말 필수. 채널 정리는 백그라운드 작업(close_finished_channels)이 해요."""
    ending.stop_collaboration(user_id, collaboration_id, body)
    return load_detail(user_id, collaboration_id)


@router.post("/changes/{change_id}/withdraw")
def withdraw_postpone(change_id: int, user_id: int = Depends(get_current_user_id)) -> dict:
    """시작일 미루기 [요청 철회]: 요청한 사람만."""
    collaboration_id = waiting.withdraw_postpone(user_id, change_id)
    return load_detail(user_id, collaboration_id)