"""가짜 출처·가짜 완성만으로 조사부터 전송 검사까지 돌립니다. 실제 논문·모델을 검증하지 않습니다."""

import json
from datetime import UTC, datetime

from app.insights.agent_contract import WritingBudget, writing_budget_for_tests
from app.insights.agent_flow import (
    SourceAccessError,
    run_virtual_flow,
    virtual_complete,
    write_virtual_bundle,
)
from app.insights.collection_policy import DiscoveryPolicy, discovery_windows
from app.insights.transfer_contract import validate_transfer_bytes
from app.insights.workspace_schemas import CollectionConfig

SOURCE = "https://example.org/fictional-study"
RUN_ID = "offline-flow-001"
NOW = datetime(2026, 10, 29, 8, 0, tzinfo=UTC)


def sample_config(**policy_fields: object) -> CollectionConfig:
    policy = DiscoveryPolicy.model_validate(
        {"enabled": False, "target_candidates": 2, "max_source_requests": 8, **policy_fields}
    )
    return CollectionConfig.model_validate(
        {
            "sources": [
                {
                    "name": "가상 출처",
                    "url": SOURCE,
                    "selected": True,
                    "content_kinds": ["case", "trend"],
                }
            ],
            "discovery_policy": policy.model_dump(mode="json"),
        }
    )


def ok_hit(**overrides: object) -> dict:
    hit = {
        "url": SOURCE,
        "title": "가상 연구 설명",
        "doi": None,
        "published": {"value": "2026-10-01", "precision": "day"},
        "excerpt": "가상 초록입니다.",
        "access": "ok",
    }
    hit.update(overrides)
    return hit


def lookup_hits(hits: list[dict]):
    def lookup(url: str, profile: str, _window: tuple[int, int]) -> list[dict]:
        if url != SOURCE or profile == "news":
            return []
        return hits

    return lookup


def test_virtual_case_and_trend_pass_transfer_check(tmp_path):
    result = run_virtual_flow(
        sample_config(),
        lookup=lookup_hits([ok_hit()]),
        run_id=RUN_ID,
        now=NOW,
    )
    assert result.outcome == "ready_for_review"
    assert result.item_count == 2
    assert result.publication_approved is False
    bundle = validate_transfer_bytes(result.bundle_bytes)
    assert {item.draft.kind for item in bundle.items} == {"case", "trend"}
    assert bundle.items[0].draft.slug != bundle.items[1].draft.slug
    assert bundle.items[0].article.sections != bundle.items[1].article.sections
    assert all("가상" in item.article.sampleNotice for item in bundle.items)
    saved = write_virtual_bundle(result, tmp_path)
    assert saved == tmp_path / f"{RUN_ID}.json"
    assert "가상" in saved.read_text(encoding="utf-8")


def test_empty_lookup_is_insufficient_candidates():
    result = run_virtual_flow(sample_config(), lookup=lookup_hits([]), run_id=RUN_ID)
    assert result.outcome == "insufficient_candidates"
    assert result.bundle_bytes is None
    assert result.publication_approved is False


def test_unreachable_source_is_source_error():
    def lookup(_url: str, _profile: str, _window: tuple[int, int]) -> list[dict]:
        raise SourceAccessError("가상 접근 불가")

    result = run_virtual_flow(sample_config(), lookup=lookup, run_id=RUN_ID)
    assert result.outcome == "source_error"
    assert result.hold_reason == "source_unreachable"


def test_unknown_date_is_kept_and_not_filled_with_collection_day():
    result = run_virtual_flow(
        sample_config(),
        lookup=lookup_hits([ok_hit(published={"value": None, "precision": "unknown"})]),
        run_id=RUN_ID,
        now=NOW,
    )
    bundle = validate_transfer_bytes(result.bundle_bytes)
    published = bundle.items[0].source_published
    assert published.precision == "unknown"
    assert published.value is None
    assert "2026-10-29" not in json.dumps(published.model_dump(mode="json"))


def test_missing_evidence_ref_is_needs_revision():
    result = run_virtual_flow(
        sample_config(),
        lookup=lookup_hits([ok_hit()]),
        extra_payload={"drop_evidence": True},
        writing=WritingBudget(
            max_model_calls=6, max_tokens=8000, max_revision_rounds=1, max_wall_seconds=30
        ),
        run_id=RUN_ID,
    )
    assert result.outcome == "needs_revision"
    assert result.bundle_bytes is None


def test_invalid_model_json_is_model_error():
    def complete(_role: str, _payload: dict) -> object:
        return "this-is-not-json"

    result = run_virtual_flow(
        sample_config(),
        lookup=lookup_hits([ok_hit()]),
        complete=complete,
        run_id=RUN_ID,
    )
    assert result.outcome == "model_error"
    assert result.hold_reason == "invalid_model_json"


def test_same_slug_for_case_and_trend_is_rejected():
    result = run_virtual_flow(
        sample_config(),
        lookup=lookup_hits([ok_hit()]),
        extra_payload={"same_slug": True},
        run_id=RUN_ID,
    )
    assert result.outcome == "duplicate_slug"
    assert result.bundle_bytes is None


def test_revision_cap_holds_incomplete_glossary():
    result = run_virtual_flow(
        sample_config(),
        lookup=lookup_hits([ok_hit()]),
        extra_payload={"omit_glossary": True},
        writing=WritingBudget(
            max_model_calls=6, max_tokens=8000, max_revision_rounds=1, max_wall_seconds=30
        ),
        run_id=RUN_ID,
    )
    assert result.outcome == "needs_revision"
    assert result.usage.revision_rounds == 1
    assert result.bundle_bytes is None


def test_request_cap_is_held_not_forced_through():
    second = {
        "name": "가상 출처 2",
        "url": "https://example.org/fictional-other",
        "selected": True,
        "content_kinds": ["case"],
    }
    data = sample_config(max_source_requests=1).model_dump(mode="json")
    data["sources"].append(second)
    config = CollectionConfig.model_validate(data)
    result = run_virtual_flow(config, lookup=lookup_hits([]), run_id=RUN_ID)
    assert result.outcome == "held"
    assert result.hold_reason == "budget_exhausted"
    assert result.usage.source_requests == 1


def test_time_cap_is_held():
    result = run_virtual_flow(
        sample_config(),
        lookup=lookup_hits([ok_hit()]),
        elapsed=lambda: 200,
        run_id=RUN_ID,
    )
    assert result.outcome == "held"
    assert result.hold_reason == "budget_exhausted"


def test_discovery_windows_stop_at_policy_caps():
    policy = DiscoveryPolicy(enabled=True, case_max_days=90, news_max_days=30, explanation_max_days=90)
    config = sample_config(
        enabled=True, case_max_days=90, news_max_days=30, explanation_max_days=90
    )
    result = run_virtual_flow(config, lookup=lookup_hits([ok_hit()]), run_id=RUN_ID)
    assert result.planned_windows["case"] == discovery_windows("case", policy)
    assert result.planned_windows["news"] == [(0, 30)]
    assert result.planned_windows["explanation"] == [(0, 30), (30, 90)]
    assert result.outcome == "ready_for_review"


def test_usage_log_omits_secret_and_full_prompt():
    secret = "fake-secret-must-not-be-logged"
    result = run_virtual_flow(sample_config(), lookup=lookup_hits([ok_hit()]), run_id=RUN_ID)
    text = json.dumps(result.logs, ensure_ascii=False)
    assert secret not in text
    assert "excerpt" not in text
    assert "virtual-ev-1" in text


def test_default_complete_does_not_name_a_provider():
    payload = {
        "evidence": {
            "evidence_id": "virtual-ev-1",
            "url": SOURCE,
            "title": "가상 연구 설명",
            "doi": None,
        }
    }
    output = virtual_complete("case_writer", payload)
    dumped = json.dumps(output, ensure_ascii=False).lower()
    assert "openai" not in dumped
    assert "anthropic" not in dumped
    assert writing_budget_for_tests().max_revision_rounds == 2
