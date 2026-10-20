"""분류표 보기 목록: 화면의 도메인(연구 분야) 칩을 그릴 때 씁니다."""

from fastapi import APIRouter

from app.db import get_connection

router = APIRouter(prefix="/api/v1/taxonomy", tags=["taxonomy"])


@router.get("/fields")
def list_fields() -> list[dict]:
    """연구 분야 대분류 10개와, 각 대분류 안의 세부 분야를 묶어서 돌려줍니다. 폐기(retired)된 항목은 뺍니다."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT c.field_category_id, c.name AS category_name, f.field_id, f.name AS field_name
            FROM field_category c
            JOIN research_field f ON f.field_category_id = c.field_category_id
            WHERE c.status <> 'retired' AND f.status <> 'retired'
            ORDER BY c.sort_order, f.sort_order
            """
        )
        rows = cursor.fetchall()

    # 한 줄씩 온 결과를 대분류별로 묶습니다. (dict는 넣은 순서를 지켜서 정렬 순서가 유지돼요)
    categories: dict[str, dict] = {}
    for row in rows:
        category = categories.setdefault(
            row["field_category_id"],
            {
                "field_category_id": row["field_category_id"],
                "name": row["category_name"],
                "fields": [],
            },
        )
        category["fields"].append({"field_id": row["field_id"], "name": row["field_name"]})
    return list(categories.values())