"""운영 조회는 가상 회원으로 검사합니다. 실제 DB와 실제 계정은 쓰지 않습니다."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.operations.account_actions import MemoryAccountStore
from app.operations.metrics import build_summary, filter_members, member_detail, research_detail
from app.operations.periods import resolve_range
from app.operations.records import (
    DATA_TYPE_SQL,
    FIELD_SQL,
    FORBIDDEN_SQL_WORDS,
    MEMBER_SQL,
    PAGE_SIZE,
    RESEARCH_SQL,
    WORK_SQL,
    MemberRow,
    OperationsSnapshot,
    ResearchRow,
    member_page_query,
    research_page_query,
)
from app.routers.operations import get_account_store, get_record_set, get_snapshot
from tests.test_insight_workflow import ADMIN_ID, ORIGIN, login, make_draft
from tests.test_insight_workflow import client as client  # noqa: PLC0414 - pytest fixture 재노출

SEOUL = ZoneInfo("Asia/Seoul")
TODAY = date(2026, 10, 26)
ACCESS = "/api/v1/admin/operations/access"
SUMMARY = "/api/v1/admin/operations/summary"
MEMBERS = "/api/v1/admin/operations/members"
RESEARCHES = "/api/v1/admin/operations/researches"
INSIGHTS = "/api/v1/admin/insights/access"
CANDIDATES = "/api/v1/admin/insights/candidates"


def at(day: str, hour: int = 12, minute: int = 0) -> datetime:
    clock = f"{day}T{hour:02d}:{minute:02d}:00"
    return datetime.fromisoformat(clock).replace(tzinfo=SEOUL)


def member(
    user_id: int,
    role: str | None,
    step: str = "done",
    status: str = "active",
    created: str = "2026-10-01",
    nickname: str | None = None,
    admin: bool = False,
) -> MemberRow:
    return MemberRow(
        user_id=user_id,
        nickname=nickname or f"회원{user_id}",
        user_role=role,
        signup_step=step,
        status=status,
        is_admin=admin,
        created_at=at(created),
        affiliation=None,
    )


def research(
    research_id: int,
    user_id: int,
    status: str = "registered",
    created: str = "2026-09-01",
    fields: tuple[tuple[str, str], ...] = (),
) -> ResearchRow:
    return ResearchRow(
        research_id=research_id,
        user_id=user_id,
        owner_nickname=f"회원{user_id}",
        status=status,
        title=f"가상 연구 {research_id}",
        created_at=at(created),
        updated_at=at("2026-10-26"),
        data_status="ready",
        share_policy="conditional",
        task_unsure=False,
        is_primary=False,
        field_ids=tuple(item[0] for item in fields),
        field_names=tuple(item[1] for item in fields),
        able_work_ids=(),
        able_work_names=(),
        data_types=("image",),
    )


def snapshot() -> OperationsSnapshot:
    members = (
        member(1, "researcher", created="2026-09-01"),
        member(2, "expert", created="2026-10-20"),
        member(3, None, step="info", created="2026-10-26"),
        member(4, "researcher", status="suspended", created="2026-10-19"),
        member(5, "researcher", status="deleted", created="2026-10-26"),
        member(6, "expert", step="role", created="2026-10-02"),
    )
    researches = (
        research(10, 1, created="2026-09-15", fields=(("FIELD001", "영상"), ("FIELD002", "세포"))),
        research(11, 1, status="draft", created="2026-10-26"),
    )
    return OperationsSnapshot(members=members, researches=researches)


def use_snapshot(data: OperationsSnapshot | None = None) -> None:
    records = data or snapshot()
    app.dependency_overrides[get_snapshot] = lambda: records
    app.dependency_overrides[get_record_set] = lambda: records
    app.dependency_overrides[get_account_store] = MemoryAccountStore


def login_ops(client: TestClient, discord_id: str = "300000000000000003") -> dict:
    user = login(client, discord_id)
    user["is_admin"] = False
    return user


def test_sql_does_not_select_private_columns():
    combined = f"{MEMBER_SQL}\n{RESEARCH_SQL}\n{FIELD_SQL}\n{WORK_SQL}\n{DATA_TYPE_SQL}"
    for word in FORBIDDEN_SQL_WORDS:
        assert word not in combined


def test_list_sql_uses_limit_and_keeps_percent_literal():
    query = {
        "q": "%",
        "role": "",
        "status": "",
        "signup_step": "",
        "created_start": None,
        "created_end": None,
        "progress_status": "",
        "field_id": "",
        "able_work_id": "",
    }
    member_sql, member_count, member_params, member_offset = member_page_query(query, 2)
    research_sql, research_count, _research_params, research_offset = research_page_query(query, 2)
    assert "LIMIT" in member_sql and "OFFSET" in member_sql
    assert "LIMIT" in research_sql and "OFFSET" in research_sql
    assert member_offset == PAGE_SIZE and research_offset == PAGE_SIZE
    assert "position(" in member_sql and "LIKE" not in member_sql.upper()
    assert member_params[0] == "%"
    assert "COUNT(*)" in member_count and "COUNT(*)" in research_count
    for word in FORBIDDEN_SQL_WORDS:
        assert word not in member_sql and word not in research_sql


def test_range_uses_seoul_midnight_and_limits_custom_span():
    start, end = resolve_range("7d", today=TODAY)
    assert start == at("2026-10-20", 0)
    assert end == at("2026-10-27", 0)
    assert at("2026-10-19", 23, 30) < start
    month_start, month_end = resolve_range("month", today=TODAY)
    assert month_start == at("2026-10-01", 0)
    assert month_end == at("2026-10-27", 0)
    with pytest.raises(ValueError):
        resolve_range("custom", date(2026, 1, 1), date(2027, 2, 1), TODAY)


def test_summary_separates_completion_creation_and_registration():
    start, end = resolve_range("7d", today=TODAY)
    body = build_summary(snapshot(), start, end, TODAY)
    completed = body["members"]["completed"]
    assert completed["value"] == 3
    assert completed["active"] == 2
    assert completed["suspended"] == 1
    assert body["members"]["in_progress"]["value"] == 2
    assert body["members"]["roles"]["counts"] == {"researcher": 2, "expert": 2, "unset": 1}
    created = body["members"]["accounts_created"]
    assert created["value"] == 3
    assert created["comparison"]["previous"] == 1
    assert body["members"]["signup_completed_in_period"]["value"] is None
    researches = body["researches"]
    assert researches["registered"]["value"] == 1
    assert researches["created"]["value"] == 1
    assert researches["first_registered_in_period"]["value"] is None
    assert sum(item["count"] for item in researches["fields"]["items"]) == 2
    assert researches["abandonment"]["status"] == "not_collected"
    assert body["unavailable"][0]["status"] == "not_collected"


def test_previous_zero_has_no_rate_and_search_is_literal():
    only = OperationsSnapshot(
        members=(member(1, "researcher", created="2026-10-26"),), researches=()
    )
    start, end = resolve_range("today", today=TODAY)
    created = build_summary(only, start, end, TODAY)["members"]["accounts_created"]
    assert created["comparison"]["previous"] == 0
    assert created["comparison"]["rate"] is None
    assert created["comparison"]["absolute"] == 1
    query = {
        "q": "%",
        "role": "",
        "status": "",
        "signup_step": "",
        "created_start": None,
        "created_end": None,
    }
    assert filter_members(snapshot().members, query, 1)["total"] == 0


def test_member_page_boundary_and_deleted_default(client, monkeypatch):
    monkeypatch.setenv("OPERATIONS_ADMIN_DISCORD_IDS", "300000000000000003")
    use_snapshot()
    login_ops(client)
    hidden = client.get(MEMBERS).json()
    assert hidden["total"] == 5
    assert all(item["status"] != "deleted" for item in hidden["items"])
    listed = client.get(MEMBERS, params={"status": "any", "page": 1}).json()
    assert listed["total"] == 6
    many = tuple(member(index, "researcher", created="2026-10-01") for index in range(1, 22))
    use_snapshot(OperationsSnapshot(members=many, researches=()))
    page_two = client.get(MEMBERS, params={"page": 2}).json()
    page_three = client.get(MEMBERS, params={"page": 3}).json()
    assert page_two["total"] == 21
    assert len(page_two["items"]) == 1
    assert page_three["items"] == []
    empty = client.get(MEMBERS, params={"q": "없는닉네임"})
    assert empty.status_code == 200 and empty.json()["total"] == 0


def test_detail_hides_research_body(client, monkeypatch):
    monkeypatch.setenv("OPERATIONS_ADMIN_DISCORD_IDS", "300000000000000003")
    use_snapshot()
    login_ops(client)
    body = client.get(f"{RESEARCHES}/10").json()
    assert "공개 모집" in body["status_note"]
    assert "공개 여부" in body["share_policy"]["note"]
    assert "description" not in body
    assert "share_condition" not in body
    assert "discord_id" not in body
    detail = research_detail(snapshot(), 10)
    assert detail is not None and "description" not in detail
    assert client.get(f"{RESEARCHES}/999").status_code == 404
    person = client.get(f"{MEMBERS}/1").json()
    assert person["is_admin"] is False
    assert person["actions"]["status"] == "ready"
    assert person["actions"]["next_status"] == "suspended"
    assert member_detail(snapshot(), 1)["researches"][0]["research_id"] == 10


def test_permissions_split_insight_and_operations(client, monkeypatch):
    monkeypatch.setenv("OPERATIONS_ADMIN_DISCORD_IDS", "300000000000000003")
    monkeypatch.setenv("INSIGHT_ADMIN_DISCORD_IDS", ADMIN_ID)
    use_snapshot()
    assert client.get(ACCESS).status_code == 401
    login(client)
    assert client.get(ACCESS).status_code == 403
    assert client.get(INSIGHTS).status_code == 200
    login_ops(client)
    assert client.get(ACCESS).json()["can_read_operations"] is True
    assert client.get(INSIGHTS).status_code == 403
    rejected = client.post(CANDIDATES, json=make_draft("ops"), headers=ORIGIN)
    assert rejected.status_code == 403
    summary = client.get(SUMMARY, params={"preset": "7d"})
    assert summary.status_code == 200
    assert summary.json()["members"]["signup_completed_in_period"]["value"] is None
    monkeypatch.setenv("INSIGHTS_ENABLED", "false")
    assert client.get(ACCESS).status_code == 200
    assert client.get(INSIGHTS).status_code == 404


def test_me_carries_admin_menu_flags(client, monkeypatch):
    """헤더가 권한 API를 따로 치지 않도록 /auth/me에 메뉴 사실을 넣습니다."""
    monkeypatch.setenv("OPERATIONS_ADMIN_DISCORD_IDS", "300000000000000003")
    monkeypatch.setenv("INSIGHT_ADMIN_DISCORD_IDS", ADMIN_ID)
    login(client, "200000000000000001")
    regular = client.get("/api/v1/auth/me").json()
    assert regular["can_manage_insights"] is False
    assert regular["can_read_operations"] is False

    login(client)
    insight_admin = client.get("/api/v1/auth/me").json()
    assert insight_admin["can_manage_insights"] is True
    assert insight_admin["can_read_operations"] is False
    assert insight_admin["is_admin"] is False

    login_ops(client)
    operations_admin = client.get("/api/v1/auth/me").json()
    assert operations_admin["can_manage_insights"] is False
    assert operations_admin["can_read_operations"] is True

    shared = login(client, "200000000000000002")
    shared["is_admin"] = True
    both = client.get("/api/v1/auth/me").json()
    assert both["can_manage_insights"] is True
    assert both["can_read_operations"] is True

    monkeypatch.setenv("INSIGHTS_ENABLED", "false")
    hidden = client.get("/api/v1/auth/me").json()
    assert hidden["can_manage_insights"] is False
    assert hidden["can_read_operations"] is True


def test_is_admin_can_read_without_operations_list(client, monkeypatch):
    monkeypatch.setenv("OPERATIONS_ADMIN_DISCORD_IDS", "")
    user = login(client, "200000000000000001")
    user["is_admin"] = True
    use_snapshot()
    assert client.get(ACCESS).status_code == 200
    user["status"] = "suspended"
    assert client.get(ACCESS).status_code == 403


def test_summary_route_uses_fixed_today(client, monkeypatch):
    monkeypatch.setenv("OPERATIONS_ADMIN_DISCORD_IDS", "300000000000000003")
    monkeypatch.setattr("app.routers.operations.seoul_today", lambda: TODAY)
    use_snapshot()
    login_ops(client)
    body = client.get(SUMMARY, params={"preset": "7d"}).json()
    assert body["range"]["start"] == "2026-10-20"
    assert body["range"]["end"] == "2026-10-27"
    assert body["range"]["today_in_progress"] is True
    assert body["members"]["accounts_created"]["value"] == 3


def test_research_progress_does_not_infer_recruitment_from_registration(client, monkeypatch):
    monkeypatch.setenv("OPERATIONS_ADMIN_DISCORD_IDS", "300000000000000003")
    use_snapshot()
    login_ops(client)
    registered = client.get(RESEARCHES, params={"status": "registered"}).json()
    assert registered["items"][0]["progress"]["code"] == "not_linked"
    drafts = client.get(RESEARCHES, params={"progress_status": "not_applicable"}).json()
    assert drafts["total"] == 1 and drafts["items"][0]["status"] == "draft"
    linked = client.get(RESEARCHES, params={"progress_status": "not_linked"}).json()
    assert linked["total"] == 1 and linked["items"][0]["status"] == "registered"
    for state in (
        "recruiting", "unmatched_closed", "scheduled", "in_progress", "completed",
        "recruitment_canceled", "paused", "completion_pending", "discontinued",
    ):
        result = client.get(RESEARCHES, params={"progress_status": state})
        assert result.status_code == 200 and result.json()["total"] == 0
    assert client.get(RESEARCHES, params={"progress_status": "invalid"}).status_code == 422
    detail = client.get(f"{RESEARCHES}/10").json()
    assert detail["progress"] == registered["items"][0]["progress"]
    assert client.get(RESEARCHES, params={"q": "10", "progress_status": "not_linked"}).json()["total"] == 1
    assert client.get(RESEARCHES, params={"status": "draft", "progress_status": "not_linked"}).json()["total"] == 0
