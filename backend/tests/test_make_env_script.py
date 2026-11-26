"""infra/deploy/make-env.sh 를 가짜 aws 로 확인해요. (실제 AWS 없이)

- SSM Parameter Store 서버용 경로(/labbridge/prod/server/<그룹>/<이름>)에서 값을 읽어 .env.production 을 만들어요.
  사람용 값은 /labbridge/prod/human/… 에 따로 두고 서버는 읽지 않아요 (경로 정책, 팀 공유 문서 6-4).
- 경로의 맨 끝(이름)만 환경변수 이름으로 써요. 다른 그룹에 같은 이름이 있으면 어느 값을 쓸지 몰라 멈춰요.
- infra/env.production.example 에 있는 이름만 써요.
- 값은 작은따옴표로 감싸요. 비밀번호에 $ 가 있어도 compose 가 다른 값으로 바꾸지 않게요.
- 비밀값을 화면(로그)에 찍지 않고, 실패하면 원래 파일을 그대로 둬요.
자세한 이유: docs/aws-deployment/03-network-security.md 5절
"""

import os
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
MAKE_ENV_SH = ROOT / "infra" / "deploy" / "make-env.sh"
EXAMPLE = ROOT / "infra" / "env.production.example"

SECRET_URL = "postgresql://labbridge_app:pa$$word@db.example:5432/labbridge?sslmode=require"
SECRET_JWT = "jwt-secret-value-that-must-not-be-printed"

# 가짜 aws: 받은 명령을 기록하고, FAKE_PARAMS 파일 내용을 "이름<TAB>값" 줄로 돌려줘요.
FAKE_AWS = r"""#!/usr/bin/env bash
echo "$*" >> "$FAKE_LOG"
[ "${FAKE_FAIL:-0}" = "1" ] && { echo "AccessDenied" >&2; exit 254; }
cat "$FAKE_PARAMS"
"""


def find_bash() -> str | None:
    """Windows 에서는 WSL bash 가 아니라 Git Bash 를 써요."""
    git_bash = Path(r"C:\Program Files\Git\bin\bash.exe")
    if os.name == "nt":
        return str(git_bash) if git_bash.exists() else None
    return shutil.which("bash")


BASH = find_bash()
pytestmark = pytest.mark.skipif(BASH is None, reason="bash 가 없어요")


def run_make_env(tmp_path: Path, params: dict[str, str], *, fail: bool = False) -> tuple[int, str, str]:
    """가짜 aws 로 make-env.sh 를 실행하고 (종료 코드, 출력, aws 에 넘긴 인자)를 돌려줘요."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir(exist_ok=True)
    aws = bin_dir / "aws"
    aws.write_text(FAKE_AWS, encoding="utf-8", newline="\n")
    aws.chmod(0o755)
    params_file = tmp_path / "params.tsv"
    # params 의 열쇠는 "그룹/이름" (예: db/DATABASE_URL) 이에요.
    lines = [f"/labbridge/prod/server/{name}\t{value}" for name, value in params.items()]
    params_file.write_text("".join(line + "\n" for line in lines), encoding="utf-8", newline="\n")
    log = tmp_path / "aws.log"
    env = {
        **os.environ,
        "PATH": f"{bin_dir}{os.pathsep}{os.environ['PATH']}",
        "FAKE_LOG": str(log), "FAKE_PARAMS": str(params_file), "FAKE_FAIL": "1" if fail else "0",
        "KEYS_FILE": str(EXAMPLE), "ENV_FILE": str(tmp_path / ".env.production"),
    }
    # 실패(종료 코드 1)도 테스트할 값이라 check=False 로 직접 확인해요.
    result = subprocess.run([BASH, str(MAKE_ENV_SH)], check=False, cwd=tmp_path, env=env,
                            capture_output=True, text=True, encoding="utf-8", timeout=60)
    calls = log.read_text(encoding="utf-8") if log.exists() else ""
    return result.returncode, result.stdout + result.stderr, calls


def read_env(tmp_path: Path) -> dict[str, str]:
    """만들어진 .env.production 을 {이름: 따옴표 포함 값} 으로 읽어요."""
    text = (tmp_path / ".env.production").read_text(encoding="utf-8")
    pairs = [line.split("=", 1) for line in text.splitlines() if line and not line.startswith("#")]
    return {name: value for name, value in pairs}


def test_writes_known_keys_with_single_quotes(tmp_path):
    code, out, _ = run_make_env(tmp_path, {
        "db/DATABASE_URL": SECRET_URL, "auth/JWT_SECRET": SECRET_JWT, "db/UNKNOWN_EXTRA": "not-in-example"})
    assert code == 0, out
    env = read_env(tmp_path)
    assert env["DATABASE_URL"] == f"'{SECRET_URL}'"
    assert env["JWT_SECRET"] == f"'{SECRET_JWT}'"
    # 예시 파일에 없는 이름은 서버 파일에 넣지 않아요.
    assert "UNKNOWN_EXTRA" not in env


def test_group_folders_map_to_last_name(tmp_path):
    """server/discord/DISCORD_BOT_TOKEN → DISCORD_BOT_TOKEN. 그룹은 사람이 알아보기 위한 폴더예요."""
    code, out, _ = run_make_env(tmp_path, {
        "discord/DISCORD_BOT_TOKEN": "bot-token", "feature/ENABLE_DISCORD_BOT": "1", "web/CORS_ORIGINS": "https://a,https://b"})
    assert code == 0, out
    env = read_env(tmp_path)
    assert env["DISCORD_BOT_TOKEN"] == "'bot-token'"
    assert env["ENABLE_DISCORD_BOT"] == "'1'"
    assert env["CORS_ORIGINS"] == "'https://a,https://b'"


def test_same_name_in_two_groups_stops_and_keeps_old_file(tmp_path):
    """어느 값을 써야 할지 모르니 멈춰요. (조용히 하나를 고르면 엉뚱한 값으로 운영될 수 있어요)"""
    old = tmp_path / ".env.production"
    old.write_text("JWT_SECRET='old'\n", encoding="utf-8")
    code, out, _ = run_make_env(tmp_path, {"auth/JWT_SECRET": "a", "db/JWT_SECRET": "b"})
    assert code == 1
    assert "JWT_SECRET" in out
    assert old.read_text(encoding="utf-8") == "JWT_SECRET='old'\n"


def test_missing_values_fall_back_to_example_defaults(tmp_path):
    """SSM 에 없는 값은 예시 파일의 기본값(봇 꺼 둠 0, MVP+ false, 나머지 빈 값)을 써요."""
    code, out, _ = run_make_env(tmp_path, {"auth/JWT_SECRET": SECRET_JWT})
    assert code == 0, out
    env = read_env(tmp_path)
    assert env["ENABLE_DISCORD_BOT"] == "'0'"
    assert env["INSIGHTS_ENABLED"] == "'false'"
    assert env["DISCORD_CLIENT_ID"] == "''"
    # 아직 비어 있는 필수 값은 이름만 알려 줘요.
    assert "DATABASE_URL" in out


def test_never_prints_secret_values(tmp_path):
    code, out, _ = run_make_env(tmp_path, {"db/DATABASE_URL": SECRET_URL, "auth/JWT_SECRET": SECRET_JWT})
    assert code == 0, out
    assert SECRET_URL not in out
    assert SECRET_JWT not in out


def test_reads_decrypted_values_under_server_path_only(tmp_path):
    """기본 경로는 서버용(server/) 이에요. 사람용(human/)·다른 환경은 읽지 않아요."""
    code, out, calls = run_make_env(tmp_path, {"auth/JWT_SECRET": SECRET_JWT})
    assert code == 0, out
    assert "ssm get-parameters-by-path" in calls
    assert "--path /labbridge/prod/server/" in calls
    assert "--recursive" in calls
    assert "--with-decryption" in calls


@pytest.mark.parametrize("bad_value", ["it's", "a'b"])
def test_rejects_single_quote_and_keeps_old_file(tmp_path, bad_value):
    """작은따옴표가 든 값은 안전하게 감쌀 수 없어서 멈추고, 원래 파일을 그대로 둬요."""
    old = tmp_path / ".env.production"
    old.write_text("JWT_SECRET='old'\n", encoding="utf-8")
    code, out, _ = run_make_env(tmp_path, {"auth/JWT_SECRET": bad_value})
    assert code == 1
    assert "JWT_SECRET" in out
    assert old.read_text(encoding="utf-8") == "JWT_SECRET='old'\n"


def test_aws_failure_keeps_old_file(tmp_path):
    old = tmp_path / ".env.production"
    old.write_text("JWT_SECRET='old'\n", encoding="utf-8")
    code, out, _ = run_make_env(tmp_path, {}, fail=True)
    assert code == 1
    assert "Parameter Store" in out
    assert old.read_text(encoding="utf-8") == "JWT_SECRET='old'\n"


def test_empty_path_stops_and_keeps_old_file(tmp_path):
    """값을 새 경로로 옮기기 전에 배포돼도, 빈 값으로 덮어쓰지 않고 멈춰요."""
    old = tmp_path / ".env.production"
    old.write_text("JWT_SECRET='old'\n", encoding="utf-8")
    code, out, _ = run_make_env(tmp_path, {})
    assert code == 1
    assert "하나도 없어요" in out
    assert old.read_text(encoding="utf-8") == "JWT_SECRET='old'\n"


def test_file_is_private_and_replaced_at_once():
    """다른 사용자가 못 읽게(600) 만들고, 다 쓴 뒤 한 번에 바꿔요(mv)."""
    text = MAKE_ENV_SH.read_text(encoding="utf-8")
    assert text.startswith("#!/usr/bin/env bash\n") and "set -euo pipefail" in text
    assert "umask 077" in text
    assert "chmod 600" in text
    assert 'mv -f "$tmp" "$ENV_FILE"' in text
