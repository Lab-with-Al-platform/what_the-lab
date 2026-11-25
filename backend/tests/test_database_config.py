"""네트워크 연결 없이 회원·인사이트의 공통 DB 설정을 검증합니다."""

from unittest.mock import Mock

import pytest

from app import db
from app.database_config import get_database_url
from app.insights.database import get_engine


def test_url_is_authoritative_for_both_connections(monkeypatch):
    # DB_*에 옛 MySQL 값이 남아 있어도 URL 하나만 선택해야 합니다.
    monkeypatch.setenv("DATABASE_URL", "postgresql://member:p%40ss@db.example:5432/shared?sslmode=require")
    monkeypatch.setenv("DB_PORT", "3309")
    connect = Mock()
    monkeypatch.setattr(db.psycopg, "connect", connect)
    db.get_connection()
    get_engine.cache_clear()
    engine = get_engine()
    try:
        args = connect.call_args.kwargs
        assert args["host"] == engine.url.host == "db.example"
        assert args["dbname"] == engine.url.database == "shared"
        assert args["user"] == engine.url.username == "member"
        assert args["password"] == engine.url.password == "p@ss"
        assert args["port"] == engine.url.port == 5432
        assert args["sslmode"] == engine.url.query["sslmode"] == "require"
        assert args["connect_timeout"] == 5
    finally:
        engine.dispose()
        get_engine.cache_clear()


@pytest.mark.parametrize("raw_url", ["", "   "])
def test_db_fields_are_shared_fallback(monkeypatch, raw_url):
    monkeypatch.setenv("DATABASE_URL", raw_url)
    monkeypatch.setenv("DB_PORT", "5433")
    monkeypatch.setenv("DB_PASSWORD", "p@ss#word")
    url = get_database_url()
    assert url.port == 5433
    assert url.password == "p@ss#word"
    assert url.drivername == "postgresql+psycopg"


@pytest.mark.parametrize("driver", ["postgres", "postgresql", "postgresql+psycopg"])
def test_supported_postgres_schemes(monkeypatch, driver):
    monkeypatch.setenv("DATABASE_URL", f"{driver}://member:password@db.example/shared")
    assert get_database_url().drivername == "postgresql+psycopg"


@pytest.mark.parametrize(
    "url",
    [
        "mysql://member:secret-marker@db.example/shared",
        "sqlite:///secret-marker",
        "invalid-secret-marker",
        "postgresql://member:secret-marker@db.example:wrong/shared",
        "postgresql://member:secret-marker@db.example/",
    ],
)
def test_invalid_config_does_not_leak_secrets(monkeypatch, url):
    monkeypatch.setenv("DATABASE_URL", url)
    with pytest.raises(ValueError) as error:
        get_database_url()
    assert "secret-marker" not in str(error.value)


def test_url_does_not_require_old_db_fields(monkeypatch):
    for name in ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("DATABASE_URL", "postgresql://member:password@db.example/shared")
    assert get_database_url().database == "shared"


def test_missing_credentials_fail_before_connect(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("DB_PASSWORD", raising=False)
    with pytest.raises(ValueError, match="공통"):
        get_database_url()


def test_supabase_uses_ssl_by_default(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql://postgres.test:password@aws-0-test.pooler.supabase.com/postgres"
    )
    assert get_database_url().query["sslmode"] == "require"


@pytest.mark.parametrize("mode", ["disable", "allow", "prefer"])
def test_supabase_rejects_unencrypted_fallback(monkeypatch, mode):
    monkeypatch.setenv(
        "DATABASE_URL",
        f"postgresql://postgres.test:password@aws-0-test.pooler.supabase.com/postgres?sslmode={mode}",
    )
    with pytest.raises(ValueError):
        get_database_url()


def test_member_transaction_uses_same_connection(monkeypatch):
    connection = Mock()
    connection.__enter__ = Mock(return_value=connection)
    connection.__exit__ = Mock(return_value=False)
    connection.transaction.return_value.__enter__ = Mock()
    connection.transaction.return_value.__exit__ = Mock(return_value=False)
    cursor = Mock()
    connection.cursor.return_value.__enter__ = Mock(return_value=cursor)
    connection.cursor.return_value.__exit__ = Mock(return_value=False)
    monkeypatch.setattr(db, "get_connection", lambda: connection)
    with db.transaction() as actual_cursor:
        assert actual_cursor is cursor
