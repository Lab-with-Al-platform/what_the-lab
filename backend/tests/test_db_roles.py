"""운영 DB 계정 SQL(B11)이 놓치기 쉬운 것을 DB 없이 확인해요.

실제 권한 동작은 CI migration-check 가 PostgreSQL 17로 확인해요 (backend/migrations/roles/README.md).
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROLES = ROOT / "migrations" / "roles"
SCHEMA_LIST = re.compile(r"schemas text\[\] := ARRAY\[([^\]]+)\]")


def schemas_in(sql_file: str) -> set[str]:
    """SQL 파일의 schemas 배열에 적힌 스키마 이름들."""
    match = SCHEMA_LIST.search((ROLES / sql_file).read_text(encoding="utf-8"))
    assert match, f"{sql_file} 에 schemas 배열이 없어요"
    return {name.strip().strip("'") for name in match.group(1).split(",")}


def schemas_created_by_migrations() -> set[str]:
    """마이그레이션이 만드는 스키마 (public 포함). 새 스키마가 생기면 권한 파일에도 넣어야 해요."""
    text = "\n".join(p.read_text(encoding="utf-8") for p in (ROOT / "migrations").rglob("*") if p.suffix in {".py", ".sql"})
    found = set(re.findall(r"CREATE SCHEMA (?:IF NOT EXISTS )?([a-z_]+)", text))
    found |= set(re.findall(r'SCHEMA = "([a-z_]+)"', text))
    return found | {"public"}


def test_grant_and_verify_cover_every_migration_schema():
    expected = schemas_created_by_migrations()
    assert schemas_in("02_grant_privileges.sql") == expected
    assert schemas_in("03_verify_privileges.sql") == expected


def test_create_roles_has_no_password_in_file():
    """비밀번호는 psql 변수(-v)로만 받아요. 저장소가 공개예요."""
    text = (ROLES / "01_create_roles.sql").read_text(encoding="utf-8")
    passwords = re.findall(r"PASSWORD\s+(\S+)", text)
    assert passwords and all(p.startswith(":'") for p in passwords), passwords


def test_grants_are_rerunnable_and_app_cannot_change_structure():
    text = (ROLES / "02_grant_privileges.sql").read_text(encoding="utf-8")
    assert text.count("IF NOT EXISTS (SELECT 1 FROM pg_policies") == 2  # 정책은 이미 있으면 건너뛰어요
    assert "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES" in text
    for forbidden in ["GRANT ALL", "TRUNCATE", "CREATE ON SCHEMA", "BYPASSRLS"]:
        assert forbidden not in text, forbidden


def test_readonly_account_is_read_only_by_default():
    text = (ROLES / "01_create_roles.sql").read_text(encoding="utf-8")
    assert "ALTER ROLE labbridge_readonly SET default_transaction_read_only = on;" in text
