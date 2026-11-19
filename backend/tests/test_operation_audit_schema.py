"""운영 이력 표의 기록 종류 규칙(DB 없이): 코드가 쓰는 action 값을 DB 규칙이 모두 받아야 해요.

메모리 저장소 테스트만으로는 DB CHECK 규칙을 못 봐서, 관리자 부여(grant_admin)가 운영 DB에서만 실패했어요.
"""

import re
from pathlib import Path

from app.operations.account_actions import AUDIT_ACTIONS

ROOT = Path(__file__).resolve().parents[2]
RULE = re.compile(r"ck_operation_audit_action\s+CHECK\s*\(\s*action\s+IN\s*\(([^)]*)\)", re.IGNORECASE)
# 코드가 operation_audit에 남기는 기록 종류 전부
WRITTEN_ACTIONS = set(AUDIT_ACTIONS)


def last_rule(paths: list[Path]) -> set[str]:
    """파일 순서대로 읽어 마지막으로 정해진 규칙의 허용 값만 돌려줍니다."""
    allowed: set[str] = set()
    for path in paths:
        for match in RULE.finditer(path.read_text(encoding="utf-8")):
            allowed = set(re.findall(r"'([a-z_]+)'", match[1]))
    return allowed


def test_supabase_migrations_allow_every_written_action():
    paths = sorted((ROOT / "backend/migrations/sql").glob("*/*.sql"))
    assert WRITTEN_ACTIONS <= last_rule(paths)


def test_docker_init_allows_every_written_action():
    paths = sorted((ROOT / "database/init").glob("*.sql"))
    assert WRITTEN_ACTIONS <= last_rule(paths)
