"""회원·연구 조회의 안전한 열만 읽습니다. 본문·연락처·Discord 번호는 가져오지 않습니다."""

from dataclasses import dataclass
from datetime import datetime

from app.db import get_connection
from app.operations.periods import SEOUL

PAGE_SIZE = 20

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


def _member_row(row: dict) -> MemberRow:
    return MemberRow(
        user_id=row["user_id"],
        nickname=row["nickname"],
        user_role=row["user_role"],
        signup_step=row["signup_step"],
        status=row["status"],
        is_admin=bool(row["is_admin"]),
        created_at=row["created_at"],
        affiliation=row["affiliation"],
    )


def _research_row(
    row: dict,
    fields: dict[int, list[dict]],
    works: dict[int, list[dict]],
    data_types: dict[int, list[dict]],
) -> ResearchRow:
    research_id = row["research_id"]
    return ResearchRow(
        research_id=research_id,
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
        field_ids=tuple(item["field_id"] for item in fields.get(research_id, [])),
        field_names=tuple(item["field_name"] for item in fields.get(research_id, [])),
        able_work_ids=tuple(item["able_work_id"] for item in works.get(research_id, [])),
        able_work_names=tuple(item["able_work_name"] for item in works.get(research_id, [])),
        data_types=tuple(item["data_type"] for item in data_types.get(research_id, [])),
    )


def _contains(column: str) -> str:
    """% 같은 문자를 LIKE 와일드카드로 쓰지 않고, 글자 그대로 찾습니다."""
    return f"position(lower(%s) in lower({column})) > 0"


def _created_clauses(column: str, start_at: datetime | None, end_at: datetime | None) -> tuple[list[str], list]:
    clauses: list[str] = []
    params: list = []
    if start_at is None and end_at is None:
        return clauses, params
    if start_at is not None and end_at is not None:
        clauses.append(f"{column} >= %s AND {column} < %s")
        params.extend([start_at, end_at])
        return clauses, params
    if start_at is not None:
        clauses.append(f"({column} AT TIME ZONE 'Asia/Seoul')::date >= %s")
        params.append(start_at.astimezone(SEOUL).date())
        return clauses, params
    assert end_at is not None
    clauses.append(f"({column} AT TIME ZONE 'Asia/Seoul')::date < %s")
    params.append(end_at.astimezone(SEOUL).date())
    return clauses, params


def member_where(query: dict) -> tuple[str, list]:
    clauses = ["TRUE"]
    params: list = []
    text = query["q"].strip()
    if text:
        if text.isdigit():
            clauses.append(f"(u.user_id = %s OR {_contains('u.nickname')})")
            params.extend([int(text), text])
        else:
            clauses.append(_contains("u.nickname"))
            params.append(text)
    if query["role"] == "unset":
        clauses.append("u.user_role IS NULL")
    elif query["role"] in {"researcher", "expert"}:
        clauses.append("u.user_role = %s")
        params.append(query["role"])
    if query["signup_step"]:
        clauses.append("u.signup_step = %s")
        params.append(query["signup_step"])
    if query["status"] == "":
        clauses.append("u.status <> 'deleted'")
    elif query["status"] != "any":
        clauses.append("u.status = %s")
        params.append(query["status"])
    created, created_params = _created_clauses("u.created_at", query["created_start"], query["created_end"])
    clauses.extend(created)
    params.extend(created_params)
    return " AND ".join(clauses), params


def research_where(query: dict) -> tuple[str, list]:
    clauses = ["TRUE"]
    params: list = []
    text = query["q"].strip()
    if text:
        if text.isdigit():
            clauses.append(
                f"(r.research_id = %s OR {_contains('r.title')} OR {_contains('u.nickname')})"
            )
            params.extend([int(text), text, text])
        else:
            clauses.append(f"({_contains('r.title')} OR {_contains('u.nickname')})")
            params.extend([text, text])
    if query["status"]:
        clauses.append("r.status = %s")
        params.append(query["status"])
    progress = query.get("progress_status") or ""
    if progress == "not_applicable":
        clauses.append("r.status = 'draft'")
    elif progress == "not_linked":
        clauses.append("r.status = 'registered'")
    elif progress:
        clauses.append("FALSE")
    if query["field_id"]:
        clauses.append(
            "EXISTS (SELECT 1 FROM research_domain rd WHERE rd.research_id = r.research_id AND rd.field_id = %s)"
        )
        params.append(query["field_id"])
    if query["able_work_id"]:
        clauses.append(
            "EXISTS (SELECT 1 FROM research_able_work rw WHERE rw.research_id = r.research_id AND rw.able_work_id = %s)"
        )
        params.append(query["able_work_id"])
    created, created_params = _created_clauses("r.created_at", query["created_start"], query["created_end"])
    clauses.extend(created)
    params.extend(created_params)
    return " AND ".join(clauses), params


def member_page_query(query: dict, page: int) -> tuple[str, str, list, int]:
    """목록 SELECT와 COUNT를 같이 만듭니다. LIMIT은 바인딩 값으로 넣습니다."""
    where, params = member_where(query)
    offset = (page - 1) * PAGE_SIZE
    data_sql = (
        f"{MEMBER_SQL} WHERE {where} ORDER BY u.created_at DESC, u.user_id DESC LIMIT %s OFFSET %s"
    )
    count_sql = f"SELECT COUNT(*) AS n FROM users u WHERE {where}"
    return data_sql, count_sql, [*params, PAGE_SIZE, offset], offset


def research_page_query(query: dict, page: int) -> tuple[str, str, list, int]:
    where, params = research_where(query)
    offset = (page - 1) * PAGE_SIZE
    data_sql = (
        f"{RESEARCH_SQL} WHERE {where} ORDER BY r.created_at DESC, r.research_id DESC LIMIT %s OFFSET %s"
    )
    count_sql = f"SELECT COUNT(*) AS n FROM research r JOIN users u ON u.user_id = r.user_id WHERE {where}"
    return data_sql, count_sql, [*params, PAGE_SIZE, offset], offset


def _ids_sql(sql: str, column: str) -> str:
    return sql.replace("ORDER BY", f"WHERE {column} = ANY(%s)\nORDER BY", 1)


def _fetch_related(cursor, ids: list[int]) -> tuple[dict[int, list[dict]], dict[int, list[dict]], dict[int, list[dict]]]:
    if not ids:
        return {}, {}, {}
    cursor.execute(_ids_sql(FIELD_SQL, "rd.research_id"), (ids,))
    fields = _group(cursor.fetchall(), "research_id")
    cursor.execute(_ids_sql(WORK_SQL, "rw.research_id"), (ids,))
    works = _group(cursor.fetchall(), "research_id")
    cursor.execute(_ids_sql(DATA_TYPE_SQL, "research_id"), (ids,))
    data_types = _group(cursor.fetchall(), "research_id")
    return fields, works, data_types


def fetch_members_page(query: dict, page: int) -> tuple[int, tuple[MemberRow, ...]]:
    data_sql, count_sql, params, _offset = member_page_query(query, page)
    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute(count_sql, params[:-2])
        total = int(cursor.fetchone()["n"])
        cursor.execute(data_sql, params)
        rows = cursor.fetchall()
    return total, tuple(_member_row(row) for row in rows)


def fetch_researches_page(query: dict, page: int) -> tuple[int, tuple[ResearchRow, ...]]:
    data_sql, count_sql, params, _offset = research_page_query(query, page)
    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute(count_sql, params[:-2])
        total = int(cursor.fetchone()["n"])
        cursor.execute(data_sql, params)
        rows = cursor.fetchall()
        fields, works, data_types = _fetch_related(cursor, [row["research_id"] for row in rows])
    return total, tuple(_research_row(row, fields, works, data_types) for row in rows)


def fetch_member(user_id: int) -> MemberRow | None:
    sql = f"{MEMBER_SQL} WHERE u.user_id = %s"
    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute(sql, (user_id,))
        row = cursor.fetchone()
    return None if row is None else _member_row(row)


def fetch_researches_of(user_id: int) -> tuple[ResearchRow, ...]:
    sql = f"{RESEARCH_SQL} WHERE r.user_id = %s ORDER BY r.created_at DESC, r.research_id DESC"
    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute(sql, (user_id,))
        rows = cursor.fetchall()
        fields, works, data_types = _fetch_related(cursor, [row["research_id"] for row in rows])
    return tuple(_research_row(row, fields, works, data_types) for row in rows)


def fetch_research(research_id: int) -> ResearchRow | None:
    sql = f"{RESEARCH_SQL} WHERE r.research_id = %s"
    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute(sql, (research_id,))
        row = cursor.fetchone()
        if row is None:
            return None
        fields, works, data_types = _fetch_related(cursor, [research_id])
    return _research_row(row, fields, works, data_types)


def fetch_snapshot() -> OperationsSnapshot:
    """요약 카드용입니다. 목록·상세는 한 페이지/한 건만 읽습니다."""
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
    members = tuple(_member_row(row) for row in member_rows)
    researches = tuple(_research_row(row, fields, works, data_types) for row in research_rows)
    return OperationsSnapshot(members=members, researches=researches)
