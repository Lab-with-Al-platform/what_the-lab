"""일괄 후보 입력은 가상 자료와 임시 DB에서만 검사합니다."""

from copy import deepcopy

import pytest
from fastapi import HTTPException

from app.insights import service
from tests.test_insight_workflow import (
    ADMIN_PATH,
    ORIGIN,
    PUBLIC_PATH,
    approve,
    create,
    login,
    make_draft,
    publish,
    submit,
)
from tests.test_insight_workflow import client as client  # noqa: PLC0414 - pytest fixture 재노출

IMPORT_PATH = f"{ADMIN_PATH}/import"


def import_request(client, drafts: list[dict], **options):
    return client.post(IMPORT_PATH, json={"drafts": drafts, **options}, headers=ORIGIN)


def test_preview_is_default_and_does_not_store_any_candidate(client):
    login(client)
    response = import_request(client, [make_draft("one"), make_draft("two")])
    assert response.status_code == 200, response.text
    assert response.json()["dry_run"] is True
    assert response.json()["would_create"] == 2
    assert response.json()["created"] == 0
    assert client.get(ADMIN_PATH).json()["total"] == 0
    assert client.get(PUBLIC_PATH).json()["total"] == 0


def test_three_imports_keep_one_unapproved_candidate_and_do_not_edit_it(client):
    login(client)
    draft = make_draft()
    first = import_request(client, [draft], dry_run=False).json()
    candidate_id = first["items"][0]["candidate_id"]
    before = client.get(f"{ADMIN_PATH}/{candidate_id}").json()
    draft["title"] = "재입력으로 기존 원고를 덮어쓰지 않음"
    for _ in range(2):
        result = import_request(client, [draft], dry_run=False)
        assert result.status_code == 200, result.text
        assert result.json()["created"] == 0
        assert result.json()["existing_preserved"] == 1
    assert client.get(ADMIN_PATH).json()["total"] == 1
    after = client.get(f"{ADMIN_PATH}/{candidate_id}").json()
    assert after == before
    assert after["status"] == "draft"
    assert client.get(PUBLIC_PATH).json()["total"] == 0


def test_import_clears_untrusted_verification_scores_and_keyword_links(client):
    login(client)
    draft = make_draft()
    draft["keyword_ids"] = ["CAP-FAKE"]
    draft["image_policy"] = "rights_checked"
    result = import_request(client, [draft], dry_run=False)
    assert result.status_code == 200, result.text
    candidate_id = result.json()["items"][0]["candidate_id"]
    detail = client.get(f"{ADMIN_PATH}/{candidate_id}").json()
    content = detail["revisions"][0]["content"]
    assert content["source"]["bibliography_checked"] is False
    assert content["source"]["access_level"] == "unknown"
    assert {claim["verification"] for claim in content["claims"]} == {"needs_review"}
    assert content["scores"] == content["keyword_ids"] == []
    assert content["image_policy"] == "no_image"
    assert detail["approved_revision"] is None
    assert any(event["action"] == "imported" for event in detail["events"])
    pending = submit(client, detail)
    response = client.post(
        f"{ADMIN_PATH}/{candidate_id}/approve",
        headers=ORIGIN,
        json={
            "expected_version": pending["version"],
            "reason": "검증 생략은 불가",
            "editorial_checked": True,
            "rights_checked": True,
        },
    )
    assert response.status_code == 422


def test_import_keeps_only_approved_keyword_suggestions(client):
    login(client)
    draft = make_draft()
    draft["keyword_ids"] = ["CAP023", "CAP-FAKE", "CAP024"]
    preview = import_request(client, [draft]).json()["items"][0]
    # 미리 보기에서 남길 ID와 버릴 ID를 함께 보여 줍니다.
    assert preview["keyword_ids"] == ["CAP023", "CAP024"]
    assert preview["dropped_keyword_ids"] == ["CAP-FAKE"]

    saved = import_request(client, [draft], dry_run=False).json()["items"][0]
    detail = client.get(f"{ADMIN_PATH}/{saved['candidate_id']}").json()
    assert detail["revisions"][0]["content"]["keyword_ids"] == ["CAP023", "CAP024"]
    assert detail["status"] == "draft" and detail["approved_revision"] is None
    assert any("수집 제안값" in event["reason"] for event in detail["events"] if event["action"] == "imported")


def test_same_doi_with_different_spelling_and_url_is_one_candidate(client):
    login(client)
    draft = make_draft()
    duplicate = deepcopy(draft)
    duplicate["source"]["doi"] = f"https://doi.org/{draft['source']['doi'].upper()}"
    duplicate["source"]["url"] = "https://example.org/official-mirror"
    result = import_request(client, [draft, duplicate], dry_run=False)
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["created"] == 1 and body["duplicate_in_batch"] == 1
    assert body["items"][0]["candidate_id"] == body["items"][1]["candidate_id"]
    assert body["items"][1]["duplicate_of"] == 0


def test_url_only_records_are_idempotent_but_similar_titles_are_not_merged(client):
    login(client)
    first, second = make_draft("one"), make_draft("two")
    first["source"]["doi"] = second["source"]["doi"] = None
    second["source"]["title"] = first["source"]["title"]
    result = import_request(client, [first, first, second], dry_run=False).json()
    assert result["created"] == 2 and result["duplicate_in_batch"] == 1
    assert import_request(client, [first, second], dry_run=False).json()["existing_preserved"] == 2


@pytest.mark.parametrize("dry_run", [True, False])
def test_conflicting_identifiers_reject_whole_batch(client, dry_run):
    login(client)
    first, second = make_draft("one"), make_draft("two")
    second["source"]["url"] = first["source"]["url"]
    response = import_request(client, [first, second], dry_run=dry_run)
    assert response.status_code == 409
    assert client.get(ADMIN_PATH).json()["total"] == 0


def test_doi_and_url_pointing_to_different_existing_sources_do_not_merge(client):
    login(client)
    first, second = make_draft("one"), make_draft("two")
    create(client, first)
    create(client, second)
    first["source"]["url"] = second["source"]["url"]
    response = import_request(client, [make_draft("new"), first], dry_run=False)
    assert response.status_code == 409
    assert client.get(ADMIN_PATH).json()["total"] == 2


def test_import_does_not_overwrite_manual_pending_revision(client):
    login(client)
    draft = make_draft()
    original = submit(client, create(client, draft))
    before = client.get(f"{ADMIN_PATH}/{original['id']}").json()
    draft["summary"] = "수동 편집 내용을 이 문장으로 바꾸지 않음"
    result = import_request(client, [draft], dry_run=False).json()
    assert result["existing_preserved"] == 1
    assert client.get(f"{ADMIN_PATH}/{original['id']}").json() == before


@pytest.mark.parametrize("published", [False, True])
def test_reimport_preserves_approval_and_published_snapshot(client, published):
    login(client)
    draft = make_draft()
    original = approve(client, submit(client, create(client, draft)))
    if published:
        assert publish(client, original).status_code == 200
    before = client.get(f"{ADMIN_PATH}/{original['id']}").json()
    public_before = client.get(PUBLIC_PATH).json()
    draft["title"] = "기존 승인·공개본을 이 원고로 대체하지 않음"
    response = import_request(client, [draft], dry_run=False)
    assert response.status_code == 200, response.text
    assert response.json()["existing_preserved"] == 1
    assert client.get(f"{ADMIN_PATH}/{original['id']}").json() == before
    assert client.get(PUBLIC_PATH).json() == public_before


@pytest.mark.parametrize("existing", [False, True])
def test_duplicate_slugs_for_different_sources_reject_batch(client, existing):
    login(client)
    first, second = make_draft("one"), make_draft("two")
    second["slug"] = first["slug"]
    if existing:
        create(client, first)
    response = import_request(client, [first, second], dry_run=False)
    assert response.status_code == 409
    assert client.get(ADMIN_PATH).json()["total"] == int(existing)


def test_later_write_failure_rolls_back_earlier_candidate(client, monkeypatch):
    login(client)
    original = service.create_candidate
    calls = 0

    def fail_second(session, draft, actor):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise HTTPException(409, "동시 입력 충돌을 재현")
        return original(session, draft, actor)

    monkeypatch.setattr(service, "create_candidate", fail_second)
    response = import_request(client, [make_draft("one"), make_draft("two")], dry_run=False)
    assert response.status_code == 409
    assert client.get(ADMIN_PATH).json()["total"] == 0


def test_import_requires_admin_origin_and_enabled_feature(client, monkeypatch):
    assert import_request(client, [make_draft()]).status_code == 401
    login(client, "200000000000000001")
    assert import_request(client, [make_draft()]).status_code == 403
    login(client)
    assert client.post(IMPORT_PATH, json={"drafts": [make_draft()]}).status_code == 403
    monkeypatch.setenv("INSIGHTS_ENABLED", "false")
    assert import_request(client, [make_draft()]).status_code == 404


@pytest.mark.parametrize(
    "options",
    [
        {"drafts": []},
        {"drafts": [make_draft()] * 51},
        {"drafts": [make_draft()], "dry_run": "false"},
        {"drafts": [make_draft()], "approved": True},
    ],
)
def test_batch_limits_and_strict_options(client, options):
    login(client)
    response = client.post(IMPORT_PATH, json=options, headers=ORIGIN)
    assert response.status_code == 422
    assert client.get(ADMIN_PATH).json()["total"] == 0
