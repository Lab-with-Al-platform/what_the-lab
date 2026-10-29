"""협업 상세의 요청: 남기기 · 완료 · 취소. (연구회원·AI 전문가 공통)

- 요청은 항상 상대에게 보내요 (협업은 두 사람). 받은 사람만 [완료], 보낸 사람만 [취소]
- 끝난 협업(완료·중단·취소)에서는 바꿀 수 없어요 (409)
- 저장한 뒤 협업 상세 전체(load_detail)를 돌려줘요. 화면은 받은 값으로 다시 그려요
입력 규칙은 app/workspace_rules.py (TaskInput · clean_task)
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException

from app import workspace_rules as rules
from app.db import transaction
from app.security import get_current_user_id
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


def find_task(cursor, user_id: int, task_id: int) -> dict:
    """요청 하나 + 내 협업인지 확인 (남의 협업이면 find_collaboration 이 404). 이 협업을 잠가요."""
    cursor.execute(
        "SELECT task_id, collaboration_id, requested_by, assignee, status FROM collaboration_task WHERE task_id = %s",
        (task_id,),
    )
    task = cursor.fetchone()
    if task is None:
        raise HTTPException(status_code=404, detail="요청을 찾을 수 없어요")
    check_open_collab(find_collaboration(cursor, user_id, task["collaboration_id"], lock=True))
    if task["status"] != "open":
        raise HTTPException(status_code=409, detail="이미 끝난 요청이에요")
    return task


@router.post("/{collaboration_id}/tasks")
def add_task(collaboration_id: int, body: rules.TaskInput, user_id: int = Depends(get_current_user_id)) -> dict:
    """[＋ 요청 남기기]: 상대에게 맡길 일. 기한은 선택 (오늘 ~ 협업 종료일)."""
    with transaction() as cursor:
        collab = find_collaboration(cursor, user_id, collaboration_id, lock=True)
        check_open_collab(collab)
        values = rules.clean_task(body, (collab["start_date"], collab["end_date"]), today_kst())
        cursor.execute(
            """
            INSERT INTO collaboration_task (collaboration_id, requested_by, assignee, content, due_date, source)
            VALUES (%(collaboration_id)s, %(requested_by)s, %(assignee)s, %(content)s, %(due_date)s, 'web')
            """,
            {
                **values,
                "collaboration_id": collaboration_id,
                "requested_by": user_id,
                "assignee": partner_id(cursor, collaboration_id, collab["my_side"]),
            },
        )
    return load_detail(user_id, collaboration_id)


@router.post("/tasks/{task_id}/done")
def complete_task(task_id: int, user_id: int = Depends(get_current_user_id)) -> dict:
    """[완료]: 받은 사람만 눌러요."""
    with transaction() as cursor:
        task = find_task(cursor, user_id, task_id)
        if task["assignee"] != user_id:
            raise HTTPException(status_code=403, detail="요청을 받은 사람만 완료할 수 있어요")
        cursor.execute("UPDATE collaboration_task SET status = 'done', closed_at = now() WHERE task_id = %s", (task_id,))
    return load_detail(user_id, task["collaboration_id"])


@router.post("/tasks/{task_id}/cancel")
def cancel_task(task_id: int, user_id: int = Depends(get_current_user_id)) -> dict:
    """[취소]: 보낸 사람이 필요 없어졌을 때만 눌러요."""
    with transaction() as cursor:
        task = find_task(cursor, user_id, task_id)
        if task["requested_by"] != user_id:
            raise HTTPException(status_code=403, detail="요청을 보낸 사람만 취소할 수 있어요")
        cursor.execute("UPDATE collaboration_task SET status = 'canceled', closed_at = now() WHERE task_id = %s", (task_id,))
    return load_detail(user_id, task["collaboration_id"])