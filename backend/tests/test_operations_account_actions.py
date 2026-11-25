"""회원 정지·해제는 가상 계정으로만 확인합니다. 실제 회원 DB에는 쓰지 않습니다."""

import re
from pathlib import Path
from uuid import uuid4

from app import user_store
from app.operations.account_actions import MemberAccount, MemoryAccountStore
from app.operations.records import OperationsSnapshot
from app.routers.operations import get_account_store
from app.security import create_access_token
from tests.test_insight_workflow import ADMIN_ID, ORIGIN, login
from tests.test_insight_workflow import client as client  # noqa: PLC0414
from tests.test_operations_admin import login_ops, use_snapshot

STATUS = "/api/v1/admin/operations/members/{user_id}/status"
ME = "/api/v1/auth/me"


def bind(store: MemoryAccountStore) -> None:
    use_snapshot()
    from app.main import app

    app.dependency_overrides[get_account_store] = lambda: store


def payload(expected: str, nxt: str, reason: str = "가상 사유", key: str | None = None) -> dict:
    return {
        "expected_status": expected,
        "next_status": nxt,
        "reason": reason,
        "notice": "가상 안내. 발송하지 않습니다.",
        "idempotency_key": key or str(uuid4()),
    }


def test_suspend_and_replay_keep_one_history_and_do_not_touch_research(client, monkeypatch):
    monkeypatch.setenv("OPERATIONS_ADMIN_DISCORD_IDS", "300000000000000003")
    actor = login_ops(client)
    target = MemberAccount(50, "active", False)
    store = MemoryAccountStore(
        {50: target, actor["user_id"]: MemberAccount(actor["user_id"], "active", False)}
    )
    bind(store)
    key = str(uuid4())
    first = client.post(
        STATUS.format(user_id=50), json=payload("active", "suspended", key=key), headers=ORIGIN
    )
    second = client.post(
        STATUS.format(user_id=50), json=payload("active", "suspended", key=key), headers=ORIGIN
    )
    assert first.status_code == 200, first.text
    assert first.json()["replayed"] is False
    assert second.json()["replayed"] is True
    assert target.status == "suspended"
    assert len(store.rows) == 1
    source = Path("app/operations/account_actions.py").read_text(encoding="utf-8").lower()
    # 연구 표(research, research_*)는 건드리지 않습니다. 역할 이름 researcher·researcher_profile은 괜찮습니다.
    assert "delete from" not in source and not re.search(r"\bresearch(?!er)", source)
    detail = client.get("/api/v1/admin/operations/members/1").json()
    assert "discord_id" not in detail["audit"]["items"].__repr__()


def test_conflict_admin_self_deleted_and_failed_audit_do_not_change_status(client, monkeypatch):
    monkeypatch.setenv("OPERATIONS_ADMIN_DISCORD_IDS", "300000000000000003")
    actor = login_ops(client)
    members = {
        50: MemberAccount(50, "active", False),
        51: MemberAccount(51, "active", True),
        52: MemberAccount(52, "deleted", False),
        actor["user_id"]: MemberAccount(actor["user_id"], "active", False),
    }
    store = MemoryAccountStore(members)
    bind(store)
    stale = client.post(
        STATUS.format(user_id=50), json=payload("suspended", "active"), headers=ORIGIN
    )
    assert stale.status_code == 409 and members[50].status == "active"
    admin = client.post(
        STATUS.format(user_id=51), json=payload("active", "suspended"), headers=ORIGIN
    )
    assert admin.status_code == 409 and members[51].status == "active"
    self_change = client.post(
        STATUS.format(user_id=actor["user_id"]), json=payload("active", "suspended"), headers=ORIGIN
    )
    assert self_change.status_code == 409
    deleted = client.post(
        STATUS.format(user_id=52), json=payload("active", "suspended"), headers=ORIGIN
    )
    assert deleted.status_code == 409
    store.fail_write = True
    failed = client.post(
        STATUS.format(user_id=50), json=payload("active", "suspended"), headers=ORIGIN
    )
    assert failed.status_code == 503 and members[50].status == "active" and store.rows == []


def test_permissions_and_existing_cookie_follow_the_new_status(client, monkeypatch):
    monkeypatch.setenv("OPERATIONS_ADMIN_DISCORD_IDS", "300000000000000003")
    monkeypatch.setenv("INSIGHT_ADMIN_DISCORD_IDS", ADMIN_ID)
    assert (
        client.post(
            STATUS.format(user_id=50), json=payload("active", "suspended"), headers=ORIGIN
        ).status_code
        == 401
    )
    login(client)
    assert (
        client.post(
            STATUS.format(user_id=50), json=payload("active", "suspended"), headers=ORIGIN
        ).status_code
        == 403
    )
    target = login(client, "400000000000000004")
    record = user_store.find_by_id(target["user_id"])
    assert record is not None
    member = MemberAccount(record["user_id"], "active", False)
    store = MemoryAccountStore({member.user_id: member})
    bind(store)
    login_ops(client)
    changed = client.post(
        STATUS.format(user_id=member.user_id), json=payload("active", "suspended"), headers=ORIGIN
    )
    assert changed.status_code == 200
    record["status"] = member.status
    client.cookies.set(
        "access_token",
        create_access_token(record["user_id"], record["discord_id"]),
        domain=client.base_url.host,
        path="/",
    )
    assert client.get(ME).status_code == 403
    login_ops(client)
    restored = client.post(
        STATUS.format(user_id=member.user_id),
        json=payload("suspended", "active", reason="가상 해제"),
        headers=ORIGIN,
    )
    assert restored.status_code == 200 and member.status == "active"
    record["status"] = member.status
    client.cookies.set(
        "access_token",
        create_access_token(record["user_id"], record["discord_id"]),
        domain=client.base_url.host,
        path="/",
    )
    assert client.get(ME).status_code == 200


ADMIN = "/api/v1/admin/operations/members/{user_id}/admin"


def admin_payload(expected: bool, nxt: bool, reason: str = "가상 권한 사유", key: str | None = None) -> dict:
    return {
        "expected_is_admin": expected,
        "next_is_admin": nxt,
        "reason": reason,
        "notice": "가상 안내. 발송하지 않습니다.",
        "idempotency_key": key or str(uuid4()),
    }


def test_grant_admin_and_replay_keep_one_history(client, monkeypatch):
    monkeypatch.setenv("OPERATIONS_ADMIN_DISCORD_IDS", "300000000000000003")
    actor = login_ops(client)
    target = MemberAccount(50, "active", False)
    other_admin = MemberAccount(51, "active", True)
    store = MemoryAccountStore(
        {
            50: target,
            51: other_admin,
            actor["user_id"]: MemberAccount(actor["user_id"], "active", False),
        }
    )
    bind(store)
    key = str(uuid4())
    first = client.post(ADMIN.format(user_id=50), json=admin_payload(False, True, key=key), headers=ORIGIN)
    second = client.post(ADMIN.format(user_id=50), json=admin_payload(False, True, key=key), headers=ORIGIN)
    assert first.status_code == 200, first.text
    assert first.json()["replayed"] is False
    assert first.json()["is_admin"] is True
    assert second.json()["replayed"] is True
    assert target.is_admin is True
    assert len(store.rows) == 1
    assert store.rows[0]["action"] == "grant_admin"
    detail = client.get("/api/v1/admin/operations/members/2").json()
    assert detail["admin_actions"]["status"] == "ready"
    assert detail["admin_actions"]["next_is_admin"] is True
    assert "discord_id" not in str(detail)


def test_ops_reader_cannot_revoke_last_admin_or_self_or_without_origin(client, monkeypatch):
    monkeypatch.setenv("OPERATIONS_ADMIN_DISCORD_IDS", "300000000000000003")
    actor = login_ops(client)
    only_admin = MemberAccount(51, "active", True)
    store = MemoryAccountStore(
        {51: only_admin, actor["user_id"]: MemberAccount(actor["user_id"], "active", False)}
    )
    bind(store)
    last = client.post(ADMIN.format(user_id=51), json=admin_payload(True, False), headers=ORIGIN)
    assert last.status_code == 409 and only_admin.is_admin is True
    self_change = client.post(
        ADMIN.format(user_id=actor["user_id"]), json=admin_payload(False, True), headers=ORIGIN
    )
    assert self_change.status_code == 409
    missing_origin = client.post(ADMIN.format(user_id=51), json=admin_payload(True, False))
    assert missing_origin.status_code == 403
    login(client)
    forbidden = client.post(ADMIN.format(user_id=51), json=admin_payload(True, False), headers=ORIGIN)
    assert forbidden.status_code == 403 and only_admin.is_admin is True


ROLE = "/api/v1/admin/operations/members/{user_id}/role"


def role_payload(expected: str | None, nxt: str, reason: str = "가상 사유", key: str | None = None) -> dict:
    return {
        "expected_role": expected,
        "next_role": nxt,
        "reason": reason,
        "notice": "",
        "idempotency_key": key or str(uuid4()),
    }


def role_store(actor_id: int, *members: MemberAccount) -> MemoryAccountStore:
    accounts = {item.user_id: item for item in members}
    accounts[actor_id] = MemberAccount(actor_id, "active", False)
    store = MemoryAccountStore(accounts)
    bind(store)
    return store


def test_admin_target_role_changes_at_once_and_fills_blank_profile(client, monkeypatch):
    monkeypatch.setenv("OPERATIONS_ADMIN_DISCORD_IDS", "300000000000000003")
    actor = login_ops(client)
    target = MemberAccount(50, "active", True, "expert")
    store = role_store(actor["user_id"], target)
    key = str(uuid4())
    first = client.post(ROLE.format(user_id=50), json=role_payload("expert", "researcher", key=key), headers=ORIGIN)
    second = client.post(ROLE.format(user_id=50), json=role_payload("expert", "researcher", key=key), headers=ORIGIN)
    assert first.status_code == 200, first.text
    assert first.json()["role"] == "researcher"
    assert first.json()["signup_step"] == "done"
    assert second.json()["replayed"] is True
    # 관리자(테스트) 계정은 바로 바뀌고, 연구자에게 필요한 빈 프로필을 채웁니다.
    assert (target.user_role, target.signup_step) == ("researcher", "done")
    assert store.filled == [(50, "researcher")]
    assert [row["action"] for row in store.rows] == ["change_role"]
    assert (store.rows[0]["before_status"], store.rows[0]["after_status"]) == ("expert", "researcher")


def test_member_target_role_goes_back_to_signup_choice(client, monkeypatch):
    monkeypatch.setenv("OPERATIONS_ADMIN_DISCORD_IDS", "300000000000000003")
    actor = login_ops(client)
    target = MemberAccount(50, "active", False, "expert")
    store = role_store(actor["user_id"], target)
    response = client.post(ROLE.format(user_id=50), json=role_payload("expert", "researcher"), headers=ORIGIN)
    assert response.status_code == 200, response.text
    assert response.json()["role"] is None
    assert response.json()["signup_step"] == "role"
    # 일반 회원은 역할을 비우고 회원 유형 선택으로 보냅니다. 기관 인증은 회원이 직접 합니다.
    assert (target.user_role, target.signup_step) == (None, "role")
    assert store.filled == []
    assert store.rows[0]["action"] == "reset_role"
    assert store.rows[0]["after_status"] == "signup"


def test_role_change_rejects_stale_same_self_inactive_unchosen_and_missing_origin(client, monkeypatch):
    monkeypatch.setenv("OPERATIONS_ADMIN_DISCORD_IDS", "300000000000000003")
    actor = login_ops(client)
    expert = MemberAccount(50, "active", True, "expert")
    stopped = MemberAccount(51, "suspended", False, "researcher")
    unchosen = MemberAccount(52, "active", False, None, "role")
    store = role_store(actor["user_id"], expert, stopped, unchosen)
    stale = client.post(ROLE.format(user_id=50), json=role_payload("researcher", "expert"), headers=ORIGIN)
    same = client.post(ROLE.format(user_id=50), json=role_payload("expert", "expert"), headers=ORIGIN)
    self_change = client.post(
        ROLE.format(user_id=actor["user_id"]), json=role_payload(None, "expert"), headers=ORIGIN
    )
    inactive = client.post(ROLE.format(user_id=51), json=role_payload("researcher", "expert"), headers=ORIGIN)
    not_chosen = client.post(ROLE.format(user_id=52), json=role_payload(None, "expert"), headers=ORIGIN)
    missing_origin = client.post(ROLE.format(user_id=50), json=role_payload("expert", "researcher"))
    assert [item.status_code for item in (stale, same, self_change, inactive, not_chosen)] == [409] * 5
    assert missing_origin.status_code == 403
    assert expert.user_role == "expert" and store.rows == []


def test_member_detail_explains_role_change_for_admin_and_member(client, monkeypatch):
    from tests.test_operations_admin import member

    monkeypatch.setenv("OPERATIONS_ADMIN_DISCORD_IDS", "300000000000000003")
    login_ops(client)
    use_snapshot(OperationsSnapshot(members=(member(7, "expert", admin=True), member(8, "researcher")), researches=()))
    admin_detail = client.get("/api/v1/admin/operations/members/7").json()["role_actions"]
    member_detail = client.get("/api/v1/admin/operations/members/8").json()["role_actions"]
    assert (admin_detail["status"], admin_detail["mode"], admin_detail["next_role"]) == ("ready", "direct", "researcher")
    assert (member_detail["status"], member_detail["mode"], member_detail["next_role"]) == ("ready", "reset", "expert")
