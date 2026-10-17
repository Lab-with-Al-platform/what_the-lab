"""실제 DB에 접속하지 않고 PostgreSQL 마이그레이션 SQL을 점검합니다."""

from io import StringIO
from pathlib import Path

from alembic import command
from alembic.config import Config


def test_offline_upgrade_has_private_tables_and_no_secrets(monkeypatch):
    marker = "this-password-must-never-appear-in-sql"
    monkeypatch.setenv("DATABASE_URL", f"postgresql://test:{marker}@invalid.example/test")
    output = StringIO()
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"), output_buffer=output)
    command.upgrade(config, "head", sql=True)
    sql = output.getvalue()
    for table in ("sources", "candidates", "revisions", "review_events", "publications"):
        assert f"CREATE TABLE insight_private.{table}" in sql
    assert "CREATE SCHEMA insight_private" in sql
    assert "REVOKE ALL ON SCHEMA insight_private FROM PUBLIC" in sql
    assert "UNIQUE (idempotency_key)" in sql
    assert marker not in sql
