"""연구회원 내 연구 읽기. 조회 API와 저장 API가 모두 이 함수로 최신 목록을 돌려줍니다."""

from fastapi import HTTPException

from app.db import get_connection

# 여러 개 고르는 값이 들어 있는 표: 응답 이름 → (표 이름, 값 컬럼, 정렬용 번호 컬럼)
CHILD_TABLES = {
    "field_ids": ("research_domain", "field_id", "research_domain_id"),
    "able_work_ids": ("research_able_work", "able_work_id", "research_able_work_id"),
    "data_types": ("research_data_type", "data_type", "research_data_type_id"),
    "outputs": ("research_output", "output_type", "research_output_id"),
    "rewards": ("research_reward", "reward_type", "research_reward_id"),
}


def load_researches(user_id: int) -> list[dict]:
    """내 연구 목록 (최근 작성 순). 화면의 Research 타입과 같은 모양이에요."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT research_id, status, is_primary, title, description, data_status, share_policy,
                   share_condition, task_unsure, meeting_type, face_to_area, created_at, updated_at
            FROM research
            WHERE user_id = %s
            ORDER BY created_at DESC, research_id DESC
            """,
            (user_id,),
        )
        researches = cursor.fetchall()
        if not researches:
            return []

        ids = [research["research_id"] for research in researches]
        children = {name: load_child(cursor, ids, *table) for name, table in CHILD_TABLES.items()}

    for research in researches:
        research["is_primary"] = bool(research["is_primary"])  # MySQL은 TRUE를 1로 돌려줘요.
        research["task_unsure"] = bool(research["task_unsure"])
        research["description"] = research["description"] or ""
        for name, values in children.items():
            research[name] = values.get(research["research_id"], [])
    return researches


def load_child(cursor, research_ids: list[int], table: str, column: str, order_column: str) -> dict:
    """연구 여러 개의 고른 값을 한 번에 읽어 {research_id: [값, ...]}로 묶습니다. (연구마다 따로 묻지 않게)"""
    placeholders = ", ".join(["%s"] * len(research_ids))
    cursor.execute(
        f"SELECT research_id, {column} AS value FROM {table}"
        f" WHERE research_id IN ({placeholders}) ORDER BY {order_column}",
        research_ids,
    )
    grouped: dict[int, list[str]] = {}
    for row in cursor.fetchall():
        grouped.setdefault(row["research_id"], []).append(row["value"])
    return grouped


def require_researcher(user_id: int) -> None:
    """소속 인증을 마친 연구회원만 쓸 수 있어요. 아니면 403."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT 1 FROM `user` u
            JOIN researcher_profile r ON r.user_id = u.user_id
            WHERE u.user_id = %s AND u.user_role = 'researcher'
            """,
            (user_id,),
        )
        if cursor.fetchone() is None:
            raise HTTPException(status_code=403, detail="연구회원만 쓸 수 있어요")