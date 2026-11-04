"""시작 전 협업 (요청 수락 ~ 협업 시작일): 협업 취소 · 시작일 미루기 · 전문가가 새 요청을 받을 수 있는지.

시작 전에는 요청 · 일정 · 정한 것을 쓸 수 없어요 (app/workspace_store.py 의 check_started).
그 대신 두 사람은 디스코드 채널에서 대화하고, 여기 있는 두 가지만 할 수 있어요.

- 협업 취소: 둘 중 누구나, 시작일 전까지 바로. 사유(CANCEL_REASONS) + 남길 말 필수
  → 상대에게 알림 종 + 채널 멘션, 채널은 바로 잠그고 CHANNEL_KEEP_DAYS 뒤에 지워요 (app/collab_channel.py)
  → 구글 캘린더의 이 협업 일정을 지우고, 협업은 '취소됨'으로 남겨요 (지우지 않아요. 평가 없음)
- 시작일 미루기: 한 명이 요청 → 상대가 [수락] / [다시 얘기해요]. 요청한 사람은 [철회]
  → 최대 MAX_POSTPONE_DAYS 일, 협업 하나에 한 번만. 종료일도 같은 만큼 밀려요 (기간 길이 그대로)
  → 3일 안에 답이 없거나 시작일이 되면 만료 (app/workspace_store.py 의 expire_changes)
- 전문가 요청 받기: 진행 중 · 시작 전 협업이 없거나, 모든 협업이 AVAILABLE_DAYS 일 안에 끝나야 새 요청을 받아요
  (app/routers/collab_requests.py 가 요청 보낼 때 · 수락할 때 · 협업이 시작될 때 써요)

저장 함수는 (웹 · 디스코드 공통) 같은 트랜잭션에서 상대 알림 종까지 저장하고, 채널에 올릴 정보(notice)를 돌려줘요.
응답을 보낸 뒤 after_cancel · after_postpone(notice) 로 채널에 올려요 (BackgroundTasks).
"""

import logging
from datetime import date, datetime, time, timedelta

import httpx
from fastapi import HTTPException
from pydantic import BaseModel

from app.db import transaction
from app.discord_bot import bot_ready, lock_member
from app.form_rules import bad_request, optional_text, required_text
from app.google_sync import clear_collab_google, sync_marks, today_kst
from app.schedule_notice import collab_people
from app.task_sync import mention, retry_once, send_message
from app.task_text import KST, day_text
from app.workspace_store import expire_changes, find_collaboration

log = logging.getLogger("labbridge.collab_waiting")

CANCEL_REASONS = {
    "schedule": "일정이 맞지 않게 됐어요",
    "terms": "협업 조건(범위 · 보상 · 데이터)이 달라졌어요",
    "contact": "상대와 연락이 잘 안 돼요",
    "other": "기타",
}
MAX_CANCEL_TEXT = 200  # 취소하며 상대에게 남길 말
MAX_POSTPONE_TEXT = 200  # 시작일 미루기 사유
MAX_ANSWER_NOTE = 200  # [다시 얘기해요] 한 줄 이유 (collaboration_change.answer_note)
MAX_POSTPONE_DAYS = 14  # 원래 시작일에서 최대 며칠까지 미룰 수 있나
ANSWER_DAYS = 3  # 시작일 미루기에 답할 기한 (시작일이 더 빠르면 시작일 0시까지)
CHANNEL_KEEP_DAYS = 2  # 취소한 뒤 채널을 며칠 남겨 둘까 (잠근 채로)
AVAILABLE_DAYS = 30  # 전문가: 모든 협업이 이만큼 안에 끝나야 새 요청을 받아요


class CancelInput(BaseModel):
    reason: str  # schedule / terms / contact / other (CANCEL_REASONS)
    text: str  # 상대에게 남길 말 (필수, 200자)


class PostponeInput(BaseModel):
    start_date: date  # 새 시작일 (원래 시작일 뒤 ~ +14일)
    reason: str  # 사유 (필수, 200자)


class AnswerInput(BaseModel):
    note: str = ""  # [다시 얘기해요] 한 줄 이유 (선택, 200자)


# ---------- 공통 ----------
def is_waiting(collab: dict, today: date) -> bool:
    """시작 전 협업인지 (진행 중 상태 + 오늘이 시작일 전)"""
    return collab["status"] == "ongoing" and today < collab["start_date"]


def check_waiting(collab: dict, today: date) -> None:
    """취소 · 시작일 미루기는 시작 전에만 (끝났거나 이미 시작했으면 409)"""
    if collab["status"] != "ongoing":
        raise HTTPException(status_code=409, detail="이미 끝난 협업이에요")
    if not is_waiting(collab, today):
        raise HTTPException(status_code=409, detail="이미 시작한 협업이라 취소 · 시작일 미루기를 할 수 없어요")


def short(day: date) -> str:
    """"11.9" (메시지 안에서 짧게)"""
    return f"{day.month}.{day.day}"


def save_notice(cursor, people: dict, actor_id: int, type_: str, note: str) -> dict:
    """상대에게 알림 종 한 줄 + 채널에 올릴 때 쓸 정보. (app/schedule_notice.py 의 notify_schedule 과 같은 모양)"""
    mine_is_researcher = people["researcher_id"] == actor_id
    partner = people["expert_id"] if mine_is_researcher else people["researcher_id"]
    cursor.execute(
        """
        INSERT INTO notification (user_id, type, actor_id, collaboration_id, note, discord_status, discord_error)
        VALUES (%s, %s, %s, %s, %s, 'skipped', '협업 채널로 알려요')
        """,
        (partner, type_, actor_id, people["collaboration_id"], note[:200]),
    )
    return {
        "collaboration_id": people["collaboration_id"],
        "channel": people["discord_channel_id"],
        "to": people["expert_discord_id"] if mine_is_researcher else people["researcher_discord_id"],
        "members": [people["researcher_discord_id"], people["expert_discord_id"]],
        "actor": people["researcher_name"] if mine_is_researcher else people["expert_name"],
        "type": type_,
        "note": note[:200],
    }


# ---------- 협업 취소 ----------
CANCEL_SQL = """
    UPDATE collaboration
    SET status = 'canceled', ended_at = now(), ended_by = %(user_id)s, end_reason = %(reason)s,
        discord_delete_at = CASE WHEN discord_channel_id IS NOT NULL THEN now() + make_interval(days => %(keep)s) END,
        discord_status = CASE discord_status WHEN 'ready' THEN 'closed' WHEN 'pending' THEN 'skipped' ELSE discord_status END
    WHERE collaboration_id = %(collaboration_id)s
    RETURNING discord_delete_at
"""


def cancel_collaboration(user_id: int, collaboration_id: int, body: CancelInput, source: str = "web") -> dict:
    """[협업 취소] (웹 · 디스코드 공통): 시작 전에만, 둘 중 누구나. 채널에 올릴 정보를 돌려줘요.

    end_reason 에는 "사유 · 남길 말"을 저장해요 (상세 화면 · 상대 알림에 그대로 보여요).
    """
    if body.reason not in CANCEL_REASONS:
        raise bad_request("취소 사유를 골라 주세요")
    text = required_text(body.text, MAX_CANCEL_TEXT, "상대에게 남길 말")
    reason = f"{CANCEL_REASONS[body.reason]} · {text}"
    with transaction() as cursor:
        collab = find_collaboration(cursor, user_id, collaboration_id, lock=True)
        check_waiting(collab, today_kst())
        cursor.execute(
            CANCEL_SQL,
            {"user_id": user_id, "reason": reason[:300], "keep": CHANNEL_KEEP_DAYS, "collaboration_id": collaboration_id},
        )
        delete_at = cursor.fetchone()["discord_delete_at"]
        # 답을 기다리던 시작일 미루기는 철회로 닫아요 (협업이 없어졌으니)
        cursor.execute(
            "UPDATE collaboration_change SET status = 'withdrawn', answered_at = now()"
            " WHERE collaboration_id = %s AND status = 'pending'",
            (collaboration_id,),
        )
        people = collab_people(cursor, collaboration_id)
        notice = save_notice(cursor, people, user_id, "collab_canceled", reason)
    notice["delete_on"] = delete_at.astimezone(KST).date() if delete_at else None
    notice["source"] = source
    return notice


def cancel_text(notice: dict) -> str:
    """채널 마지막 메시지: "❌ <@상대> jiwoo_lab 님이 협업을 취소했어요 …" """
    who = f"<@{notice['to']}> " if notice.get("to") else ""
    lines = [f"❌ {who}{notice['actor']} 님이 협업을 취소했어요", f"사유: {notice['note']}"]
    if notice.get("delete_on"):
        lines.append(f"이 채널은 **{day_text(notice['delete_on'])}**에 삭제돼요. 필요한 파일은 그 전에 받아 두세요.")
    return "\n".join(lines)


def after_cancel(notice: dict) -> None:
    """응답을 보낸 뒤: 채널에 마지막 메시지(상대 멘션 → 폰 알림) → 채널 잠그기 → 구글 일정 지우기.

    하나가 실패해도 나머지는 해요. 채널 삭제는 백그라운드 작업이 discord_delete_at 에 해요.
    """
    channel = notice.get("channel")
    if bot_ready() and channel:
        try:
            people = [notice["to"]] if notice.get("to") else []
            retry_once(send_message, channel, cancel_text(notice), mentions=mention(*people))
        except httpx.HTTPError as error:
            log.warning("협업 %s 취소 메시지 실패: %s", notice["collaboration_id"], error)
        for discord_id in notice.get("members") or []:
            if not discord_id:
                continue
            try:
                retry_once(lock_member, channel, discord_id)
            except httpx.HTTPError as error:
                log.warning("협업 %s 채널 잠그기 실패: %s", notice["collaboration_id"], error)
    try:
        clear_collab_google(notice["collaboration_id"])
    except Exception:
        log.exception("협업 %s 구글 일정 지우기 실패", notice["collaboration_id"])


# ---------- 시작일 미루기 ----------
def answer_deadline(now: datetime, start: date) -> datetime:
    """답할 기한: 지금부터 3일, 시작일 0시(한국)가 더 빠르면 그때까지 (시작하면 미룰 수 없으니까)"""
    start_midnight = datetime.combine(start, time(0), tzinfo=KST)
    return min(now + timedelta(days=ANSWER_DAYS), start_midnight)


def check_postpone(old_start: date, new_start: date, already: bool) -> None:
    """미룰 수 있는 날인지 (DB 없이 · 테스트: tests/test_collab_waiting.py)

    already: 이 협업에서 이미 시작일을 미룬 적이 있는지 (수락된 미루기)
    """
    if already:
        raise HTTPException(status_code=409, detail="시작일 미루기는 한 협업에 한 번만 할 수 있어요")
    if new_start <= old_start:
        raise bad_request("새 시작일은 지금 시작일보다 뒤로 골라 주세요")
    if (new_start - old_start).days > MAX_POSTPONE_DAYS:
        last = old_start + timedelta(days=MAX_POSTPONE_DAYS)
        raise bad_request(f"시작일은 {MAX_POSTPONE_DAYS}일까지 미룰 수 있어요 ({day_text(last)}까지)")


def request_postpone(user_id: int, collaboration_id: int, body: PostponeInput, source: str = "web") -> dict:
    """[시작일 미루기] 요청 (웹 · 디스코드 공통). 상대에게 알림 종 + 채널 [수락] [다시 얘기해요]."""
    reason = required_text(body.reason, MAX_POSTPONE_TEXT, "사유")
    with transaction() as cursor:
        collab = find_collaboration(cursor, user_id, collaboration_id, lock=True)
        check_waiting(collab, today_kst())
        cursor.execute(
            "SELECT status, kind FROM collaboration_change WHERE collaboration_id = %s"
            " AND (status = 'pending' AND expires_at >= now() OR kind = 'start' AND status = 'accepted')",
            (collaboration_id,),
        )
        rows = cursor.fetchall()
        if any(row["status"] == "pending" for row in rows):
            raise HTTPException(status_code=409, detail="답을 기다리는 요청이 있어요. 답을 받은 뒤 다시 요청해 주세요")
        old_start, old_end = collab["start_date"], collab["end_date"]
        check_postpone(old_start, body.start_date, any(row["kind"] == "start" for row in rows))
        new_end = old_end + (body.start_date - old_start)
        expire_changes(cursor, collaboration_id)  # 만료된 요청이 '기다리는 요청 하나' 규칙에 걸리지 않게
        expires = answer_deadline(datetime.now(KST), old_start)
        cursor.execute(
            """
            INSERT INTO collaboration_change (collaboration_id, kind, requested_by, old_start_date, new_start_date,
                                              old_end_date, new_end_date, reason, expires_at)
            VALUES (%s, 'start', %s, %s, %s, %s, %s, %s, %s)
            RETURNING change_id
            """,
            (collaboration_id, user_id, old_start, body.start_date, old_end, new_end, reason, expires),
        )
        change_id = cursor.fetchone()["change_id"]
        people = collab_people(cursor, collaboration_id)
        note = f"{short(old_start)} → {short(body.start_date)} (종료 {short(old_end)} → {short(new_end)}) · {reason}"
        notice = save_notice(cursor, people, user_id, "start_change_requested", note)
    deadline = expires.astimezone(KST)
    return {**notice, "change_id": change_id, "reason": reason, "new_start": body.start_date, "new_end": new_end,
            "old_start": old_start, "old_end": old_end, "deadline": deadline, "source": source}


def find_change(cursor, user_id: int, change_id: int) -> tuple[dict, dict]:
    """시작일 미루기 요청 하나 + 내 협업인지 확인 (남의 것이면 404). 협업과 요청을 잠가요."""
    cursor.execute("SELECT collaboration_id, kind FROM collaboration_change WHERE change_id = %s", (change_id,))
    found = cursor.fetchone()
    if found is None or found["kind"] != "start":
        raise HTTPException(status_code=404, detail="요청을 찾을 수 없어요")
    # 잠그는 순서: 협업 → 요청 (취소와 같은 순서라 서로 기다리다 멈추지 않아요)
    collab = find_collaboration(cursor, user_id, found["collaboration_id"], lock=True)
    cursor.execute(
        "SELECT change_id, collaboration_id, kind, requested_by, status, expires_at, old_start_date, new_start_date,"
        " old_end_date, new_end_date, reason FROM collaboration_change WHERE change_id = %s FOR UPDATE",
        (change_id,),
    )
    change = cursor.fetchone()
    if change["status"] != "pending" or change["expires_at"] < datetime.now(KST):
        raise HTTPException(status_code=409, detail="이미 답했거나 기한이 지난 요청이에요")
    return change, collab


def answer_postpone(user_id: int, change_id: int, accept: bool, body: AnswerInput, source: str = "web") -> dict:
    """[수락] / [다시 얘기해요] (웹 · 디스코드 공통): 요청을 받은 사람만. 요청한 사람에게 알려요.

    수락하면 협업 시작일 · 종료일을 바꾸고, 구글의 협업 시작일 · 종료일 표시도 응답 뒤에 맞춰요.
    """
    note = optional_text(body.note, MAX_ANSWER_NOTE, "이유")
    with transaction() as cursor:
        change, collab = find_change(cursor, user_id, change_id)
        if change["requested_by"] == user_id:
            raise HTTPException(status_code=403, detail="요청을 받은 사람만 답할 수 있어요")
        check_waiting(collab, today_kst())
        if accept:
            cursor.execute(
                "UPDATE collaboration SET start_date = %s, end_date = %s WHERE collaboration_id = %s",
                (change["new_start_date"], change["new_end_date"], change["collaboration_id"]),
            )
        cursor.execute(
            "UPDATE collaboration_change SET status = %s, answered_at = now(), answer_note = %s WHERE change_id = %s",
            ("accepted" if accept else "declined", note or None, change_id),
        )
        people = collab_people(cursor, change["collaboration_id"])
        moved = f"{short(change['old_start_date'])} → {short(change['new_start_date'])}"
        type_ = "start_change_accepted" if accept else "start_change_declined"
        text = f"{moved} (종료 {short(change['new_end_date'])})" if accept else f"{moved}" + (f" · {note}" if note else "")
        notice = save_notice(cursor, people, user_id, type_, text)
    return {**notice, "change_id": change_id, "new_start": change["new_start_date"], "new_end": change["new_end_date"],
            "answer_note": note, "source": source}


def withdraw_postpone(user_id: int, change_id: int) -> int:
    """[요청 철회]: 요청한 사람만. 상대에게는 알리지 않아요 (답할 게 없어졌을 뿐). 협업 번호를 돌려줘요."""
    with transaction() as cursor:
        change, _collab = find_change(cursor, user_id, change_id)
        if change["requested_by"] != user_id:
            raise HTTPException(status_code=403, detail="요청한 사람만 철회할 수 있어요")
        cursor.execute(
            "UPDATE collaboration_change SET status = 'withdrawn', answered_at = now() WHERE change_id = %s",
            (change_id,),
        )
    return change["collaboration_id"]


def postpone_components(change_id: int) -> list:
    """채널 메시지의 [수락] [다시 얘기해요] 버튼 (디스코드 봇이 start:accept:번호 · start:decline:번호 로 받아요)"""
    return [
        {
            "type": 1,
            "components": [
                {"type": 2, "style": 3, "label": "수락", "custom_id": f"start:accept:{change_id}"},
                {"type": 2, "style": 2, "label": "다시 얘기해요", "custom_id": f"start:decline:{change_id}"},
            ],
        }
    ]


def postpone_text(notice: dict) -> str:
    """채널 메시지 (요청 · 수락 · 다시 얘기해요)"""
    who = f"<@{notice['to']}> " if notice.get("to") else ""
    kind = notice["type"]
    if kind == "start_change_requested":
        deadline = notice["deadline"]
        return (
            f"🗓 {who}{notice['actor']} 님이 시작일을 미루자고 했어요 · **{short(notice['old_start'])} → "
            f"{short(notice['new_start'])}** (종료 {short(notice['new_end'])})\n“{notice['reason']}” · "
            f"{deadline.month}.{deadline.day} {deadline:%H:%M}까지 답해 주세요"
        )
    if kind == "start_change_accepted":
        return (
            f"🗓 {who}{notice['actor']} 님이 수락했어요 · 협업 기간이 **{short(notice['new_start'])} ~ "
            f"{short(notice['new_end'])}**로 바뀌었어요"
        )
    note = f" · “{notice['answer_note']}”" if notice.get("answer_note") else ""
    return f"🗓 {who}{notice['actor']} 님이 시작일 미루기에 [다시 얘기해요]를 눌렀어요{note} · 채널에서 얘기해 보세요"


def after_postpone(notice: dict) -> None:
    """응답을 보낸 뒤: 채널에 올리고(상대 멘션), 수락이면 구글의 협업 시작일 · 종료일을 맞춰요."""
    channel = notice.get("channel")
    if bot_ready() and channel:
        try:
            people = [notice["to"]] if notice.get("to") else []
            components = postpone_components(notice["change_id"]) if notice["type"] == "start_change_requested" else None
            retry_once(send_message, channel, postpone_text(notice), components=components, mentions=mention(*people))
        except httpx.HTTPError as error:
            log.warning("협업 %s 시작일 미루기 메시지 실패: %s", notice["collaboration_id"], error)
    if notice["type"] == "start_change_accepted":
        try:
            sync_marks(today_kst(), notice["collaboration_id"])
        except httpx.HTTPError as error:
            log.warning("협업 %s 구글 시작일 · 종료일 맞추기 실패: %s", notice["collaboration_id"], error)


# ---------- 전문가가 새 요청을 받을 수 있는지 ----------
def open_from(last_end: date | None, today: date) -> date | None:
    """요청을 받을 수 있는 날. 지금 받을 수 있으면 None (DB 없이 · 테스트용)

    last_end: 진행 중 · 시작 전 협업 중 가장 늦은 종료일 (없으면 None)
    모든 협업이 오늘부터 30일 안에 끝나면 받을 수 있어요. 아니면 '가장 늦은 종료일 − 30일'부터.
    """
    if last_end is None or last_end <= today + timedelta(days=AVAILABLE_DAYS):
        return None
    return last_end - timedelta(days=AVAILABLE_DAYS)


def expert_open_from(cursor, expert_id: int, today: date) -> date | None:
    """전문가 한 명이 새 협업 요청을 받을 수 있는 날 (지금 받을 수 있으면 None)"""
    cursor.execute(
        "SELECT max(end_date) AS last_end FROM collaboration WHERE expert_id = %s AND status = 'ongoing'",
        (expert_id,),
    )
    return open_from(cursor.fetchone()["last_end"], today)


def busy_text(day: date) -> str:
    return f"이 전문가는 {day_text(day)}부터 새 협업 요청을 받을 수 있어요"