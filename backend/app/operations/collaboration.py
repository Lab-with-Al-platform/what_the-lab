"""협업 요청의 현재 상태만 집계합니다.

참여 신청, 마일스톤, 완료, 평가는 표가 없으므로 숫자를 만들지 않습니다.
요청을 보낸 집단이 나중에 시작했는지로 나눈 성공률도 만들지 않습니다.
"""

from dataclasses import dataclass
from datetime import datetime

import psycopg

from app.db import transaction
from app.operations.periods import in_range, previous_range

STATUSES = (
    ("pending", "답변 대기", "전문가가 아직 답하지 않은 요청입니다."),
    ("accepted", "전문가 수락", "전문가가 수락했고 연구회원이 시작 전인 요청입니다."),
    ("started", "협업 시작", "연구회원이 시작을 누른 요청입니다. 마일스톤이나 완료가 아닙니다."),
    ("rejected", "거절", "전문가가 거절한 요청입니다."),
    ("expired", "기한 만료", "답변 기한이 지나 만료된 요청입니다."),
    ("canceled", "취소", "연구회원이 취소했거나, 다른 요청을 시작하며 정리된 요청입니다."),
)
STATUS_CODES = {code for code, _label, _note in STATUSES}
STATUS_LABELS = {code: label for code, label, _note in STATUSES}
PAGE_SIZE = 20

# 메시지와 거절 문구는 관리자 응답에 넣지 않습니다.
REQUEST_SQL = """
SELECT cr.request_id, cr.research_id, r.title, owner.nickname AS owner_nickname,
       cr.expert_id, expert.nickname AS expert_nickname, cr.status,
       cr.created_at, cr.responded_at, cr.started_at, cr.expires_at
FROM collaboration_request cr
JOIN research r ON r.research_id = cr.research_id
JOIN users owner ON owner.user_id = r.user_id
JOIN users expert ON expert.user_id = cr.expert_id
ORDER BY cr.created_at DESC, cr.request_id DESC
"""


@dataclass(frozen=True)
class RequestRow:
    """요청 목록에 필요한 식별과 시각만 담습니다."""

    request_id: int
    research_id: int
    title: str
    owner_nickname: str
    expert_id: int
    expert_nickname: str
    status: str
    created_at: datetime
    responded_at: datetime | None
    started_at: datetime | None
    expires_at: datetime


def build_collaboration_report(
    rows: list[RequestRow],
    *,
    table_ready: bool,
    start: datetime,
    end: datetime,
    status: str,
    page: int,
) -> dict:
    """현재 상태 건수와, 기간에 새로 생긴 요청 수를 따로 돌려줍니다."""
    created = [row for row in rows if in_range(row.created_at, start, end)]
    previous_start, previous_end = previous_range(start, end)
    previous = [row for row in rows if in_range(row.created_at, previous_start, previous_end)]
    selected = [row for row in rows if status == "" or row.status == status]
    start_index = (page - 1) * PAGE_SIZE
    page_rows = selected[start_index : start_index + PAGE_SIZE]
    ready = "ready" if table_ready else "unavailable"
    return {
        "table_ready": table_ready,
        "note": "상태 칸은 지금 남아 있는 요청입니다. 기간에 생긴 요청을 시작 수로 나누지 않습니다.",
        "counts": [_count(rows, code, label, note, ready) for code, label, note in STATUSES],
        "created_in_period": _created(len(created), len(previous), ready),
        "missing": _missing(),
        "total": len(selected) if table_ready else 0,
        "page": page,
        "page_size": PAGE_SIZE,
        "items": [_item(row) for row in page_rows] if table_ready else [],
    }


class MemoryCollaborationSource:
    """테스트용. 넘어온 요청만 돌려주고 실제 표는 열지 않습니다."""

    def __init__(self, rows: list[RequestRow], table_ready: bool = True) -> None:
        self.rows = rows
        self.table_ready = table_ready

    def load(self) -> tuple[bool, list[RequestRow]]:
        return self.table_ready, list(self.rows)


class PostgresCollaborationSource:
    """운영 표. 없거나 연결이 안 되면 0건으로 꾸미지 않고 없음으로 돌립니다."""

    def load(self) -> tuple[bool, list[RequestRow]]:
        try:
            with transaction() as cursor:
                cursor.execute(REQUEST_SQL)
                found = cursor.fetchall()
        except psycopg.Error:
            return False, []
        return True, [_row(item) for item in found]


def _count(rows: list[RequestRow], code: str, label: str, note: str, ready: str) -> dict:
    value = sum(1 for row in rows if row.status == code) if ready == "ready" else None
    return {"status": code, "label": label, "value": value, "state": ready, "note": note}


def _created(current: int, previous: int, ready: str) -> dict:
    body = {
        "status": ready,
        "value": current if ready == "ready" else None,
        "note": "이 기간에 생긴 협업 요청입니다. 수락·시작 비율이 아닙니다.",
    }
    if ready == "ready":
        absolute = current - previous
        rate = None if previous == 0 else absolute / previous
        body["comparison"] = {"previous": previous, "absolute": absolute, "rate": rate}
    return body


def _missing() -> list[dict]:
    notes = (
        ("applications", "참여 신청", "전문가가 공개 연구에 신청하는 표가 없습니다."),
        ("milestones", "마일스톤", "협업 중 단계 표가 없습니다."),
        ("completion", "완료", "종료·완료 상태 표가 없습니다."),
        ("evaluation", "평가", "양방향 평가 표가 없습니다."),
    )
    return [
        {"id": item_id, "label": label, "status": "not_linked", "value": None, "note": note}
        for item_id, label, note in notes
    ]


def _item(row: RequestRow) -> dict:
    return {
        "request_id": row.request_id,
        "research_id": row.research_id,
        "title": row.title,
        "owner_nickname": row.owner_nickname,
        "expert_id": row.expert_id,
        "expert_nickname": row.expert_nickname,
        "status": row.status,
        "status_label": STATUS_LABELS.get(row.status, row.status),
        "created_at": row.created_at.isoformat(),
        "responded_at": row.responded_at.isoformat() if row.responded_at else None,
        "started_at": row.started_at.isoformat() if row.started_at else None,
        "expires_at": row.expires_at.isoformat(),
    }


def _row(item: dict) -> RequestRow:
    return RequestRow(
        request_id=item["request_id"],
        research_id=item["research_id"],
        title=item["title"],
        owner_nickname=item["owner_nickname"],
        expert_id=item["expert_id"],
        expert_nickname=item["expert_nickname"],
        status=item["status"],
        created_at=item["created_at"],
        responded_at=item["responded_at"],
        started_at=item["started_at"],
        expires_at=item["expires_at"],
    )
