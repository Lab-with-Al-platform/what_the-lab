"""협업 공간: 내 협업 목록·일정 보기, 처음 열기, 일정 추가·수정·삭제. (연구회원·AI 전문가 공통)

같은 협업의 두 사람(연구회원, 전문가)만 볼 수 있고 바꿀 수 있어요. 남의 협업은 404.
저장 API는 모두 처리가 끝난 최신 목록 전체(load_workspace)를 돌려줍니다. 화면은 받은 값으로 그대로 다시 그려요.
일정을 추가 · 변경 · 삭제하면 상대에게 알려요 (종 알림 + 응답 뒤 협업 채널 멘션, app/schedule_notice.py).
일정 입력 규칙은 app/workspace_rules.py 에 모아 두었어요.
"""

from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app import schedule_notice as notice
from app import workspace_rules as rules
from app.db import transaction
from app.google_calendar import event_id
from app.security import get_current_user_id
from app.workspace_detail import load_detail
from app.workspace_store import check_ongoing, find_collaboration, load_workspace

router = APIRouter(prefix="/api/v1/workspace", tags=["workspace"])

INSERT_SCHEDULE = """
    INSERT INTO collaboration_schedule
      (collaboration_id, kind, title, start_date, end_date, start_time, end_time, place, memo, assignee, series_id,
       created_by, google_status)
    VALUES (%(collaboration_id)s, %(kind)s, %(title)s, %(start_date)s, %(end_date)s, %(start_time)s, %(end_time)s,
            %(place)s, %(memo)s, %(assignee)s, %(series_id)s, %(created_by)s, %(google_status)s)
    RETURNING schedule_id
"""


def google_status(collab: dict) -> str:
    """구글 캘린더가 있는 협업이면 '구글에 반영할 차례(pending)', 없으면 'none'"""
    return "pending" if collab.get("google_calendar_id") else "none"


@router.get("")
def get_workspace(user_id: int = Depends(get_current_user_id)) -> dict:
    """내 협업 전부(진행 중·시작 전·완료) + 진행 중 협업의 일정."""
    return load_workspace(user_id)

@router.get("/{collaboration_id}")
def get_collaboration_detail(collaboration_id: int, user_id: int = Depends(get_current_user_id)) -> dict:
    """협업 상세: 머리 · 일정 · 요청 · 정한 것 · 기간 변경 요청 · 합의 내용. 남의 협업이면 404."""
    return load_detail(user_id, collaboration_id)


@router.post("/{collaboration_id}/open")
def open_workspace(collaboration_id: int, user_id: int = Depends(get_current_user_id)) -> dict:
    """[협업 공간 열기]: 내 쪽에서 처음 연 때를 남겨요. 이미 열었으면 그대로 둬요."""
    with transaction() as cursor:
        collab = find_collaboration(cursor, user_id, collaboration_id, lock=True)
        column = "researcher_opened_at" if collab["my_side"] == "researcher" else "expert_opened_at"
        cursor.execute(
            f"UPDATE collaboration SET {column} = COALESCE({column}, now()) WHERE collaboration_id = %s",
            (collaboration_id,),
        )
    return load_workspace(user_id)


@router.post("/{collaboration_id}/schedules")
def add_schedule(
    collaboration_id: int,
    body: rules.ScheduleInput,
    background: BackgroundTasks,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    """일정 추가 (웹). 저장 · 알림은 save_schedule, 채널 멘션은 응답을 보낸 뒤에."""
    background.add_task(notice.announce, save_schedule(user_id, collaboration_id, body))
    return load_workspace(user_id)


@router.put("/schedules/{schedule_id}")
def update_schedule(
    schedule_id: int,
    body: rules.ScheduleInput,
    background: BackgroundTasks,
    series: bool = False,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    """일정 수정 (웹). series=true 면 같은 반복 일정 중 이 날짜와 그 뒤를 모두. 저장 · 알림은 edit_schedule."""
    background.add_task(notice.announce, edit_schedule(user_id, schedule_id, body, series))
    return load_workspace(user_id)


@router.delete("/schedules/{schedule_id}")
def delete_schedule(
    schedule_id: int,
    background: BackgroundTasks,
    series: bool = False,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    """일정 삭제 (웹). series=true 면 같은 반복 묶음 중 이 날짜와 그 뒤 일정을 모두. 저장 · 알림은 remove_schedule."""
    background.add_task(notice.announce, remove_schedule(user_id, schedule_id, series))
    return load_workspace(user_id)


# ---------- 웹 · 디스코드(/일정) 공통: 저장 + 상대 알림 저장. 돌려준 값을 notice.announce 에 넘기면 채널 멘션 ----------
def save_schedule(user_id: int, collaboration_id: int, body: rules.ScheduleInput) -> dict:
    """일정 추가. 매주 반복을 고르면 종료일까지 같은 요일마다 하나씩 만들고 series_id 로 묶어요."""
    with transaction() as cursor:
        collab = find_collaboration(cursor, user_id, collaboration_id, lock=True)
        check_ongoing(collab)
        values = rules.clean_schedule(body, allowed_period(collab))
        values.update(
            collaboration_id=collaboration_id, created_by=user_id, series_id=None, google_status=google_status(collab)
        )

        # 하루짜리만 반복해요 (작업 기간·여러 날 일정은 반복하지 않아요)
        repeat = body.repeat_weekly and values["kind"] != "work" and values["start_date"] == values["end_date"]
        days = rules.weekly_dates(values["start_date"], collab["end_date"]) if repeat else [values["start_date"]]
        series_id = None
        first_id = None
        for day in days:
            end = day if repeat else values["end_date"]  # 반복 일정은 모두 하루짜리
            cursor.execute(INSERT_SCHEDULE, {**values, "start_date": day, "end_date": end, "series_id": series_id})
            new_id = cursor.fetchone()["schedule_id"]
            first_id = first_id or new_id
            if repeat and series_id is None:  # 첫 일정 번호로 묶어요
                series_id = new_id
                cursor.execute("UPDATE collaboration_schedule SET series_id = %s WHERE schedule_id = %s", (new_id, new_id))
        first = {**values, "start_date": days[0], "end_date": days[0] if repeat else values["end_date"]}
        people = notice.collab_people(cursor, collaboration_id)
        return notice.notify_schedule(
            cursor, people, user_id, "schedule_created", first_id, notice.created_note(first, len(days))
        )


UPDATE_SCHEDULE = """
    UPDATE collaboration_schedule SET kind = %(kind)s, title = %(title)s, start_date = %(start_date)s,
      end_date = %(end_date)s, start_time = %(start_time)s, end_time = %(end_time)s, place = %(place)s,
      memo = %(memo)s, assignee = %(assignee)s, updated_by = %(updated_by)s,
      google_status = %(google_status)s, google_attempts = 0, google_error = NULL
    WHERE schedule_id = %(schedule_id)s
"""


def edit_schedule(user_id: int, schedule_id: int, body: rules.ScheduleInput, series: bool = False) -> dict | None:
    """일정 수정. 고친 사람을 남기고, 구글에도 다시 반영해요.

    series=True 이고 반복 일정이면 이 날짜와 그 뒤 반복 일정을 모두 같은 내용으로 (날짜를 옮기면 모두 같은 만큼 옮겨요).
    알림은 몇 개를 바꿔도 한 번만. 날짜 · 시각이 바뀌면 상대에게 종 + 채널 멘션, 제목 · 메모 · 종류만 바뀌면 종에만.
    그대로면 None(알림 없음).
    """
    with transaction() as cursor:
        collab = find_collaboration(cursor, user_id, schedule_owner(cursor, schedule_id), lock=True)
        check_ongoing(collab)
        period = allowed_period(collab)
        values = rules.clean_schedule(body, period)
        old = find_schedule(cursor, schedule_id)
        rows = series_rows(cursor, schedule_id) if series and old["series_id"] else [old]
        if len(rows) > 1 and values["start_date"] != values["end_date"]:
            raise HTTPException(status_code=400, detail="반복 일정은 하루짜리로만 함께 바꿀 수 있어요")
        shift = values["start_date"] - old["start_date"]  # 날짜를 옮긴 만큼 뒤 일정도 옮겨요
        for row in rows:
            day = row["start_date"] + shift
            end = values["end_date"] if len(rows) == 1 else day
            if len(rows) > 1 and not period[0] <= day <= period[1]:
                raise HTTPException(
                    status_code=400,
                    detail=f"옮기면 반복 일정 중 {notice.when_text({'start_date': day, 'end_date': day})}이(가) 협업 기간을 벗어나요",
                )
            rules.check_in_period(day, end, period)
            cursor.execute(
                UPDATE_SCHEDULE,
                {
                    **values,
                    "start_date": day,
                    "end_date": end,
                    "schedule_id": row["schedule_id"],
                    "updated_by": user_id,
                    "google_status": google_status(collab),
                },
            )
        if not (notice.is_moved(old, values) or notice.is_edited(old, values)):
            return None
        moved = notice.is_moved(old, values)
        note = notice.changed_note(old, values) if moved else notice.schedule_line(values)
        if len(rows) > 1:
            note += f" · 이 날짜부터 매주 {len(rows)}개"
        people = notice.collab_people(cursor, collab["collaboration_id"])
        return notice.notify_schedule(
            cursor,
            people,
            user_id,
            "schedule_changed" if moved else "schedule_edited",
            schedule_id,
            note,
            line=notice.schedule_line(values),
            message_id=old["discord_message_id"],
        )


def series_rows(cursor, schedule_id: int) -> list[dict]:
    """같은 반복 묶음에서 이 날짜와 그 뒤 일정들 (날짜 순)"""
    cursor.execute(
        """
        SELECT t.schedule_id, t.start_date FROM collaboration_schedule t
        JOIN collaboration_schedule s ON s.schedule_id = %s
        WHERE t.collaboration_id = s.collaboration_id AND t.series_id = s.series_id AND t.start_date >= s.start_date
        ORDER BY t.start_date
        """,
        (schedule_id,),
    )
    return cursor.fetchall()


def remove_schedule(user_id: int, schedule_id: int, series: bool = False) -> dict:
    """일정 삭제. series=True 면 같은 반복 묶음 중 이 날짜와 그 뒤 일정을 모두 지워요.

    구글 캘린더가 있는 협업이면 지운 일정을 대기열(google_event_trash)에 적어 구글에서도 지워요.
    """
    with transaction() as cursor:
        collab = find_collaboration(cursor, user_id, schedule_owner(cursor, schedule_id), lock=True)
        check_ongoing(collab)
        target = find_schedule(cursor, schedule_id)  # 지우기 전에 알림 글자용으로 읽어 둬요
        deleted: list[int] = []
        if series:
            cursor.execute(
                """
                DELETE FROM collaboration_schedule t USING collaboration_schedule s
                WHERE s.schedule_id = %s AND t.collaboration_id = s.collaboration_id
                  AND t.series_id = s.series_id AND t.start_date >= s.start_date
                RETURNING t.schedule_id
                """,
                (schedule_id,),
            )
            deleted = [row["schedule_id"] for row in cursor.fetchall()]
        if not deleted:  # 반복 일정이 아니면 이 일정 하나만
            cursor.execute("DELETE FROM collaboration_schedule WHERE schedule_id = %s RETURNING schedule_id", (schedule_id,))
            deleted = [row["schedule_id"] for row in cursor.fetchall()]
        if collab["google_calendar_id"]:
            cursor.executemany(
                "INSERT INTO google_event_trash (calendar_id, event_id) VALUES (%s, %s)",
                [(collab["google_calendar_id"], event_id(item)) for item in deleted],
            )
        people = notice.collab_people(cursor, collab["collaboration_id"])
        return notice.notify_schedule(
            cursor,
            people,
            user_id,
            "schedule_deleted",
            schedule_id,
            notice.deleted_note(target, len(deleted)),
            line=notice.schedule_line(target),
            message_id=target["discord_message_id"],
        )


def allowed_period(collab: dict) -> tuple[date, date]:
    """일정을 잡을 수 있는 기간. 추가·수정이 같은 기간을 쓰도록 여기서만 계산해요."""
    return rules.schedule_period(collab["start_date"], collab["end_date"], collab["confirmed_on"])

def find_schedule(cursor, schedule_id: int) -> dict:
    """바꾸기 · 지우기 전 일정 (무엇이 바뀌었는지 · 무엇을 지웠는지 알림에 써요)"""
    cursor.execute(
        "SELECT schedule_id, kind, title, start_date, end_date, start_time, end_time, memo, series_id,"
        " discord_message_id FROM collaboration_schedule WHERE schedule_id = %s",
        (schedule_id,),
    )
    return cursor.fetchone()

def schedule_owner(cursor, schedule_id: int) -> int:
    """일정이 속한 협업 번호. 없으면 404. (내 협업인지는 find_collaboration 에서 확인해요)"""
    cursor.execute("SELECT collaboration_id FROM collaboration_schedule WHERE schedule_id = %s", (schedule_id,))
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="일정을 찾을 수 없어요")
    return row["collaboration_id"]