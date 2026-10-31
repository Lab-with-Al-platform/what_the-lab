"""협업 공간 읽기·만들기. 조회 API와 저장 API가 모두 load_workspace 로 최신 목록을 돌려줍니다.

- 협업은 연구회원이 [협업 시작하기]를 누르거나, 급한 요청을 전문가가 수락할 때 만들어져요 (create_collaboration).
- 종료일이 지난 진행 중 협업은 완료로 바꿔요 (complete_ended_collaborations, 1분마다 + 목록 읽을 때).
"""

from datetime import date

from fastapi import HTTPException

from app.config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
from app.db import get_connection
from app.discord_bot import channel_url
from app.google_calendar import add_calendar_url, google_ready
from app.notification_store import notify_requests

# 오늘 날짜는 한국 시간 기준 (DB 서버 시간대와 상관없이)
TODAY_KST = "(now() AT TIME ZONE 'Asia/Seoul')::date"

# 시작할 때 합의한 내용 복사본. 요청(cr)과 연구(rs)에서 읽어요.
# (마이그레이션 010/20261028_13 에서 기존 협업을 옮길 때와 같은 모양)
AGREEMENT_SQL = """
  jsonb_build_object(
    'title', rs.title,
    'description', rs.description,
    'field_ids', COALESCE((SELECT jsonb_agg(d.field_id ORDER BY d.field_id) FROM research_domain d WHERE d.research_id = rs.research_id), '[]'::jsonb),
    'able_work_ids', COALESCE((SELECT jsonb_agg(w.able_work_id ORDER BY w.able_work_id) FROM research_able_work w WHERE w.research_id = rs.research_id), '[]'::jsonb),
    'task_unsure', rs.task_unsure,
    'outputs', COALESCE((SELECT jsonb_agg(o.output_type ORDER BY o.output_type) FROM research_output o WHERE o.research_id = rs.research_id), '[]'::jsonb),
    'rewards', COALESCE((SELECT jsonb_agg(w.reward_type ORDER BY w.reward_type) FROM research_reward w WHERE w.research_id = rs.research_id), '[]'::jsonb),
    'data_types', COALESCE((SELECT jsonb_agg(t.data_type ORDER BY t.data_type) FROM research_data_type t WHERE t.research_id = rs.research_id), '[]'::jsonb),
    'data_status', rs.data_status,
    'share_policy', rs.share_policy,
    'share_condition', rs.share_condition,
    'meeting_type', rs.meeting_type,
    'face_to_area', rs.face_to_area,
    'message', cr.message,
    'reply_message', cr.reply_message
  )
"""

SCHEDULE_COLUMNS = """
  s.schedule_id, s.collaboration_id, s.kind, s.title, s.start_date, s.end_date,
  to_char(s.start_time, 'HH24:MI') AS start_time, to_char(s.end_time, 'HH24:MI') AS end_time,
  s.place, s.memo, s.assignee, s.series_id, s.created_by, s.created_at, s.updated_at, s.updated_by
"""


def create_collaboration(cursor, request_id: int) -> None:
    """[협업 시작] 순간에 협업 공간을 만들어요. 기간은 확정된 기간(조정했으면 조정한 기간)을 복사해요.

    요청 상태를 started 로 바꾸는 같은 트랜잭션 안에서 불러야 해요. (둘 중 하나만 되는 일이 없게)
    """
    cursor.execute(
        f"""
        INSERT INTO collaboration (request_id, research_id, expert_id, start_date, end_date, agreement)
        SELECT cr.request_id, cr.research_id, cr.expert_id,
               COALESCE(cr.accepted_start_date, cr.start_date),
               COALESCE(cr.accepted_end_date, cr.end_date),
               {AGREEMENT_SQL}
        FROM collaboration_request cr
        JOIN research rs ON rs.research_id = cr.research_id
        WHERE cr.request_id = %s
        """,
        (request_id,),
    )


def complete_ended_collaborations(cursor) -> None:
    """종료일이 지난 진행 중 협업을 완료로 바꿔요. (종료일 당일까지는 진행 중)"""
    cursor.execute(
        f"UPDATE collaboration SET status = 'done', ended_at = now()"
        f" WHERE status = 'ongoing' AND end_date < {TODAY_KST}"
        " RETURNING request_id"
    )
    completed_requests = [row["request_id"] for row in cursor.fetchall()]
    # UPDATE is atomic: only the first runner receives the changed rows. Repeated
    # background jobs/page reads do not create new review reminders.
    if completed_requests:
        notify_requests(cursor, "review_ready", completed_requests)


def user_role(cursor, user_id: int) -> str:
    """연구회원(researcher) / AI 전문가(expert). 회원 유형이 없으면 403."""
    cursor.execute("SELECT user_role FROM users WHERE user_id = %s", (user_id,))
    row = cursor.fetchone()
    if row is None or row["user_role"] not in ("researcher", "expert"):
        raise HTTPException(status_code=403, detail="연구회원 또는 AI 전문가 회원만 쓸 수 있어요")
    return row["user_role"]


def find_collaboration(cursor, user_id: int, collaboration_id: int, lock: bool = False) -> dict:
    """내가 속한 협업인지 확인합니다. 남의 협업이거나 없으면 똑같이 404.

    돌려주는 값: collaboration_id, status, start_date, end_date, my_side(researcher/expert)
    """
    cursor.execute(
        f"""
        SELECT c.collaboration_id, c.status, c.start_date, c.end_date,
               (c.created_at AT TIME ZONE 'Asia/Seoul')::date AS confirmed_on, c.google_calendar_id,
               CASE WHEN rs.user_id = %s THEN 'researcher' ELSE 'expert' END AS my_side
        FROM collaboration c
        JOIN research rs ON rs.research_id = c.research_id
        WHERE c.collaboration_id = %s AND (rs.user_id = %s OR c.expert_id = %s)
        {"FOR UPDATE OF c" if lock else ""}
        """,
        (user_id, collaboration_id, user_id, user_id),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="협업을 찾을 수 없어요")
    return row


def check_ongoing(collab: dict) -> None:
    """끝난 협업은 읽기 전용이에요. 일정을 추가·수정·삭제할 수 없어요."""
    if collab["status"] != "ongoing":
        raise HTTPException(status_code=409, detail="끝난 협업이라 일정을 바꿀 수 없어요")


def load_workspace(user_id: int) -> dict:
    """협업 공간 첫 화면: 내 협업 전부 + 진행 중 협업의 일정.

    화면의 WorkspaceData 와 같은 모양이에요.
    - status: waiting(시작 전) / active(진행 중) / done / ended_early / canceled
    - opened: 내 쪽에서 [협업 공간 열기]를 했는지
    """
    with get_connection() as conn, conn.transaction(), conn.cursor() as cursor:
        complete_ended_collaborations(cursor)
        role = user_role(cursor, user_id)
        mine = "rs.user_id = %s" if role == "researcher" else "c.expert_id = %s"
        cursor.execute(
            f"""
            SELECT c.collaboration_id, c.status, c.start_date, c.end_date,
                   (c.created_at AT TIME ZONE 'Asia/Seoul')::date AS confirmed_on,
                   c.discord_status, c.discord_channel_id,
                   c.agreement ->> 'title' AS title,
                   {"c.researcher_opened_at" if role == "researcher" else "c.expert_opened_at"} IS NOT NULL AS opened,
                   {"c.researcher_google_at" if role == "researcher" else "c.expert_google_at"} IS NOT NULL AS google_linked,
                   c.google_calendar_id,
                   {TODAY_KST} AS today,
                   pu.nickname, pu.user_photo
            FROM collaboration c
            JOIN research rs ON rs.research_id = c.research_id
            JOIN users pu ON pu.user_id = {"c.expert_id" if role == "researcher" else "rs.user_id"}
            WHERE {mine}
            ORDER BY c.start_date, c.collaboration_id
            """,
            (user_id,),
        )
        rows = cursor.fetchall()
        ongoing_ids = [row["collaboration_id"] for row in rows if row["status"] == "ongoing"]
        cursor.execute(
            f"SELECT {SCHEDULE_COLUMNS}, cu.nickname AS created_by_nickname, uu.nickname AS updated_by_nickname"
            " FROM collaboration_schedule s LEFT JOIN users cu ON cu.user_id = s.created_by"
            " LEFT JOIN users uu ON uu.user_id = s.updated_by"
            " WHERE s.collaboration_id = ANY(%s) ORDER BY s.start_date, s.start_time NULLS FIRST, s.schedule_id",
            (ongoing_ids,),
        )
        schedules = cursor.fetchall()

        # 열린 요청 (최신순). 협업 목록의 요청 목록 · 달력 · 다가오는 일정에 보여요
        cursor.execute(
            "SELECT t.task_id, t.collaboration_id, t.content, t.due_date, t.created_at,"
            " CASE WHEN t.assignee = %s THEN 'in' ELSE 'out' END AS direction,"
            " rq.nickname AS requested_by_nickname, asg.nickname AS assignee_nickname"
            " FROM collaboration_task t"
            " JOIN users rq ON rq.user_id = t.requested_by JOIN users asg ON asg.user_id = t.assignee"
            " WHERE t.collaboration_id = ANY(%s) AND t.status = 'open'"
            " ORDER BY t.created_at DESC, t.task_id DESC",
            (user_id, ongoing_ids),
        )
        tasks = cursor.fetchall()

    partner_role = "expert" if role == "researcher" else "researcher"
    collaborations = [
        {
            "collaboration_id": row["collaboration_id"],
            "research": {"title": row["title"]},
            "partner": {"nickname": row["nickname"], "user_photo": row["user_photo"], "role": partner_role},
            "start_date": row["start_date"],
            "end_date": row["end_date"],
            "confirmed_on": row["confirmed_on"],
            "status": screen_status(row["status"], row["start_date"], row["today"]),

            "opened": row["opened"],
            "google_linked": row["google_linked"],  # 내가 [내 구글 캘린더에 추가]를 했는지
            "google_calendar_url": add_calendar_url(row["google_calendar_id"]) if row["google_linked"] else None,
            "discord_channel_url": (
                channel_url(row["discord_channel_id"]) if row["discord_status"] in ("ready", "closed") else None
            ),
        }
        for row in rows
    ]
    # google_enabled: 서버에 구글 연동 설정이 있는지 (없으면 화면에서 구글 버튼을 숨겨요)
    return {
        "collaborations": collaborations,
        "schedules": schedules,
        "tasks": tasks,  # 진행 중 협업의 열린 요청 (direction: in=받은 · out=보낸)
        "google_enabled": google_login_ready(),
    }

def google_login_ready() -> bool:
    """서비스 계정 키 + 구글 로그인 앱 값이 다 있는지 (화면의 구글 버튼을 보여 줄지)"""
    return google_ready() and bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)


def screen_status(status: str, start: date, today: date) -> str:
    """DB 상태 → 화면 상태. 진행 중(ongoing)인데 시작일 전이면 '시작 전(waiting)'."""
    if status == "ongoing":
        return "waiting" if today < start else "active"
    return status