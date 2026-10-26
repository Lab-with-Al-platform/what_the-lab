"""AI 전문가 찾기: 공개한 전문가만 검색합니다.

검색어는 분류표(taxonomy v4.0)의 같은 말 사전으로 넓혀서 찾습니다.
예: '데이터 정리' → 같은 뜻의 수행 기술(CAP) → 그 기술이 속한 '할 수 있는 일'(UG) 그룹
"""

import json
import re
from pathlib import Path

from app.db import get_connection

TAXONOMY_DIR = Path(__file__).resolve().parents[2] / "taxonomy" / "v4.0"


def normalize(text: str) -> str:
    """비교용: 소문자로 바꾸고 공백·가운뎃점·하이픈을 지웁니다. 예: 'Object Detection' → 'objectdetection'"""
    return re.sub(r"[\s·\-_/()]", "", text.lower())


def load_aliases() -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    """(검색어 → UG ID들, 검색어 → FIELD ID들). 분류표 파일이 없으면 빈 사전으로 동작합니다."""
    try:
        aliases = json.loads((TAXONOMY_DIR / "search-aliases.json").read_text(encoding="utf-8"))
        members = json.loads((TAXONOMY_DIR / "ui-group-members.json").read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}, {}
    groups_of_capability: dict[str, set[str]] = {}
    for member in members:
        groups_of_capability.setdefault(member["capability_id"], set()).add(member["group_id"])

    to_groups: dict[str, set[str]] = {}
    to_fields: dict[str, set[str]] = {}
    for alias in aliases:
        key = normalize(alias["term"])
        if alias["axis"] == "capability":
            to_groups.setdefault(key, set()).update(
                groups_of_capability.get(alias["term_id"], set())
            )
        elif alias["axis"] == "research_field":
            to_fields.setdefault(key, set()).add(alias["term_id"])
    return to_groups, to_fields


ALIAS_GROUPS, ALIAS_FIELDS = load_aliases()  # 서버가 켜질 때 한 번만 읽습니다.


def expand_query(query: str) -> tuple[list[str], list[str]]:
    """검색어와 같은 뜻인 (UG ID 목록, FIELD ID 목록). 사전에 없으면 빈 목록."""
    key = normalize(query)
    if not key:
        return [], []
    groups, fields = set(ALIAS_GROUPS.get(key, set())), set(ALIAS_FIELDS.get(key, set()))
    # 세 글자 이상이면 그 말을 포함한 표현도 같은 뜻으로 봅니다. (예: 데이터 정리 → 비정형 데이터 정리)
    if len(key) >= 3:
        for term, ids in ALIAS_GROUPS.items():
            if key in term:
                groups |= ids
        for term, ids in ALIAS_FIELDS.items():
            if key in term:
                fields |= ids
    return sorted(groups), sorted(fields)


# 참여 중 = 협업을 시작했고(started) 희망 종료일이 아직 안 지났거나 정하지 않은 요청이 있음
ENGAGED_SQL = """
    SELECT expert_id, MAX(end_date) AS engaged_until
    FROM collaboration_request
    WHERE status = 'started' AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    GROUP BY expert_id
"""


def search_experts(
    query: str, able_work_ids: list[str], category_ids: list[str], offset: int, limit: int
) -> dict:
    """공개 전문가 목록. 정렬: 지금 협업 가능한 사람(최근 가입 순) → 참여 중인 사람(종료일 빠른 순)."""
    group_ids, field_ids = expand_query(query)
    conditions = ["e.is_public = TRUE", "u.status = 'active'", "u.user_role = 'expert'"]
    params: list = []

    if able_work_ids:  # 고른 일 중 하나라도 할 수 있으면
        conditions.append(
            "EXISTS (SELECT 1 FROM expert_able_work w"
            " WHERE w.user_id = e.user_id AND w.able_work_id = ANY(%s))"
        )
        params.append(able_work_ids)
    if category_ids:  # 고른 분야(대분류) 중 하나라도 도메인 경험이 있으면
        conditions.append(
            "EXISTS (SELECT 1 FROM expert_domain d JOIN research_field f ON f.field_id = d.field_id"
            " WHERE d.user_id = e.user_id AND f.field_category_id = ANY(%s))"
        )
        params.append(category_ids)
    if query.strip():
        # %, _ 는 LIKE에서 특별한 뜻이라, 글자 그대로 찾도록 앞에 역슬래시를 붙입니다.
        like = "%" + re.sub(r"([%_\\])", r"\\\1", query.strip()) + "%"
        conditions.append(
            """(
            u.nickname ILIKE %s OR e.introduce ILIKE %s
            OR EXISTS (SELECT 1 FROM expert_able_work w JOIN able_work a ON a.able_work_id = w.able_work_id
                       WHERE w.user_id = e.user_id AND (a.name ILIKE %s OR w.able_work_id = ANY(%s)))
            OR EXISTS (SELECT 1 FROM expert_domain d
                       JOIN research_field f ON f.field_id = d.field_id
                       JOIN field_category c ON c.field_category_id = f.field_category_id
                       WHERE d.user_id = e.user_id
                         AND (f.name ILIKE %s OR c.name ILIKE %s OR d.field_id = ANY(%s)))
            OR EXISTS (SELECT 1 FROM portfolio p WHERE p.user_id = e.user_id AND p.title ILIKE %s)
            )"""
        )
        params += [like, like, like, group_ids, like, like, field_ids, like]

    base = f"""
        FROM expert e
        JOIN users u ON u.user_id = e.user_id
        LEFT JOIN ({ENGAGED_SQL}) g ON g.expert_id = e.user_id
        WHERE {" AND ".join(conditions)}
    """
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(f"SELECT COUNT(*) AS total {base}", params)
        total = cursor.fetchone()["total"]
        cursor.execute(
            f"""
            SELECT e.user_id, u.nickname, u.user_photo, e.introduce,
                   g.expert_id IS NOT NULL AS engaged, g.engaged_until
            {base}
            ORDER BY engaged, g.engaged_until NULLS LAST, e.created_at DESC, e.user_id DESC
            LIMIT %s OFFSET %s
            """,
            [*params, limit, offset],
        )
        rows = cursor.fetchall()
        ids = [row["user_id"] for row in rows]
        works = group_by_user(
            cursor, ids, "expert_able_work", "able_work_id", "expert_able_work_id"
        )
        domains = group_by_user(cursor, ids, "expert_domain", "field_id", "expert_domain_id")

    for row in rows:
        row["able_work_ids"] = works.get(row["user_id"], [])
        row["domain_ids"] = domains.get(row["user_id"], [])
    return {
        "total": total,
        "items": rows,
        # 같은 뜻으로 함께 찾은 분류 (화면에 '○○과 같은 뜻으로 함께 찾았어요' 안내용)
        "matched": {"able_work_ids": group_ids, "field_ids": field_ids},
    }


def group_by_user(cursor, user_ids: list[int], table: str, column: str, order: str) -> dict:
    """여러 전문가의 고른 값을 한 번에 읽어 {user_id: [값, ...]}로 묶습니다."""
    if not user_ids:
        return {}
    cursor.execute(
        f"SELECT user_id, {column} AS value FROM {table} WHERE user_id = ANY(%s) ORDER BY {order}",
        (user_ids,),
    )
    grouped: dict[int, list[str]] = {}
    for row in cursor.fetchall():
        grouped.setdefault(row["user_id"], []).append(row["value"])
    return grouped


def load_engagement(user_id: int) -> dict:
    """한 전문가의 참여 상태. 협업 요청 창의 '지금 협업 중이라 ○월 ○일부터' 안내에 씁니다."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            f"SELECT engaged_until FROM ({ENGAGED_SQL}) g WHERE expert_id = %s", (user_id,)
        )
        row = cursor.fetchone()
    return {"engaged": row is not None, "engaged_until": row["engaged_until"] if row else None}

def load_collaborations(user_id: int) -> list[dict]:
    """이 서비스에서 진행한 연구 (협업을 시작한 요청). 최근에 시작한 것부터.

    title: 연구 제목 / partner_nickname: 함께한 연구회원 닉네임
    ongoing: 희망 종료일이 아직 안 지났으면 True (진행 중)
    """
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT cr.research_id, cr.start_date, cr.end_date, r.title,
                   u.nickname AS partner_nickname,
                   (cr.end_date >= CURRENT_DATE) AS ongoing
            FROM collaboration_request cr
            JOIN research r ON r.research_id = cr.research_id
            JOIN users u ON u.user_id = r.user_id
            WHERE cr.expert_id = %s AND cr.status = 'started'
            ORDER BY cr.start_date DESC, cr.request_id DESC
            """,
            (user_id,),
        )
        rows = cursor.fetchall()
        ids = [row["research_id"] for row in rows]
        categories: dict[int, list[str]] = {}
        works: dict[int, list[str]] = {}
        if ids:
            cursor.execute(
                "SELECT DISTINCT d.research_id, f.field_category_id FROM research_domain d"
                " JOIN research_field f ON f.field_id = d.field_id WHERE d.research_id = ANY(%s)"
                " ORDER BY f.field_category_id",
                (ids,),
            )
            for row in cursor.fetchall():
                categories.setdefault(row["research_id"], []).append(row["field_category_id"])
            cursor.execute(
                "SELECT research_id, able_work_id FROM research_able_work"
                " WHERE research_id = ANY(%s) ORDER BY research_able_work_id",
                (ids,),
            )
            for row in cursor.fetchall():
                works.setdefault(row["research_id"], []).append(row["able_work_id"])

    for row in rows:
        research_id = row.pop("research_id")
        row["category_ids"] = categories.get(research_id, [])
        row["able_work_ids"] = works.get(research_id, [])
    return rows