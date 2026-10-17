"""테스트는 가상 계정과 임시 DB만 사용합니다. 실제 .env 연결은 사용하지 않습니다."""

import os

os.environ.update(
    {
        "DISCORD_CLIENT_ID": "test-client",
        "DISCORD_CLIENT_SECRET": "test-secret",
        "DISCORD_REDIRECT_URI": "http://localhost:8000/api/v1/auth/discord/callback",
        "JWT_SECRET": "test-only-jwt-secret-not-for-real-users-0123456789",
        "DATABASE_URL": "postgresql://test:test@127.0.0.1:1/not_a_live_database",
        # 회원 DB 전환 전에도 로컬 .env의 MySQL 설정을 테스트에 사용하지 않습니다.
        "DB_HOST": "127.0.0.1",
        "DB_PORT": "1",
        "DB_NAME": "not_a_live_database",
        "DB_USER": "test",
        "DB_PASSWORD": "test-only-password",
        "APP_ENV": "production",
    }
)
