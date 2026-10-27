"""브라우저에 실제로 열리는 정적 원고의 주소 목록.

제목이 비슷하다는 이유로는 연결하지 않습니다. slug와 유형이 소스에 함께 있을 때만 공개 경로로 봅니다.
"""

import re
from functools import lru_cache
from pathlib import Path

CATALOG_FILE = Path(__file__).resolve().parents[3] / "frontend" / "src" / "lib" / "insights.ts"
SLUG_KIND = re.compile(r'slug:\s*"([a-z0-9-]+)",\s*kind:\s*"(case|trend)"')


@lru_cache(maxsize=1)
def public_articles() -> frozenset[tuple[str, str]]:
    """(유형, slug) 쌍. 파일을 못 읽으면 빈 연결로 조용히 넘기지 않고 실패합니다."""
    text = CATALOG_FILE.read_text(encoding="utf-8")
    found = frozenset((kind, slug) for slug, kind in SLUG_KIND.findall(text))
    if len(found) < 10:
        raise RuntimeError("공개 인사이트 주소 목록을 확인하지 못했습니다.")
    return found


def is_public_article(kind: str, slug: str) -> bool:
    return (kind, slug) in public_articles()
