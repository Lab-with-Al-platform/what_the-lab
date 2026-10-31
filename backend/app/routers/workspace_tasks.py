"""협업 상세의 요청: 남기기 · 완료 · 취소 · 기한 변경 · 되돌리기 · 기한 얘기하기 · 다시 요청. (연구회원·AI 전문가 공통)

- 요청은 항상 상대에게 보내요 (협업은 두 사람). 받은 사람만 [완료]·[기한 얘기하기], 보낸 사람만 [취소]·[기한 변경]
- 끝낸 사람은 [되돌리기]로 다시 진행 중으로 돌릴 수 있어요 (완료 → 받은 사람, 취소 → 보낸 사람)
- 보낸 사람은 완료된 요청을 [다시 요청]으로 진행 중으로 돌려요 (이유 필수)
- [기한 얘기하기]는 상태를 바꾸지 않아요. 기록을 남기고 보낸 사람을 불러요. 기한은 보낸 사람이 [기한 변경]으로 바꿔요
- 무엇을 하든 요청 기록(collaboration_task_event)에 한 줄 남겨요 (누가 · 언제 · 무엇을 · 웹/디스코드)
- 끝난 협업(완료·중단·취소)에서는 바꿀 수 없어요 (409)
- 저장한 뒤 협업 상세 전체(load_detail)를 돌려줘요. 화면은 받은 값으로 다시 그려요
- create_task · close_task · change_due · reopen_task · talk_due · return_task 는 디스코드 봇(app/discord_gateway.py)도 같이 써요. 규칙이 한 곳에만 있게
입력 규칙은 app/workspace_rules.py (TaskInput · clean_task · TalkInput · ReturnInput)
- 웹에서 바꾸면 응답을 보낸 뒤 디스코드 채널 · 구글 캘린더에 반영해요 (app/task_sync.py, BackgroundTasks)
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app import workspace_rules as rules
from app.db import transaction
from app.notification_store import notify_task
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


def log_event(
    cursor,
    task_id: int,
    actor_id: int,
    kind: str,
    source: str,
    old_due: date | None = None,
    new_due: date | None = None,
    note: str | None = None,
) -> None:
    """요청 기록 한 줄 (같은 트랜잭션 안에서 저장해서, 저장과 기록이 항상 같이 남아요)

    kind: created · done · canceled · reopened · due · due_talk · returned
    source: 어디서 눌렀나 — "web" / "discord"
    """
    cursor.execute(
        """
        INSERT INTO collaboration_task_event (task_id, actor_id, kind, old_due, new_due, note, source)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
    (task_id, actor_id, kind, old_due, new_due, note, source),
    )
    notify_task(cursor, task_id, actor_id, kind)


def pending_talk(cursor, task_id: int) -> dict | None:
    """답을 기다리는 [기한 얘기하기] 기록. 그 뒤로 기한 변경 · 지금 기한 유지 · 완료 · 취소가 있으면 None.

    (app/workspace_store.py 의 TASK_FLAG_SQL · app/workspace_detail.py 의 task_marks 와 같은 규칙)
    """
    cursor.execute(
        "SELECT kind, old_due, new_due, note FROM collaboration_task_event"
        " WHERE task_id = %s AND kind IN ('due_talk', 'due_kept', 'due', 'done', 'canceled')"
        " ORDER BY event_id DESC LIMIT 1",
        (task_id,),
    )
    row = cursor.fetchone()
    return row if row and row["kind"] == "due_talk" else None


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
        task_id = cursor.fetchone()["task_id"]
        log_event(cursor, task_id, user_id, "created", source, new_due=values["due_date"])
        return task_id


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


def close_task(user_id: int, task_id: int, status: str, source: str = "web") -> int:
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
        log_event(cursor, task_id, user_id, status, source)
    return task["collaboration_id"]


def change_due(user_id: int, task_id: int, due: date | None, source: str = "web") -> dict:
    """[기한 변경] (웹 · 디스코드 공통): 보낸 사람만. 기한은 정한 사람이 바꿔요.

    due: 새 기한 (None 이면 기한 없음). 돌려주는 값: collaboration_id, old_due(바꾸기 전 기한)
    """
    with transaction() as cursor:
        task = find_task(cursor, user_id, task_id)
        if task["requested_by"] != user_id:
            raise HTTPException(status_code=403, detail="요청을 보낸 사람만 기한을 바꿀 수 있어요")
        due = rules.check_due(due, task["period"], today_kst())
        if due != task["due_date"]:  # 그대로면 저장 · 기록하지 않아요
            cursor.execute("UPDATE collaboration_task SET due_date = %s WHERE task_id = %s", (due, task_id))
            log_event(cursor, task_id, user_id, "due", source, old_due=task["due_date"], new_due=due)
    return {"collaboration_id": task["collaboration_id"], "old_due": task["due_date"]}


@router.post("/tasks/{task_id}/due")
def change_task_due(
    task_id: int, body: rules.DueInput, background: BackgroundTasks, user_id: int = Depends(get_current_user_id)
) -> dict:
    """[기한 변경]: 보낸 사람만. 비우면 기한 없음."""
    result = change_due(user_id, task_id, body.due_date)
    background.add_task(after_web_change, task_id, "due", result["old_due"])
    return load_detail(user_id, result["collaboration_id"])


def reopen_task(user_id: int, task_id: int, source: str = "web") -> int:
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
        log_event(cursor, task_id, user_id, "reopened", source)
    return task["collaboration_id"]


def talk_due(user_id: int, task_id: int, body: rules.TalkInput, source: str = "web") -> int:
    """[기한 얘기하기] (웹 · 디스코드 공통): 받은 사람만, 진행 중인 요청만. 이 요청의 협업 번호를 돌려줘요.

    요청 상태 · 기한은 그대로예요. 기록을 남기고(due_talk), 보낸 사람에게 알려요(task_sync).
    원하는 기한(body.due_date)이 없으면 "이 기한으로는 어려워요"예요.
    """
    with transaction() as cursor:
        task = find_task(cursor, user_id, task_id)
        if task["assignee"] != user_id:
            raise HTTPException(status_code=403, detail="요청을 받은 사람만 기한을 얘기할 수 있어요")
        values = rules.clean_talk(body, task["period"], today_kst())
        log_event(
            cursor, task_id, user_id, "due_talk", source,
            old_due=task["due_date"], new_due=values["due"], note=values["note"],
        )
    return task["collaboration_id"]

def keep_due(user_id: int, task_id: int, body: rules.KeepInput, source: str = "web") -> int:
    """[지금 기한 유지] (웹 · 디스코드 공통): 보낸 사람이 기한 수정 요청에 "그대로 갈게요"로 답해요.

    답을 기다리는 기한 수정 요청이 있을 때만 (없으면 409). 기한 · 상태는 그대로, 기록(due_kept) + 받은 사람에게 알림.
    """
    with transaction() as cursor:
        task = find_task(cursor, user_id, task_id)
        if task["requested_by"] != user_id:
            raise HTTPException(status_code=403, detail="요청을 보낸 사람만 답할 수 있어요")
        if pending_talk(cursor, task_id) is None:
            raise HTTPException(status_code=409, detail="답을 기다리는 기한 수정 요청이 없어요")
        log_event(
            cursor, task_id, user_id, "due_kept", source,
            old_due=task["due_date"], new_due=task["due_date"], note=rules.clean_keep(body),
        )
    return task["collaboration_id"]


@router.post("/tasks/{task_id}/keep-due")
def keep_task_due(
    task_id: int, body: rules.KeepInput, background: BackgroundTasks, user_id: int = Depends(get_current_user_id)
) -> dict:
    """[지금 기한 유지]: 보낸 사람이 기한 수정 요청을 거절해요 (이유는 선택). 받은 사람을 불러요."""
    collaboration_id = keep_due(user_id, task_id, body)
    background.add_task(after_web_change, task_id, "due_kept")
    return load_detail(user_id, collaboration_id)

@router.post("/tasks/{task_id}/due-talk")
def talk_task_due(
    task_id: int, body: rules.TalkInput, background: BackgroundTasks, user_id: int = Depends(get_current_user_id)
) -> dict:
    """[기한 얘기하기]: 받은 사람이 원하는 기한 + 이유를 보내요. 보낸 사람을 디스코드에서 불러요."""
    collaboration_id = talk_due(user_id, task_id, body)
    background.add_task(after_web_change, task_id, "due_talk")
    return load_detail(user_id, collaboration_id)


def return_task(user_id: int, task_id: int, body: rules.ReturnInput, source: str = "web") -> dict:
    """[다시 요청] (웹 · 디스코드 공통): 보낸 사람만, 완료된 요청만 → 다시 진행 중.

    이유는 꼭 받아요. 새 기한을 안 쓰면 원래 기한 (이미 지났으면 새 기한 필수).
    돌려주는 값: collaboration_id, old_due(바꾸기 전 기한)
    """
    with transaction() as cursor:
        task = find_task(cursor, user_id, task_id, need_open=False)
        if task["requested_by"] != user_id:
            raise HTTPException(status_code=403, detail="요청을 보낸 사람만 다시 요청할 수 있어요")
        if task["status"] != "done":
            raise HTTPException(status_code=409, detail="완료된 요청만 다시 요청할 수 있어요")
        values = rules.clean_return(body, task["due_date"], task["period"], today_kst())
        cursor.execute(
            "UPDATE collaboration_task SET status = 'open', closed_at = NULL, due_date = %s WHERE task_id = %s",
            (values["due"], task_id),
        )
        log_event(
            cursor, task_id, user_id, "returned", source,
            old_due=task["due_date"], new_due=values["due"], note=values["note"],
        )
    return {"collaboration_id": task["collaboration_id"], "old_due": task["due_date"]}


@router.post("/tasks/{task_id}/return")
def return_done_task(
    task_id: int, body: rules.ReturnInput, background: BackgroundTasks, user_id: int = Depends(get_current_user_id)
) -> dict:
    """[다시 요청]: 보낸 사람이 완료된 요청을 다시 진행 중으로. 받은 사람을 디스코드에서 불러요."""
    result = return_task(user_id, task_id, body)
    background.add_task(after_web_change, task_id, "returned")
    return load_detail(user_id, result["collaboration_id"])


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