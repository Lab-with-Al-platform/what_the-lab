"""기존 원고 보존·비공개 수집·관리자 목록을 실제 서비스 함수로 검사합니다."""

from contextlib import contextmanager
from copy import deepcopy

import pytest
from sqlalchemy import func, select

from app.insights.catalog_import import article_hash, import_catalog
from app.insights.collection_oct22 import collected_drafts
from app.insights.database import get_session
from app.insights.models import Candidate, Publication, Revision
from app.main import app
from tests.test_insight_workflow import ADMIN_PATH, ORIGIN, create, login, make_draft
from tests.test_insight_workflow import client as client  # noqa: PLC0414

CATALOG = "/api/v1/admin/insights/publications"


def legacy_article() -> dict:
    return {
        "slug": "legacy-preservation",
        "kind": "case",
        "title": "기존 원고 보존 검증",
        "summary": "가상 설계 시나리오 표시도 보존합니다.",
        "publishedOn": "2026.10.10",
        "field": "검증용",
        "sampleNotice": "실제 성과가 아닌 설계 시나리오",
        "sections": [
            {
                "id": "notes",
                "title": "편집자 노트",
                "paragraphs": [{"kind": "caution", "text": "본문을 줄이지 않습니다." * 2000}],
            }
        ],
        "glossary": [{"id": "term", "label": "용어", "definition": "정의"}],
        "coverSrc": "/photos/keep.webp",
        "imageCaption": "원래 이미지 설명",
    }


def seed_legacy(article: dict) -> None:
    with contextmanager(app.dependency_overrides[get_session])() as session:
        result = import_catalog(session, [article])
        assert result == {"created": 1, "preserved": 0}


def test_catalog_preserves_full_article_and_never_fabricates_approval(client):
    article = legacy_article()
    seed_legacy(article)
    with contextmanager(app.dependency_overrides[get_session])() as session:
        assert import_catalog(session, [article]) == {"created": 0, "preserved": 1}
        saved = session.scalar(select(Publication))
        candidate = session.get(Candidate, saved.candidate_id)
        assert saved.snapshot["article"] == article
        assert saved.snapshot["article_hash"] == article_hash(article)
        assert candidate.status == "published"
        assert candidate.approved_by is candidate.approved_revision is None
        assert session.scalar(select(func.count()).select_from(Revision)) == 1
    changed = deepcopy(article)
    changed["summary"] = "변경 원고"
    with (
        contextmanager(app.dependency_overrides[get_session])() as session,
        pytest.raises(ValueError, match="덮어쓰지"),
    ):
        import_catalog(session, [changed])


def test_published_and_collected_lists_are_separate_and_protected(client):
    seed_legacy(legacy_article())
    assert client.get(CATALOG).status_code == 401
    login(client, "200000000000000001")
    assert client.get(CATALOG).status_code == 403
    login(client)
    create(client)
    catalog = client.get(CATALOG).json()
    assert catalog["total"] == 1
    assert "article" not in catalog["items"][0]  # 목록마다 전체 본문을 전송하지 않습니다.
    saved = client.get(f"{CATALOG}/{catalog['items'][0]['id']}").json()
    assert saved["article"] == legacy_article()
    assert client.get(CATALOG, params={"kind": "trend"}).json()["total"] == 0
    assert client.get(CATALOG, params={"q": "%"}).json()["total"] == 0
    assert client.get(ADMIN_PATH, params={"collection_only": True}).json()["total"] == 1
    existing = next(
        item for item in client.get(ADMIN_PATH).json()["items"] if item["status"] == "published"
    )
    assert client.get(f"{ADMIN_PATH}/{existing['id']}").json()["legacy_article"] == legacy_article()
    response = client.post(
        f"{ADMIN_PATH}/{existing['id']}/revisions",
        headers=ORIGIN,
        json={"expected_version": 1, "reason": "변경 시도", "draft": make_draft()},
    )
    assert response.status_code == 409


def test_six_real_candidates_remain_private_unverified_and_idempotent(client):
    login(client)
    drafts = [draft.model_dump(mode="json") for draft in collected_drafts()]
    assert [draft["kind"] for draft in drafts].count("case") == 3
    assert [draft["kind"] for draft in drafts].count("trend") == 3
    response = client.post(
        f"{ADMIN_PATH}/import", headers=ORIGIN, json={"dry_run": False, "drafts": drafts}
    )
    assert response.status_code == 200, response.text
    assert response.json()["created"] == 6
    assert client.get("/api/v1/insights").json()["total"] == 0
    for kind in ("case", "trend"):
        assert client.get(ADMIN_PATH, params={"kind": kind}).json()["total"] == 3
    for item in client.get(ADMIN_PATH).json()["items"]:
        detail = client.get(f"{ADMIN_PATH}/{item['id']}").json()
        draft = detail["revisions"][0]["content"]
        assert detail["status"] == "draft" and detail["approved_revision"] is None
        assert draft["glossary"] and not draft["scores"] and not draft["keyword_ids"]
        assert not draft["source"]["bibliography_checked"]
        assert all(claim["verification"] == "needs_review" for claim in draft["claims"])
    repeated = client.post(
        f"{ADMIN_PATH}/import", headers=ORIGIN, json={"dry_run": False, "drafts": drafts}
    ).json()
    assert repeated["created"] == 0 and repeated["existing_preserved"] == 6


def test_same_source_can_have_case_and_trend_but_kind_cannot_be_changed(client):
    login(client)
    case = make_draft("paired")
    trend = {**deepcopy(case), "kind": "trend", "slug": "paired-trend"}
    first = create(client, case)
    second = create(client, trend)
    assert second["kind"] == "trend"
    assert (
        client.get(f"{ADMIN_PATH}/{first['id']}").json()["revisions"][0]["content"]["kind"]
        == "case"
    )
    denied = client.post(
        f"{ADMIN_PATH}/{first['id']}/revisions",
        headers=ORIGIN,
        json={"expected_version": 1, "reason": "유형 변경 시도", "draft": trend},
    )
    assert denied.status_code == 409
    detail = client.get(f"{ADMIN_PATH}/{second['id']}").json()
    assert not detail["approval_check"]["ready"]
