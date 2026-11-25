"""출처 용도는 복수 선택이며 기존 설정·사용자의 명시적 선택을 보존합니다."""

from contextlib import contextmanager
from copy import deepcopy

import pytest
from pydantic import ValidationError

from app.insight_source_setup import update_source_settings
from app.insights.collection_sources import extend_collection_sources, recommended_sources
from app.insights.database import get_session
from app.insights.models import CollectionSetting
from app.insights.workspace_schemas import CollectionSource
from app.main import app
from app.routers.insight_workspace import default_collection_config
from tests.test_insight_workflow import ORIGIN, login
from tests.test_insight_workflow import client as client  # noqa: PLC0414

PATH = "/api/v1/admin/insights/collection-settings"


def test_eleven_recommended_sources_have_valid_unique_urls_and_expected_purposes():
    sources = [CollectionSource.model_validate(source) for source in recommended_sources()]
    assert len(sources) == len({source.url for source in sources}) == 11
    assert all(source.selected and source.content_kinds for source in sources)
    assert sources[0].content_kinds == ["case", "trend"]
    assert sources[3].content_kinds == ["case"]
    assert sources[-1].content_kinds == ["trend"]


def test_old_saved_settings_get_compatible_labels_without_writing(client):
    login(client)
    config = default_collection_config()
    config["sources"] = config["sources"][:3]
    for source in config["sources"]:
        source.pop("content_kinds")
    with contextmanager(app.dependency_overrides[get_session])() as session:
        session.add(
            CollectionSetting(id="collection", version=3, content=config, updated_by="test")
        )
    response = client.get(PATH).json()
    assert response["version"] == 3 and len(response["config"]["sources"]) == 3
    assert all(
        source["content_kinds"] == ["case", "trend"] for source in response["config"]["sources"]
    )
    with contextmanager(app.dependency_overrides[get_session])() as session:
        assert session.get(CollectionSetting, "collection").content == config


def test_purpose_selections_save_reload_and_keep_version_conflicts(client):
    login(client)
    config = client.get(PATH).json()["config"]
    config["sources"][0]["content_kinds"] = ["trend"]
    config["sources"][1]["content_kinds"] = []
    body = {"expected_version": 0, "config": config}
    saved = client.put(PATH, headers=ORIGIN, json=body)
    assert saved.status_code == 200
    assert client.get(PATH).json()["config"] == config
    assert client.put(PATH, headers=ORIGIN, json=body).status_code == 409
    assert saved.json()["execution_available"] is False


@pytest.mark.parametrize(
    "kinds", [["unknown"], ["case", "case"], ["case", "trend", "case"], "case", None]
)
def test_invalid_purposes_are_rejected_by_server(client, kinds):
    login(client)
    config = client.get(PATH).json()["config"]
    config["sources"][0]["content_kinds"] = kinds
    response = client.put(PATH, headers=ORIGIN, json={"expected_version": 0, "config": config})
    assert response.status_code == 422
    assert client.get(PATH).json()["saved"] is False


def test_unknown_custom_source_stays_unclassified_and_explicit_empty_is_preserved():
    source = CollectionSource(name="사용자 출처", url="https://example.org/research")
    assert source.content_kinds == []
    assert (
        CollectionSource(
            name="의도적 미분류", url="https://arxiv.org", content_kinds=[]
        ).content_kinds
        == []
    )
    with pytest.raises(ValidationError):
        CollectionSource(name="잘못된 설정", url="https://arxiv.org", selected="false")


def test_catalog_extension_preserves_period_keywords_names_selection_and_original_object():
    config = default_collection_config()
    config.update(interval_days=13, preferred_time="14:15", max_items=9, keywords=["사용자 연구어"])
    config["sources"] = config["sources"][:3]
    config["sources"][0].update(name="팀에서 바꾼 이름", selected=False, content_kinds=[])
    config["sources"][1].pop("content_kinds")
    before = deepcopy(config)
    result = extend_collection_sources(config)
    assert config == before
    assert len(result["sources"]) == 11
    assert result["sources"][0] == before["sources"][0]
    assert result["sources"][1]["content_kinds"] == ["case", "trend"]
    assert {key: value for key, value in result.items() if key != "sources"} == {
        key: value for key, value in before.items() if key != "sources"
    }
    assert extend_collection_sources(result) == result


def test_catalog_extension_never_deletes_existing_sources_to_fit_limit():
    config = default_collection_config()
    config["sources"] = [
        {"name": f"사용자 {index}", "url": f"https://example.org/{index}", "selected": False}
        for index in range(20)
    ]
    before = deepcopy(config)
    with pytest.raises(ValueError, match="상한"):
        extend_collection_sources(config)
    assert config == before


def test_setup_saves_once_and_preserves_user_configuration(client):
    config = default_collection_config()
    config["interval_days"] = 11
    config["sources"] = config["sources"][:3]
    config["sources"][0]["selected"] = False
    with contextmanager(app.dependency_overrides[get_session])() as session:
        session.add(
            CollectionSetting(id="collection", version=8, content=config, updated_by="test")
        )
    with contextmanager(app.dependency_overrides[get_session])() as session:
        result = update_source_settings(session)
        assert result["changed"] and result["version"] == 9 and result["source_count"] == 11
        assert session.get(CollectionSetting, "collection").content["interval_days"] == 11
        assert (
            session.get(CollectionSetting, "collection").content["sources"][0]["selected"] is False
        )
        assert update_source_settings(session)["changed"] is False
        assert result["collection_executed"] is False
