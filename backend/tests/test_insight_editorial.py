"""분량만 늘려 승인하지 않고 메모·전체 원고·검수의 경계를 지키는지 검사합니다."""

from copy import deepcopy

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.insight_editorial_setup import expand_candidates
from app.insights import editorial, service
from app.insights.collection_oct22 import collected_drafts
from app.insights.database import Base, build_engine
from app.insights.editorial_oct22 import expanded_article
from app.insights.importing import import_candidates
from app.insights.models import Revision
from app.insights.schemas import CandidateImportInput
from tests.test_insight_workflow import (
    ADMIN_PATH,
    ORIGIN,
    approval_body,
    create,
    login,
    prepare_article,
    publish,
    submit,
)
from tests.test_insight_workflow import client as client  # noqa: PLC0414


def test_note_cannot_be_approved_even_with_all_reading_checks(client):
    login(client)
    candidate = submit(client, create(client))
    response = client.post(
        f"{ADMIN_PATH}/{candidate['id']}/approve", headers=ORIGIN, json=approval_body(candidate)
    )
    assert response.status_code == 422
    assert "게시용 원고" in response.json()["detail"]


def test_full_article_requires_all_reading_checks_and_is_preserved_when_published(client):
    login(client)
    candidate = prepare_article(client, submit(client, create(client)))
    path = f"{ADMIN_PATH}/{candidate['id']}"
    before = client.get(path).json()
    assert before["editorial_check"]["ready"]
    assert before["revisions"][0]["content"]["claims"][0]["text"].startswith("가상")
    body = approval_body(candidate)
    body["reading_checks"]["plain_language"] = False
    response = client.post(f"{path}/approve", headers=ORIGIN, json=body)
    assert response.status_code == 422 and "전문용어" in response.json()["detail"]
    assert client.get(path).json()["status"] == "pending_review"
    response = client.post(f"{path}/approve", headers=ORIGIN, json=approval_body(candidate))
    assert response.status_code == 200
    publication = publish(client, response.json()).json()
    assert publication["article"]["sections"] == before["article"]["sections"]
    assert publication["article"]["glossary"] == before["article"]["glossary"]


def test_start_article_is_versioned_preserves_notes_and_does_not_overwrite(client):
    login(client)
    candidate = create(client)
    path = f"{ADMIN_PATH}/{candidate['id']}"
    before = client.get(path).json()["revisions"][0]["content"]
    body = {"expected_version": candidate["version"], "reason": "메모 보존 후 원고 작성"}
    assert (
        client.post(
            f"{path}/article-draft", headers=ORIGIN, json={**body, "expected_version": 99}
        ).status_code
        == 409
    )
    assert client.post(f"{path}/article-draft", headers=ORIGIN, json=body).status_code == 200
    after = client.get(path).json()
    assert after["status"] == "draft" and after["approved_revision"] is None
    assert after["revisions"][0]["content"] == before
    assert after["review_draft"] == before
    assert not after["editorial_check"]["ready"]
    assert (
        client.post(
            f"{path}/article-draft",
            headers=ORIGIN,
            json={**body, "expected_version": after["version"]},
        ).status_code
        == 409
    )
    assert (
        client.post(
            f"{path}/revisions",
            headers=ORIGIN,
            json={**body, "expected_version": after["version"], "draft": before},
        ).status_code
        == 409
    )


@pytest.mark.parametrize("draft", collected_drafts(), ids=lambda draft: draft.slug)
def test_six_articles_keep_evidence_unverified_and_add_labeled_explanations(draft):
    before = draft.model_dump(mode="json")
    article = expanded_article(draft)
    report = editorial.editorial_report({"format": "article_draft_v1", "article": article})
    assert report["ready"] and report["paragraph_count"] >= 20
    assert article["sourceUrl"] == str(draft.source.url)
    assert article["doi"] == draft.source.doi
    assert not article.get("coverSrc") and article["imagePolicy"] == "no_image"
    assert article["illustrationPlan"]["status"] == "deferred_until_editorial_review"
    assert all(item["text"] for item in article["highlights"])
    assert draft.model_dump(mode="json") == before
    assert all(claim.verification == "needs_review" for claim in draft.claims)
    assert draft.source.bibliography_checked is False


def test_structural_checks_are_not_a_character_count_gate():
    article = expanded_article(collected_drafts()[0])
    article["glossary"] = []
    article["sections"][0]["paragraphs"] = ["길이만 늘린 문장" * 500]
    report = editorial.editorial_report({"format": "article_draft_v1", "article": article})
    assert not report["ready"] and "용어 풀이" in " ".join(report["issues"])


def test_batch_is_idempotent_preserves_original_notes_and_rejects_manual_changes(tmp_path):
    engine = build_engine(f"sqlite:///{tmp_path / 'editorial.db'}", allow_sqlite=True)
    Base.metadata.create_all(engine)
    with Session(engine) as session, session.begin():
        import_candidates(
            session, CandidateImportInput(dry_run=False, drafts=collected_drafts()), "test"
        )
        old = {
            revision.id: deepcopy(revision.content)
            for revision in session.scalars(select(Revision))
        }
        result = expand_candidates(session)
        assert len(result) == 6 and all(item["action"] == "expanded" for item in result)
        assert all(
            revision.content == old[revision.id]
            for revision in session.scalars(select(Revision).where(Revision.number == 1))
        )
        assert all(item["action"] == "already_expanded" for item in expand_candidates(session))
        candidate = service.get_candidate(session, result[0]["id"])
        current = editorial.current_revision(session, candidate)
        content = deepcopy(current.content)
        content["article"]["summary"] = "사람이 수정한 내용을 보존해야 합니다."
        current.content = content
        session.flush()
        with pytest.raises(ValueError, match="덮어쓰지"):
            expand_candidates(session)
    engine.dispose()
