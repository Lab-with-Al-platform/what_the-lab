"""구글 캘린더 API를 우리 서버의 서비스 계정(로봇 계정)으로 불러요. (캘린더 만들기 · 공유 · 일정 넣기/지우기)

- 일정은 LabBridge DB가 원본이고, 구글은 복사본이에요. 회원은 구글에서 보기만 해요.
- 서비스 계정 키 파일(GOOGLE_SERVICE_ACCOUNT_FILE)이 없으면 아무것도 하지 않아요.
- 토큰은 키 파일로 직접 서명해서 받아요. (pyjwt 사용, 구글 라이브러리를 따로 설치하지 않아요)
"""

import json
import time
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path

import httpx
import jwt

from app.config import FRONTEND_URL, GOOGLE_SERVICE_ACCOUNT_FILE

CALENDAR_API = "https://www.googleapis.com/calendar/v3"
SCOPE = "https://www.googleapis.com/auth/calendar"
TIMEZONE = "Asia/Seoul"
TIMEOUT = 10  # 초
KIND_PREFIX = {"meeting": "미팅", "work": "작업", "due": "마감", "data": "데이터", "etc": "기타"}

_token: dict = {"value": "", "expires": 0.0}  # 받은 토큰을 1시간 동안 다시 써요


def google_ready() -> bool:
    """서비스 계정 키 파일이 있는지 (없으면 구글 기능을 건너뛰어요)"""
    return bool(GOOGLE_SERVICE_ACCOUNT_FILE) and Path(GOOGLE_SERVICE_ACCOUNT_FILE).is_file()


@lru_cache(maxsize=1)
def service_account() -> dict:
    """키 파일(JSON) 읽기: client_email, private_key, private_key_id, token_uri"""
    return json.loads(Path(GOOGLE_SERVICE_ACCOUNT_FILE).read_text(encoding="utf-8"))


def access_token() -> str:
    """구글 API용 토큰. 키로 서명한 JWT를 구글에 보내서 1시간짜리 토큰을 받아요."""
    now = time.time()
    if _token["value"] and now < _token["expires"] - 60:
        return _token["value"]
    account = service_account()
    assertion = jwt.encode(
        {
            "iss": account["client_email"],  # 누가 (서비스 계정)
            "scope": SCOPE,  # 무엇을 (캘린더)
            "aud": account["token_uri"],  # 어디에 (구글 토큰 주소)
            "iat": int(now),
            "exp": int(now) + 3600,
        },
        account["private_key"],
        algorithm="RS256",
        headers={"kid": account["private_key_id"]},
    )
    response = httpx.post(
        account["token_uri"],
        data={"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion},
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    body = response.json()
    _token.update(value=body["access_token"], expires=now + body.get("expires_in", 3600))
    return _token["value"]


def headers() -> dict:
    return {"Authorization": f"Bearer {access_token()}"}


# ---------- 캘린더 ----------
def create_calendar(name: str, description: str) -> str:
    """협업 캘린더를 만들고 번호를 돌려줘요. (주인은 서비스 계정)"""
    response = httpx.post(
        f"{CALENDAR_API}/calendars",
        headers=headers(),
        json={"summary": name, "description": description, "timeZone": TIMEZONE},
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    return response.json()["id"]


def share_calendar(calendar_id: str, email: str) -> None:
    """회원 한 명에게 캘린더를 '보기 전용'으로 공유해요. 이메일은 여기서만 쓰고 저장하지 않아요."""
    response = httpx.post(
        f"{CALENDAR_API}/calendars/{calendar_id}/acl",
        headers=headers(),
        params={"sendNotifications": "false"},  # 구글 안내 메일 대신 우리 화면의 [캘린더 열기] 링크로 추가해요
        json={"role": "reader", "scope": {"type": "user", "value": email}},
        timeout=TIMEOUT,
    )
    response.raise_for_status()


def add_calendar_url(calendar_id: str) -> str:
    """누르면 회원의 구글 캘린더에 이 캘린더가 추가되는 링크 (공유받은 뒤에 열어요)"""
    return f"https://calendar.google.com/calendar/u/0/r?cid={calendar_id}"


# ---------- 일정 ----------
def event_id(schedule_id: int) -> str:
    """구글 일정 번호를 일정 번호로 정해요: lbs00012 (구글 규칙: 소문자 a~v·숫자, 5자 이상)"""
    return f"lbs{schedule_id:05d}"


def event_body(schedule: dict) -> dict:
    """우리 일정 → 구글 일정 모양. 시각이 있는 하루짜리는 그 시각에, 나머지는 '하루 종일'로 넣어요."""
    start, end = schedule["start_date"], schedule["end_date"]
    if schedule.get("start_time") and start == end:
        end_time = schedule.get("end_time") or schedule["start_time"]
        when = {
            "start": {"dateTime": f"{start}T{schedule['start_time']}:00", "timeZone": TIMEZONE},
            "end": {"dateTime": f"{start}T{end_time}:00", "timeZone": TIMEZONE},
        }
    else:
        # 하루 종일 일정은 끝나는 날 '다음 날'을 적어야 해요 (구글 규칙)
        when = {"start": {"date": str(start)}, "end": {"date": str(date.fromisoformat(str(end)) + timedelta(days=1))}}
    memo = schedule.get("memo") or ""
    link = f"{FRONTEND_URL}/workspace?schedule={schedule['schedule_id']}"  # 누르면 LabBridge의 이 일정 창이 열려요
    return {
        "summary": f"[{KIND_PREFIX.get(schedule['kind'], '기타')}] {schedule['title']}",
        "description": f"{memo}\n\n※ LabBridge에서 관리하는 일정이에요. 수정·삭제는 여기서 → {link}".strip(),
        "location": schedule.get("place") or "",
        **when,
    }


def upsert_event(calendar_id: str, schedule: dict) -> None:
    """일정을 구글에 넣거나 고쳐요."""
    put_event(calendar_id, event_id(schedule["schedule_id"]), event_body(schedule))


def put_event(calendar_id: str, eid: str, body: dict) -> None:
    """구글 일정 하나를 넣거나 고쳐요. 이미 있으면 고치고(PUT), 없으면 새로 넣어요(POST)."""
    url = f"{CALENDAR_API}/calendars/{calendar_id}/events"
    response = httpx.put(f"{url}/{eid}", headers=headers(), json=body, timeout=TIMEOUT)
    if response.status_code == 404:
        response = httpx.post(url, headers=headers(), json={"id": eid, **body}, timeout=TIMEOUT)
    response.raise_for_status()


# ---------- 요청 (기한 있는 요청만) ----------
def task_event_id(task_id: int) -> str:
    """요청의 구글 일정 번호: lbt00012 (일정 lbs 와 겹치지 않게 t). 저장하지 않아도 요청 번호로 찾아요."""
    return f"lbt{task_id:05d}"


def task_event_body(task: dict) -> dict:
    """우리 요청 → 구글 하루 종일 일정 (기한 날). 완료한 요청은 제목 앞에 ✅"""
    due = task["due_date"]
    link = f"{FRONTEND_URL}/workspace/{task['collaboration_id']}"  # 누르면 LabBridge 협업 상세
    return {
        "summary": f"{'✅ ' if task['status'] == 'done' else ''}[요청] {task['content'][:60]}",
        "description": (
            f"{task['requested_by_nickname']} → {task['assignee_nickname']}\n\n{task['content']}"
            f"\n\n※ LabBridge에서 관리하는 요청이에요. 완료·기한 변경은 여기서 → {link}"
        ),
        "start": {"date": str(due)},
        "end": {"date": str(due + timedelta(days=1))},  # 하루 종일 일정은 다음 날을 적어요 (구글 규칙)
    }

def delete_event(calendar_id: str, eid: str) -> None:
    """구글에서 일정을 지워요. 이미 없으면(404·410) 지운 것으로 봐요."""
    response = httpx.delete(f"{CALENDAR_API}/calendars/{calendar_id}/events/{eid}", headers=headers(), timeout=TIMEOUT)
    if response.status_code in (404, 410):
        return
    response.raise_for_status()