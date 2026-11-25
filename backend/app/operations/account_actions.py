"""회원 정지·해제, 공통 관리자 부여, 역할 변경. 계정과 운영 이력은 한 저장 동작에서 함께 성공하거나 함께 실패합니다."""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol
from uuid import UUID

from psycopg import errors

from app.db import transaction

ALLOWED = {"active": "suspended", "suspended": "active"}
ACTIONS = {"suspended": "suspend", "active": "restore"}
ADMIN_LABEL = {True: "admin", False: "member"}
ROLES = {"researcher", "expert"}
# operation_audit의 ck_operation_audit_action이 받아야 하는 값 전부입니다. 새 값은 마이그레이션과 함께 더합니다.
AUDIT_ACTIONS = ("suspend", "restore", "grant_admin", "revoke_admin", "change_role", "reset_role")


class AccountActionError(Exception):
    """화면이 그대로 둘 수 있게, 저장 전에 이유를 상태 코드로 나눕니다."""

    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail


@dataclass
class MemberAccount:
    user_id: int
    status: str
    is_admin: bool
    user_role: str | None = None
    signup_step: str = "done"


@dataclass
class StatusChange:
    expected_status: str
    next_status: str
    reason: str
    notice: str
    idempotency_key: str


@dataclass
class AdminChange:
    expected_is_admin: bool
    next_is_admin: bool
    reason: str
    notice: str
    idempotency_key: str


@dataclass
class RoleChange:
    expected_role: str | None
    next_role: str
    reason: str
    notice: str
    idempotency_key: str


def parse_change(body: dict) -> StatusChange:
    """빈 사유와 형식이 다른 재시도 키는 저장소에 닿기 전에 거절합니다."""
    reason = str(body.get("reason", "")).strip()
    notice = str(body.get("notice", "")).strip()
    key = str(body.get("idempotency_key", "")).strip()
    expected = str(body.get("expected_status", ""))
    nxt = str(body.get("next_status", ""))
    if nxt not in {"active", "suspended"} or expected not in {"active", "suspended"}:
        raise AccountActionError(422, "정상과 정지만 바꿀 수 있습니다.")
    if not reason or len(reason) > 200 or len(notice) > 200:
        raise AccountActionError(
            422, "내부 사유는 1~200자입니다. 사용자 안내도 200자를 넘길 수 없습니다."
        )
    try:
        UUID(key)
    except ValueError as error:
        raise AccountActionError(422, "다시 시도 키가 올바르지 않습니다.") from error
    return StatusChange(expected, nxt, reason, notice, key)


def parse_admin_change(body: dict) -> AdminChange:
    """공통 관리자 여부만 받습니다. Discord 번호나 다른 권한 목록은 받지 않습니다."""
    reason = str(body.get("reason", "")).strip()
    notice = str(body.get("notice", "")).strip()
    key = str(body.get("idempotency_key", "")).strip()
    expected = body.get("expected_is_admin")
    nxt = body.get("next_is_admin")
    if not isinstance(expected, bool) or not isinstance(nxt, bool):
        raise AccountActionError(422, "관리자 여부는 예/아니오로만 바꿀 수 있습니다.")
    if expected == nxt:
        raise AccountActionError(422, "지금과 같은 권한으로는 바꾸지 않습니다.")
    if not reason or len(reason) > 200 or len(notice) > 200:
        raise AccountActionError(
            422, "내부 사유는 1~200자입니다. 사용자 안내도 200자를 넘길 수 없습니다."
        )
    try:
        UUID(key)
    except ValueError as error:
        raise AccountActionError(422, "다시 시도 키가 올바르지 않습니다.") from error
    return AdminChange(expected, nxt, reason, notice, key)


def parse_role_change(body: dict) -> RoleChange:
    """연구자·AI 전문가 두 역할만 받습니다. 빈 사유와 형식이 다른 재시도 키는 저장 전에 거절합니다."""
    reason = str(body.get("reason", "")).strip()
    notice = str(body.get("notice", "")).strip()
    key = str(body.get("idempotency_key", "")).strip()
    expected = body.get("expected_role")
    nxt = body.get("next_role")
    if nxt not in ROLES or (expected is not None and expected not in ROLES):
        raise AccountActionError(422, "연구자와 AI 전문가 중에서만 바꿀 수 있습니다.")
    if not reason or len(reason) > 200 or len(notice) > 200:
        raise AccountActionError(
            422, "내부 사유는 1~200자입니다. 사용자 안내도 200자를 넘길 수 없습니다."
        )
    try:
        UUID(key)
    except ValueError as error:
        raise AccountActionError(422, "다시 시도 키가 올바르지 않습니다.") from error
    return RoleChange(expected, nxt, reason, notice, key)


def decide(member: MemberAccount, actor_id: int, change: StatusChange, prior: dict | None) -> dict:
    """저장 여부를 순수하게 정합니다. 연구·협업 행은 이 함수가 알지 못합니다."""
    if prior is not None:
        same = (
            prior["target_id"] == str(member.user_id)
            and prior["after_status"] == change.next_status
            and prior["reason"] == change.reason
        )
        if not same:
            raise AccountActionError(
                409, "같은 재시도 키로 다른 요청이 이미 처리되었습니다. 상태를 다시 조회하세요."
            )
        return {**prior, "replayed": True}
    if member.user_id == actor_id:
        raise AccountActionError(409, "본인 계정은 이 단계에서 정지하거나 해제하지 않습니다.")
    if member.is_admin:
        raise AccountActionError(
            409, "관리자 계정은 정지하지 않습니다. 마지막 관리자 상실도 막습니다."
        )
    if member.status == "deleted":
        raise AccountActionError(409, "탈퇴 계정은 복구하거나 삭제하지 않습니다.")
    if ALLOWED.get(member.status) != change.next_status or member.status != change.expected_status:
        raise AccountActionError(409, "현재 상태가 바뀌었습니다. 최신 상태를 다시 조회하세요.")
    return {
        "idempotency_key": change.idempotency_key,
        "actor_user_id": actor_id,
        "target_type": "member",
        "target_id": str(member.user_id),
        "action": ACTIONS[change.next_status],
        "before_status": member.status,
        "after_status": change.next_status,
        "reason": change.reason,
        "notice": change.notice,
        "created_at": datetime.now(UTC),
        "replayed": False,
    }


def decide_admin(
    member: MemberAccount,
    actor_id: int,
    change: AdminChange,
    prior: dict | None,
    admin_count: int,
) -> dict:
    """공통 관리자 표시만 바꿉니다. 환경 변수 허용 목록은 고치지 않습니다."""
    if prior is not None:
        same = (
            prior["target_id"] == str(member.user_id)
            and prior["after_status"] == ADMIN_LABEL[change.next_is_admin]
            and prior["reason"] == change.reason
        )
        if not same:
            raise AccountActionError(
                409, "같은 재시도 키로 다른 요청이 이미 처리되었습니다. 상태를 다시 조회하세요."
            )
        return {**prior, "replayed": True}
    if member.user_id == actor_id:
        raise AccountActionError(409, "본인 권한은 이 화면에서 바꾸지 않습니다.")
    if member.status == "deleted":
        raise AccountActionError(409, "탈퇴 계정에는 권한을 주지 않습니다.")
    if member.status != "active":
        raise AccountActionError(409, "정상 계정에만 관리자 권한을 주거나 해제합니다.")
    if member.is_admin != change.expected_is_admin:
        raise AccountActionError(409, "현재 권한이 바뀌었습니다. 최신 상태를 다시 조회하세요.")
    if change.next_is_admin is False and admin_count <= 1:
        raise AccountActionError(409, "마지막 공통 관리자는 해제할 수 없습니다.")
    return {
        "idempotency_key": change.idempotency_key,
        "actor_user_id": actor_id,
        "target_type": "member",
        "target_id": str(member.user_id),
        "action": "grant_admin" if change.next_is_admin else "revoke_admin",
        "before_status": ADMIN_LABEL[member.is_admin],
        "after_status": ADMIN_LABEL[change.next_is_admin],
        "reason": change.reason,
        "notice": change.notice,
        "created_at": datetime.now(UTC),
        "replayed": False,
    }


def decide_role(member: MemberAccount, actor_id: int, change: RoleChange, prior: dict | None) -> dict:
    """관리자(테스트) 계정은 바로 바꾸고(change_role), 일반 회원은 가입 단계로 되돌립니다(reset_role)."""
    after = change.next_role if member.is_admin else "signup"
    if prior is not None:
        same = (
            prior["target_id"] == str(member.user_id)
            and prior["after_status"] == after
            and prior["reason"] == change.reason
        )
        if not same:
            raise AccountActionError(
                409, "같은 재시도 키로 다른 요청이 이미 처리되었습니다. 상태를 다시 조회하세요."
            )
        return {**prior, "replayed": True}
    if member.user_id == actor_id:
        raise AccountActionError(409, "본인 역할은 이 화면에서 바꾸지 않습니다.")
    if member.status != "active":
        raise AccountActionError(409, "정상 계정의 역할만 바꿉니다.")
    if member.user_role is None:
        raise AccountActionError(409, "아직 역할을 고르지 않은 회원입니다. 가입을 마친 뒤 바꿀 수 있습니다.")
    if member.user_role != change.expected_role:
        raise AccountActionError(409, "현재 역할이 바뀌었습니다. 최신 상태를 다시 조회하세요.")
    if member.user_role == change.next_role:
        raise AccountActionError(409, "지금과 같은 역할로는 바꾸지 않습니다.")
    return {
        "idempotency_key": change.idempotency_key,
        "actor_user_id": actor_id,
        "target_type": "member",
        "target_id": str(member.user_id),
        "action": "change_role" if member.is_admin else "reset_role",
        "before_status": member.user_role,
        "after_status": after,
        "reason": change.reason,
        "notice": change.notice,
        "created_at": datetime.now(UTC),
        "replayed": False,
    }


def _apply_role_now(cursor, user_id: int, change: RoleChange) -> None:
    """관리자(테스트) 계정: 역할을 바로 바꾸고, 새 역할 화면이 비지 않도록 없는 프로필만 테스트 값으로 만듭니다."""
    cursor.execute(
        """
        UPDATE users SET user_role = %s, signup_step = 'done'
        WHERE user_id = %s AND user_role IS NOT DISTINCT FROM %s AND status = 'active' AND is_admin IS TRUE
        """,
        (change.next_role, user_id, change.expected_role),
    )
    if cursor.rowcount != 1:
        raise AccountActionError(409, "현재 역할이 바뀌었습니다. 최신 상태를 다시 조회하세요.")
    # 이미 있는 프로필은 그대로 둡니다(ON CONFLICT DO NOTHING). 전문가 프로필은 검색에 공개하지 않습니다.
    if change.next_role == "researcher":
        cursor.execute(
            """
            INSERT INTO researcher_profile
              (user_id, institution_name, institution_source, department, is_verified, verified_at)
            VALUES (%s, '테스트 기관', 'manual', '테스트', TRUE, now())
            ON CONFLICT (user_id) DO NOTHING
            """,
            (user_id,),
        )
    else:
        cursor.execute(
            """
            INSERT INTO expert (user_id, current_job, ai_career, is_public)
            VALUES (%s, 'etc', 'lt1', FALSE)
            ON CONFLICT (user_id) DO NOTHING
            """,
            (user_id,),
        )


def _send_back_to_signup(cursor, user_id: int, change: RoleChange) -> None:
    """일반 회원: 역할을 비우고 회원 유형 선택으로 되돌립니다. 기존 프로필·연구·협업 기록은 지우지 않습니다."""
    cursor.execute(
        """
        UPDATE users SET user_role = NULL, signup_step = 'role'
        WHERE user_id = %s AND user_role = %s AND status = 'active' AND is_admin IS NOT TRUE
        """,
        (user_id, change.expected_role),
    )
    if cursor.rowcount != 1:
        raise AccountActionError(409, "현재 역할이 바뀌었습니다. 최신 상태를 다시 조회하세요.")


class AccountStore(Protocol):
    def change(self, actor_id: int, user_id: int, change: StatusChange) -> dict: ...

    def change_admin(self, actor_id: int, user_id: int, change: AdminChange) -> dict: ...

    def change_role(self, actor_id: int, user_id: int, change: RoleChange) -> dict: ...

    def history(self, user_id: int) -> list[dict]: ...


class MemoryAccountStore:
    """테스트 전용 저장소. 실패하면 상태 변경도 함께 되돌립니다."""

    def __init__(self, members: dict[int, MemberAccount] | None = None) -> None:
        self.members = members or {}
        self.rows: list[dict] = []
        self.filled: list[tuple[int, str]] = []  # (회원 번호, 빈 프로필을 채운 역할)
        self.fail_write = False

    def change(self, actor_id: int, user_id: int, change: StatusChange) -> dict:
        member = self.members.get(user_id)
        if member is None:
            raise AccountActionError(404, "회원을 찾을 수 없습니다.")
        prior = next(
            (row for row in self.rows if row["idempotency_key"] == change.idempotency_key), None
        )
        decision = decide(member, actor_id, change, prior)
        if decision["replayed"]:
            return decision
        previous = member.status
        member.status = change.next_status
        if self.fail_write:
            member.status = previous
            raise AccountActionError(503, "이력 저장에 실패해 상태 변경을 취소했습니다.")
        self.rows.append({key: value for key, value in decision.items() if key != "replayed"})
        return decision

    def change_admin(self, actor_id: int, user_id: int, change: AdminChange) -> dict:
        member = self.members.get(user_id)
        if member is None:
            raise AccountActionError(404, "회원을 찾을 수 없습니다.")
        prior = next(
            (row for row in self.rows if row["idempotency_key"] == change.idempotency_key), None
        )
        admin_count = sum(
            1 for item in self.members.values() if item.is_admin and item.status != "deleted"
        )
        decision = decide_admin(member, actor_id, change, prior, admin_count)
        if decision["replayed"]:
            return decision
        previous = member.is_admin
        member.is_admin = change.next_is_admin
        if self.fail_write:
            member.is_admin = previous
            raise AccountActionError(503, "이력 저장에 실패해 권한 변경을 취소했습니다.")
        self.rows.append({key: value for key, value in decision.items() if key != "replayed"})
        return decision

    def change_role(self, actor_id: int, user_id: int, change: RoleChange) -> dict:
        member = self.members.get(user_id)
        if member is None:
            raise AccountActionError(404, "회원을 찾을 수 없습니다.")
        prior = next(
            (row for row in self.rows if row["idempotency_key"] == change.idempotency_key), None
        )
        decision = decide_role(member, actor_id, change, prior)
        if decision["replayed"]:
            return decision
        if member.is_admin:
            member.user_role, member.signup_step = change.next_role, "done"
            self.filled.append((user_id, change.next_role))
        else:
            member.user_role, member.signup_step = None, "role"
        self.rows.append({key: value for key, value in decision.items() if key != "replayed"})
        return decision

    def history(self, user_id: int) -> list[dict]:
        return [row for row in self.rows if row["target_id"] == str(user_id)]


class PostgresAccountStore:
    """운영 표에 상태와 이력을 한 트랜잭션으로 씁니다. 원격 적용 전에는 표가 없을 수 있습니다."""

    def change(self, actor_id: int, user_id: int, change: StatusChange) -> dict:
        try:
            with transaction() as cursor:
                cursor.execute(
                    "SELECT user_id, status, is_admin FROM users WHERE user_id = %s FOR UPDATE",
                    (user_id,),
                )
                row = cursor.fetchone()
                if row is None:
                    raise AccountActionError(404, "회원을 찾을 수 없습니다.")
                cursor.execute(
                    """
                    SELECT idempotency_key, target_id, after_status, reason, before_status, action
                    FROM operation_audit WHERE idempotency_key = %s
                    """,
                    (change.idempotency_key,),
                )
                prior = cursor.fetchone()
                decision = decide(
                    MemberAccount(row["user_id"], row["status"], row["is_admin"]),
                    actor_id,
                    change,
                    prior,
                )
                if decision["replayed"]:
                    return decision
                cursor.execute(
                    "UPDATE users SET status = %s WHERE user_id = %s AND status = %s",
                    (change.next_status, user_id, change.expected_status),
                )
                if cursor.rowcount != 1:
                    raise AccountActionError(
                        409, "현재 상태가 바뀌었습니다. 최신 상태를 다시 조회하세요."
                    )
                cursor.execute(
                    """
                    INSERT INTO operation_audit (
                      idempotency_key, actor_user_id, target_type, target_id, action,
                      before_status, after_status, reason, notice, created_at
                    ) VALUES (%s, %s, 'member', %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        change.idempotency_key,
                        actor_id,
                        str(user_id),
                        decision["action"],
                        decision["before_status"],
                        change.next_status,
                        change.reason,
                        change.notice,
                        decision["created_at"],
                    ),
                )
                return decision
        except errors.UndefinedTable as error:
            raise AccountActionError(
                503, "운영 이력 표가 아직 없어 상태를 바꾸지 않습니다."
            ) from error

    def change_admin(self, actor_id: int, user_id: int, change: AdminChange) -> dict:
        try:
            with transaction() as cursor:
                cursor.execute(
                    "SELECT user_id, status, is_admin FROM users WHERE user_id = %s FOR UPDATE",
                    (user_id,),
                )
                row = cursor.fetchone()
                if row is None:
                    raise AccountActionError(404, "회원을 찾을 수 없습니다.")
                cursor.execute(
                    """
                    SELECT COUNT(*) AS admin_count
                    FROM users
                    WHERE is_admin IS TRUE AND status <> 'deleted'
                    """
                )
                counted = cursor.fetchone()
                admin_count = int(counted["admin_count"]) if counted else 0
                cursor.execute(
                    """
                    SELECT idempotency_key, target_id, after_status, reason, before_status, action
                    FROM operation_audit WHERE idempotency_key = %s
                    """,
                    (change.idempotency_key,),
                )
                prior = cursor.fetchone()
                decision = decide_admin(
                    MemberAccount(row["user_id"], row["status"], row["is_admin"]),
                    actor_id,
                    change,
                    prior,
                    admin_count,
                )
                if decision["replayed"]:
                    return decision
                cursor.execute(
                    """
                    UPDATE users
                    SET is_admin = %s
                    WHERE user_id = %s AND is_admin IS NOT DISTINCT FROM %s AND status = 'active'
                    """,
                    (change.next_is_admin, user_id, change.expected_is_admin),
                )
                if cursor.rowcount != 1:
                    raise AccountActionError(
                        409, "현재 권한이 바뀌었습니다. 최신 상태를 다시 조회하세요."
                    )
                cursor.execute(
                    """
                    INSERT INTO operation_audit (
                      idempotency_key, actor_user_id, target_type, target_id, action,
                      before_status, after_status, reason, notice, created_at
                    ) VALUES (%s, %s, 'member', %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        change.idempotency_key,
                        actor_id,
                        str(user_id),
                        decision["action"],
                        decision["before_status"],
                        decision["after_status"],
                        change.reason,
                        change.notice,
                        decision["created_at"],
                    ),
                )
                return decision
        except errors.UndefinedTable as error:
            raise AccountActionError(
                503, "운영 이력 표가 아직 없어 권한을 바꾸지 않습니다."
            ) from error

    def change_role(self, actor_id: int, user_id: int, change: RoleChange) -> dict:
        try:
            with transaction() as cursor:
                cursor.execute(
                    """
                    SELECT user_id, status, is_admin, user_role, signup_step
                    FROM users WHERE user_id = %s FOR UPDATE
                    """,
                    (user_id,),
                )
                row = cursor.fetchone()
                if row is None:
                    raise AccountActionError(404, "회원을 찾을 수 없습니다.")
                cursor.execute(
                    """
                    SELECT idempotency_key, target_id, after_status, reason, before_status, action
                    FROM operation_audit WHERE idempotency_key = %s
                    """,
                    (change.idempotency_key,),
                )
                prior = cursor.fetchone()
                member = MemberAccount(
                    row["user_id"], row["status"], row["is_admin"], row["user_role"], row["signup_step"]
                )
                decision = decide_role(member, actor_id, change, prior)
                if decision["replayed"]:
                    return decision
                if member.is_admin:
                    _apply_role_now(cursor, user_id, change)
                else:
                    _send_back_to_signup(cursor, user_id, change)
                cursor.execute(
                    """
                    INSERT INTO operation_audit (
                      idempotency_key, actor_user_id, target_type, target_id, action,
                      before_status, after_status, reason, notice, created_at
                    ) VALUES (%s, %s, 'member', %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        change.idempotency_key,
                        actor_id,
                        str(user_id),
                        decision["action"],
                        decision["before_status"],
                        decision["after_status"],
                        change.reason,
                        change.notice,
                        decision["created_at"],
                    ),
                )
                return decision
        except errors.UndefinedTable as error:
            raise AccountActionError(
                503, "운영 이력 표가 아직 없어 역할을 바꾸지 않습니다."
            ) from error

    def history(self, user_id: int) -> list[dict]:
        try:
            with transaction() as cursor:
                cursor.execute(
                    """
                    SELECT actor_user_id, action, before_status, after_status, reason, notice, created_at
                    FROM operation_audit
                    WHERE target_type = 'member' AND target_id = %s
                    ORDER BY created_at DESC
                    LIMIT 20
                    """,
                    (str(user_id),),
                )
                return list(cursor.fetchall())
        except errors.UndefinedTable:
            raise AccountActionError(503, "운영 이력 표가 아직 없습니다.") from None
