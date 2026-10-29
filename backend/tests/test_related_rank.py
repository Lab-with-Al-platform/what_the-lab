"""관련 항목 판정은 DB 없이 규칙만 검사합니다."""

from app.related_rank import is_related, split_category_ids, split_work_ids


def test_work_ids_keep_able_work_and_skip_capability():
    assert split_work_ids("UG04,CAP023,UG04") == ["UG04"]


def test_category_ids_drop_field_detail_ids():
    assert split_category_ids("F02,FIELD011,F02") == ["F02"]


def test_empty_preference_is_never_related():
    assert is_related(["UG04"], ["F02"], [], []) is False


def test_overlapping_work_is_related_and_unrelated_stays_visible_rule():
    assert is_related(["UG04", "UG01"], ["F01"], ["UG04"], []) is True
    assert is_related(["UG11"], ["F08"], ["UG04"], ["F02"]) is False
