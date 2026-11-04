"""마이그레이션 번호 지키기 (DB 없이): 두 PR이 같은 번호를 쓰면 머지 전에 여기서 걸려요.

- alembic: 끝(head)이 하나 · 개정 번호가 겹치지 않음 · 번호 앞자리(날짜_순번)의 순번이 1씩 이어짐
- Docker database/init: 파일 앞 번호(001~)가 겹치지 않음
- Docker 파일이 올리는 개정 번호(SET version_num = …)가 alembic 순서와 같고, 바로 앞 개정에서 올림
새 마이그레이션은 develop 최신의 마지막 번호 다음을 써요. 자세한 규칙: database/README.md "마이그레이션 번호"
"""

import re
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

ROOT = Path(__file__).resolve().parents[2]
INIT = ROOT / "database/init"


def alembic_chain() -> list[str]:
    """처음 → 끝 순서의 개정 번호"""
    scripts = ScriptDirectory.from_config(Config(str(ROOT / "backend/alembic.ini")))
    heads = scripts.get_heads()
    assert len(heads) == 1, f"alembic 끝(head)이 {len(heads)}개예요: {heads}. down_revision 을 develop 최신 번호로 맞춰 주세요"
    return [revision.revision for revision in scripts.walk_revisions()][::-1]


def test_alembic_numbers_are_sequential():
    chain = alembic_chain()
    numbers = [int(revision.split("_")[1]) for revision in chain]
    assert numbers == list(range(1, len(chain) + 1)), f"개정 순번이 1씩 이어지지 않아요: {chain}"


def test_docker_init_numbers_are_unique():
    prefixes = [path.name[:3] for path in sorted(INIT.glob("*.sql"))]
    duplicated = sorted({prefix for prefix in prefixes if prefixes.count(prefix) > 1})
    assert not duplicated, f"database/init 번호가 겹쳐요: {duplicated}. develop 최신 다음 번호로 바꿔 주세요"


def test_docker_init_follows_alembic_order():
    chain = alembic_chain()
    bumps = []  # (파일, 올리는 번호, 바로 앞 번호)
    for path in sorted(INIT.glob("*.sql")):
        text = path.read_text(encoding="utf-8")
        match = re.search(r"SET version_num = '([\d_]+)'\s*WHERE version_num = '([\d_]+)'", text)
        if match:
            bumps.append((path.name, match[1], match[2]))
    for name, new, old in bumps:
        assert new in chain, f"{name}: 개정 번호 {new} 가 alembic 에 없어요"
        assert chain.index(new) == chain.index(old) + 1, f"{name}: {old} → {new} 는 바로 다음 개정이 아니에요"
    assert [new for _, new, _ in bumps] == sorted(new for _, new, _ in bumps), "Docker 파일 순서와 개정 순서가 달라요"
    assert bumps[-1][1] == chain[-1], f"마지막 Docker 파일({bumps[-1][0]})이 alembic 끝({chain[-1]})까지 올리지 않아요"