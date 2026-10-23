"""원격 DB를 수정하지 않고 Supabase 적용 경계와 동결 SQL을 검증합니다."""

from io import StringIO
from pathlib import Path
from unittest.mock import Mock

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy.engine import make_url

from app import supabase_setup
from app.supabase_setup import validate_project, verify_updated_at


@pytest.mark.parametrize(
    "url",
    [
        "postgresql://postgres:password@db.example-ref.supabase.co/postgres",
        "postgresql://postgres.example-ref:password@aws-0-test.pooler.supabase.com/postgres",
    ],
)
def test_apply_requires_exact_supabase_project(url):
    validate_project(make_url(url), "example-ref")


@pytest.mark.parametrize(
    "url,ref",
    [
        ("postgresql://postgres:password@db.other-ref.supabase.co/postgres", "example-ref"),
        (
            "postgresql://postgres.other-ref:password@aws-0-test.pooler.supabase.com/postgres",
            "example-ref",
        ),
        ("postgresql://admin:password@localhost:5433/labbridge", "example-ref"),
        ("postgresql://admin:password@invalid.example/postgres", ""),
    ],
)
def test_wrong_or_unconfirmed_target_is_rejected(url, ref):
    with pytest.raises(ValueError):
        validate_project(make_url(url), ref)


def test_shared_member_migration_sql_protects_all_tables():
    backend = Path(__file__).resolve().parents[1]
    config = Config(str(backend / "alembic.ini"), output_buffer=StringIO())
    # 회원 초기 구조의 검증은 해당 이력에 고정합니다. 후속 설정 표와 섞지 않습니다.
    command.upgrade(config, "20261021_02", sql=True)
    sql = config.output_buffer.getvalue()
    assert "CREATE TABLE users" in sql
    assert "CREATE TABLE research" in sql
    assert "CREATE TABLE expert" in sql
    assert sql.count("ENABLE ROW LEVEL SECURITY") == 24
    assert "FROM anon" in sql
    assert "FROM authenticated" in sql
    assert "FROM service_role" in sql
    assert "자동 덮어쓰기 중단" in sql
    assert "UPDATE public.users" not in sql
    assert "DELETE FROM" not in sql
    assert "DROP TABLE" not in sql
    assert "DROP SCHEMA" not in sql
    assert "20261021_02" in sql
    frozen = backend / "migrations" / "sql" / "20261021_02"
    assert len(list(frozen.glob("*.sql"))) == 6


def test_search_path_revision_only_alters_existing_function():
    backend = Path(__file__).resolve().parents[1]
    config = Config(str(backend / "alembic.ini"), output_buffer=StringIO())
    command.upgrade(config, "20261021_02:head", sql=True)
    sql = config.output_buffer.getvalue()
    assert "ALTER FUNCTION public.set_updated_at() SET search_path = pg_catalog" in sql
    assert "20261021_03" in sql
    for forbidden in ("CREATE TABLE", "CREATE FUNCTION", "DROP", "INSERT", "DELETE", "REVOKE"):
        assert forbidden not in sql
    assert "UPDATE public.users" not in sql


def test_fresh_docker_init_also_fixes_search_path():
    root = Path(__file__).resolve().parents[2]
    sql = (root / "database/init/001_create_tables.sql").read_text(encoding="utf-8")
    assert "LANGUAGE plpgsql SET search_path = pg_catalog" in sql
    # 과거에 적용한 동결본을 고쳐 이력을 바꾸지 않습니다.
    frozen = root / "backend/migrations/sql/20261021_02/001_create_tables.sql"
    assert "SET search_path = pg_catalog" not in frozen.read_text(encoding="utf-8")


@pytest.mark.parametrize("settings", [None, [], ["search_path=public"], ["search_path=pg_catalog, public"]])
def test_verify_updated_at_rejects_missing_or_unsafe_path(settings):
    connection = Mock()
    connection.execute.return_value.scalar_one_or_none.return_value = settings
    with pytest.raises(ValueError, match="검색 경로 보호"):
        verify_updated_at(connection)


def test_verify_updated_at_accepts_fixed_path():
    connection = Mock()
    connection.execute.return_value.scalar_one_or_none.return_value = ["search_path=pg_catalog"]
    assert verify_updated_at(connection) == {"updated_at_search_path": "pg_catalog"}


@pytest.mark.parametrize("current_revision", ["20261016_01", "20261021_02", "20261021_03"])
def test_setup_handles_initial_previous_and_current_revision(monkeypatch, tmp_path, current_revision):
    connection = Mock()
    monkeypatch.setattr(supabase_setup, "ROOT", tmp_path)
    monkeypatch.setattr(supabase_setup, "inspect_database", lambda _: {
        "public_tables": (
            ["insight_alembic_version"] if current_revision == "20261016_01"
            else ["insight_alembic_version", "users"]
        ),
        "versions": [current_revision],
    })
    verify_members = Mock(return_value={"protected_public_tables": 24})
    verify_function = Mock(return_value={"updated_at_search_path": "pg_catalog"})
    monkeypatch.setattr(supabase_setup, "verify_members", verify_members)
    monkeypatch.setattr(supabase_setup, "verify_updated_at", verify_function)
    monkeypatch.setattr(supabase_setup, "read_insights", lambda _: {"sources": []})
    upgrade = Mock()
    monkeypatch.setattr(supabase_setup.command, "upgrade", upgrade)

    result = supabase_setup.apply_members(connection, rehearse=True)

    assert result["updated_at_search_path"] == "pg_catalog"
    verify_function.assert_called_once_with(connection)
    if current_revision == "20261021_03":
        assert result["already_applied"] is True
        upgrade.assert_not_called()
    else:
        assert result["rehearsal"] is True
        assert upgrade.call_args.args[1] == "20261021_03"
        assert upgrade.call_args.args[0].attributes["connection"] is connection


def test_setup_rejects_unknown_history_before_writing(monkeypatch):
    connection = Mock()
    monkeypatch.setattr(supabase_setup, "inspect_database", lambda _: {
        "public_tables": ["users"], "versions": ["unknown_revision"],
    })
    upgrade = Mock()
    monkeypatch.setattr(supabase_setup.command, "upgrade", upgrade)
    with pytest.raises(ValueError, match="자동 적용"):
        supabase_setup.apply_members(connection, rehearse=False)
    upgrade.assert_not_called()


def test_setup_rejects_unprotected_previous_revision(monkeypatch):
    connection = Mock()
    monkeypatch.setattr(supabase_setup, "inspect_database", lambda _: {
        "public_tables": ["users"], "versions": ["20261021_02"],
    })
    monkeypatch.setattr(supabase_setup, "verify_members", Mock(side_effect=ValueError("보호 실패")))
    upgrade = Mock()
    monkeypatch.setattr(supabase_setup.command, "upgrade", upgrade)
    with pytest.raises(ValueError, match="보호 실패"):
        supabase_setup.apply_members(connection, rehearse=False)
    upgrade.assert_not_called()
