"""통합 목록·설정 저장·공개본을 보존하는 수정 판본의 실패 경계를 검사합니다."""

from contextlib import contextmanager
from copy import deepcopy
from io import StringIO
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import select

from app.insights.catalog_import import import_catalog
from app.insights.database import get_session
from app.insights.models import CollectionSetting
from app.main import app
from tests.test_insight_workflow import (
    ADMIN_PATH,
    ORIGIN,
    approve,
    create,
    login,
    make_draft,
    publish,
    submit,
)
from tests.test_insight_workflow import client as client  # noqa: PLC0414

WORKSPACE = "/api/v1/admin/insights/workspace"
SETTINGS = "/api/v1/admin/insights/collection-settings"


def article_document() -> dict:
    return {
        "slug": "test-public-original",
        "kind": "case",
        "title": "가상 검증용 공개 원고",
        "summary": "검증용 요약",
        "field": "검증 분야",
        "topicId": "research",
        "topicLabel": "검증",
        "domains": ["검증 분야"],
        "tags": ["가상 분류", "테스트 키워드"],
        "source": "가상 출처",
        "sourceUrl": "https://example.org/test-original",
        "publishedOn": "2026.10.10",
        "readingMinutes": 2,
        "cover": "chart",
        "highlights": [],
        "facts": [],
        "technologies": [],
        "relatedSlugs": [],
        "sampleNotice": "테스트용 가상 원고: 실제 연구 아님",
        "sections": [
            {
                "id": "body",
                "toc": "본문",
                "title": "본문",
                "paragraphs": [
                    {"kind": "caution", "text": "긴 원고도 줄이지 않고 보존합니다." * 200},
                    {"kind": "interpretation", "text": "가상 해설"},
                    {"kind": "application", "text": "가상 시험 제안"},
                ],
            }
        ],
        "glossary": [{"id": "term", "label": "가상 용어", "definition": "검증용"}],
    }


def seed_article() -> dict:
    article = article_document()
    with contextmanager(app.dependency_overrides[get_session])() as session:
        import_catalog(session, [article])
    return article


def test_workspace_permissions_filters_counts_sorting_and_projection(client):
    seed_article()
    assert client.get(WORKSPACE).status_code == 401
    login(client, "200000000000000001")
    assert client.get(WORKSPACE).status_code == 403
    login(client)
    newer = create(
        client,
        {
            **make_draft("list"),
            "research_field": "미게시 분야",
            "classification_tags": ["분류 초안"],
        },
    )
    all_rows = client.get(WORKSPACE).json()
    assert all_rows["counts"] == {"all": 2, "collected": 1, "published": 1}
    assert all_rows["items"][0]["id"] == newer["id"]
    assert all_rows["categories"] == ["검증 분야"]
    assert all_rows["keywords"] == ["가상 분류", "테스트 키워드"]
    assert "분류 초안" not in all_rows["keywords"]
    # 메뉴·검색·페이지가 달라져도 선택지는 게시 중인 원고의 분류만 유지합니다.
    assert client.get(WORKSPACE, params={"scope": "collected", "q": "없는 검색어"}).json()[
        "categories"
    ] == ["검증 분야"]
    assert "sections" not in all_rows["items"][0] and "revisions" not in all_rows["items"][0]
    assert client.get(WORKSPACE, params={"order": "oldest"}).json()["items"][0]["is_published"]
    assert client.get(WORKSPACE, params={"scope": "published"}).json()["total"] == 1
    assert (
        client.get(WORKSPACE, params={"keyword": "테스트 키워드", "category": "검증 분야"}).json()[
            "total"
        ]
        == 1
    )
    assert client.get(WORKSPACE, params={"keyword": "분류 초안"}).json()["total"] == 1
    assert client.get(WORKSPACE, params={"status": "published"}).json()["total"] == 1
    assert client.get(WORKSPACE, params={"q": "%"}).json()["total"] == 0
    assert client.get(WORKSPACE, params={"page_size": 1, "page": 2}).json()["total"] == 2
    assert client.get(WORKSPACE, params={"scope": "unknown"}).status_code == 422


def test_no_publications_means_empty_facet_options_without_hiding_candidates(client):
    login(client)
    create(client, {**make_draft("private-facets"), "classification_tags": ["미게시 전용"]})
    result = client.get(WORKSPACE).json()
    assert result["total"] == 1
    assert result["categories"] == [] and result["keywords"] == []


def test_first_publication_facets_use_published_fields_not_private_classification(client):
    login(client)
    draft = {
        **make_draft("public-facets"),
        "research_field": "공개 분야",
        "classification_tags": ["비공개 분류"],
    }
    candidate = create(client, draft)
    publish(client, approve(client, submit(client, candidate)))
    result = client.get(WORKSPACE).json()
    assert result["categories"] == ["공개 분야"]
    # 승인한 전체 원고의 tags가 이제 공개 스냅샷에도 포함됩니다.
    assert "비공개 분류" in result["keywords"]


def test_settings_save_is_shared_versioned_and_does_not_execute_collection(client):
    assert client.get(SETTINGS).status_code == 401
    login(client, "200000000000000001")
    assert client.get(SETTINGS).status_code == 403
    login(client)
    original = client.get(SETTINGS).json()
    assert (
        original["version"] == 0 and not original["saved"] and not original["execution_available"]
    )
    with contextmanager(app.dependency_overrides[get_session])() as session:
        assert (
            session.scalar(select(CollectionSetting)) is None
        )  # 단순 조회는 설정을 저장하지 않습니다.
    body = {"expected_version": 0, "config": original["config"]}
    assert client.put(SETTINGS, json=body).status_code == 403
    response = client.put(SETTINGS, json=body, headers=ORIGIN)
    assert response.status_code == 200
    assert response.json()["version"] == 1 and response.json()["saved"]
    assert not response.json()["execution_available"]
    assert client.put(SETTINGS, json=body, headers=ORIGIN).status_code == 409
    assert client.get(SETTINGS).json()["config"] == body["config"]
    assert client.get(WORKSPACE).json()["total"] == 0
    assert client.post("/api/v1/admin/insights/collect", headers=ORIGIN).status_code == 404


@pytest.mark.parametrize(
    "url",
    [
        "http://example.org",
        "https://127.0.0.1",
        "https://localhost",
        "https://foo.internal",
        "https://user:secret@example.org",
        "https://example.org?api_key=secret",
        "https://example.org:8443",
    ],
)
def test_settings_reject_internal_or_credential_urls(client, url):
    login(client)
    body = client.get(SETTINGS).json()["config"]
    body["sources"][0]["url"] = url
    assert (
        client.put(
            SETTINGS, headers=ORIGIN, json={"expected_version": 0, "config": body}
        ).status_code
        == 422
    )


def test_correction_preserves_public_copy_until_explicit_reapproval_and_publish(client):
    original = seed_article()
    login(client)
    item = client.get(WORKSPACE).json()["items"][0]
    public_path = f"/api/v1/insights/{original['slug']}"
    before = client.get(public_path).json()
    start_path = f"/api/v1/admin/insights/publications/{item['publication_id']}/correction"
    assert (
        client.post(
            start_path, headers=ORIGIN, json={"expected_version": 1, "reason": "가상 수정 검증"}
        ).status_code
        == 200
    )
    path = f"{ADMIN_PATH}/{item['id']}"
    detail = client.get(path).json()
    assert detail["status"] == "draft" and detail["current_revision"] == 2
    assert detail["article"] == original
    assert not detail["approval_check"]["ready"]
    assert client.get(public_path).json() == before
    assert client.get(WORKSPACE, params={"scope": "collected"}).json()["items"][0]["has_correction"]
    repeat = client.post(
        start_path,
        headers=ORIGIN,
        json={"expected_version": detail["version"], "reason": "이미 작업 중"},
    ).json()
    assert repeat["version"] == detail["version"]
    changed = deepcopy(detail["article"])
    changed["title"] = "검토를 마친 가상 수정 제목"
    changed["field"] = "수정본 전용 분야"
    changed["tags"] = ["수정본 전용 키워드"]
    changed["sections"][0]["paragraphs"][0]["text"] += "수정된 문장"
    draft = deepcopy(detail["review_draft"])
    draft["title"] = changed["title"]
    draft["research_field"] = changed["field"]
    draft["classification_tags"] = changed["tags"]
    checked = make_draft("evidence")
    draft.update({"claims": checked["claims"], "scores": checked["scores"]})
    draft["source"].update({"bibliography_checked": True, "access_level": "open_authorized"})
    body = {
        "expected_version": detail["version"],
        "article": changed,
        "draft": draft,
        "reason": "가상 원고·근거 대조",
    }
    # 짧은 후보 저장 API로 전체 원고를 실수로 날릴 수 없습니다.
    assert (
        client.post(
            f"{path}/revisions",
            headers=ORIGIN,
            json={key: value for key, value in body.items() if key != "article"},
        ).status_code
        == 409
    )
    saved = client.post(f"{path}/article-revisions", headers=ORIGIN, json=body)
    assert saved.status_code == 200, saved.text
    assert client.get(public_path).json() == before
    current = client.get(path).json()
    assert len(current["article"]["sections"][0]["paragraphs"][0]["text"]) > 1000
    assert current["article"]["glossary"] == original["glossary"]
    facets_before = client.get(WORKSPACE).json()
    assert facets_before["categories"] == [original["field"]]
    assert facets_before["keywords"] == sorted(original["tags"])
    approved = approve(client, submit(client, current))
    assert client.get(public_path).json() == before
    snapshot = publish(client, approved).json()
    assert snapshot["article"]["title"] == changed["title"]
    assert snapshot["id"] == before["id"]  # 같은 공개 주소·게시물 ID를 유지합니다.
    assert client.get(public_path).json()["article"]["title"] == changed["title"]
    facets_after = client.get(WORKSPACE).json()
    assert facets_after["categories"] == [changed["field"]]
    assert facets_after["keywords"] == changed["tags"]
    assert publish(client, approved).json() == snapshot  # 재시도는 중복 반영하지 않습니다.


def test_correction_rejects_scenario_removal_and_stale_versions(client):
    seed_article()
    login(client)
    item = client.get(WORKSPACE).json()["items"][0]
    client.post(
        f"/api/v1/admin/insights/publications/{item['publication_id']}/correction",
        headers=ORIGIN,
        json={"expected_version": 1, "reason": "수정본 생성"},
    )
    path = f"{ADMIN_PATH}/{item['id']}"
    detail = client.get(path).json()
    body = {
        "expected_version": detail["version"],
        "article": deepcopy(detail["article"]),
        "draft": detail["review_draft"],
        "reason": "잘못된 변경 검사",
    }
    body["article"].pop("sampleNotice")
    assert client.post(f"{path}/article-revisions", headers=ORIGIN, json=body).status_code == 422
    body["expected_version"] = 1
    assert client.post(f"{path}/article-revisions", headers=ORIGIN, json=body).status_code == 409


def test_settings_migration_adds_only_private_table_and_access_protection():
    config = Config(
        str(Path(__file__).resolve().parents[1] / "alembic.ini"), output_buffer=StringIO()
    )
    command.upgrade(config, "20261021_03:20261022_04", sql=True)
    sql = config.output_buffer.getvalue()
    assert "CREATE TABLE insight_private.collection_settings" in sql
    assert "ENABLE ROW LEVEL SECURITY" in sql
    assert "REVOKE ALL" in sql
    assert "DROP TABLE" not in sql and "DELETE FROM" not in sql
    assert "UPDATE public.users" not in sql
