"""맞는 전문가·글을 위로 올리는 규칙입니다. 안 맞는 항목은 숨기지 않습니다."""

from __future__ import annotations


def split_work_ids(value: str) -> list[str]:
    """'UG04,CAP023' → ['UG04']. UG가 아닌 값은 버립니다."""
    return _unique_prefixed(value, "UG")


def split_category_ids(value: str) -> list[str]:
    """'F02,FIELD011' → ['F02']. FIELD 상세 ID는 대분류와 헷갈리지 않게 뺍니다."""
    ids: list[str] = []
    seen: set[str] = set()
    for raw in value.split(","):
        item = raw.strip()
        if item.startswith("FIELD") or not item.startswith("F") or len(item) > 10:
            continue
        if item in seen:
            continue
        seen.add(item)
        ids.append(item)
    return ids


def is_related(
    able_work_ids: list[str],
    category_ids: list[str],
    prefer_works: list[str],
    prefer_fields: list[str],
) -> bool:
    """맡길 일(UG)이나 분야 대분류(F)가 하나라도 겹치면 관련 항목입니다."""
    if prefer_works and set(able_work_ids) & set(prefer_works):
        return True
    return bool(prefer_fields and set(category_ids) & set(prefer_fields))


def _unique_prefixed(value: str, prefix: str) -> list[str]:
    ids: list[str] = []
    seen: set[str] = set()
    for raw in value.split(","):
        item = raw.strip()
        if not item.startswith(prefix) or len(item) > 10:
            continue
        if item in seen:
            continue
        seen.add(item)
        ids.append(item)
    return ids
