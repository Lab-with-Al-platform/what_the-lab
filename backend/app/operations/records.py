"""회원·연구 조회의 안전한 열만 읽습니다. 본문·연락처·Discord 번호는 가져오지 않습니다."""

from dataclasses import dataclass
from datetime import datetime

from app.db import get_connection

# 가입 완료 시각 열은 없습니다. created_at을 완료 시각으로 쓰지 않기 위해 이름만 계정 생성으로 둡니다.
MEMBER_SQL = """
SELECT u.user_id, u.nickname, u.user_role, u.signup_step, u.status, u.is_admin, u.created_at,
       CASE
         WHEN u.user_role = 'researcher' THEN rp.institution_name
         WHEN u.user_role = 'expert' THEN ex.affiliation
         ELSE NULL
       END AS affiliation
FROM users u
LEFT JOIN researcher_profile rp ON rp.user_id = u.user_id
LEFT JOIN expert ex ON ex.user_id = u.user_id
"""

# description, share_condition, 지역 문구는 관리자 응답에 넣지 않습니다.
RESEARCH_SQL = """
SELECT r.research_id, r.user_id, u.nickname AS owner_nickname, r.status, r.title,
       r.created_at, r.updated_at, r.data_status, r.share_policy, r.task_unsure, r.is_primary
FROM research r
JOIN users u ON u.user_id = r.user_id
"""

FIELD_SQL = """
SELECT rd.research_id, rd.field_id, rf.name AS field_name
FROM research_domain rd
JOIN research_field rf ON rf.field_id = rd.field_id
ORDER BY rd.research_id, rf.sort_order, rd.field_id
"""

WORK_SQL = """
SELECT rw.research_id, rw.able_work_id, aw.name AS able_work_name
FROM research_able_work rw
JOIN able_work aw ON aw.able_work_id = rw.able_work_id
ORDER BY rw.research_id, aw.sort_order, rw.able_work_id
"""

DATA_TYPE_SQL = """
SELECT research_id, data_type
FROM research_data_type
ORDER BY research_id, data_type
"""

FORBIDDEN_SQL_WORDS = ("discord_id", "description", "share_condition", "face_to_area", "user_photo")


@dataclass(frozen=True)
class MemberRow:
    user_id: int
    nickname: str
    user_role: str | None
    signup_step: str
    status: str
    is_admin: bool
    created_at: datetime
    affiliation: str | None


@dataclass(frozen=True)
class ResearchRow:
    research_id: int
    user_id: int
    owner_nickname: str
    status: str
    title: str
    created_at: datetime
    updated_at: datetime
    data_status: str | None
    share_policy: str | None
    task_unsure: bool
    is_primary: bool
    field_ids: tuple[str, ...]
    field_names: tuple[str, ...]
    able_work_ids: tuple[str, ...]
    able_work_names: tuple[str, ...]
    data_types: tuple[str, ...]


@dataclass(frozen=True)
class OperationsSnapshot:
    members: tuple[MemberRow, ...]
    researches: tuple[ResearchRow, ...]


def _group(rows: list[dict], key: str) -> dict[int, list[dict]]:
    grouped: dict[int, list[dict]] = {}
    for row in rows:
        grouped.setdefault(row[key], []).append(row)
    return grouped


def fetch_snapshot() -> OperationsSnapshot:
    """필터 전에 허용 열만 읽습니다. 회원 수가 작은 현재 단계를 위한 읽기입니다."""
    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute(MEMBER_SQL)
        member_rows = cursor.fetchall()
        cursor.execute(RESEARCH_SQL)
        research_rows = cursor.fetchall()
        cursor.execute(FIELD_SQL)
        fields = _group(cursor.fetchall(), "research_id")
        cursor.execute(WORK_SQL)
        works = _group(cursor.fetchall(), "research_id")
        cursor.execute(DATA_TYPE_SQL)
        data_types = _group(cursor.fetchall(), "research_id")
    members = tuple(
        MemberRow(
            user_id=row["user_id"],
            nickname=row["nickname"],
            user_role=row["user_role"],
            signup_step=row["signup_step"],
            status=row["status"],
            is_admin=bool(row["is_admin"]),
            created_at=row["created_at"],
            affiliation=row["affiliation"],
        )
        for row in member_rows
    )
    researches = tuple(
        ResearchRow(
            research_id=row["research_id"],
            user_id=row["user_id"],
            owner_nickname=row["owner_nickname"],
            status=row["status"],
            title=row["title"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            data_status=row["data_status"],
            share_policy=row["share_policy"],
            task_unsure=bool(row["task_unsure"]),
            is_primary=bool(row["is_primary"]),
            field_ids=tuple(item["field_id"] for item in fields.get(row["research_id"], [])),
            field_names=tuple(item["field_name"] for item in fields.get(row["research_id"], [])),
            able_work_ids=tuple(item["able_work_id"] for item in works.get(row["research_id"], [])),
            able_work_names=tuple(
                item["able_work_name"] for item in works.get(row["research_id"], [])
            ),
            data_types=tuple(item["data_type"] for item in data_types.get(row["research_id"], [])),
        )
        for row in research_rows
    )
    return OperationsSnapshot(members=members, researches=researches)
