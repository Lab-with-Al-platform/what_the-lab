"""구글 캘린더 복사 (실제 구글에 접속하지 않고 응답만 흉내 내요)."""

import json
import re
from datetime import date

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app import google_calendar as gc

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture
def account(tmp_path, monkeypatch):
    """테스트용 가짜 서비스 계정 키 파일"""
    pem = KEY.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    path = tmp_path / "key.json"
    path.write_text(
        json.dumps(
            {
                "client_email": "robot@labbridge.iam.gserviceaccount.com",
                "private_key": pem.decode(),
                "private_key_id": "k1",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        )
    )
    monkeypatch.setattr(gc, "GOOGLE_SERVICE_ACCOUNT_FILE", str(path))
    gc.service_account.cache_clear()
    gc._token.update(value="", expires=0)
    return path


def test_google_ready_needs_key_file(account, monkeypatch):
    assert gc.google_ready() is True
    monkeypatch.setattr(gc, "GOOGLE_SERVICE_ACCOUNT_FILE", "")
    assert gc.google_ready() is False


def test_access_token_signs_jwt_and_reuses_token(account, monkeypatch):
    calls: list = []

    def post(url, data, timeout):
        calls.append(data)
        return httpx.Response(200, json={"access_token": "t1", "expires_in": 3600}, request=httpx.Request("POST", url))

    monkeypatch.setattr(gc.httpx, "post", post)
    assert gc.access_token() == "t1"
    assert gc.access_token() == "t1"  # 1시간 동안은 다시 받지 않아요
    assert len(calls) == 1
    claims = jwt.decode(calls[0]["assertion"], KEY.public_key(), algorithms=["RS256"], audience="https://oauth2.googleapis.com/token")
    assert claims["iss"] == "robot@labbridge.iam.gserviceaccount.com"
    assert claims["scope"] == gc.SCOPE


def test_event_id_follows_google_rule():
    for schedule_id in (1, 12, 123456789):
        assert re.fullmatch(r"[a-v0-9]{5,1024}", gc.event_id(schedule_id))
    assert gc.event_id(12) == "lbs00012"


SCHEDULE = {"schedule_id": 12, "kind": "meeting", "title": "킥오프", "start_date": date(2026, 11, 3), "end_date": date(2026, 11, 3), "memo": "링크", "place": None}


def test_all_day_event_ends_next_day():
    body = gc.event_body({**SCHEDULE, "kind": "work", "end_date": date(2026, 11, 5)})
    assert body["start"] == {"date": "2026-11-03"}
    assert body["end"] == {"date": "2026-11-06"}  # 구글은 끝나는 날 다음 날을 적어요
    assert body["summary"] == "[작업] 킥오프"
    assert "/workspace?schedule=12" in body["description"]  # LabBridge에서 수정·삭제하는 링크


def test_timed_event_for_one_day_with_time():
    body = gc.event_body({**SCHEDULE, "start_time": "14:00", "end_time": "15:00"})
    assert body["start"] == {"dateTime": "2026-11-03T14:00:00", "timeZone": "Asia/Seoul"}
    assert body["end"] == {"dateTime": "2026-11-03T15:00:00", "timeZone": "Asia/Seoul"}


def fake(responses: list, calls: list):
    def call(url, headers, timeout, json=None, params=None):
        calls.append({"url": url, "json": json})
        return httpx.Response(responses.pop(0), json={}, request=httpx.Request("GET", url))

    return call


def test_upsert_inserts_when_missing(monkeypatch):
    monkeypatch.setattr(gc, "access_token", lambda: "t")
    calls: list = []
    monkeypatch.setattr(gc.httpx, "put", fake([404], calls))
    monkeypatch.setattr(gc.httpx, "post", fake([200], calls))
    gc.upsert_event("cal1", SCHEDULE)
    assert calls[0]["url"].endswith("/calendars/cal1/events/lbs00012")  # 먼저 고치기 시도
    assert calls[1]["url"].endswith("/calendars/cal1/events") and calls[1]["json"]["id"] == "lbs00012"  # 없으면 새로


def test_upsert_raises_for_retry(monkeypatch):
    monkeypatch.setattr(gc, "access_token", lambda: "t")
    monkeypatch.setattr(gc.httpx, "put", fake([500], []))
    with pytest.raises(httpx.HTTPError):
        gc.upsert_event("cal1", SCHEDULE)


def test_delete_treats_missing_as_done(monkeypatch):
    monkeypatch.setattr(gc, "access_token", lambda: "t")
    for status in (204, 404, 410):
        monkeypatch.setattr(gc.httpx, "delete", fake([status], []))
        gc.delete_event("cal1", "lbs00012")


def test_share_is_read_only(monkeypatch):
    monkeypatch.setattr(gc, "access_token", lambda: "t")
    calls: list = []
    monkeypatch.setattr(gc.httpx, "post", fake([200], calls))
    gc.share_calendar("cal1", "someone@gmail.com")
    assert calls[0]["json"] == {"role": "reader", "scope": {"type": "user", "value": "someone@gmail.com"}}