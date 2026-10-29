"""실제 DB에 접속하지 않고 PostgreSQL 마이그레이션 SQL을 점검합니다."""

from io import StringIO
from pathlib import Path

from alembic import command
from alembic.config import Config

BACKEND = Path(__file__).resolve().parents[1]
INIT_SQL = BACKEND.parent / "database" / "init" / "022_add_transfer_receipts.sql"


def test_offline_upgrade_has_private_tables_and_no_secrets(monkeypatch):
    marker = "this-password-must-never-appear-in-sql"
    monkeypatch.setenv("DATABASE_URL", f"postgresql://test:{marker}@invalid.example/test")
    monkeypatch.setattr("dotenv.load_dotenv", lambda *args, **kwargs: False)

    def blocked_engine(*args, **kwargs):
        raise AssertionError("오프라인 SQL 검사는 DB에 연결하지 않습니다.")

    monkeypatch.setattr("app.insights.database.build_engine", blocked_engine)
    output = StringIO()
    config = Config(str(BACKEND / "alembic.ini"), output_buffer=output)
    command.upgrade(config, "head", sql=True)
    sql = output.getvalue()
    tables = (
        "sources",
        "candidates",
        "revisions",
        "review_events",
        "publications",
        "transfer_receipts",
        "transfer_receipt_items",
    )
    for table in tables:
        assert f"CREATE TABLE insight_private.{table}" in sql
    assert "CREATE SCHEMA insight_private" in sql
    assert "REVOKE ALL ON SCHEMA insight_private FROM PUBLIC" in sql
    assert "UNIQUE (idempotency_key)" in sql
    assert "UNIQUE (trust_scope, bundle_id)" in sql
    assert marker not in sql
    init_sql = INIT_SQL.read_text(encoding="utf-8")
    assert "CREATE TABLE insight_private.transfer_receipts" in init_sql
    assert "UNIQUE (trust_scope, bundle_id)" in init_sql
    assert "version_num = '20261029_18'" in init_sql
    assert "WHERE version_num = '20261028_17'" in init_sql
