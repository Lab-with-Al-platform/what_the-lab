"""기관 목록 파일들을 합쳐 institution 시드 SQL을 만듭니다.

실행 (저장소 맨 위 폴더에서):
    python database/seed/build_institution_seed.py

입력 (database/seed/)
- world_universities_and_domains.json : Hipo 대학 도메인 목록 (MIT 라이선스). 이메일 도메인의 기본 출처
- universities.csv                    : 공공데이터 대학 목록 (학교명, 홈페이지주소). 한글 학교명 출처 (없어도 됨)
- research_institutes.csv             : 연구기관 목록 (domain,name). 직접 관리
- manual_institutions.csv             : 직접 고친 값 (domain,name,institution_type). 항상 최우선 (없어도 됨)
출력
- database/init/002_seed_institutions.sql : institution 테이블 INSERT 문
- database/seed/needs_korean_name.csv     : 한글 이름을 못 찾은 대학 (manual에 채울 대상)
- database/seed/missing_homepage.csv      : 공공데이터에서 홈페이지가 비어 뺀 학교
"""
import csv
import json
from pathlib import Path
from urllib.parse import urlparse

SEED_DIR = Path(__file__).resolve().parent
HIPO_JSON = SEED_DIR / "world_universities_and_domains.json"
PUBLIC_CSV = SEED_DIR / "universities.csv"
RESEARCH_CSV = SEED_DIR / "research_institutes.csv"
MANUAL_CSV = SEED_DIR / "manual_institutions.csv"
NEEDS_NAME_CSV = SEED_DIR / "needs_korean_name.csv"
MISSING_CSV = SEED_DIR / "missing_homepage.csv"
OUTPUT_SQL = SEED_DIR.parent / "init" / "002_seed_institutions.sql"

# Hipo에서 가져올 나라. 나라를 늘리려면 여기에 코드만 추가하세요. 예: {"KR", "US", "JP"}
COUNTRY_CODES = {"KR"}

# 공공데이터 CSV의 실제 컬럼 이름에 맞게 바꾸세요. (공공데이터는 한국 대학만 있습니다)
PUBLIC_NAME_COLUMN = "학교명"
PUBLIC_HOMEPAGE_COLUMN = "홈페이지주소"

# 'snu.ac.kr', 'ox.ac.uk'처럼 나라 도메인 앞에 한 칸이 더 붙는 경우
SECOND_LEVELS = {"ac", "re", "or", "go", "co", "ne", "es", "hs", "ms", "sc", "kg", "edu", "gov"}


# ---------- 도메인 다듬기 ----------

def to_base_domain(host: str) -> str:
    """'cs.snu.ac.kr' → 'snu.ac.kr', 'www.skku.edu' → 'skku.edu' 처럼 기관 대표 도메인만 남깁니다."""
    labels = host.lower().strip(".").split(".")
    is_country_tld = len(labels[-1]) == 2  # kr, uk, jp 같은 두 글자 나라 도메인
    if len(labels) >= 3 and is_country_tld and labels[-2] in SECOND_LEVELS:
        return ".".join(labels[-3:])
    return ".".join(labels[-2:])


def homepage_to_domain(homepage: str) -> str | None:
    """'http://www.snu.ac.kr/index' → 'snu.ac.kr'. 비어 있거나 이상하면 None."""
    homepage = homepage.strip()
    if not homepage:
        return None
    if "://" not in homepage:
        homepage = "http://" + homepage
    host = urlparse(homepage).hostname
    if not host or "." not in host:
        return None
    return to_base_domain(host)


# ---------- 파일 읽기 ----------

def read_csv_rows(path: Path) -> list[dict]:
    """공공데이터 CSV는 cp949인 경우가 많아서 두 가지 인코딩을 차례로 시도합니다. 파일이 없으면 빈 목록."""
    if not path.exists():
        return []
    for encoding in ("utf-8-sig", "cp949"):
        try:
            with path.open(encoding=encoding, newline="") as file:
                return list(csv.DictReader(file))
        except UnicodeDecodeError:
            continue
    raise ValueError(f"{path.name} 인코딩을 읽지 못했어요 (utf-8, cp949 모두 실패)")


def load_hipo() -> list[dict]:
    """Hipo 목록에서 COUNTRY_CODES 나라의 대학만 남깁니다."""
    with HIPO_JSON.open(encoding="utf-8") as file:
        universities = json.load(file)
    return [u for u in universities if u["alpha_two_code"] in COUNTRY_CODES]


def load_public_names() -> tuple[dict[str, str], list[dict]]:
    """공공데이터: 홈페이지 도메인 → 한글 학교명. 홈페이지가 빈 학교는 따로 모읍니다."""
    domain_to_name: dict[str, str] = {}
    missing: list[dict] = []
    for row in read_csv_rows(PUBLIC_CSV):
        name = (row.get(PUBLIC_NAME_COLUMN) or "").strip()
        homepage = row.get(PUBLIC_HOMEPAGE_COLUMN) or ""
        domain = homepage_to_domain(homepage)
        if not name:
            continue
        if domain is None:
            missing.append({"name": name, "homepage": homepage})
            continue
        saved = domain_to_name.get(domain)
        if saved is None or len(name) < len(saved):  # 본교·분교가 같은 도메인이면 짧은 이름(대개 본교)
            domain_to_name[domain] = name
    return domain_to_name, missing


# ---------- 합치기 ----------

def new_row(domain: str, name: str, name_en: str | None, country: str, inst_type: str, source: str) -> dict:
    return {"domain": domain, "name": name, "name_en": name_en,
            "country_code": country, "institution_type": inst_type, "source": source}


def merge_hipo(rows: dict[str, dict], hipo: list[dict], public_names: dict[str, str]) -> None:
    """Hipo 대학을 넣습니다. 도메인 중 하나라도 공공데이터와 맞으면 그 한글 이름을 모든 도메인에 씁니다."""
    for university in hipo:
        domains = sorted({to_base_domain(d) for d in university["domains"]})
        korean_name = next((public_names[d] for d in domains if d in public_names), None)
        for domain in domains:
            rows[domain] = new_row(domain, korean_name or university["name"], university["name"],
                                   university["alpha_two_code"], "university", "hipo")


def merge_public_only(rows: dict[str, dict], public_names: dict[str, str]) -> None:
    """Hipo에 없는 학교는 공공데이터 홈페이지 도메인으로 넣습니다."""
    for domain, name in public_names.items():
        if domain not in rows:
            rows[domain] = new_row(domain, name, None, "KR", "university", "public")


def merge_simple_csv(rows: dict[str, dict], path: Path, default_type: str, source: str) -> int:
    """domain,name(,institution_type) 형식 파일을 넣습니다. 앞의 값보다 우선합니다."""
    csv_rows = read_csv_rows(path)
    for row in csv_rows:
        domain = to_base_domain(row["domain"].strip())
        name = row["name"].strip()
        if not domain or not name:
            continue
        inst_type = (row.get("institution_type") or "").strip() or default_type
        name_en = rows.get(domain, {}).get("name_en")  # 영어 이름은 남겨 둡니다.
        rows[domain] = new_row(domain, name, name_en, "KR", inst_type, source)
    return len(csv_rows)


def find_needs_korean_name(rows: dict[str, dict]) -> list[dict]:
    """한국 대학인데 아직 영어 이름 그대로인 줄 (manual_institutions.csv에 채울 대상)."""
    return [
        {"domain": row["domain"], "name_en": row["name_en"]}
        for row in rows.values()
        if row["country_code"] == "KR" and row["name"] == row["name_en"]
    ]


# ---------- 쓰기 ----------

def sql_value(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def write_seed_sql(rows: dict[str, dict]) -> None:
    columns = ["domain", "name", "name_en", "country_code", "institution_type", "source"]
    values = ",\n".join(
        "  (" + ", ".join(sql_value(row[c]) for c in columns) + ")" for _, row in sorted(rows.items())
    )
    OUTPUT_SQL.write_text(
        "-- build_institution_seed.py 가 만든 파일입니다. 직접 고치지 말고 스크립트를 다시 실행하세요.\n"
        "SET NAMES utf8mb4;  -- 한글이 깨지지 않게 utf8mb4로 읽으라고 알려 줍니다.\n"
        f"INSERT INTO institution ({', '.join(columns)}) VALUES\n{values};\n",
        encoding="utf-8",
    )


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    rows: dict[str, dict] = {}  # 도메인 → 한 줄. 뒤에 넣는 값이 앞의 값을 덮어씁니다.
    public_names, missing = load_public_names()
    merge_hipo(rows, load_hipo(), public_names)
    merge_public_only(rows, public_names)
    research_count = merge_simple_csv(rows, RESEARCH_CSV, "research", "research")
    manual_count = merge_simple_csv(rows, MANUAL_CSV, "university", "manual")
    needs_name = find_needs_korean_name(rows)

    write_seed_sql(rows)
    write_csv(NEEDS_NAME_CSV, needs_name, ["domain", "name_en"])
    write_csv(MISSING_CSV, missing, ["name", "homepage"])

    counts = {}
    for row in rows.values():
        counts[row["source"]] = counts.get(row["source"], 0) + 1
    print(f"나라 {sorted(COUNTRY_CODES)} → 도메인 {len(rows)}개 {counts}")
    print(f"연구기관 {research_count}행, 직접 수정 {manual_count}행 반영")
    print(f"한글 이름 없는 대학 {len(needs_name)}개 → {NEEDS_NAME_CSV.name}")
    print(f"홈페이지 비어 뺀 학교 {len(missing)}개 → {MISSING_CSV.name}")


if __name__ == "__main__":
    main()
