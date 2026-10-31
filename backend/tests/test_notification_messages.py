"""알림 문구 만들기 (DB 없이). 받는 사람이 전문가인지 연구회원인지에 따라 문구가 달라요."""

from datetime import date, datetime

from app.notification_store import build_message
from app.request_rules import KST

EXPERT, RESEARCHER = 10, 20


def row(type_: str, **extra) -> dict:
    base = {
        "type": type_,
        "actor_nickname": "neural_kim",
        "research_title": "세포 이미지 자동 계수",
        "reject_reason": None,
        "expert_id": EXPERT,
        "request_status": "pending",
        "is_urgent": False,
        "expires_at": datetime(2026, 10, 26, 0, 0, tzinfo=KST),
        "accepted_start_date": None,
        "cancel_reason": None,
        "responded_at": None,
    }
    return {**base, **extra}


def test_received_goes_with_deadline_only_while_waiting():
    title, detail = build_message(row("request_received", actor_nickname="cell_jung"), EXPERT)
    assert title == "cell_jung 님이 협업을 요청했어요"
    assert detail == "세포 이미지 자동 계수 · 10.25 밤까지 답해 주세요"
    _, answered = build_message(row("request_received", request_status="accepted"), EXPERT)
    assert answered == "세포 이미지 자동 계수"


def test_rejected_shows_reason_label():
    _, detail = build_message(row("request_rejected", reject_reason="schedule"), RESEARCHER)
    assert detail == "일정이 맞지 않아요"


def test_expired_wording_depends_on_receiver():
    to_expert, _ = build_message(row("request_expired", actor_nickname="cell_jung"), EXPERT)
    to_researcher, _ = build_message(row("request_expired"), RESEARCHER)
    assert to_expert == "cell_jung 님의 요청이 답이 없어 만료됐어요"
    assert to_researcher == "neural_kim 님에게 보낸 요청이 답이 없어 만료됐어요"


def test_left_member_and_deleted_research():
    gone = row("request_accepted", actor_nickname=None, research_title=None)
    title, detail = build_message(gone, RESEARCHER)
    assert title == "탈퇴한 회원 님이 협업 요청을 수락했어요"
    assert detail == "삭제된 연구"

def test_urgent_and_adjusted_and_withdrawn():
    title, _ = build_message(row("request_received", is_urgent=True, actor_nickname="cell_jung"), EXPERT)
    assert title == "🔥 cell_jung 님이 급한 협업을 요청했어요"
    title, _ = build_message(row("request_accepted", accepted_start_date="2026-11-03"), RESEARCHER)
    assert title == "neural_kim 님이 기간을 조정해서 수락했어요"
    title, _ = build_message(row("request_withdrawn"), RESEARCHER)
    assert title == "neural_kim 님이 수락을 취소했어요"


def test_canceled_wording_follows_reason():
    other, _ = build_message(row("request_canceled", cancel_reason="other_started"), EXPERT)
    declined, _ = build_message(row("request_canceled", cancel_reason="declined"), EXPERT)
    assert other == "neural_kim 님의 연구는 협업 인원이 다 찼어요"
    assert declined == "neural_kim 님이 이번 협업은 진행하지 않기로 했어요"


def test_expired_after_accept_has_its_own_wording():
    title, _ = build_message(row("request_expired", responded_at="x"), RESEARCHER)
    assert title == "neural_kim 님이 수락한 요청이 시작 기한이 지나 만료됐어요"



# ---------- 협업 공간 알림 (요청 · 아침 브리핑) ----------
def task_row(kind, **fields):
    return {
        "type": kind, "actor_nickname": "jiwoo_lab", "task_content": "그래프를 표로 정리해 주세요",
        "task_due": date(2026, 11, 10), "notice_on": None, "collab_title": "세포 이미지 분석",
        "collab_end": date(2026, 11, 17), "collaboration_id": 3, "task_id": 12, **fields,
    }


def test_task_notice_wording_and_link():
    from app.notification_store import notice_link, task_message

    assert task_message(task_row("task_created")) == ("jiwoo_lab 님이 요청을 남겼어요", "그래프를 표로 정리해 주세요 · 세포 이미지 분석")
    assert task_message(task_row("task_due"))[0] == "jiwoo_lab 님이 기한을 11.10(으)로 바꿨어요"
    assert task_message(task_row("task_due_kept"))[0] == "jiwoo_lab 님이 지금 기한(11.10)을 유지하기로 했어요"
    assert task_message(task_row("task_due_soon", notice_on=date(2026, 11, 10)))[0] == "요청 기한이 오늘까지예요"
    assert task_message(task_row("task_due_soon", notice_on=date(2026, 11, 9)))[0] == "요청 기한이 내일까지예요"
    assert task_message(task_row("collab_ending", task_id=None))[0] == "협업 종료 3일 전이에요 (11.17)"
    assert notice_link(task_row("task_done")) == "/workspace/3#task-12"  # 누르면 그 요청 줄로
    assert notice_link(task_row("collab_ending", task_id=None)) == "/workspace/3"
    assert notice_link({"collaboration_id": None, "task_id": None}) == "/requests"  # 매칭 알림은 그대로