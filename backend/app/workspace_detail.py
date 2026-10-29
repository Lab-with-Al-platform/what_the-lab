"""협업 상세 한 화면에 필요한 것을 한 번에 읽어요. (GET /api/v1/workspace/{collaboration_id})

- 머리: 상태 · 기간 · 두 사람 · 디스코드 · 구글 캘린더
- 일정: 이 협업 일정 전부 (지난 일정 포함. 화면이 다가오는 것과 지난 것을 나눠요)
- 요청 · 정한 것 · 기간 연장/조기 완료 요청 (collaboration_task · _decision · _change)
- 합의 내용: 시작할 때 복사해 둔 agreement 그대로 (분야·맡길 일 이름은 화면의 taxonomy-options 로 바꿔요)

DB에서 읽기(load_detail)와 화면 모양 만들기(build_detail)를 나눠서, 모양 만들기는 DB 없이 시험해요.
"""

from app.db import get_connection
from app.discord_bot import channel_url
from app.google_calendar import add_calendar_url
from app.workspace_store import (
    SCHEDULE_COLUMNS,
    TODAY_KST,
    complete_ended_collaborations,
    find_collaboration,
    google_login_ready,
    screen_status,
)

# 협업 한 줄 + 두 사람 정보. 연구회원은 research.user_id, 전문가는 collaboration.expert_id 예요.
COLLAB_SQL = f"""
    SELECT c.collaboration_id, c.status, c.start_date, c.end_date, c.agreement,
           (c.created_at AT TIME ZONE 'Asia/Seoul')::date AS confirmed_on,
           c.discord_status, c.discord_channel_id, c.google_calendar_id,
           c.researcher_google_at IS NOT NULL AS researcher_google, c.expert_google_at IS NOT NULL AS expert_google,
           c.ended_at, c.end_reason, xu.nickname AS ended_by_nickname,
           {TODAY_KST} AS today,
           ru.user_id AS r_id, ru.nickname AS r_nickname, ru.user_photo AS r_photo,
           rp.institution_name AS r_institution, rp.department AS r_department, rp.position AS r_position,
           eu.user_id AS e_id, eu.nickname AS e_nickname, eu.user_photo AS e_photo,
           e.current_job AS e_job, e.ai_career AS e_career, e.affiliation AS e_affiliation, e.introduce AS e_introduce
    FROM collaboration c
    JOIN research rs ON rs.research_id = c.research_id
    JOIN users ru ON ru.user_id = rs.user_id
    LEFT JOIN researcher_profile rp ON rp.user_id = rs.user_id
    JOIN users eu ON eu.user_id = c.expert_id
    LEFT JOIN expert e ON e.user_id = c.expert_id
    LEFT JOIN users xu ON xu.user_id = c.ended_by
    WHERE c.collaboration_id = %s
"""

SCHEDULES_SQL = f"""
    SELECT {SCHEDULE_COLUMNS}, cu.nickname AS created_by_nickname, uu.nickname AS updated_by_nickname
    FROM collaboration_schedule s
    LEFT JOIN users cu ON cu.user_id = s.created_by
    LEFT JOIN users uu ON uu.user_id = s.updated_by
    WHERE s.collaboration_id = %s
    ORDER BY s.start_date, s.start_time NULLS FIRST, s.schedule_id
"""

# 요청: 진행 중 → 기한 빠른 순 (기한 없는 건 뒤) → 오래된 순
TASKS_SQL = """
    SELECT t.task_id, t.requested_by, t.assignee, t.content, t.due_date, t.status, t.closed_at,
           t.source, t.created_at, ru.nickname AS requested_by_nickname, au.nickname AS assignee_nickname
    FROM collaboration_task t
    JOIN users ru ON ru.user_id = t.requested_by
    JOIN users au ON au.user_id = t.assignee
    WHERE t.collaboration_id = %s
    ORDER BY (t.status = 'open') DESC, t.due_date NULLS LAST, t.task_id
"""

# 정한 것: 최근 것부터 (화면에서 번호를 붙여 보여 줘요)
DECISIONS_SQL = """
    SELECT d.decision_id, d.proposed_by, d.content, d.status, d.answered_at, d.answer_note,
           d.replaces_id, d.source, d.created_at, pu.nickname AS proposed_by_nickname
    FROM collaboration_decision d
    JOIN users pu ON pu.user_id = d.proposed_by
    WHERE d.collaboration_id = %s
    ORDER BY d.decision_id DESC
"""

# 기간 연장 · 조기 완료 요청: 최근 것부터. 3일이 지난 '기다림'은 아직 만료 처리 전이어도 지난 걸로 봐요
CHANGES_SQL = """
    SELECT ch.change_id, ch.kind, ch.requested_by, ch.old_end_date, ch.new_end_date, ch.reason,
           ch.status, ch.answer_note, ch.expires_at, ch.answered_at, ch.created_at,
           ch.status = 'pending' AND ch.expires_at < now() AS overdue,
           u.nickname AS requested_by_nickname
    FROM collaboration_change ch
    JOIN users u ON u.user_id = ch.requested_by
    WHERE ch.collaboration_id = %s
    ORDER BY ch.change_id DESC
"""


def load_detail(user_id: int, collaboration_id: int) -> dict:
    """협업 상세 화면 한 장. 내 협업이 아니면 404 (find_collaboration)."""
    with get_connection() as conn, conn.cursor() as cursor:
        complete_ended_collaborations(cursor)
        side = find_collaboration(cursor, user_id, collaboration_id)["my_side"]
        cursor.execute(COLLAB_SQL, (collaboration_id,))
        row = cursor.fetchone()
        rows = {}
        for name, sql in (("schedules", SCHEDULES_SQL), ("tasks", TASKS_SQL), ("decisions", DECISIONS_SQL), ("changes", CHANGES_SQL)):
            cursor.execute(sql, (collaboration_id,))
            rows[name] = cursor.fetchall()
    return build_detail(row, side, user_id, **rows)


def build_detail(row: dict, side: str, user_id: int, schedules: list, tasks: list, decisions: list, changes: list) -> dict:
    """DB에서 읽은 줄들 → 화면의 CollaborationDetail 모양. "나"를 기준으로 방향(받은/보낸)을 붙여요."""
    researcher = {
        "user_id": row["r_id"],
        "nickname": row["r_nickname"],
        "user_photo": row["r_photo"],
        "role": "researcher",
        "institution_name": row["r_institution"],
        "department": row["r_department"],
        "position": row["r_position"],
    }
    expert = {
        "user_id": row["e_id"],
        "nickname": row["e_nickname"],
        "user_photo": row["e_photo"],
        "role": "expert",
        "current_job": row["e_job"],
        "ai_career": row["e_career"],
        "affiliation": row["e_affiliation"],
        "introduce": row["e_introduce"],
    }
    me, partner = (researcher, expert) if side == "researcher" else (expert, researcher)
    google_linked = row["researcher_google"] if side == "researcher" else row["expert_google"]
    open_changes = [change for change in changes if change["status"] == "pending" and not change["overdue"]]

    return {
        "collaboration": {
            "collaboration_id": row["collaboration_id"],
            "research": {"title": row["agreement"].get("title", "")},
            "status": screen_status(row["status"], row["start_date"], row["today"]),
            "start_date": row["start_date"],
            "end_date": row["end_date"],
            "confirmed_on": row["confirmed_on"],
            "today": row["today"],  # 한국 날짜. 화면의 D-day·타임라인 '오늘'을 서버와 맞춰요
            "my_side": side,
            "me": me,
            "partner": partner,
            "discord_channel_url": (
                channel_url(row["discord_channel_id"]) if row["discord_status"] in ("ready", "closed") else None
            ),
            "google_linked": google_linked,
            "google_calendar_url": add_calendar_url(row["google_calendar_id"]) if google_linked else None,
            "ended_at": row["ended_at"],
            "ended_by_nickname": row["ended_by_nickname"],
            "end_reason": row["end_reason"],
        },
        "agreement": row["agreement"],
        "schedules": schedules,
        "tasks": [{**task, "direction": "in" if task["assignee"] == user_id else "out"} for task in tasks],
        "decisions": [{**decision, "mine": decision["proposed_by"] == user_id} for decision in decisions],
        # 답 기다리는 연장·조기 완료 요청 (협업당 하나). 내가 보냈으면 mine=True → [철회], 아니면 [수락]·[다시 얘기해요]
        "pending_change": (
            {**open_changes[0], "mine": open_changes[0]["requested_by"] == user_id} if open_changes else None
        ),
        # 기간이 바뀐 기록 (수락된 연장): "12.31 → 1.16"
        "extensions": [change for change in changes if change["kind"] == "extend" and change["status"] == "accepted"],
        "google_enabled": google_login_ready(),
    }