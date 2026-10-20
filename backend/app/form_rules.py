"""입력값 검사 도우미. 화면에서 막더라도 API에서 한 번 더 확인합니다."""

import re

from fastapi import HTTPException

MONTH = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")  # 2026-10
YEAR = re.compile(r"^\d{4}$")  # 2026


def required_text(value: str | None, max_length: int, label: str) -> str:
    """앞뒤 공백을 지우고, 비었거나 너무 길면 400."""
    value = (value or "").strip()
    if not value:
        raise bad_request(f"{label}{josa(label, '을', '를')} 입력해 주세요")
    if len(value) > max_length:
        raise bad_request(f"{label}{josa(label, '은', '는')} {max_length}자 이내로 입력해 주세요")
    return value


def optional_text(value: str | None, max_length: int, label: str) -> str | None:
    """선택 항목. 비어 있으면 None(= 입력 안 함)."""
    value = (value or "").strip()
    if len(value) > max_length:
        raise bad_request(f"{label}{josa(label, '은', '는')} {max_length}자 이내로 입력해 주세요")
    return value or None


def unique_list(values: list[str], minimum: int, maximum: int, label: str) -> list[str]:
    """순서를 지키며 중복을 지우고 개수를 확인합니다."""
    unique = list(dict.fromkeys(values))
    if minimum <= len(unique) <= maximum:
        return unique
    if minimum == 0:
        raise bad_request(f"{label}{josa(label, '은', '는')} {maximum}개까지 넣을 수 있어요")
    raise bad_request(f"{label}{josa(label, '을', '를')} {minimum}~{maximum}개 골라 주세요")


def check_pattern(value: str | None, pattern: re.Pattern, label: str) -> str:
    if not value or not pattern.match(value):
        raise bad_request(f"{label} 형식이 올바르지 않아요")
    return value


def optional_pattern(value: str | None, pattern: re.Pattern, label: str) -> str | None:
    """선택 항목인 연도·달. 비어 있으면 None."""
    return check_pattern(value, pattern, label) if value else None


def bad_request(message: str) -> HTTPException:
    return HTTPException(status_code=400, detail=message)


def josa(word: str, with_final: str, without_final: str) -> str:
    """마지막 글자에 받침이 있으면 '을/은', 없으면 '를/는'. 예: 소개→를, 지역→을"""
    code = ord(word[-1]) - 0xAC00  # 한글 '가'부터의 순번
    has_final = 0 <= code < 11172 and code % 28 != 0
    return with_final if has_final else without_final