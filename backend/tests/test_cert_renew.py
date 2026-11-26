"""infra/certbot/renew-origin-cert.sh 를 가짜 docker 로 확인해요. (실제 Docker·Let's Encrypt 없이)

- certbot 은 만료 30일 전부터만 실제로 갱신해요. 그래서 하루 두 번 돌려도 안전해요.
- 인증서 파일이 실제로 바뀌었을 때만 nginx 설정을 검사하고 다시 읽어요.
- 연습(DRY_RUN=1)은 Let's Encrypt 연습 서버로만 확인하고 nginx 는 건드리지 않아요.
- 갱신이 실패하면 nginx 를 건드리지 않고 실패로 끝나요. (systemd 가 기록해요)
"""

import os
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "infra" / "certbot" / "renew-origin-cert.sh"
SERVICE = ROOT / "infra" / "certbot" / "labbridge-cert-renew.service"
TIMER = ROOT / "infra" / "certbot" / "labbridge-cert-renew.timer"
DOMAIN = "origin.example.test"

# 가짜 docker: 받은 명령을 기록해요. certbot renew 때 FAKE_RENEW=1 이면 인증서 내용을 바꿔요.
FAKE_DOCKER = r"""#!/usr/bin/env bash
echo "$*" >> "$FAKE_LOG"
case "$*" in
  run*renew*)
    [ "${FAKE_CERTBOT_FAIL:-0}" = "1" ] && { echo "certbot failed" >&2; exit 1; }
    if [ "${FAKE_RENEW:-0}" = "1" ]; then echo "new-cert" > "$FAKE_CERT"; fi ;;
  "exec labbridge-prod-nginx nginx -t") [ "${FAKE_NGINX_BAD:-0}" != "1" ] ;;
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


def run_renew(tmp_path: Path, **fake: str) -> tuple[int, list[str], str]:
    """가짜 docker 로 갱신 스크립트를 실행하고 (종료 코드, docker 명령 목록, 출력)을 돌려줘요."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir(exist_ok=True)
    docker = bin_dir / "docker"
    docker.write_text(FAKE_DOCKER, encoding="utf-8", newline="\n")
    docker.chmod(0o755)
    live = tmp_path / "letsencrypt" / "live" / DOMAIN
    live.mkdir(parents=True, exist_ok=True)
    cert = live / "fullchain.pem"
    cert.write_text("old-cert\n", encoding="utf-8", newline="\n")
    log = tmp_path / "docker.log"
    env = {
        **os.environ,
        "PATH": f"{bin_dir}{os.pathsep}{os.environ['PATH']}",
        "FAKE_LOG": str(log), "FAKE_CERT": str(cert),
        "LE_DIR": str(tmp_path / "letsencrypt"), "LE_WORK_DIR": str(tmp_path / "work"),
        "CERT_NAME": DOMAIN,
        **fake,
    }
    # 실패(종료 코드 1)도 테스트할 값이라 check=False 로 직접 확인해요.
    result = subprocess.run([BASH, str(SCRIPT)], check=False, cwd=tmp_path, env=env,
                            capture_output=True, text=True, encoding="utf-8", timeout=60)
    calls = log.read_text(encoding="utf-8").splitlines() if log.exists() else []
    return result.returncode, calls, result.stdout + result.stderr


def test_runs_certbot_renew_with_route53_and_letsencrypt_folders(tmp_path):
    code, calls, out = run_renew(tmp_path)
    assert code == 0, out
    renew = next(c for c in calls if c.startswith("run"))
    assert "certbot/dns-route53" in renew
    assert " renew" in renew and "--non-interactive" in renew
    assert f"{tmp_path / 'letsencrypt'}:/etc/letsencrypt" in renew
    # IMDS 홉 제한 1 에서도 서버 역할 권한을 받도록 서버 네트워크를 그대로 써요 (팀 공유 문서 6-5).
    assert "--network host" in renew


def test_no_reload_when_certificate_did_not_change(tmp_path):
    """만료 30일 전이 아니면 certbot 이 아무것도 안 해요 → nginx 도 그대로 둬요."""
    code, calls, out = run_renew(tmp_path)
    assert code == 0, out
    assert not any("nginx" in c for c in calls)
    assert "갱신할 필요 없음" in out


def test_reloads_nginx_after_checking_config_when_renewed(tmp_path):
    code, calls, out = run_renew(tmp_path, FAKE_RENEW="1")
    assert code == 0, out
    check = calls.index("exec labbridge-prod-nginx nginx -t")
    reload = calls.index("exec labbridge-prod-nginx nginx -s reload")
    assert check < reload


def test_bad_nginx_config_stops_before_reload(tmp_path):
    code, calls, out = run_renew(tmp_path, FAKE_RENEW="1", FAKE_NGINX_BAD="1")
    assert code == 1
    assert "exec labbridge-prod-nginx nginx -s reload" not in calls
    assert "nginx 설정 검사 실패" in out


def test_certbot_failure_does_not_touch_nginx(tmp_path):
    code, calls, out = run_renew(tmp_path, FAKE_CERTBOT_FAIL="1")
    assert code == 1
    assert not any("nginx" in c for c in calls)
    assert "갱신 실패" in out


def test_dry_run_uses_staging_and_never_reloads(tmp_path):
    code, calls, out = run_renew(tmp_path, DRY_RUN="1", FAKE_RENEW="1")
    assert code == 0, out
    renew = next(c for c in calls if c.startswith("run"))
    assert "--dry-run" in renew
    assert not any("nginx" in c for c in calls)


def test_systemd_timer_runs_twice_a_day_and_catches_up():
    """하루 두 번, 서버가 꺼져 있던 동안 놓친 실행은 켜질 때 다시 해요 (Persistent)."""
    timer = TIMER.read_text(encoding="utf-8")
    assert "OnCalendar=*-*-* 03,15:" in timer
    assert "Persistent=true" in timer
    assert "RandomizedDelaySec=" in timer
    service = SERVICE.read_text(encoding="utf-8")
    assert "Type=oneshot" in service
    assert "ExecStart=/opt/labbridge/infra/certbot/renew-origin-cert.sh" in service
    assert "Requires=docker.service" in service
    assert "docker.service" in next(line for line in service.splitlines() if line.startswith("After="))


def test_unit_files_are_checked_out_with_lf():
    """systemd 는 CRLF 줄 끝을 잘못 읽어요. 저장소에서 LF 로 받게 해요."""
    attrs = (ROOT / ".gitattributes").read_text(encoding="utf-8")
    assert "*.service text eol=lf" in attrs
    assert "*.timer text eol=lf" in attrs
