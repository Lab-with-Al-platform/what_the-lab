"""지정 개발 DB에서 가상 회원 흐름을 검증하고 모든 테스트 행을 rollback합니다."""

import argparse
import json
import sys
from contextlib import ExitStack, contextmanager
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app import db
from app.database_config import get_database_url
from app.main import app
from app.routers import auth
from app.supabase_setup import validate_project


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--confirm-project-ref", required=True)
    args = parser.parse_args()
    validate_project(get_database_url(), args.confirm_project_ref)
    real_connection = db.get_connection
    connection = real_connection()
    connection.autocommit = False
    suffix = uuid4().hex[:8]
    fake_discord_id = str(800000000000000000 + int(suffix, 16))
    fake_user = {"id": fake_discord_id, "username": f"통합검증_{suffix}"}

    @contextmanager
    def borrowed_connection():
        # 저장소의 with 문이 실제 연결을 닫거나 최상위 트랜잭션을 확정하지 않게 합니다.
        with connection.transaction():
            yield connection

    try:
        before = connection.execute("SELECT count(*) AS n FROM public.users").fetchone()["n"]
        with ExitStack() as patches:
            for name, module in list(sys.modules.items()):
                if name.startswith("app.") and getattr(module, "get_connection", None) is real_connection:
                    patches.enter_context(patch.object(module, "get_connection", borrowed_connection))
            patches.enter_context(patch.object(auth, "fetch_discord_user", lambda _code: fake_user))
            patches.enter_context(patch.dict("os.environ", {"INSIGHTS_ENABLED": "true"}))
            with TestClient(app, base_url="http://testserver.local") as client:
                assert client.get("/api/v1/auth/me").status_code == 401
                client.cookies.set("oauth_state", "fake-state", domain=client.base_url.host, path="/")
                response = client.get(
                    "/api/v1/auth/discord/callback?code=fake-code&state=fake-state",
                    follow_redirects=False,
                )
                assert response.status_code == 307
                member = client.get("/api/v1/auth/me").json()
                assert member["discord_id"] == fake_discord_id
                user_id = member["user_id"]
                response = client.post("/api/v1/expert/signup", json={
                    "able_works": ["UG04"], "current_job": "researcher", "ai_career": "1_3",
                })
                assert response.status_code == 200, response.text
                assert client.get("/api/v1/expert/profile").status_code == 200
                assert client.get("/api/v1/auth/me").json()["user_role"] == "expert"
                assert client.get("/api/v1/admin/insights/candidates").status_code == 403
                connection.execute("UPDATE public.users SET is_admin=TRUE WHERE user_id=%s", (user_id,))
                assert client.get("/api/v1/admin/insights/candidates").status_code == 200
                assert client.post("/api/v1/auth/logout").status_code == 204
                assert client.get("/api/v1/auth/me").status_code == 401
    finally:
        # 성공·실패와 상관없이 가상 회원·전문가 정보·임시 관리자 값은 모두 취소합니다.
        connection.rollback()
        connection.close()
    with real_connection() as check:
        after = check.execute("SELECT count(*) AS n FROM public.users").fetchone()["n"]
        remaining = check.execute(
            "SELECT count(*) AS n FROM public.users WHERE discord_id=%s", (fake_discord_id,)
        ).fetchone()["n"]
    assert before == after and remaining == 0
    print(json.dumps({
        "member_callback": "passed_mock_discord_real_db",
        "expert_signup_and_profile": "passed",
        "admin_and_logout": "passed",
        "test_rows_remaining": remaining,
    }))


if __name__ == "__main__":
    main()
