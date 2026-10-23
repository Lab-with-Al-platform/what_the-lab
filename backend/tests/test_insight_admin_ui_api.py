"""인사이트 관리자 화면의 권한·검색·승인 조건 조회를 격리 DB로 검사합니다."""

from tests.test_insight_workflow import ADMIN_PATH, ORIGIN, create, login, make_draft, submit
from tests.test_insight_workflow import client as client  # noqa: PLC0414 - pytest fixture 재노출

ACCESS_PATH = "/api/v1/admin/insights/access"


def test_admin_menu_capability_is_checked_on_server(client, monkeypatch):
    assert client.get(ACCESS_PATH).status_code == 401
    login(client, "200000000000000001")
    assert client.get(ACCESS_PATH).status_code == 403
    login(client)
    assert client.get(ACCESS_PATH).json() == {"can_manage_insights": True}
    monkeypatch.setenv("INSIGHTS_ENABLED", "false")
    assert client.get(ACCESS_PATH).status_code == 404


def test_shared_admin_field_and_insight_allowlist_use_same_capability(client, monkeypatch):
    user = login(client, "200000000000000001")
    user["is_admin"] = True
    monkeypatch.setenv("INSIGHT_ADMIN_DISCORD_IDS", "")
    assert client.get(ACCESS_PATH).status_code == 200
    user["status"] = "suspended"
    assert client.get(ACCESS_PATH).status_code == 403


def test_list_contains_current_titles_and_supports_search_status_and_pagination(client):
    login(client)
    first, second = make_draft("alpha"), make_draft("beta")
    first["title"], second["title"] = "치주골 연구", "신소재 생성"
    submitted = submit(client, create(client, first))
    create(client, second)
    response = client.get(ADMIN_PATH, params={"q": "치주골", "status": "pending_review"}).json()
    assert response["total"] == 1
    assert response["items"][0]["id"] == submitted["id"]
    assert response["items"][0]["title"] == "치주골 연구"
    assert "revisions" not in response["items"][0]
    assert client.get(ADMIN_PATH, params={"q": "INSIGHT-TEST-BETA"}).json()["total"] == 1
    assert client.get(ADMIN_PATH, params={"q": "%"}).json()["total"] == 0
    assert client.get(ADMIN_PATH, params={"q": "_"}).json()["total"] == 0
    page_one = client.get(ADMIN_PATH, params={"page": 1, "page_size": 1}).json()
    page_two = client.get(ADMIN_PATH, params={"page": 2, "page_size": 1}).json()
    assert page_one["total"] == page_two["total"] == 2
    assert page_one["items"][0]["id"] != page_two["items"][0]["id"]
    assert client.get(ADMIN_PATH, params={"status": "invented"}).status_code == 422


def test_evidence_check_is_read_only_and_tracks_saved_revision(client):
    login(client)
    draft = make_draft()
    candidate = create(client, draft)
    path = f"{ADMIN_PATH}/{candidate['id']}"
    before = client.get(path).json()
    assert before["approval_check"]["ready"] is False
    assert before["editorial_check"]["stage"] == "collection_note"
    assert before["status"] == "draft" and before["approved_revision"] is None
    assert client.get(path).json() == before
    draft["claims"][0]["verification"] = "needs_review"
    response = client.post(
        f"{path}/revisions",
        headers=ORIGIN,
        json={
            "expected_version": candidate["version"],
            "draft": draft,
            "reason": "근거 재검토",
        },
    )
    assert response.status_code == 200
    after = client.get(path).json()
    assert after["approval_check"]["ready"] is False
    assert after["current_revision"] == 2
    assert after["version"] == before["version"] + 1
