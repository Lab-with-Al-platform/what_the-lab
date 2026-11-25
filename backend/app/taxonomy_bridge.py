"""인사이트 기술 ID(CAP)와 전문가 '할 수 있는 일'(UG)을 같은 분류표로 잇습니다.

전문가는 가입 때 UG를 고르고, 인사이트 원고는 CAP을 붙입니다.
UG를 골랐다고 그 그룹의 CAP을 모두 가진 것은 아닙니다. 글 → 전문가 찾기만
CAP이 속한 UG로 넓혀서, 잘못된 skill=CAP023 주소를 만들지 않습니다.
"""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path
from urllib.parse import urlencode

TAXONOMY_DIR = Path(__file__).resolve().parents[2] / "taxonomy" / "v4.0"


@cache
def _group_by_capability() -> dict[str, tuple[str, ...]]:
    """CAP ID → 속한 UG ID들. 분류표 파일이 없으면 빈 사전입니다."""
    path = TAXONOMY_DIR / "ui-group-members.json"
    if not path.is_file():
        return {}
    grouped: dict[str, set[str]] = {}
    for member in json.loads(path.read_text(encoding="utf-8")):
        if member.get("status") == "retired":
            continue
        grouped.setdefault(member["capability_id"], set()).add(member["group_id"])
    return {cap_id: tuple(sorted(group_ids)) for cap_id, group_ids in grouped.items()}


def able_work_ids_for_keywords(keyword_ids: list[str]) -> list[str]:
    """원고의 CAP ID를 전문가가 고르는 UG ID로 바꿉니다. 모르는 ID는 건너뜁니다."""
    mapping = _group_by_capability()
    found: set[str] = set()
    for keyword_id in keyword_ids:
        found.update(mapping.get(keyword_id, ()))
    return sorted(found)


def expert_search_path(keyword_ids: list[str] | None = None, category_ids: list[str] | None = None) -> str:
    """전문가 찾기 주소. CAP을 주소에 넣지 않고 UG·대분류 ID만 붙입니다."""
    params: list[tuple[str, str]] = []
    works = able_work_ids_for_keywords(keyword_ids or [])
    fields = [
        item
        for item in dict.fromkeys(category_ids or [])
        if item.startswith("F") and not item.startswith("FIELD")
    ]
    if works:
        params.append(("works", ",".join(works)))
    if fields:
        params.append(("fields", ",".join(fields)))
    if not params:
        return "/experts"
    return "/experts?" + urlencode(params)
