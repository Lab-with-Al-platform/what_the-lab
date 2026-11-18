"""infra/deploy/deploy.sh 의 순서와 안전장치를 가짜 docker 로 확인해요. (실제 Docker·DB 없이)

- 새 마이그레이션이 있는데 RDS 스냅샷 표시가 없으면 아무것도 바꾸지 않고 멈춰요.
- 마이그레이션 → 버전 확인 → backend → (봇) → nginx 순서예요.
- 새 backend 가 응답하지 않으면 이전 이미지로 되돌려요.
자세한 이유: docs/aws-deployment/10-operations-runbook.md 1절, 14-ci-cd-pipeline.md 5.2절
"""

import os
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
DEPLOY_SH = ROOT / "infra" / "deploy" / "deploy.sh"
NEW_IMAGE = "registry.example/labbridge-backend:new"
OLD_IMAGE = "registry.example/labbridge-backend:old"

# 가짜 docker: 받은 명령을 기록하고, 테스트가 정한 값으로 대답해요.
FAKE_DOCKER = r"""#!/usr/bin/env bash
echo "IMAGE=${BACKEND_IMAGE:-} DB=${DATABASE_URL:-} $*" >> "$FAKE_LOG"
case "$*" in
  *"alembic current"*)
    if [ -f "$FAKE_STATE/upgraded" ]; then echo "$FAKE_HEADS (head)"; elif [ -n "$FAKE_CURRENT" ]; then echo "$FAKE_CURRENT"; fi ;;
  *"alembic heads"*) echo "$FAKE_HEADS (head)" ;;
  *"alembic upgrade head"*) touch "$FAKE_STATE/upgraded" ;;
  "inspect --format {{.Config.Image}} labbridge-prod-backend")
    if [ -n "$FAKE_RUNNING_IMAGE" ]; then echo "$FAKE_RUNNING_IMAGE"; else exit 1; fi ;;
  "inspect --format {{.State.Running}}"*) echo true ;;
  "inspect --format {{.RestartCount}}"*) echo 0 ;;
  "exec labbridge-prod-backend python"*) [ "$FAKE_HEALTH" = ok ] ;;
esac
"""


def find_bash() -> str | None:
    """Windows 에서는 WSL bash 가 아니라 Git Bash 를 써요."""
    git_bash = Path(r"C:\Program Files\Git\bin\bash.exe")
    if os.name == "nt":
        return str(git_bash) if git_bash.exists() else None
    return shutil.which("bash")


BASH = find_bash()
pytestmark = pytest.mark.skipif(BASH is None, reason="bash 가 없어요")


def run_deploy(tmp_path: Path, *, current: str, heads: str = "20261104_27", health: str = "ok",
               running: str = OLD_IMAGE, extra_env: dict[str, str] | None = None) -> tuple[int, list[str], str]:
    """가짜 docker 로 deploy.sh 를 실행하고 (종료 코드, docker 명령 목록, 출력)을 돌려줘요."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    docker = bin_dir / "docker"
    docker.write_text(FAKE_DOCKER, encoding="utf-8", newline="\n")
    docker.chmod(0o755)
    (tmp_path / "docker-compose.prod.yml").write_text("services: {}\n", encoding="utf-8")
    (tmp_path / ".env.production").write_text("ENABLE_DISCORD_BOT=0\n", encoding="utf-8")
    log = tmp_path / "docker.log"
    env = {
        **os.environ,
        "PATH": f"{bin_dir}{os.pathsep}{os.environ['PATH']}",
        "FAKE_LOG": str(log), "FAKE_STATE": str(tmp_path), "FAKE_CURRENT": current,
        "FAKE_HEADS": heads, "FAKE_HEALTH": health, "FAKE_RUNNING_IMAGE": running,
        "STATE_DIR": str(tmp_path / "state"), "HEALTH_TIMEOUT": "3", "BOT_SETTLE_SECONDS": "0",
        **(extra_env or {}),
    }
    env.pop("ENABLE_DISCORD_BOT", None)
    env.pop("DATABASE_URL", None)
    env.pop("MIGRATION_DATABASE_URL", None)
    env.update(extra_env or {})
    # 실패(종료 코드 1)도 테스트할 값이라 check=False 로 직접 확인해요.
    result = subprocess.run([BASH, str(DEPLOY_SH), NEW_IMAGE], check=False, cwd=tmp_path, env=env,
                            capture_output=True, text=True, encoding="utf-8", timeout=60)
    calls = log.read_text(encoding="utf-8").splitlines() if log.exists() else []
    return result.returncode, calls, result.stdout + result.stderr


def index_of(calls: list[str], text: str) -> int:
    """text 가 들어간 첫 docker 명령의 위치 (없으면 실패)."""
    for i, call in enumerate(calls):
        if text in call:
            return i
    raise AssertionError(f"{text!r} 명령이 없어요:\n" + "\n".join(calls))


def test_pending_migration_without_snapshot_stops_before_any_change(tmp_path):
    code, calls, out = run_deploy(tmp_path, current="20261103_26")
    assert code == 1
    assert "MIGRATION_SNAPSHOT_ID" in out
    assert not any("upgrade head" in c or " up -d" in c for c in calls)


def test_migration_runs_before_containers_in_runbook_order(tmp_path):
    code, calls, out = run_deploy(tmp_path, current="20261103_26",
                                  extra_env={"MIGRATION_SNAPSHOT_ID": "pre-migrate-test"})
    assert code == 0, out
    upgrade = index_of(calls, "alembic upgrade head")
    backend = index_of(calls, "up -d --no-deps backend")
    nginx = index_of(calls, "up -d --no-deps nginx")
    assert upgrade < backend < nginx
    assert f"IMAGE={NEW_IMAGE}" in calls[backend]
    assert "pull backend" in calls[index_of(calls, "pull backend")]


def test_no_migration_when_db_is_current(tmp_path):
    code, calls, out = run_deploy(tmp_path, current="20261104_27")
    assert code == 0, out
    assert not any("upgrade head" in c for c in calls)


def test_bot_stays_off_until_enabled(tmp_path):
    code, calls, _ = run_deploy(tmp_path, current="20261104_27")
    assert code == 0
    assert any("stop discord-bot" in c for c in calls)
    assert not any("up -d --no-deps discord-bot" in c for c in calls)


def test_bot_starts_between_backend_and_nginx_when_enabled(tmp_path):
    code, calls, out = run_deploy(tmp_path, current="20261104_27", extra_env={"ENABLE_DISCORD_BOT": "1"})
    assert code == 0, out
    backend = index_of(calls, "up -d --no-deps backend")
    bot = index_of(calls, "up -d --no-deps discord-bot")
    nginx = index_of(calls, "up -d --no-deps nginx")
    assert backend < bot < nginx


def test_unhealthy_backend_rolls_back_to_previous_image(tmp_path):
    code, calls, out = run_deploy(tmp_path, current="20261104_27", health="fail")
    assert code == 1
    backend_ups = [c for c in calls if "up -d --no-deps backend" in c]
    assert [c.split()[0] for c in backend_ups] == [f"IMAGE={NEW_IMAGE}", f"IMAGE={OLD_IMAGE}"]
    assert not any("up -d --no-deps nginx" in c for c in calls)
    assert "이전 이미지로 되돌려요" in out


def test_script_never_downgrades_or_scales():
    """운영 DB를 되돌리는 downgrade, backend 여러 개(--scale)는 쓰지 않아요."""
    text = DEPLOY_SH.read_text(encoding="utf-8")
    assert "downgrade" not in text
    assert "--scale" not in text
    assert text.startswith("#!/usr/bin/env bash\n") and "set -euo pipefail" in text


MIGRATOR_URL = "postgresql://labbridge_migrator:x@db.example:5432/labbridge"


def test_migrator_account_runs_migrations_and_grants(tmp_path):
    """계정을 나누면 alembic·권한 맞추기는 migrator 로, 앱 컨테이너는 원래 DATABASE_URL 로 (B11)."""
    code, calls, out = run_deploy(tmp_path, current="20261103_26", extra_env={
        "MIGRATION_SNAPSHOT_ID": "pre-migrate-test", "MIGRATION_DATABASE_URL": MIGRATOR_URL})
    assert code == 0, out
    for text in ["alembic current", "alembic heads", "alembic upgrade head", "apply_grants.py"]:
        assert f"DB={MIGRATOR_URL}" in calls[index_of(calls, text)], text
    assert index_of(calls, "alembic upgrade head") < index_of(calls, "apply_grants.py") < index_of(calls, "up -d --no-deps backend")
    assert f"DB={MIGRATOR_URL}" not in calls[index_of(calls, "up -d --no-deps backend")]
    assert MIGRATOR_URL not in out  # 비밀번호가 든 주소를 화면에 찍지 않아요


def test_single_account_mode_skips_grants(tmp_path):
    code, calls, out = run_deploy(tmp_path, current="20261104_27")
    assert code == 0, out
    assert not any("apply_grants.py" in c for c in calls)
    assert "권한 맞추기 건너뜀" in out
