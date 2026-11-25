"""진행 중 협업 마무리 (웹에서만): 기간 연장 · 조기 완료 · 협업 중단. 끝난 협업의 채널 정리.

- 기간 연장: 한 명이 요청(새 종료일 + 사유) → 상대 [수락] / [다시 얘기해요](거절). 한 번에 최대 MAX_EXTEND_DAYS 일, 여러 번 가능
- 조기 완료: 진행 중인 요청 0개 + 오늘 이후 남은 일정 0개일 때만. 한 명이 요청 → 상대 [수락하고 완료] / [다시 얘기해요]
  → 수락하면 '완료'(정상 완료와 같음), 두 사람에게 평가 알림
- 협업 중단: 한 명이 바로. 사유(STOP_REASONS) + 남길 말 필수 → '중단'(ended_early), 누가 중단했는지(ended_by) 남김
  → 중단당한 사람에게만 평가 알림 (중단한 사람은 평가하지 않아요 · app/review_store.py)
- 답을 기다리는 요청은 협업마다 하나 (DB 규칙 uq_change_one_pending). 답 기한 3일, 종료일이 더 빠르면 종료일 다음 날 0시까지
- 디스코드는 알림만 (버튼 없음, 웹 링크). 시작일 미루기만 디스코드 버튼이 있어요 (app/discord_waiting.py)

끝난 협업(완료 · 중단)의 채널은 close_finished_channels 가 15초마다: 마지막 메시지 → 잠금 → CHANNEL_KEEP_DAYS 뒤 삭제
(자동 완료도 같이 처리돼요. 시작 전 취소는 app/collab_waiting.py 가 바로 잠가요)
"""

import logging
from datetime import date, datetime, time, timedelta

import httpx
from fastapi import HTTPException
from pydantic import BaseModel

from app.collab_waiting import CHANNEL_KEEP_DAYS, save_notice, short
from app.config import FRONTEND_URL
from app.db import get_connection, transaction
from app.discord_bot import bot_ready, lock_member
from app.form_rules import bad_request, optional_text, required_text
from app.google_sync import sync_marks, today_kst
from app.schedule_notice import collab_people
from app.task_sync import mention, retry_once, send_message
from app.task_text import KST, day_text
from app.workspace_store import expire_changes, find_collaboration

log = logging.getLogger("labbridge.collab_ending")

STOP_REASONS = {
    "contact": "상대와 연락이 잘 안 돼요",
    "terms": "협업 범위 · 조건이 처음과 달라졌어요",
    "personal": "개인 사정 · 일정 문제로 더 진행하기 어려워요",
    "result": "결과물이 기대와 많이 달라요",
    "other": "기타",
}
MAX_EXTEND_DAYS = 30  # 한 번에 최대 며칠까지 늘릴 수 있나 (여러 번 가능)
MAX_TEXT = 200  # 사유 · 한마디 · 남길 말 · 다시 얘기해요 이유
ANSWER_DAYS = 3  # 연장 · 조기 완료 요청에 답할 기한
RECENT_END_DAYS = 1  # 이만큼 안에 끝난 협업의 채널만 정리해요 (예전에 끝난 협업의 채널은 건드리지 않아요)


class ExtendInput(BaseModel):
    end_date: date  # 새 종료일 (지금 종료일 다음 날 ~ +30일)
    reason: str  # 사유 (필수, 200자)


class CompleteInput(BaseModel):
    note: str = ""  # 한마디 (선택, 200자)


class StopInput(BaseModel):
    reason: str  # contact / terms / personal / result / other (STOP_REASONS)
    text: str  # 상대에게 남길 말 (필수, 200자)


# ---------- 공통 ----------
def check_active(collab: dict, today: date) -> None:
    """연장 · 조기 완료 · 중단은 진행 중(시작일 ~ 종료일)에만"""
    if collab["status"] != "ongoing":
        raise HTTPException(status_code=409, detail="이미 끝난 협업이에요")
    if today < collab["start_date"]:
        raise HTTPException(status_code=409, detail="시작 전 협업은 시작일 미루기 · 협업 취소만 할 수 있어요")


def answer_deadline(now: datetime, end: date) -> datetime:
    """답할 기한: 지금부터 3일, 종료일 다음 날 0시(한국)가 더 빠르면 그때까지 (끝나면 바꿀 수 없으니까)"""
    after_end = datetime.combine(end + timedelta(days=1), time(0), tzinfo=KST)
    return min(now + timedelta(days=ANSWER_DAYS), after_end)


def check_extend(old_end: date, new_end: date) -> None:
    """늘릴 수 있는 날인지 (DB 없이 · 테스트: tests/test_collab_ending.py)"""
    if new_end <= old_end:
        raise bad_request("새 종료일은 지금 종료일보다 뒤로 골라 주세요")
    if (new_end - old_end).days > MAX_EXTEND_DAYS:
        last = old_end + timedelta(days=MAX_EXTEND_DAYS)
        raise bad_request(f"한 번에 {MAX_EXTEND_DAYS}일까지 늘릴 수 있어요 ({day_text(last)}까지)")


def complete_blockers(cursor, collaboration_id: int, today: date) -> dict:
    """조기 완료를 막는 것: 진행 중인 요청 수 · 오늘 이후 남은 일정 수 (둘 다 0이어야 해요)"""
    cursor.execute(
        """
        SELECT (SELECT count(*) FROM collaboration_task WHERE collaboration_id = %(c)s AND status = 'open') AS open_tasks,
               (SELECT count(*) FROM collaboration_schedule WHERE collaboration_id = %(c)s AND end_date >= %(t)s)
                 AS upcoming_schedules
        """,
        {"c": collaboration_id, "t": today},
    )
    return cursor.fetchone()


def blockers_text(blockers: dict) -> str | None:
    """조기 완료를 막는 이유 글자 (없으면 None)"""
    parts = []
    if blockers["open_tasks"]:
        parts.append(f"진행 중인 요청 {blockers['open_tasks']}개")
    if blockers["upcoming_schedules"]:
        parts.append(f"남은 일정 {blockers['upcoming_schedules']}개")
    if not parts:
        return None
    return f"{' · '.join(parts)}를 먼저 끝내거나 지워 주세요"


def check_no_pending(cursor, collaboration_id: int) -> None:
    """답을 기다리는 요청(연장 · 조기 완료)은 협업마다 하나"""
    expire_changes(cursor, collaboration_id)
    cursor.execute(
        "SELECT 1 FROM collaboration_change WHERE collaboration_id = %s AND status = 'pending'", (collaboration_id,)
    )
    if cursor.fetchone():
        raise HTTPException(status_code=409, detail="답을 기다리는 요청이 있어요. 답을 받은 뒤 다시 요청해 주세요")


def detail_link(collaboration_id: int) -> str:
    return f"{FRONTEND_URL}/workspace/{collaboration_id}"


# ---------- 기간 연장 · 조기 완료 요청 ----------
def request_extend(user_id: int, collaboration_id: int, body: ExtendInput) -> dict:
    """[기간 연장 요청]: 새 종료일 + 사유. 상대에게 알림 종 + 채널 멘션(웹 링크)."""
    reason = required_text(body.reason, MAX_TEXT, "사유")
    with transaction() as cursor:
        collab = find_collaboration(cursor, user_id, collaboration_id, lock=True)
        check_active(collab, today_kst())
        check_no_pending(cursor, collaboration_id)
        old_end = collab["end_date"]
        check_extend(old_end, body.end_date)
        expires = answer_deadline(datetime.now(KST), old_end)
        cursor.execute(
            """
            INSERT INTO collaboration_change (collaboration_id, kind, requested_by, old_end_date, new_end_date, reason, expires_at)
            VALUES (%s, 'extend', %s, %s, %s, %s, %s) RETURNING change_id
            """,
            (collaboration_id, user_id, old_end, body.end_date, reason, expires),
        )
        change_id = cursor.fetchone()["change_id"]
        people = collab_people(cursor, collaboration_id)
        note = f"{short(old_end)} → {short(body.end_date)} · {reason}"
        notice = save_notice(cursor, people, user_id, "extend_requested", note)
    return {**notice, "change_id": change_id, "deadline": expires}


def request_complete(user_id: int, collaboration_id: int, body: CompleteInput) -> dict:
    """[조기 완료 요청]: 진행 중인 요청 · 남은 일정이 없을 때만. 한마디는 선택."""
    note = optional_text(body.note, MAX_TEXT, "한마디")
    today = today_kst()
    with transaction() as cursor:
        collab = find_collaboration(cursor, user_id, collaboration_id, lock=True)
        check_active(collab, today)
        blocked = blockers_text(complete_blockers(cursor, collaboration_id, today))
        if blocked:
            raise HTTPException(status_code=409, detail=blocked)
        check_no_pending(cursor, collaboration_id)
        expires = answer_deadline(datetime.now(KST), collab["end_date"])
        cursor.execute(
            """
            INSERT INTO collaboration_change (collaboration_id, kind, requested_by, old_end_date, reason, expires_at)
            VALUES (%s, 'complete', %s, %s, %s, %s) RETURNING change_id
            """,
            (collaboration_id, user_id, collab["end_date"], note or None, expires),
        )
        change_id = cursor.fetchone()["change_id"]
        people = collab_people(cursor, collaboration_id)
        notice = save_notice(cursor, people, user_id, "complete_requested", note or "할 일을 다 끝냈어요")
    return {**notice, "change_id": change_id, "deadline": expires}


# ---------- 답하기 (연장 · 조기 완료) ----------
def change_kind(change_id: int) -> str | None:
    """요청 종류 (start · extend · complete). 없으면 None. [수락] · [다시 얘기해요] API가 어느 함수로 보낼지 정할 때 써요"""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("SELECT kind FROM collaboration_change WHERE change_id = %s", (change_id,))
        row = cursor.fetchone()
    return row["kind"] if row else None


def find_change(cursor, user_id: int, change_id: int) -> tuple[dict, dict]:
    """연장 · 조기 완료 요청 하나 + 내 협업인지 (남의 것이면 404). 협업 → 요청 순서로 잠가요."""
    cursor.execute("SELECT collaboration_id, kind FROM collaboration_change WHERE change_id = %s", (change_id,))
    found = cursor.fetchone()
    if found is None or found["kind"] not in ("extend", "complete"):
        raise HTTPException(status_code=404, detail="요청을 찾을 수 없어요")
    collab = find_collaboration(cursor, user_id, found["collaboration_id"], lock=True)
    cursor.execute(
        "SELECT change_id, collaboration_id, kind, requested_by, status, expires_at, old_end_date, new_end_date, reason"
        " FROM collaboration_change WHERE change_id = %s FOR UPDATE",
        (change_id,),
    )
    change = cursor.fetchone()
    if change["status"] != "pending" or change["expires_at"] < datetime.now(KST):
        raise HTTPException(status_code=409, detail="이미 답했거나 기한이 지난 요청이에요")
    if change["requested_by"] == user_id:
        raise HTTPException(status_code=403, detail="요청을 받은 사람만 답할 수 있어요")
    return change, collab


def answer_change(user_id: int, change_id: int, accept: bool, note: str = "") -> dict:
    """[수락] / [다시 얘기해요](거절): 요청을 받은 사람만. 요청한 사람에게 알려요.

    연장 수락 → 종료일 변경 / 조기 완료 수락 → '완료' + 두 사람에게 평가 알림 (채널 정리는 close_finished_channels)
    """
    note = optional_text(note, MAX_TEXT, "이유") or ""
    today = today_kst()
    with transaction() as cursor:
        change, collab = find_change(cursor, user_id, change_id)
        check_active(collab, today)
        cid = change["collaboration_id"]
        if accept and change["kind"] == "complete":
            blocked = blockers_text(complete_blockers(cursor, cid, today))
            if blocked:  # 요청한 뒤 새 요청 · 일정이 생겼을 수 있어요
                raise HTTPException(status_code=409, detail=f"완료할 수 없어요 · {blocked}")
            cursor.execute(
                "UPDATE collaboration SET status = 'done', ended_at = now() WHERE collaboration_id = %s RETURNING request_id",
                (cid,),
            )
            request_id = cursor.fetchone()["request_id"]
            from app.notification_store import notify_requests  # 서로 불러오지 않게 여기서

            notify_requests(cursor, "review_ready", [request_id])
        elif accept:
            cursor.execute("UPDATE collaboration SET end_date = %s WHERE collaboration_id = %s", (change["new_end_date"], cid))
        cursor.execute(
            "UPDATE collaboration_change SET status = %s, answered_at = now(), answer_note = %s WHERE change_id = %s",
            ("accepted" if accept else "declined", note or None, change_id),
        )
        people = collab_people(cursor, cid)
        if change["kind"] == "extend":
            moved = f"{short(change['old_end_date'])} → {short(change['new_end_date'])}"
            type_ = "extend_accepted" if accept else "extend_declined"
            notice = save_notice(cursor, people, user_id, type_, moved + (f" · {note}" if note and not accept else ""))
        elif accept:
            notice = {"collaboration_id": cid, "type": "complete_accepted", "channel": None}  # 알림은 review_ready
        else:
            notice = save_notice(cursor, people, user_id, "complete_declined", note or "조기 완료")
    return {**notice, "kind": change["kind"], "accept": accept, "new_end": change["new_end_date"]}


# ---------- 협업 중단 ----------
def stop_collaboration(user_id: int, collaboration_id: int, body: StopInput) -> dict:
    """[협업 중단]: 한 명이 바로. 사유 + 남길 말 필수. 중단당한 사람에게만 평가 알림."""
    if body.reason not in STOP_REASONS:
        raise bad_request("중단 사유를 골라 주세요")
    text = required_text(body.text, MAX_TEXT, "상대에게 남길 말")
    reason = f"{STOP_REASONS[body.reason]} · {text}"
    with transaction() as cursor:
        collab = find_collaboration(cursor, user_id, collaboration_id, lock=True)
        check_active(collab, today_kst())
        cursor.execute(
            "UPDATE collaboration SET status = 'ended_early', ended_at = now(), ended_by = %s, end_reason = %s"
            " WHERE collaboration_id = %s RETURNING request_id",
            (user_id, reason[:300], collaboration_id),
        )
        request_id = cursor.fetchone()["request_id"]
        # 남아 있던 요청은 "협업 종료로 마감" 기록, 답을 기다리던 연장 · 조기 완료 요청은 철회로 닫아요
        cursor.execute(
            "INSERT INTO collaboration_task_event (task_id, actor_id, kind, source)"
            " SELECT task_id, NULL, 'ended', 'web' FROM collaboration_task WHERE collaboration_id = %s AND status = 'open'",
            (collaboration_id,),
        )
        cursor.execute(
            "UPDATE collaboration_change SET status = 'withdrawn', answered_at = now()"
            " WHERE collaboration_id = %s AND status = 'pending'",
            (collaboration_id,),
        )
        people = collab_people(cursor, collaboration_id)
        notice = save_notice(cursor, people, user_id, "collab_stopped", reason)
        # 평가 알림은 중단당한 사람에게만 (중단한 사람은 평가하지 않아요)
        partner = people["expert_id"] if people["researcher_id"] == user_id else people["researcher_id"]
        cursor.execute(
            """
            INSERT INTO notification (user_id, type, actor_id, request_id)
            VALUES (%s, 'review_ready', %s, %s)
            ON CONFLICT (user_id, type, request_id) WHERE request_id IS NOT NULL DO NOTHING
            """,
            (partner, user_id, request_id),
        )
    return notice


# ---------- 응답을 보낸 뒤: 채널 · 구글 ----------
def request_text(notice: dict) -> str:
    """채널 메시지 (연장 · 조기 완료 요청과 답). 버튼 없이 웹 링크로 답해요."""
    who = f"<@{notice['to']}> " if notice.get("to") else ""
    link = detail_link(notice["collaboration_id"])
    kind = notice["type"]
    if kind in ("extend_requested", "complete_requested"):
        deadline = notice["deadline"].astimezone(KST)
        what = "기간 연장을" if kind == "extend_requested" else "조기 완료를"
        return (
            f"⏩ {who}{notice['actor']} 님이 {what} 요청했어요 · {notice['note']}\n"
            f"{deadline.month}.{deadline.day} {deadline:%H:%M}까지 웹에서 답해 주세요 → {link}"
        )
    if kind == "extend_accepted":
        return f"⏩ {who}{notice['actor']} 님이 기간 연장을 수락했어요 · 협업이 **{day_text(notice['new_end'])}**까지로 바뀌었어요"
    what = "기간 연장" if kind == "extend_declined" else "조기 완료"
    return f"💬 {who}{notice['actor']} 님이 {what}에 [다시 얘기해요]를 눌렀어요 · {notice['note']} · 채널에서 얘기해 보세요"


def after_change(notice: dict) -> None:
    """응답을 보낸 뒤: 채널에 올리고(상대 멘션), 연장이 수락되면 구글의 협업 종료일 표시를 옮겨요."""
    channel = notice.get("channel")
    if bot_ready() and channel:
        try:
            people = [notice["to"]] if notice.get("to") else []
            retry_once(send_message, channel, request_text(notice), mentions=mention(*people))
        except httpx.HTTPError as error:
            log.warning("협업 %s 요청 메시지 실패: %s", notice["collaboration_id"], error)
    if notice.get("type") == "extend_accepted":
        try:
            sync_marks(today_kst(), notice["collaboration_id"])
        except httpx.HTTPError as error:
            log.warning("협업 %s 구글 종료일 맞추기 실패: %s", notice["collaboration_id"], error)


# ---------- 끝난 협업 채널 정리 (완료 · 조기 완료 · 중단, 15초마다) ----------
FINISHED_SQL = """
    SELECT c.collaboration_id, c.status, c.end_reason, c.discord_channel_id, c.ended_by,
           rs.user_id AS researcher_id, c.expert_id,
           ru.discord_id AS researcher_discord_id, eu.discord_id AS expert_discord_id,
           ru.nickname AS researcher_name, eu.nickname AS expert_name
    FROM collaboration c
    JOIN research rs ON rs.research_id = c.research_id
    JOIN users ru ON ru.user_id = rs.user_id
    JOIN users eu ON eu.user_id = c.expert_id
    WHERE c.status IN ('done', 'ended_early') AND c.discord_status = 'ready' AND c.discord_channel_id IS NOT NULL
      AND c.ended_at >= now() - make_interval(days => %s)
    ORDER BY c.ended_at
    LIMIT 10
    FOR UPDATE OF c SKIP LOCKED
"""


def finished_text(row: dict, delete_on: date) -> str:
    """끝난 협업 채널의 마지막 메시지 (두 사람 멘션 + 평가 안내 + 삭제 날짜)"""
    people = " ".join(f"<@{d}>" for d in (row["researcher_discord_id"], row["expert_discord_id"]) if d)
    link = detail_link(row["collaboration_id"])
    keep = f"이 채널은 **{day_text(delete_on)}**에 삭제돼요. 필요한 파일은 그 전에 받아 두세요."
    if row["status"] == "done":
        return f"🎉 {people} 협업이 완료됐어요! 수고 많으셨어요\n⭐ 30일 안에 서로 평가를 남겨 주세요 → {link}\n{keep}"
    stopper = row["researcher_name"] if row["ended_by"] == row["researcher_id"] else row["expert_name"]
    return (
        f"⛔ {people} {stopper} 님이 협업을 중단했어요\n사유: {row['end_reason'] or ''}\n"
        f"⭐ 상대에게 평가를 남길 수 있어요 (중단한 분은 제외) → {link}\n{keep}"
    )


def close_finished_channels() -> int:
    """방금 끝난 협업의 채널: 마지막 메시지 → 두 사람 잠금 → 2일 뒤 삭제 예약. 처리한 개수를 돌려줘요.

    자동 완료(종료일 지남) · 조기 완료 · 중단을 한곳에서 처리해요. 디스코드가 안 되면 다음 차례에 다시.
    예전에 끝난 협업(RECENT_END_DAYS 보다 오래전)의 채널은 건드리지 않아요.
    """
    if not bot_ready():
        return 0
    done = 0
    with get_connection() as conn, conn.transaction(), conn.cursor() as cursor:
        cursor.execute(FINISHED_SQL, (RECENT_END_DAYS,))
        for row in cursor.fetchall():
            channel = row["discord_channel_id"]
            delete_on = (datetime.now(KST) + timedelta(days=CHANNEL_KEEP_DAYS)).date()
            people = [d for d in (row["researcher_discord_id"], row["expert_discord_id"]) if d]
            try:
                retry_once(send_message, channel, finished_text(row, delete_on), mentions=mention(*people))
            except httpx.HTTPError as error:
                log.warning("협업 %s 마지막 메시지 실패 (다음 차례에 다시): %s", row["collaboration_id"], error)
                continue
            for discord_id in people:  # 메시지를 올렸으면 잠그기가 실패해도 다시 올리지 않아요 (2일 뒤 삭제는 그대로)
                try:
                    retry_once(lock_member, channel, discord_id)
                except httpx.HTTPError as error:
                    log.warning("협업 %s 채널 잠그기 실패: %s", row["collaboration_id"], error)
            cursor.execute(
                "UPDATE collaboration SET discord_status = 'closed',"
                " discord_delete_at = now() + make_interval(days => %s) WHERE collaboration_id = %s",
                (CHANNEL_KEEP_DAYS, row["collaboration_id"]),
            )
            done += 1
    return done