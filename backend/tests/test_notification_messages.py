"""알림 문구 만들기 (DB 없이). 받는 사람이 전문가인지 연구회원인지에 따라 문구가 달라요."""

from app.notification_store import build_message

EXPERT, RESEARCHER = 10, 20


def row(type_: str, **extra) -> dict:
    base = {
        "type": type_,
        "actor_nickname": "neural_kim",
        "research_title": "세포 이미지 자동 계수",
        "reject_reason": None,
        "expert_id": EXPERT,
        "request_status": "pending",
    }
    return {**base, **extra}


def test_received_goes_with_deadline_only_while_waiting():
    title, detail = build_message(row("request_received", actor_nickname="cell_jung"), EXPERT)
    assert title == "cell_jung 님이 협업을 요청했어요"
    assert detail == "세포 이미지 자동 계수 · 7일 안에 답해 주세요"
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