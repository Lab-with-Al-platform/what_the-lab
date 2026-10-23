"""외부 API 없이 권한·근거·승인 버전·게시 중복의 실제 실패 경계를 확인합니다."""

from datetime import timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session
from sqlalchemy.schema import CreateTable

from app import user_store
from app.config import JWT_SECRET
from app.insights.database import SCHEMA, Base, build_engine, get_session
from app.insights.models import Publication, utc_now
from app.insights.schemas import SCORE_MAXIMUMS, ReadingChecks, normalize_doi
from app.main import app
from app.security import create_access_token

ADMIN_ID = "100000000000000001"
ORIGIN = {"Origin": "http://localhost:3000"}
ADMIN_PATH = "/api/v1/admin/insights/candidates"
PUBLIC_PATH = "/api/v1/insights"


def make_draft(name: str = "first") -> dict:
    """실제 논문이 아닌 테스트 전용 가상 자료입니다."""
    fields = [
        "research_problem",
        "bottleneck",
        "ai_role",
        "researcher_role",
        "input_data",
        "validation_method",
        "outcomes",
        "limitations",
    ]
    return {
        "source": {
            "title": "테스트 전용 가상 출처",
            "doi": f"10.9999/insight-test-{name}",
            "url": f"https://example.org/test-papers/{name}",
            "access_level": "open_authorized",
            "bibliography_checked": True,
        },
        "title": f"실제 연구가 아닌 검증용 가상 사례 {name}",
        "slug": f"test-case-{name}",
        "summary": "자동 테스트용 가상 사례입니다. 운영에 반입하지 않습니다.",
        "research_field": "가상 테스트 분야",
        "case_type": "practical",
        "claims": [
            {
                "field": field,
                "text": f"가상 검증 문장: {field}",
                "locator": f"Test section / {field}",
                "verification": "verified",
                "evidence_level": "fulltext",
            }
            for field in fields
        ],
        "scores": [
            {"criterion": key, "value": value, "rationale": "테스트 전용 가상 평가"}
            for key, value in SCORE_MAXIMUMS.items()
        ],
        "keyword_ids": [],
        "image_policy": "no_image",
    }


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("INSIGHTS_ENABLED", "true")
    monkeypatch.setenv("INSIGHT_ADMIN_DISCORD_IDS", ADMIN_ID)
    monkeypatch.setenv("INSIGHT_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8000")
    # 회원 저장소의 구현이 바뀌어도 인사이트 검사는 실제 회원 DB에 접속하지 않습니다.
    users: dict[int, dict] = {}

    def find_test_user(user_id: int) -> dict | None:
        return users.get(user_id)

    def find_test_discord_user(discord_id: str) -> dict | None:
        return next((user for user in users.values() if user["discord_id"] == discord_id), None)

    def create_test_user(discord_user: dict) -> dict:
        user_id = len(users) + 1
        user = {
            "user_id": user_id,
            "discord_id": discord_user["id"],
            "nickname": discord_user["username"],
            "user_role": None,
            "signup_step": "role",
            "user_photo": None,
            "status": "active",
            "is_admin": False,
        }
        users[user_id] = user
        return user

    def reject_real_member_db() -> None:
        raise AssertionError("인사이트 단위 테스트는 실제 회원 DB에 접속하면 안 됩니다.")

    monkeypatch.setattr(user_store, "find_by_id", find_test_user)
    monkeypatch.setattr(user_store, "find_by_discord_id", find_test_discord_user)
    monkeypatch.setattr(user_store, "create_user", create_test_user)
    monkeypatch.setattr(user_store, "get_connection", reject_real_member_db)
    engine = build_engine(f"sqlite:///{tmp_path / 'insight.db'}", allow_sqlite=True)
    Base.metadata.create_all(engine)

    def test_session():
        with Session(engine) as session, session.begin():
            yield session

    app.dependency_overrides[get_session] = test_session
    with TestClient(app, base_url="http://testserver.local") as test_client:
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


def login(client: TestClient, discord_id: str = ADMIN_ID) -> dict:
    user = user_store.find_by_discord_id(discord_id)
    if user is None:
        user = user_store.create_user({"id": discord_id, "username": "테스트 계정"})
    # 실제 브라우저처럼 호스트·경로를 맞춰야 로그아웃의 쿠키 삭제도 검증할 수 있습니다.
    client.cookies.set(
        "access_token",
        create_access_token(user["user_id"], user["discord_id"]),
        domain=client.base_url.host,
        path="/",
    )
    return user


def create(client: TestClient, draft: dict | None = None) -> dict:
    response = client.post(ADMIN_PATH, json=draft or make_draft(), headers=ORIGIN)
    assert response.status_code == 201, response.text
    return response.json()


def submit(client: TestClient, candidate: dict) -> dict:
    response = client.post(
        f"{ADMIN_PATH}/{candidate['id']}/submit",
        headers=ORIGIN,
        json={"expected_version": candidate["version"], "reason": "근거 검토 요청"},
    )
    assert response.status_code == 200, response.text
    return response.json()


def approval_body(candidate: dict, **extra) -> dict:
    return {
        "expected_version": candidate["version"],
        "reason": "원문과 독자 유용성을 검토함",
        "editorial_checked": True,
        "rights_checked": True,
        "reading_checks": {name: True for name in ReadingChecks.model_fields},
        **extra,
    }


def prepare_article(client: TestClient, candidate: dict) -> dict:
    path = f"{ADMIN_PATH}/{candidate['id']}"
    detail = client.get(path).json()
    if not detail.get("article"):
        response = client.post(
            f"{path}/article-draft",
            headers=ORIGIN,
            json={"expected_version": candidate["version"], "reason": "가상 테스트용 원고 작성"},
        )
        assert response.status_code == 200, response.text
        detail = client.get(path).json()
        article = detail["article"]
        article["glossary"] = [
            {"id": "test-term", "label": "가상 용어", "definition": "실제 연구가 아닌 테스트 풀이"}
        ]
        article["sections"][0]["paragraphs"] += [
            {"kind": kind, "text": f"가상 테스트용 {kind}"}
            for kind in ("interpretation", "application", "caution")
        ]
        response = client.post(
            f"{path}/article-revisions",
            headers=ORIGIN,
            json={
                "expected_version": detail["version"],
                "reason": "가상 독자용 본문 보완",
                "article": article,
                "draft": detail["review_draft"],
            },
        )
        assert response.status_code == 200, response.text
        candidate = submit(client, response.json())
    return candidate


def approve(client: TestClient, candidate: dict) -> dict:
    candidate = prepare_article(client, candidate)
    response = client.post(
        f"{ADMIN_PATH}/{candidate['id']}/approve", headers=ORIGIN, json=approval_body(candidate)
    )
    assert response.status_code == 200, response.text
    return response.json()


def publish(client: TestClient, candidate: dict, key: str = "test-publish-key-001"):
    return client.post(
        f"{ADMIN_PATH}/{candidate['id']}/publish",
        headers=ORIGIN,
        json={
            "expected_version": candidate["version"],
            "idempotency_key": key,
            "reason": "수동 첫 게시 검증",
        },
    )


def test_one_case_approval_publication_and_retry(client):
    login(client)
    candidate = create(client)
    assert client.get(PUBLIC_PATH).json()["items"] == []
    assert client.get(f"{PUBLIC_PATH}/test-case-first").status_code == 404
    assert publish(client, candidate).status_code == 409
    approved = approve(client, submit(client, candidate))
    assert client.get(PUBLIC_PATH).json()["total"] == 0
    first = publish(client, approved)
    retry = publish(client, approved)
    assert first.status_code == retry.status_code == 200
    assert first.json()["id"] == retry.json()["id"]
    assert first.json()["score_total"] == 12
    assert first.json()["expert_search_url"] == "/experts"
    assert "idempotency_key" not in first.json()
    assert "approved_by" not in first.json()
    assert client.get(PUBLIC_PATH).json()["total"] == 1
    client.cookies.clear()
    assert client.get(f"{PUBLIC_PATH}/test-case-first").status_code == 200


def test_admin_and_origin_required(client):
    assert client.get(ADMIN_PATH).status_code == 401
    login(client, "100000000000000002")
    assert client.get(ADMIN_PATH).status_code == 403
    login(client)
    assert client.post(ADMIN_PATH, json=make_draft()).status_code == 403
    assert (
        client.post(
            ADMIN_PATH, json=make_draft(), headers={"Origin": "https://evil.example"}
        ).status_code
        == 403
    )
    candidate = create(client)
    login(client, "100000000000000002")
    assert (
        client.post(
            f"{ADMIN_PATH}/{candidate['id']}/approve", headers=ORIGIN, json=approval_body(candidate)
        ).status_code
        == 403
    )


def test_flag_disabled_keeps_health_and_auth_working(client, monkeypatch):
    monkeypatch.setenv("INSIGHTS_ENABLED", "false")
    assert client.get(PUBLIC_PATH).status_code == 404
    assert client.get(ADMIN_PATH).status_code == 404
    assert client.get("/api/v1/health").json() == {"status": "ok"}
    login(client)
    assert client.get("/api/v1/auth/me").status_code == 200


def test_merge_keeps_member_and_insight_routes_registered(client):
    paths = set(app.openapi()["paths"])
    assert {
        "/api/v1/auth/me",
        "/api/v1/auth/logout",
        "/api/v1/researcher/profile",
        "/api/v1/expert/signup",
        PUBLIC_PATH,
        ADMIN_PATH,
    } <= paths


def test_member_id_and_logout_still_work_with_insights(client):
    user = login(client)
    assert isinstance(user["user_id"], int)
    assert client.get("/api/v1/auth/me").json()["discord_id"] == ADMIN_ID
    assert client.get(ADMIN_PATH).status_code == 200
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 204
    assert "access_token" not in client.cookies
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get(ADMIN_PATH).status_code == 401


def test_empty_admin_allowlist_denies_everyone(client, monkeypatch):
    login(client)
    monkeypatch.setenv("INSIGHT_ADMIN_DISCORD_IDS", "")
    assert client.get(ADMIN_PATH).status_code == 403


def test_common_admin_flag_can_manage_insights(client, monkeypatch):
    user = login(client, "100000000000000003")
    monkeypatch.setenv("INSIGHT_ADMIN_DISCORD_IDS", "")
    assert client.get(ADMIN_PATH).status_code == 403
    user["is_admin"] = True  # 실제 DB 권한을 변경하지 않는 가상 회원입니다.
    assert client.get("/api/v1/auth/me").json()["is_admin"] is True
    assert client.get(ADMIN_PATH).status_code == 200
    user["is_admin"] = False
    assert client.get(ADMIN_PATH).status_code == 403


@pytest.mark.parametrize("status", ["suspended", "deleted"])
def test_inactive_accounts_denied_in_member_and_insight_apis(client, status):
    user = login(client)
    user["is_admin"] = True
    user["status"] = status
    for path in ("/api/v1/auth/me", "/api/v1/researcher/profile", ADMIN_PATH):
        assert client.get(path).status_code == 403
    response = client.get("/api/v1/auth/discord/login", follow_redirects=False)
    assert response.status_code == 403


def test_missing_account_denied_in_member_and_insight_apis(client, monkeypatch):
    login(client)
    monkeypatch.setattr(user_store, "find_by_id", lambda _user_id: None)
    for path in ("/api/v1/auth/me", "/api/v1/researcher/profile", ADMIN_PATH):
        assert client.get(path).status_code == 401


def test_legacy_insight_allowlist_does_not_grant_global_admin(client):
    user = login(client)
    assert user["is_admin"] is False
    assert client.get(ADMIN_PATH).status_code == 200
    assert client.get("/api/v1/auth/me").json()["is_admin"] is False


def test_old_cookie_cannot_impersonate_reassigned_user_id(client):
    user = login(client)
    user["discord_id"] = "100000000000000099"  # DB 이전으로 내부 번호의 주인이 달라진 상황
    for path in ("/api/v1/auth/me", "/api/v1/researcher/profile", ADMIN_PATH):
        assert client.get(path).status_code == 401


def test_legacy_cookie_requires_discord_login_again(client):
    user = login(client)
    old_token = jwt.encode(
        {"sub": str(user["user_id"]), "exp": (utc_now() + timedelta(days=1)).timestamp()},
        JWT_SECRET,
        algorithm="HS256",
    )
    client.cookies.clear()
    client.cookies.set("access_token", old_token, domain=client.base_url.host, path="/")
    assert client.get("/api/v1/auth/me").status_code == 401
    response = client.get("/api/v1/auth/discord/login", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"].startswith("https://discord.com/oauth2/authorize?")


def test_discord_callback_reuses_same_member_for_all_features(client, monkeypatch):
    # Discord에 실제 접속하지 않고, 같은 외부 고유 번호로 두 번 로그인합니다.
    from app.routers import auth

    monkeypatch.setattr(
        auth,
        "fetch_discord_user",
        lambda _code: {"id": ADMIN_ID, "username": "가상 테스트 회원"},
    )
    user_ids = []
    for _attempt in range(2):
        client.cookies.set("oauth_state", "test-state", domain=client.base_url.host, path="/")
        response = client.get(
            "/api/v1/auth/discord/callback?code=fake-code&state=test-state",
            follow_redirects=False,
        )
        assert response.status_code == 307
        member = client.get("/api/v1/auth/me").json()
        assert member["discord_id"] == ADMIN_ID
        assert client.get(ADMIN_PATH).status_code == 200
        user_ids.append(member["user_id"])
    assert user_ids == [1, 1]


def test_duplicate_doi_normalization(client):
    login(client)
    create(client)
    duplicate = make_draft()
    duplicate["source"]["doi"] = " HTTPS://DOI.ORG/10.9999/INSIGHT-TEST-FIRST "
    assert client.post(ADMIN_PATH, json=duplicate, headers=ORIGIN).status_code == 409
    assert client.get(ADMIN_PATH).json()["total"] == 1


def test_revision_invalidates_approval_and_keeps_old_snapshot(client):
    login(client)
    approved = approve(client, submit(client, create(client)))
    new_draft = make_draft()
    new_draft["title"] = "관리자가 수정한 테스트 제목"
    old_detail = client.get(f"{ADMIN_PATH}/{approved['id']}").json()
    article = old_detail["article"]
    article["title"] = new_draft["title"]
    response = client.post(
        f"{ADMIN_PATH}/{approved['id']}/article-revisions",
        headers=ORIGIN,
        json={
            "expected_version": approved["version"],
            "draft": new_draft,
            "article": article,
            "reason": "근거 검토 후 제목 수정",
        },
    )
    assert response.status_code == 200, response.text
    revised = client.get(f"{ADMIN_PATH}/{approved['id']}").json()
    assert revised["status"] == "draft"
    assert revised["approved_revision"] is None
    assert publish(client, approved).status_code == 409
    assert publish(client, revised).status_code == 409
    detail = client.get(f"{ADMIN_PATH}/{approved['id']}").json()
    assert len(detail["revisions"]) == 4
    assert detail["revisions"][0]["content"]["title"] == make_draft()["title"]
    assert detail["events"][-1]["action"] == "revised"


def test_stale_version_conflict(client):
    login(client)
    candidate = create(client)
    submit(client, candidate)
    assert (
        client.post(
            f"{ADMIN_PATH}/{candidate['id']}/submit",
            headers=ORIGIN,
            json={"expected_version": candidate["version"], "reason": "오래된 화면"},
        ).status_code
        == 409
    )


@pytest.mark.parametrize(
    "problem",
    [
        "unverified",
        "locator",
        "abstract",
        "unavailable",
        "restricted",
        "bibliography",
        "missing_claim",
        "score",
        "low_score",
        "keyword",
    ],
)
def test_approval_blocks_incomplete_evidence(client, problem):
    login(client)
    draft = make_draft()
    if problem == "unverified":
        draft["claims"][0]["verification"] = "unsupported"
    elif problem == "locator":
        draft["claims"][0]["locator"] = ""
    elif problem == "abstract":
        draft["claims"][2]["evidence_level"] = "abstract"
    elif problem == "unavailable":
        draft["claims"][0]["evidence_level"] = "unavailable"
    elif problem == "restricted":
        draft["source"]["access_level"] = "restricted"
    elif problem == "bibliography":
        draft["source"]["bibliography_checked"] = False
    elif problem == "missing_claim":
        draft["claims"].pop()
    elif problem == "score":
        draft["scores"].pop()
    elif problem == "low_score":
        for score in draft["scores"]:
            score["value"] = 0
    elif problem == "keyword":
        draft["keyword_ids"] = ["CAP023"]  # 현재 registry의 pending_review 항목
    candidate = submit(client, create(client, draft))
    response = client.post(
        f"{ADMIN_PATH}/{candidate['id']}/approve", headers=ORIGIN, json=approval_body(candidate)
    )
    assert response.status_code == 422, response.text
    assert client.get(PUBLIC_PATH).json()["total"] == 0


def test_future_schedule_and_naive_timezone(client):
    login(client)
    candidate = prepare_article(client, submit(client, create(client)))
    path = f"{ADMIN_PATH}/{candidate['id']}/approve"
    assert (
        client.post(
            path,
            headers=ORIGIN,
            json=approval_body(
                candidate,
                scheduled_for="2030-01-01T15:00:00",
            ),
        ).status_code
        == 422
    )
    response = client.post(
        path,
        headers=ORIGIN,
        json=approval_body(
            candidate,
            scheduled_for=(utc_now() + timedelta(days=7)).isoformat(),
        ),
    )
    assert response.status_code == 200
    assert publish(client, response.json()).status_code == 409


def test_cannot_approve_directly_or_change_source(client):
    login(client)
    candidate = create(client)
    assert (
        client.post(
            f"{ADMIN_PATH}/{candidate['id']}/approve", headers=ORIGIN, json=approval_body(candidate)
        ).status_code
        == 409
    )
    changed = make_draft("different")
    assert (
        client.post(
            f"{ADMIN_PATH}/{candidate['id']}/revisions",
            headers=ORIGIN,
            json={"expected_version": 1, "draft": changed, "reason": "다른 출처로 바꾸려는 요청"},
        ).status_code
        == 409
    )


def test_published_snapshot_cannot_be_overwritten(client):
    login(client)
    approved = approve(client, submit(client, create(client)))
    assert publish(client, approved).status_code == 200
    current = client.get(f"{ADMIN_PATH}/{approved['id']}").json()
    assert (
        client.post(
            f"{ADMIN_PATH}/{approved['id']}/revisions",
            headers=ORIGIN,
            json={
                "expected_version": current["version"],
                "draft": make_draft(),
                "reason": "게시 후 무단 덮어쓰기",
            },
        ).status_code
        == 409
    )
    assert publish(client, current, "different-publish-key").status_code == 409


def test_key_collision_rolls_back_second_publication(client):
    login(client)
    first = approve(client, submit(client, create(client)))
    second = approve(client, submit(client, create(client, make_draft("second"))))
    assert publish(client, first).status_code == 200
    assert publish(client, second).status_code == 409
    assert client.get(PUBLIC_PATH).json()["total"] == 1
    assert client.get(f"{ADMIN_PATH}/{second['id']}").json()["status"] == "approved"


def test_untrusted_extra_fields_and_invalid_score(client):
    login(client)
    for field, value in [("status", "published"), ("score_total", 12)]:
        body = make_draft()
        body[field] = value
        assert client.post(ADMIN_PATH, json=body, headers=ORIGIN).status_code == 422
    body = make_draft()
    body["scores"][-1]["value"] = 2
    assert client.post(ADMIN_PATH, json=body, headers=ORIGIN).status_code == 422
    assert client.get(PUBLIC_PATH + "?page_size=1000").status_code == 422


def test_postgres_ddl_contains_private_schema_and_unique_constraints():
    ddl = "\n".join(
        str(CreateTable(table).compile(dialect=postgresql.dialect()))
        for table in Base.metadata.sorted_tables
    )
    assert f"{SCHEMA}.candidates" in ddl
    assert "TIMESTAMP WITH TIME ZONE" in ddl
    assert "UNIQUE (idempotency_key)" in ddl
    assert "UNIQUE (candidate_id)" in ddl


def test_restart_keeps_publication(tmp_path):
    from app.insights import editorial, service
    from app.insights.schemas import ApprovalInput, Draft

    url = f"sqlite:///{tmp_path / 'restart.db'}"
    engine = build_engine(url, allow_sqlite=True)
    Base.metadata.create_all(engine)
    with Session(engine) as session, session.begin():
        candidate = service.create_candidate(session, Draft.model_validate(make_draft()), ADMIN_ID)
        article = editorial.notes_to_article(Draft.model_validate(make_draft()))
        article["glossary"] = [{"id": "test", "label": "가상", "definition": "테스트"}]
        article["sections"][0]["paragraphs"] += [
            {"kind": kind, "text": "테스트"}
            for kind in ("interpretation", "application", "caution")
        ]
        editorial.start_article_draft(
            session, candidate.id, candidate.version, ADMIN_ID, "테스트", article
        )
        service.submit_candidate(session, candidate.id, candidate.version, ADMIN_ID, "테스트")
        service.approve_candidate(
            session,
            candidate.id,
            ApprovalInput.model_validate(
                approval_body({"version": candidate.version}),
            ),
            ADMIN_ID,
        )
        service.publish_candidate(
            session, candidate.id, candidate.version, "restart-test-key", ADMIN_ID, "재시작 전 게시"
        )
    engine.dispose()
    restarted = build_engine(url, allow_sqlite=True)
    with Session(restarted) as session:
        assert session.scalar(select(Publication)).snapshot["slug"] == "test-case-first"
    restarted.dispose()


@pytest.mark.parametrize("value", ["10.9999/ABC", "doi:10.9999/abc", "https://doi.org/10.9999/abc"])
def test_normalize_doi(value):
    assert normalize_doi(value) == "10.9999/abc"
