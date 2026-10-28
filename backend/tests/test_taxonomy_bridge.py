"""인사이트 CAP과 전문가 UG가 같은 분류표로 이어지는지 검사합니다. DB는 쓰지 않습니다."""

from app.taxonomy_bridge import able_work_ids_for_keywords, expert_search_path


def test_object_detection_keyword_maps_to_image_group():
    assert able_work_ids_for_keywords(["CAP023"]) == ["UG04"]


def test_unknown_keyword_is_skipped_and_known_ids_remain():
    assert able_work_ids_for_keywords(["CAP999", "CAP023"]) == ["UG04"]


def test_empty_keywords_keep_plain_expert_path():
    assert expert_search_path([]) == "/experts"
    assert expert_search_path(None) == "/experts"


def test_keyword_search_path_uses_able_work_not_capability_id():
    path = expert_search_path(["CAP023"])
    assert path == "/experts?works=UG04"
    assert "CAP" not in path


def test_category_ids_are_appended_without_field_detail_ids():
    path = expert_search_path(["CAP023"], ["F02", "FIELD011", "F02"])
    assert path == "/experts?works=UG04&fields=F02"
