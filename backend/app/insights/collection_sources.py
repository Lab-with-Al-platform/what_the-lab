"""수집 출처의 기본 제안과 용도입니다. URL 등록만으로 외부에 접속하지 않습니다."""

from copy import deepcopy

RECOMMENDED_SOURCES = [
    {
        "name": "OpenAlex · 논문 탐색",
        "url": "https://api.openalex.org",
        "content_kinds": ["case", "trend"],
    },
    {
        "name": "Crossref · DOI·서지 대조",
        "url": "https://api.crossref.org",
        "content_kinds": ["case", "trend"],
    },
    {
        "name": "arXiv · 저자 공개 논문",
        "url": "https://arxiv.org",
        "content_kinds": ["case", "trend"],
    },
    {
        "name": "Europe PMC · 생명과학 논문·공개 원문",
        "url": "https://europepmc.org",
        "content_kinds": ["case"],
    },
    {
        "name": "Nature Communications · 다분야 연구 논문",
        "url": "https://www.nature.com/ncomms",
        "content_kinds": ["case"],
    },
    {
        "name": "Google DeepMind Science · 과학 AI 연구",
        "url": "https://deepmind.google/science",
        "content_kinds": ["case", "trend"],
    },
    {
        "name": "Google Research · 공식 연구 설명",
        "url": "https://research.google/blog",
        "content_kinds": ["case", "trend"],
    },
    {
        "name": "Microsoft Research · 공식 연구 설명",
        "url": "https://www.microsoft.com/en-us/research/blog",
        "content_kinds": ["case", "trend"],
    },
    {
        "name": "MIT News · AI 연구 소식",
        "url": "https://news.mit.edu/topic/artificial-intelligence2",
        "content_kinds": ["case", "trend"],
    },
    {
        "name": "KAIST 뉴스 · 국내 연구 소식",
        "url": "https://news.kaist.ac.kr/news",
        "content_kinds": ["case", "trend"],
    },
    {
        "name": "Hugging Face · 모델·도구 해설",
        "url": "https://huggingface.co/blog",
        "content_kinds": ["trend"],
    },
]


def source_key(url: str) -> str:
    """설정의 기존 중복 검사와 같은 기준으로 주소 끝의 / 차이를 무시합니다."""
    return url.rstrip("/").lower()


def suggested_content_kinds(url: str) -> list[str]:
    for source in RECOMMENDED_SOURCES:
        if source_key(source["url"]) == source_key(url):
            return list(source["content_kinds"])
    # 알 수 없는 사용자 출처는 둘 다라고 추정하지 않고 미분류로 둡니다.
    return []


def recommended_sources() -> list[dict]:
    return [{**deepcopy(source), "selected": True} for source in RECOMMENDED_SOURCES]


def extend_collection_sources(config: dict) -> dict:
    """기존 순서·이름·주소·사용 여부·명시적 분류를 보존하고 없는 추천만 추가합니다."""
    result = deepcopy(config)
    sources = result["sources"]
    for source in sources:
        if "content_kinds" not in source:
            source["content_kinds"] = suggested_content_kinds(source["url"])
    existing = {source_key(source["url"]) for source in sources}
    sources.extend(
        source for source in recommended_sources() if source_key(source["url"]) not in existing
    )
    if len(sources) > 20:
        raise ValueError("기존 출처를 보존하면 20개 상한을 넘습니다. 출처 선택을 먼저 확인하세요.")
    return result
