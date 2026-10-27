"""회원 정지·해제는 가상 계정으로만 확인합니다. 실제 회원 DB에는 쓰지 않습니다."""

from pathlib import Path
from uuid import uuid4

from app import user_store
from app.operations.account_actions import MemberAccount, MemoryAccountStore
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
    assert "delete from" not in source and "research" not in source
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
