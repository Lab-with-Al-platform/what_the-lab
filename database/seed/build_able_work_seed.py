"""택소노미 UG 목록 → 할 수 있는 일 기준표(able_work) 시드 SQL을 만듭니다.

실행 (저장소 맨 위 폴더에서):
    python database/seed/build_able_work_seed.py

입력: taxonomy/v4.0/ui-filter-groups.json
출력: database/init/003_seed_able_work.sql
"""
import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
TAXONOMY_VERSION = "4.0"  # 분류표 버전을 올리면 여기와 아래 경로를 같이 바꿉니다.
SOURCE_JSON = ROOT_DIR / "taxonomy" / "v4.0" / "ui-filter-groups.json"
OUTPUT_SQL = ROOT_DIR / "database" / "init" / "003_seed_able_work.sql"


def sql_text(value: str) -> str:
    """SQL 문자열 안의 작은따옴표를 이스케이프합니다."""
    return "'" + value.replace("'", "''") + "'"


def to_values_row(group: dict) -> str:
    show_default = "TRUE" if group["show_default"] else "FALSE"
    return (
        f"  ({sql_text(group['id'])}, {sql_text(group['label_ko'])}, {group['sort_order']}, "
        f"{show_default}, {sql_text(group['status'])}, {sql_text(TAXONOMY_VERSION)})"
    )


def main() -> None:
    groups = json.loads(SOURCE_JSON.read_text(encoding="utf-8"))
    values = ",\n".join(to_values_row(group) for group in sorted(groups, key=lambda g: g["sort_order"]))
    OUTPUT_SQL.write_text(
        "-- build_able_work_seed.py 가 만든 파일입니다. 직접 고치지 말고 스크립트를 다시 실행하세요.\n"
        "INSERT INTO able_work (able_work_id, name, sort_order, show_default, status, taxonomy_ver) VALUES\n"
        f"{values};\n",
        encoding="utf-8",
    )
    print(f"할 수 있는 일 {len(groups)}개 → {OUTPUT_SQL.name}")


if __name__ == "__main__":
    main()