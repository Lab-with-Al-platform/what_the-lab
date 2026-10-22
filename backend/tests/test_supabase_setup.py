"""원격 DB를 수정하지 않고 Supabase 적용 경계와 동결 SQL을 검증합니다."""

from io import StringIO
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy.engine import make_url

from app.supabase_setup import validate_project


@pytest.mark.parametrize("url", [
    "postgresql://postgres:password@db.example-ref.supabase.co/postgres",
    "postgresql://postgres.example-ref:password@aws-0-test.pooler.supabase.com/postgres",
])
def test_apply_requires_exact_supabase_project(url):
    validate_project(make_url(url), "example-ref")


@pytest.mark.parametrize("url,ref", [
    ("postgresql://postgres:password@db.other-ref.supabase.co/postgres", "example-ref"),
    ("postgresql://postgres.other-ref:password@aws-0-test.pooler.supabase.com/postgres", "example-ref"),
    ("postgresql://admin:password@localhost:5433/labbridge", "example-ref"),
    ("postgresql://admin:password@invalid.example/postgres", ""),
])
def test_wrong_or_unconfirmed_target_is_rejected(url, ref):
    with pytest.raises(ValueError):
        validate_project(make_url(url), ref)


def test_shared_member_migration_sql_protects_all_tables():
    backend = Path(__file__).resolve().parents[1]
    config = Config(str(backend / "alembic.ini"), output_buffer=StringIO())
    command.upgrade(config, "20261021_02", sql=True)  # 이 migration까지만 (뒤에 추가된 표는 아래 테스트에서 따로 확인)
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


def test_collaboration_request_migration_sql_is_protected():
    """협업 요청 표도 같은 보안 규칙(RLS, 브라우저 역할 차단)을 따르고, Docker용 init SQL과 내용이 같아야 해요."""
    backend = Path(__file__).resolve().parents[1]
    config = Config(str(backend / "alembic.ini"), output_buffer=StringIO())
    command.upgrade(config, "20261021_02:20261022_03", sql=True)  # 02 다음 변경분만 SQL로 뽑아 봅니다.
    sql = config.output_buffer.getvalue()
    assert "CREATE TABLE collaboration_request" in sql
    assert sql.count("ENABLE ROW LEVEL SECURITY") == 1
    assert "FROM anon" in sql
    assert "FROM authenticated" in sql
    assert "FROM service_role" in sql
    assert "자동 덮어쓰기를 중단" in sql
    assert "DELETE FROM" not in sql
    assert "DROP TABLE" not in sql
    frozen = backend / "migrations" / "sql" / "20261022_03" / "001_create_collaboration_request.sql"
    docker = backend.parent / "database" / "init" / "007_create_collaboration_request.sql"
    assert frozen.read_text(encoding="utf-8") == docker.read_text(encoding="utf-8")