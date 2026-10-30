"""협업 상세의 요청: 남기기 · 완료 · 취소 · 기한 변경 · 되돌리기. (연구회원·AI 전문가 공통)

- 요청은 항상 상대에게 보내요 (협업은 두 사람). 받은 사람만 [완료], 보낸 사람만 [취소]·[기한 변경]
- 끝낸 사람은 [되돌리기]로 다시 진행 중으로 돌릴 수 있어요 (완료 → 받은 사람, 취소 → 보낸 사람)
- 끝난 협업(완료·중단·취소)에서는 바꿀 수 없어요 (409)
- 저장한 뒤 협업 상세 전체(load_detail)를 돌려줘요. 화면은 받은 값으로 다시 그려요
- create_task · close_task · change_due · reopen_task 는 디스코드 봇(app/discord_gateway.py)도 같이 써요. 규칙이 한 곳에만 있게
입력 규칙은 app/workspace_rules.py (TaskInput · clean_task)
- 웹에서 바꾸면 응답을 보낸 뒤 디스코드 채널 · 구글 캘린더에 반영해요 (app/task_sync.py, BackgroundTasks)
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app import workspace_rules as rules
from app.db import transaction
from app.security import get_current_user_id
from app.task_sync import after_web_change
from app.workspace_detail import load_detail
from app.workspace_store import find_collaboration

router = APIRouter(prefix="/api/v1/workspace", tags=["workspace"])


def today_kst() -> date:
    """한국 날짜 (기한이 오늘 이후인지 볼 때)"""
    return datetime.now(ZoneInfo("Asia/Seoul")).date()


def check_open_collab(collab: dict) -> None:
    """끝난 협업은 읽기 전용이에요."""
    if collab["status"] != "ongoing":
        raise HTTPException(status_code=409, detail="끝난 협업이라 바꿀 수 없어요")


def partner_id(cursor, collaboration_id: int, my_side: str) -> int:
    """협업의 상대방 회원 번호 (연구회원이면 전문가, 전문가면 연구회원)"""
    cursor.execute(
        "SELECT rs.user_id AS researcher_id, c.expert_id FROM collaboration c"
        " JOIN research rs ON rs.research_id = c.research_id WHERE c.collaboration_id = %s",
        (collaboration_id,),
    )
    row = cursor.fetchone()
    return row["expert_id"] if my_side == "researcher" else row["researcher_id"]


def find_task(cursor, user_id: int, task_id: int, need_open: bool = True) -> dict:
    """요청 하나 + 내 협업인지 확인 (남의 협업이면 find_collaboration 이 404). 이 협업을 잠가요.

    돌려주는 값에 협업 기간(period)도 붙여요. 기한을 바꿀 때 범위 검사에 써요.
    need_open: True 면 끝난 요청은 409 (완료·취소·기한 변경), False 면 끝난 요청도 돌려줘요 (되돌리기)
    """
    cursor.execute(
        "SELECT task_id, collaboration_id, requested_by, assignee, status, due_date FROM collaboration_task WHERE task_id = %s",
        (task_id,),
    )
    task = cursor.fetchone()
    if task is None:
        raise HTTPException(status_code=404, detail="요청을 찾을 수 없어요")
    collab = find_collaboration(cursor, user_id, task["collaboration_id"], lock=True)
    check_open_collab(collab)
    task["period"] = (collab["start_date"], collab["end_date"])
    if need_open and task["status"] != "open":
        raise HTTPException(status_code=409, detail="이미 끝난 요청이에요")
    return task


def create_task(user_id: int, collaboration_id: int, body: rules.TaskInput, source: str = "web") -> int:
    """요청 한 줄 저장 (웹 · 디스코드 공통). 새 요청 번호를 돌려줘요.

    source: 어디서 남겼나 — "web"(웹 화면) / "discord"(/요청 명령어)
    """
    with transaction() as cursor:
        collab = find_collaboration(cursor, user_id, collaboration_id, lock=True)
        check_open_collab(collab)
        values = rules.clean_task(body, (collab["start_date"], collab["end_date"]), today_kst())
        cursor.execute(
            """
            INSERT INTO collaboration_task (collaboration_id, requested_by, assignee, content, due_date, source)
            VALUES (%(collaboration_id)s, %(requested_by)s, %(assignee)s, %(content)s, %(due_date)s, %(source)s)
            RETURNING task_id
            """,
            {
                **values,
                "collaboration_id": collaboration_id,
                "requested_by": user_id,
                "assignee": partner_id(cursor, collaboration_id, collab["my_side"]),
                "source": source,
            },
        )
        return cursor.fetchone()["task_id"]


@router.post("/{collaboration_id}/tasks")
def add_task(
    collaboration_id: int,
    body: rules.TaskInput,
    background: BackgroundTasks,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    """[＋ 요청 남기기]: 상대에게 맡길 일. 기한은 선택 (오늘 ~ 협업 종료일). 채널에도 올려요."""
    task_id = create_task(user_id, collaboration_id, body)
    background.add_task(after_web_change, task_id, "created")
    return load_detail(user_id, collaboration_id)


def close_task(user_id: int, task_id: int, status: str) -> int:
    """요청 끝내기 (웹 · 디스코드 공통). 이 요청의 협업 번호를 돌려줘요.

    status: "done"(완료 — 받은 사람만) / "canceled"(취소 — 보낸 사람만)
    """
    with transaction() as cursor:
        task = find_task(cursor, user_id, task_id)
        if status == "done":
            if task["assignee"] != user_id:
                raise HTTPException(status_code=403, detail="요청을 받은 사람만 완료할 수 있어요")
            cursor.execute("UPDATE collaboration_task SET status = 'done', closed_at = now() WHERE task_id = %s", (task_id,))
        else:
            if task["requested_by"] != user_id:
                raise HTTPException(status_code=403, detail="요청을 보낸 사람만 취소할 수 있어요")
            cursor.execute("UPDATE collaboration_task SET status = 'canceled', closed_at = now() WHERE task_id = %s", (task_id,))
    return task["collaboration_id"]


def change_due(user_id: int, task_id: int, due: date | None) -> dict:
    """[기한 변경] (웹 · 디스코드 공통): 보낸 사람만. 기한은 정한 사람이 바꿔요.

    due: 새 기한 (None 이면 기한 없음). 돌려주는 값: collaboration_id, old_due(바꾸기 전 기한)
    """
    with transaction() as cursor:
        task = find_task(cursor, user_id, task_id)
        if task["requested_by"] != user_id:
            raise HTTPException(status_code=403, detail="요청을 보낸 사람만 기한을 바꿀 수 있어요")
        due = rules.check_due(due, task["period"], today_kst())
        cursor.execute("UPDATE collaboration_task SET due_date = %s WHERE task_id = %s", (due, task_id))
    return {"collaboration_id": task["collaboration_id"], "old_due": task["due_date"]}


@router.post("/tasks/{task_id}/due")
def change_task_due(
    task_id: int, body: rules.DueInput, background: BackgroundTasks, user_id: int = Depends(get_current_user_id)
) -> dict:
    """[기한 변경]: 보낸 사람만. 비우면 기한 없음."""
    result = change_due(user_id, task_id, body.due_date)
    background.add_task(after_web_change, task_id, "due", result["old_due"])
    return load_detail(user_id, result["collaboration_id"])


def reopen_task(user_id: int, task_id: int) -> int:
    """[되돌리기] (웹 · 디스코드 공통): 끝낸 사람만 다시 진행 중으로.

    완료는 받은 사람이, 취소는 보낸 사람이 되돌려요. 끝난 협업에서는 안 돼요 (409).
    """
    with transaction() as cursor:
        task = find_task(cursor, user_id, task_id, need_open=False)
        if task["status"] == "open":
            raise HTTPException(status_code=409, detail="이미 진행 중인 요청이에요")
        if task["status"] == "done" and task["assignee"] != user_id:
            raise HTTPException(status_code=403, detail="완료한 사람(받은 사람)만 되돌릴 수 있어요")
        if task["status"] == "canceled" and task["requested_by"] != user_id:
            raise HTTPException(status_code=403, detail="취소한 사람(보낸 사람)만 되돌릴 수 있어요")
        cursor.execute("UPDATE collaboration_task SET status = 'open', closed_at = NULL WHERE task_id = %s", (task_id,))
    return task["collaboration_id"]


@router.post("/tasks/{task_id}/reopen")
def reopen(task_id: int, background: BackgroundTasks, user_id: int = Depends(get_current_user_id)) -> dict:
    """[되돌리기]: 완료·취소를 잘못 눌렀을 때 다시 진행 중으로."""
    collaboration_id = reopen_task(user_id, task_id)
    background.add_task(after_web_change, task_id, "reopened")
    return load_detail(user_id, collaboration_id)


@router.post("/tasks/{task_id}/done")
def complete_task(task_id: int, background: BackgroundTasks, user_id: int = Depends(get_current_user_id)) -> dict:
    """[완료]: 받은 사람만 눌러요."""
    collaboration_id = close_task(user_id, task_id, "done")
    background.add_task(after_web_change, task_id, "done")
    return load_detail(user_id, collaboration_id)


@router.post("/tasks/{task_id}/cancel")
def cancel_task(task_id: int, background: BackgroundTasks, user_id: int = Depends(get_current_user_id)) -> dict:
    """[취소]: 보낸 사람이 필요 없어졌을 때만 눌러요."""
    collaboration_id = close_task(user_id, task_id, "canceled")
    background.add_task(after_web_change, task_id, "canceled")
    return load_detail(user_id, collaboration_id)