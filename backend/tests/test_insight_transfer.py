"""가상 JSON만 사용하며 DB·네트워크·외부 모델을 호출하지 않습니다."""

import copy
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from app.insights.transfer_contract import (
    MAX_TRANSFER_BYTES,
    TransferError,
    load_transfer_file,
    validate_transfer_bytes,
)

FIXTURE = Path(__file__).parent / "fixtures" / "insight-transfer-v1.json"
BACKEND = Path(__file__).resolve().parents[1]


@pytest.fixture
def payload():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def validate(payload):
    return validate_transfer_bytes(json.dumps(payload, ensure_ascii=False).encode("utf-8"))


def test_full_article_survives_without_summary_replacement(payload):
    item = validate(payload).items[0]
    assert item.article.sections[0].paragraphs[1].kind == "interpretation"
    assert item.article.sections[0].steps[0].detail == "가상 입력과 결과를 비교합니다."
    assert item.article.glossary[0].id == "validation"
    assert item.article.sampleNotice == "형식 검사 전용 가상 원고. 게시 금지."
    assert (
        item.article.model_dump(mode="json")["sections"][0]["paragraphs"]
        == (payload["items"][0]["article"]["sections"][0]["paragraphs"])
    )


@pytest.mark.parametrize("field", ["slug", "kind", "title", "summary", "field", "sourceUrl", "doi"])
def test_mismatched_evidence_and_article_fail(payload, field):
    changed = {"kind": "case", "sourceUrl": "https://example.org/other", "doi": "10.9999/other"}
    payload["items"][0]["article"][field] = changed.get(field, "other")
    with pytest.raises(TransferError, match="전송 계약"):
        validate(payload)


@pytest.mark.parametrize("location", ["bundle", "article", "section"])
def test_unknown_fields_and_self_approval_fail(payload, location):
    target = payload
    if location == "article":
        target = payload["items"][0]["article"]
    elif location == "section":
        target = payload["items"][0]["article"]["sections"][0]
    target["publication_approved"] = True
    with pytest.raises(TransferError):
        validate(payload)


@pytest.mark.parametrize("value", ["2026-10-28T01:00:00", "2026-10-28T02:00:00+09:00"])
def test_checked_time_requires_timezone_and_cannot_follow_generation(payload, value):
    payload["items"][0]["source_checked_at"] = value
    with pytest.raises(TransferError):
        validate(payload)


@pytest.mark.parametrize(
    ("value", "precision"),
    [(None, "unknown"), ("2026", "year"), ("2026-02", "month"), ("2026-02-28", "day")],
)
def test_publication_date_preserves_known_precision(payload, value, precision):
    payload["items"][0]["source_published"] = {"value": value, "precision": precision}
    assert validate(payload).items[0].source_published.value == value


@pytest.mark.parametrize(
    ("value", "precision"),
    [("2026-10-28", "unknown"), (None, "day"), ("2026-02-30", "day"), ("2026-13", "month")],
)
def test_invalid_publication_date_fails(payload, value, precision):
    payload["items"][0]["source_published"] = {"value": value, "precision": precision}
    with pytest.raises(TransferError):
        validate(payload)


def test_same_source_case_and_trend_allowed_but_same_kind_rejected(payload):
    second = copy.deepcopy(payload["items"][0])
    for part in (second["draft"], second["article"]):
        part["slug"] = "fictional-case"
    payload["items"].append(second)
    with pytest.raises(TransferError):
        validate(payload)
    for part in (second["draft"], second["article"]):
        part["kind"] = "case"
    assert len(validate(payload).items) == 2


@pytest.mark.parametrize(
    "change", ["image", "rights", "missing_term", "duplicate_term", "too_many"]
)
def test_initial_transfer_limits(payload, change):
    item = payload["items"][0]
    if change == "image":
        item["article"]["coverSrc"] = "/images/example.webp"
    elif change == "rights":
        item["draft"]["image_policy"] = "rights_checked"
    elif change == "missing_term":
        item["article"]["glossary"] = []
    elif change == "duplicate_term":
        item["article"]["glossary"] *= 2
    else:
        payload["items"] *= 11
    with pytest.raises(TransferError):
        validate(payload)


@pytest.mark.parametrize(
    "raw",
    [b'{"a":1,"a":2}', b'{"a":NaN}', b'{"a":Infinity}', b"\xff", b"[" * 2000, b"9" * 10000],
)
def test_bad_json_is_rejected_without_echoing_input(raw):
    with pytest.raises(TransferError):
        validate_transfer_bytes(raw)


def test_oversize_is_rejected():
    with pytest.raises(TransferError, match="2 MiB"):
        validate_transfer_bytes(b" " * (MAX_TRANSFER_BYTES + 1))


@pytest.mark.parametrize("change", ["version", "empty", "duplicate_slug"])
def test_envelope_rejects_unsupported_version_or_bad_item_list(payload, change):
    if change == "version":
        payload["schema_version"] = "insight_transfer_v999"
    elif change == "empty":
        payload["items"] = []
    else:
        payload["items"] *= 2
    with pytest.raises(TransferError):
        validate(payload)


def test_file_hash_is_of_original_bytes_and_path_is_confined(tmp_path):
    raw = FIXTURE.read_bytes()
    (tmp_path / "sample.json").write_bytes(raw)
    bundle, digest = load_transfer_file(Path("sample.json"), tmp_path)
    assert len(bundle.items) == 1
    assert digest == hashlib.sha256(raw).hexdigest()
    for path in (FIXTURE, Path("../sample.json"), Path("missing.json")):
        with pytest.raises(TransferError):
            load_transfer_file(path, tmp_path)
    (tmp_path / "sample.txt").write_bytes(raw)
    with pytest.raises(TransferError, match=".json"):
        load_transfer_file(Path("sample.txt"), tmp_path)


def test_link_file_is_rejected(tmp_path):
    link = tmp_path / "sample.json"
    try:
        link.symlink_to(FIXTURE)
    except OSError:
        pytest.skip("현재 Windows 계정에 심볼릭 링크 생성 권한이 없습니다.")
    with pytest.raises(TransferError, match="링크"):
        load_transfer_file(link, tmp_path)


def test_cli_is_offline_and_does_not_import_database_or_server():
    environment = {
        key: value
        for key, value in os.environ.items()
        if not key.startswith(("DB", "SUPABASE", "DISCORD", "JWT"))
    }
    # 실제 파일 검사 도중 DB·설정 모듈을 읽기만 해도 실패하도록 import를 감시합니다.
    script = """
import importlib.abc
import sys
class RejectLiveModules(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname in {'app.main', 'app.config', 'app.database', 'app.insights.service'}:
            raise RuntimeError('live module imported')
sys.meta_path.insert(0, RejectLiveModules())
from app.insight_transfer import main
sys.argv = ['validator', 'insight-transfer-v1.json', '--root', 'tests/fixtures']
raise SystemExit(main())
"""
    result = subprocess.run(
        [sys.executable, "-B", "-c", script],
        check=False,
        cwd=BACKEND,
        env=environment,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=20,
    )
    assert result.returncode == 0, result.stderr
    report = json.loads(result.stdout)
    assert report["valid"] is True
    assert report["db_written"] is False
    assert report["publication_approved"] is False


def test_cli_invalid_input_does_not_print_secret(tmp_path, payload):
    secret = "fake-secret-must-not-be-printed"
    payload["items"][0]["draft"]["source"]["url"] = f"https://user:{secret}@example.org/"
    path = tmp_path / "bad.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    result = subprocess.run(
        [sys.executable, "-B", "-m", "app.insight_transfer", str(path), "--root", str(tmp_path)],
        check=False,
        cwd=BACKEND,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=20,
    )
    assert result.returncode == 2
    assert secret not in result.stdout + result.stderr
    assert json.loads(result.stdout)["valid"] is False


def test_schema_can_be_used_by_authoring_tools():
    result = subprocess.run(
        [sys.executable, "-B", "-m", "app.insight_transfer", "--schema"],
        check=False,
        cwd=BACKEND,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=20,
    )
    assert result.returncode == 0, result.stderr
    schema = json.loads(result.stdout)
    assert schema["properties"]["schema_version"]["const"] == "insight_transfer_v1"
    assert schema["$defs"]["TransferItem"]["required"] == [
        "draft",
        "article",
        "source_published",
        "source_checked_at",
        "access_notes",
        "rights_notes",
    ]
