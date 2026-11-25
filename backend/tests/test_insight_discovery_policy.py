"""확장은 후보 수를 채우기 위한 무제한 검색이 아니며, 설정 저장만 수행합니다."""

from contextlib import contextmanager
from copy import deepcopy

import pytest
from pydantic import ValidationError

from app.insight_discovery_setup import update_discovery_settings
from app.insights.collection_policy import (
    DiscoveryPolicy,
    discovery_windows,
    recommended_discovery_policy,
)
from app.insights.database import get_session
from app.insights.models import CollectionSetting
from app.insights.workspace_schemas import CollectionConfig
from app.main import app
from app.routers.insight_workspace import default_collection_config
from tests.test_insight_workflow import ORIGIN, login
from tests.test_insight_workflow import client as client  # noqa: PLC0414

PATH = "/api/v1/admin/insights/collection-settings"


@pytest.mark.parametrize(
    "profile,ends",
    [("case", [30, 60, 90, 180, 365]), ("news", [30, 60, 90]), ("explanation", [30, 90, 365])],
)
def test_profiles_only_plan_additional_non_overlapping_windows(profile, ends):
    policy = recommended_discovery_policy(6)
    windows = discovery_windows(profile, policy)
    assert [end for _, end in windows] == ends
    assert windows[0][0] == 0
    assert all(windows[index][0] == windows[index - 1][1] for index in range(1, len(windows)))
    assert all(start < end for start, end in windows)
    assert sum(end - start for start, end in windows) == ends[-1]
    assert discovery_windows(profile, DiscoveryPolicy(enabled=False), 120) == [(0, 120)]


def test_cap_changes_trim_stages_without_inventing_extra_requests():
    assert discovery_windows("case", DiscoveryPolicy(enabled=True, case_max_days=90)) == [
        (0, 30),
        (30, 60),
        (60, 90),
    ]
    assert discovery_windows("news", DiscoveryPolicy(enabled=True, news_max_days=30)) == [(0, 30)]
    assert discovery_windows(
        "explanation", DiscoveryPolicy(enabled=True, explanation_max_days=90)
    ) == [(0, 30), (30, 90)]


@pytest.mark.parametrize(
    "field,value",
    [
        ("news_max_days", 365),
        ("case_max_days", 730),
        ("enabled", "true"),
        ("max_source_requests", 0),
        ("max_run_seconds", 601),
        ("historical_discovery", "unlimited"),
        ("date_basis", "collected"),
    ],
)
def test_invalid_policy_values_are_rejected(field, value):
    with pytest.raises(ValidationError):
        DiscoveryPolicy.model_validate({field: value})


def test_legacy_configuration_is_read_without_enabling_or_losing_custom_period(client):
    login(client)
    legacy = default_collection_config()
    legacy.pop("discovery_policy")
    legacy.update(lookback_days=120, max_items=1)
    before = deepcopy(legacy)
    with contextmanager(app.dependency_overrides[get_session])() as session:
        session.add(
            CollectionSetting(id="collection", version=5, content=legacy, updated_by="test")
        )
    response = client.get(PATH).json()
    assert response["config"]["lookback_days"] == 120
    assert response["config"]["discovery_policy"]["enabled"] is False
    assert response["config"]["discovery_policy"]["target_candidates"] == 1
    with contextmanager(app.dependency_overrides[get_session])() as session:
        assert session.get(CollectionSetting, "collection").content == before


def test_target_must_not_exceed_storage_and_enabled_policy_starts_at_30_days(client):
    login(client)
    config = client.get(PATH).json()["config"]
    config["max_items"] = 1
    assert (
        client.put(PATH, headers=ORIGIN, json={"expected_version": 0, "config": config}).status_code
        == 422
    )
    config["discovery_policy"]["target_candidates"] = 1
    config["lookback_days"] = 60
    assert (
        client.put(PATH, headers=ORIGIN, json={"expected_version": 0, "config": config}).status_code
        == 422
    )
    config["lookback_days"] = 30
    assert (
        client.put(PATH, headers=ORIGIN, json={"expected_version": 0, "config": config}).status_code
        == 200
    )
    assert client.get(PATH).json()["config"] == config
    assert client.get(PATH).json()["execution_available"] is False


def test_recommended_update_preserves_sources_keywords_and_storage_cap(client):
    config = default_collection_config()
    config.pop("discovery_policy")
    config.update(max_items=1, interval_days=13, preferred_time="14:10", keywords=["원래 검색어"])
    config["sources"][0]["selected"] = False
    before = deepcopy(config)
    with contextmanager(app.dependency_overrides[get_session])() as session:
        session.add(
            CollectionSetting(id="collection", version=2, content=config, updated_by="test")
        )
    with contextmanager(app.dependency_overrides[get_session])() as session:
        with pytest.raises(ValueError, match="버전"):
            update_discovery_settings(session, 1)
        result = update_discovery_settings(session, 2)
        assert result["version"] == 3 and result["max_items"] == 1
        assert result["discovery_policy"]["target_candidates"] == 1
        stored = session.get(CollectionSetting, "collection").content
        assert {key: stored[key] for key in before} == before
        assert not update_discovery_settings(session, 3)["changed"]


def test_configuration_cross_checks_also_apply_outside_http():
    config = default_collection_config()
    config["discovery_policy"]["target_candidates"] = config["max_items"] + 1
    with pytest.raises(ValidationError, match="최대 저장 수"):
        CollectionConfig.model_validate(config)
