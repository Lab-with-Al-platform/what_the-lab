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


# ---- B5: t4g.micro(1GiB) 한 대 기준 운영 compose ----
# 자세한 이유: docs/aws-deployment/02-recommended-architecture.md 2-1절, 10-operations-runbook.md 5.3절
AWSLOGS = ROOT / "docker-compose.awslogs.yml"
NGINX_CONF = ROOT / "infra" / "nginx" / "nginx.conf"
MICRO_LIMITS_MB = {"nginx": 48, "backend": 384, "discord-bot": 192}  # 합계 624MB


def load_services(path: Path) -> dict:
    """compose 파일의 services 부분만 읽어요."""
    return yaml.safe_load(path.read_text(encoding="utf-8"))["services"]


def memory_mb(text: str) -> int:
    """'384M' 같은 compose 메모리 표기를 MB 숫자로 바꿔요."""
    assert text.upper().endswith("M"), f"메모리는 M 단위로 적어 주세요: {text!r}"
    return int(text[:-1])


def test_prod_runs_only_server_containers():
    """운영 DB는 RDS, 화면은 S3라서 postgres·frontend 컨테이너가 없어야 해요."""
    assert set(load_services(COMPOSE)) == set(MICRO_LIMITS_MB)


def test_memory_limits_fit_micro():
    """1GiB 서버에서 OS·Docker 몫(약 400MB)을 남기도록 한도를 정해요."""
    services = load_services(COMPOSE)
    for name, expected in MICRO_LIMITS_MB.items():
        limit = services[name]["deploy"]["resources"]["limits"]["memory"]
        assert memory_mb(limit) == expected, f"{name} 메모리 한도 {limit} → {expected}M"


def test_app_services_use_registry_image():
    """EC2는 빌드하지 않고 ECR 이미지를 받아요. backend와 봇은 같은 이미지를 써요."""
    services = load_services(COMPOSE)
    images = {services[name].get("image") for name in APP_SERVICES}
    assert len(images) == 1 and None not in images, f"backend·봇 image 가 같아야 해요: {images}"


def test_nginx_does_not_proxy_frontend():
    """frontend 컨테이너가 없으면 nginx가 'host not found'로 켜지지 않아요."""
    assert "frontend" not in NGINX_CONF.read_text(encoding="utf-8")


def test_awslogs_override_sends_each_service_to_its_group():
    """EC2에서만 덧붙이는 파일: 서비스마다 자기 로그 그룹, 전송이 느려도 앱이 멈추지 않게."""
    services = load_services(AWSLOGS)
    assert set(services) == set(MICRO_LIMITS_MB)
    for name, service in services.items():
        logging = service["logging"]
        assert logging["driver"] == "awslogs"
        assert logging["options"]["awslogs-group"] == f"/labbridge/prod/{name}"
        assert logging["options"]["mode"] == "non-blocking"
