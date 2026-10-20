"""택소노미 연구 분야(FIELD) → 분야 기준표(field_category, research_field) 시드 SQL을 만듭니다.

실행 (저장소 맨 위 폴더에서):
    python database/seed/build_research_field_seed.py

입력: taxonomy/v4.0/categories.json (대분류 F01~F10), taxonomy/v4.0/research-fields.json (세부 FIELD 83개)
출력: database/init/005_seed_research_field.sql
"""
import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
TAXONOMY_VERSION = "4.0"  # 분류표 버전을 올리면 여기와 아래 경로를 같이 바꿉니다.
TAXONOMY_DIR = ROOT_DIR / "taxonomy" / "v4.0"
OUTPUT_SQL = ROOT_DIR / "database" / "init" / "005_seed_research_field.sql"


def sql_text(value: str) -> str:
    """SQL 문자열 안의 작은따옴표를 이스케이프합니다."""
    return "'" + value.replace("'", "''") + "'"


def load(name: str) -> list[dict]:
    return json.loads((TAXONOMY_DIR / name).read_text(encoding="utf-8"))


def main() -> None:
    # categories.json에는 수행 기술(capability) 대분류도 같이 있어서 연구 분야만 고릅니다.
    categories = sorted(
        (item for item in load("categories.json") if item["axis"] == "research_field"),
        key=lambda item: item["id"],
    )
    fields = sorted(load("research-fields.json"), key=lambda item: (item["category_id"], item["sort_order"]))

    category_rows = [
        f"  ({sql_text(item['id'])}, {sql_text(item['label_ko'])}, {order}, {sql_text(item['status'])}, {sql_text(TAXONOMY_VERSION)})"
        for order, item in enumerate(categories, start=1)
    ]
    field_rows = [
        f"  ({sql_text(item['id'])}, {sql_text(item['category_id'])}, {sql_text(item['label_ko'])}, "
        f"{item['sort_order']}, {sql_text(item['status'])}, {sql_text(TAXONOMY_VERSION)})"
        for item in fields
    ]

    OUTPUT_SQL.write_text(
        "-- build_research_field_seed.py 가 만든 파일입니다. 직접 고치지 말고 스크립트를 다시 실행하세요.\n"
        "SET NAMES utf8mb4;  -- 한글이 깨지지 않게 utf8mb4로 읽으라고 알려 줍니다.\n\n"
        "INSERT INTO field_category (field_category_id, name, sort_order, status, taxonomy_ver) VALUES\n"
        + ",\n".join(category_rows)
        + ";\n\n"
        "INSERT INTO research_field (field_id, field_category_id, name, sort_order, status, taxonomy_ver) VALUES\n"
        + ",\n".join(field_rows)
        + ";\n",
        encoding="utf-8",
    )
    print(f"대분류 {len(category_rows)}개, 세부 분야 {len(field_rows)}개 → {OUTPUT_SQL}")


if __name__ == "__main__":
    main()