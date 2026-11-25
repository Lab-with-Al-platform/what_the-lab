"""이메일 주소로 기관(학교) 이름을 찾습니다."""
from app.db import get_connection

# 개인 메일. 이 메일로는 소속 인증을 할 수 없습니다.
PERSONAL_DOMAINS = {
    "gmail.com", "naver.com", "daum.net", "hanmail.net", "kakao.com",
    "nate.com", "outlook.com", "hotmail.com", "icloud.com", "yahoo.com",
}
# 'snu.ac.kr', 'ox.ac.uk'처럼 나라 도메인 앞에 한 칸이 더 붙는 경우 (시드 스크립트와 같은 규칙)
SECOND_LEVELS = {"ac", "re", "or", "go", "co", "ne", "es", "hs", "ms", "sc", "kg", "edu", "gov"}


def get_email_domain(email: str) -> str:
    """'minseo@cs.snu.ac.kr' → 'cs.snu.ac.kr'"""
    return email.rpartition("@")[2].strip().lower()


def to_base_domain(host: str) -> str:
    """'cs.snu.ac.kr' → 'snu.ac.kr', 'mail.skku.edu' → 'skku.edu' 처럼 기관 대표 도메인만 남깁니다."""
    labels = host.strip(".").split(".")
    is_country_tld = len(labels[-1]) == 2  # kr, uk, jp 같은 두 글자 나라 도메인
    if len(labels) >= 3 and is_country_tld and labels[-2] in SECOND_LEVELS:
        return ".".join(labels[-3:])
    return ".".join(labels[-2:])


def is_personal_email(email: str) -> bool:
    return get_email_domain(email) in PERSONAL_DOMAINS

def is_academic_email(email: str) -> bool:
    """학교·연구기관 도메인처럼 보이는지 ('ac.kr', 're.kr', '.edu' 등). 목록에 없을 때 직접 입력을 허락할지 판단합니다."""
    labels = get_email_domain(email).split(".")
    if len(labels) < 2:
        return False
    if labels[-1] == "edu":
        return True
    return len(labels) >= 3 and len(labels[-1]) == 2 and labels[-2] in {"ac", "re", "edu"}


def find_institution_name(email: str) -> str | None:
    """기관 이메일이면 기관명(대학·연구기관)을, 목록에 없으면 None을 돌려줍니다."""
    domain = get_email_domain(email)
    if "@" not in email or "." not in domain:
        return None
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("SELECT name FROM institution WHERE domain = %s", (to_base_domain(domain),))
        row = cursor.fetchone()
    return row["name"] if row else None
