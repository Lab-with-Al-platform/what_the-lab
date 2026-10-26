"""알림 저장·읽기 (사이트 안 알림 종). 디스코드 DM은 이 표를 보고 따로 보냅니다.

문구는 저장하지 않고, 알림 종류(type)와 관련 협업 요청으로 읽을 때 만듭니다.
"""

from datetime import timedelta

from fastapi import HTTPException

from app.db import get_connection
from app.request_rules import KST

RECENT_DAYS = 30  # 최근 며칠 알림만 보여 줄까 (지우지는 않아요)
LIST_LIMIT = 50  # 한 번에 보여 줄 최대 개수

# 받는 사람이 누구인지에 따라 나눈 알림 종류
TO_EXPERT = {"request_received", "request_canceled"}  # 연구회원이 한 일 → 전문가에게
TO_RESEARCHER = {"request_accepted", "request_rejected", "request_withdrawn"}  # 전문가가 한 일 → 연구회원에게
TO_BOTH = {"request_expired", "collab_started"}  # 둘 다에게 (서로가 상대방)

# 거절 사유 (프론트 REJECT_REASON_LABELS와 같은 문구)
REJECT_LABELS = {
    "schedule": "일정이 맞지 않아요",
    "field_mismatch": "맡길 일이 제 분야와 달라요",
    "data_terms": "데이터 공유 조건을 지키기 어려워요",
    "other": "기타",
}

# 협업 요청 1건에서 받는 사람(user_id)·일으킨 사람(actor_id)을 뽑는 SELECT
TO_EXPERT_SQL = """
    SELECT cr.expert_id, %(type)s, r.user_id, cr.request_id
    FROM collaboration_request cr JOIN research r ON r.research_id = cr.research_id
    WHERE cr.request_id = ANY(%(ids)s)
"""
TO_RESEARCHER_SQL = """
    SELECT r.user_id, %(type)s, cr.expert_id, cr.request_id
    FROM collaboration_request cr JOIN research r ON r.research_id = cr.research_id
    WHERE cr.request_id = ANY(%(ids)s)
"""

# 같은 사람·같은 종류·같은 요청 알림이 이미 있으면 새 알림처럼 다시 띄웁니다.
# (예: 만료된 요청을 다시 보내면 '요청 도착' 알림이 안 읽음으로 맨 위에 다시 와요)
UPSERT_SQL = """
    INSERT INTO notification (user_id, type, actor_id, request_id)
    {source}
    ON CONFLICT (user_id, type, request_id) WHERE request_id IS NOT NULL
    DO UPDATE SET actor_id = EXCLUDED.actor_id, created_at = now(), read_at = NULL,
        discord_status = 'pending', discord_attempts = 0,
        discord_sent_at = NULL, discord_error = NULL
"""


def notify_requests(cursor, type_: str, request_ids: list[int]) -> None:
    """협업 요청 여러 건에 대해 알림을 한 번에 저장합니다. 요청을 바꾼 같은 트랜잭션 안에서 부릅니다.

    type_: 알림 종류 (TO_EXPERT / TO_RESEARCHER / TO_BOTH 중 하나)
    request_ids: 알림을 만들 협업 요청 번호들 (비어 있으면 아무것도 안 함)
    """
    if not request_ids:
        return
    if type_ in TO_EXPERT:
        source = TO_EXPERT_SQL
    elif type_ in TO_RESEARCHER:
        source = TO_RESEARCHER_SQL
    elif type_ in TO_BOTH:
        source = f"{TO_EXPERT_SQL} UNION ALL {TO_RESEARCHER_SQL}"
    else:
        raise ValueError(f"모르는 알림 종류: {type_}")
    cursor.execute(UPSERT_SQL.format(source=source), {"type": type_, "ids": request_ids})


# ---------- 읽기 ----------
def build_message(row: dict, user_id: int) -> tuple[str, str]:
    """알림 한 줄 → (제목, 작은 설명). 받는 사람이 전문가인지 연구회원인지에 따라 문구가 달라요.

    row: type, actor_nickname, research_title, reject_reason, expert_id, request_status,
         is_urgent, expires_at, accepted_start_date, cancel_reason, responded_at 를 담은 dict
    """
    actor = row["actor_nickname"] or "탈퇴한 회원"
    title = row["research_title"] or "삭제된 연구"
    to_expert = row["expert_id"] == user_id
    kind = row["type"]
    if kind == "request_received":
        # 아직 답을 기다리는 요청일 때만 기한 안내를 붙여요. (이미 수락·거절했으면 연구 제목만)
        if row.get("request_status") != "pending":
            return f"{actor} 님이 협업을 요청했어요", title
        deadline = deadline_text(row.get("expires_at"))
        if row.get("is_urgent"):
            return f"🔥 {actor} 님이 급한 협업을 요청했어요", f"{title} · {deadline}까지 답해 주세요"
        return f"{actor} 님이 협업을 요청했어요", f"{title} · {deadline}까지 답해 주세요"
    if kind == "request_accepted":
        if row.get("accepted_start_date"):
            return f"{actor} 님이 기간을 조정해서 수락했어요", title
        return f"{actor} 님이 협업 요청을 수락했어요", title
    if kind == "request_rejected":
        reason = REJECT_LABELS.get(row["reject_reason"], title)
        return f"{actor} 님이 협업 요청을 거절했어요", reason
    if kind == "request_withdrawn":
        return f"{actor} 님이 수락을 취소했어요", title
    if kind == "request_canceled":
        reason = row.get("cancel_reason")
        if reason == "declined":
            return f"{actor} 님이 이번 협업은 진행하지 않기로 했어요", title
        if reason == "other_started":
            return f"{actor} 님의 연구는 협업 인원이 다 찼어요", title
        return f"{actor} 님이 보낸 요청을 취소했어요", title
    if kind == "request_expired":
        if row.get("responded_at"):  # 수락했는데 연구자가 기한 안에 시작하지 않았어요
            if to_expert:
                return f"{actor} 님이 기한 안에 협업을 시작하지 않아 요청이 만료됐어요", title
            return f"{actor} 님이 수락한 요청이 시작 기한이 지나 만료됐어요", title
        if to_expert:
            return f"{actor} 님의 요청이 답이 없어 만료됐어요", title
        return f"{actor} 님에게 보낸 요청이 답이 없어 만료됐어요", title
    if kind == "collab_started":
        return f"{actor} 님과 협업을 시작했어요", title
    return "새 알림이 있어요", title


def deadline_text(when) -> str:
    """기한(다음 날 0시 등) → '10.25 밤' / '10.25 14:30' (한국 시간)"""
    if when is None:
        return "기한 안"
    local = when.astimezone(KST)
    if local.hour == 0 and local.minute == 0:  # 'n일 밤까지' 기한
        day = local - timedelta(days=1)
        return f"{day.month}.{day.day} 밤"
    return f"{local.month}.{local.day} {local:%H:%M}"

def load_notifications(user_id: int) -> list[dict]:
    """내 알림 목록 (최근 30일, 최신순 50개)."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT n.notification_id, n.type, n.read_at, n.created_at,
                   a.nickname AS actor_nickname, r.title AS research_title,
                   cr.reject_reason, cr.expert_id, cr.status AS request_status,
                   cr.is_urgent, cr.expires_at, cr.accepted_start_date, cr.cancel_reason,
                   cr.responded_at
            FROM notification n
            LEFT JOIN users a ON a.user_id = n.actor_id
            LEFT JOIN collaboration_request cr ON cr.request_id = n.request_id
            LEFT JOIN research r ON r.research_id = cr.research_id
            WHERE n.user_id = %s AND n.created_at >= now() - make_interval(days => %s)
            ORDER BY n.created_at DESC, n.notification_id DESC
            LIMIT %s
            """,
            (user_id, RECENT_DAYS, LIST_LIMIT),
        )
        rows = cursor.fetchall()

    items = []
    for row in rows:
        title, detail = build_message(row, user_id)
        items.append(
            {
                "notification_id": row["notification_id"],
                "type": row["type"],
                "title": title,
                "detail": detail,
                "link": "/requests",  # 지금은 모두 요청관리. 협업공간이 생기면 collab_started는 그쪽으로
                "read": row["read_at"] is not None,
                "created_at": row["created_at"],
            }
        )
    return items


def count_unread(user_id: int) -> int:
    """안 읽은 알림 수 (헤더 종 숫자). 목록과 같은 30일 기준."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            "SELECT count(*) AS count FROM notification"
            " WHERE user_id = %s AND read_at IS NULL"
            " AND created_at >= now() - make_interval(days => %s)",
            (user_id, RECENT_DAYS),
        )
        return cursor.fetchone()["count"]


def mark_read(user_id: int, notification_id: int) -> None:
    """알림 하나를 읽음으로. 내 알림이 아니거나 없으면 404."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            "UPDATE notification SET read_at = COALESCE(read_at, now())"
            " WHERE notification_id = %s AND user_id = %s",
            (notification_id, user_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="알림을 찾을 수 없어요")


def mark_all_read(user_id: int) -> None:
    """내 안 읽은 알림을 모두 읽음으로."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            "UPDATE notification SET read_at = now() WHERE user_id = %s AND read_at IS NULL",
            (user_id,),
        )

# ---------- 알림 설정 (notification_setting) ----------
def mark_discord_joined(user_id: int) -> None:
    """LabBridge 서버에 참가했다고 기록해요. 줄이 없으면 만들고, DM 막힘 표시는 지워요."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            "INSERT INTO notification_setting (user_id, discord_joined_at) VALUES (%s, now())"
            " ON CONFLICT (user_id) DO UPDATE"
            " SET discord_joined_at = now(), discord_blocked_at = NULL",
            (user_id,),
        )



def load_setting(user_id: int) -> dict:
    """내 알림 설정. 줄이 없으면 기본값(모두 켜짐, 연결 안 됨)이에요."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            "SELECT discord_dm, notify_request, notify_workspace, discord_joined_at,"
            " discord_blocked_at FROM notification_setting WHERE user_id = %s",
            (user_id,),
        )
        row = cursor.fetchone()
    return row or {
        "discord_dm": True,
        "notify_request": True,
        "notify_workspace": True,
        "discord_joined_at": None,
        "discord_blocked_at": None,
    }


def save_setting(user_id: int, discord_dm: bool, notify_request: bool, notify_workspace: bool):
    """켜기/끄기 3개를 저장해요. 줄이 없으면 만들어요. (참가·막힘 기록은 건드리지 않아요)"""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            "INSERT INTO notification_setting (user_id, discord_dm, notify_request, notify_workspace)"
            " VALUES (%s, %s, %s, %s)"
            " ON CONFLICT (user_id) DO UPDATE SET discord_dm = EXCLUDED.discord_dm,"
            " notify_request = EXCLUDED.notify_request,"
            " notify_workspace = EXCLUDED.notify_workspace",
            (user_id, discord_dm, notify_request, notify_workspace),
        )


def set_dm_blocked(user_id: int, blocked: bool) -> None:
    """DM이 막혔으면 시각을 남기고, 다시 받을 수 있으면 지워요."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            "UPDATE notification_setting"
            " SET discord_blocked_at = CASE WHEN %s THEN now() ELSE NULL END WHERE user_id = %s",
            (blocked, user_id),
        )        
