"""운영 compose 파일 지키기 (DB·Docker 없이): 비밀값 기본값과 잘못된 변수 이름을 머지 전에 잡아요.

- B1: 비밀값은 `${이름:?안내}`처럼 **값이 없으면 실행이 멈추게** 써요. 기본값이 있으면 저장소(공개)에 키가 남아요.
- B3: backend는 `FRONTEND_URL`이 아니라 `NEXT_PUBLIC_APP_URL`을 읽어요 (`backend/app/config.py`).
자세한 이유: docs/aws-deployment/09-deployment-roadmap.md 1절 (B1, B3)
"""

import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
COMPOSE = ROOT / "docker-compose.prod.yml"
APP_SERVICES = ["backend", "discord-bot"]  # 앱 코드를 실행하는 서비스
SECRET_KEYS = ["DATABASE_URL", "JWT_SECRET", "DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET"]
REQUIRED = re.compile(r"^\$\{[A-Z_]+:\?.+\}$")  # 예: ${JWT_SECRET:?JWT_SECRET 필요}


def service_env(name: str) -> dict[str, str]:
    """compose 서비스 하나의 environment를 {키: 값}으로 읽어요."""
    services = yaml.safe_load(COMPOSE.read_text(encoding="utf-8"))["services"]
    return {key: str(value) for key, value in services[name]["environment"].items()}


def test_app_secrets_have_no_default():
    """비밀값은 기본값 없이, 빠지면 실행이 멈춰야 해요."""
    for name in APP_SERVICES:
        env = service_env(name)
        for key in SECRET_KEYS:
            assert REQUIRED.match(env[key]), f"{name}.{key} = {env[key]!r} → ${{{key}:?...}} 형태로 바꿔 주세요"


def test_no_known_default_password_in_file():
    """예전에 쓰던 공개 비밀번호·키가 파일에 남아 있지 않아야 해요."""
    text = COMPOSE.read_text(encoding="utf-8")
    for leaked in ["admin123", "labbridge-production-jwt-secret-key-32chars", "ci-secret"]:
        assert leaked not in text, f"docker-compose.prod.yml 에 공개된 값 {leaked!r} 이 남아 있어요"


def test_app_reads_front_url_by_config_name():
    """backend 설정이 읽는 이름(NEXT_PUBLIC_APP_URL)으로 화면 주소를 넘겨야 해요."""
    for name in APP_SERVICES:
        env = service_env(name)
        assert "FRONTEND_URL" not in env, f"{name}: FRONTEND_URL 은 backend가 읽지 않아요 → NEXT_PUBLIC_APP_URL"
        assert REQUIRED.match(env.get("NEXT_PUBLIC_APP_URL", "")), f"{name}: NEXT_PUBLIC_APP_URL 이 필수값이어야 해요"
