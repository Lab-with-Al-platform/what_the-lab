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


def test_bot_does_not_inherit_api_healthcheck():
    """봇은 8000번 API가 없어요. 이미지 HEALTHCHECK를 끄지 않으면 늘 unhealthy로 보여요."""
    bot = load_services(COMPOSE)["discord-bot"]
    assert bot.get("healthcheck", {}).get("disable") is True


# ---- B4: nginx는 CloudFront 전용 HTTPS 오리진 ----
# 자세한 이유: docs/aws-deployment/03-network-security.md 3절
ORIGIN_TEMPLATE = ROOT / "infra" / "nginx" / "templates" / "origin.conf.template"


def test_nginx_opens_only_https():
    """보안 그룹이 CloudFront만 443으로 들여보내요. 80번 평문은 열지 않아요."""
    nginx = load_services(COMPOSE)["nginx"]
    assert nginx["ports"] == ["443:443"]


def test_nginx_origin_values_are_required():
    """오리진 이름·비밀 헤더 값이 빠지면 실행이 멈춰야 해요 (빈 값이면 누구나 통과)."""
    env = service_env("nginx")
    for key in ["ORIGIN_DOMAIN", "ORIGIN_VERIFY_SECRET"]:
        assert REQUIRED.match(env[key]), f"nginx.{key} = {env[key]!r} → ${{{key}:?...}} 형태로 바꿔 주세요"


def test_origin_checks_secret_header_before_proxy():
    """비밀 헤더 검사, 443 인증서, backend에 비밀 헤더를 넘기지 않기."""
    text = ORIGIN_TEMPLATE.read_text(encoding="utf-8")
    assert '"${ORIGIN_VERIFY_SECRET}" 1;' in text
    assert "if ($origin_verified = 0)" in text and "return 403;" in text
    assert "/etc/letsencrypt/live/${ORIGIN_DOMAIN}/fullchain.pem" in text
    assert 'proxy_set_header X-Origin-Verify "";' in text
    assert "ssl_reject_handshake on;" in text


def test_auth_routes_have_strict_rate_limit():
    """로그인·콜백·인증번호 발송·확인은 엄격한 auth 제한을 받아요."""
    conf = NGINX_CONF.read_text(encoding="utf-8")
    text = ORIGIN_TEMPLATE.read_text(encoding="utf-8")
    assert "zone=auth:1m rate=10r/m" in conf and "limit_req_status 429;" in conf
    assert "location /api/v1/auth/discord/ {\n        limit_req zone=auth" in text
    assert "location ~ ^/api/v1/verification/(email|change)/(send|confirm)$ {\n        limit_req zone=auth" in text


def test_nginx_reads_only_origin_server_config():
    """이미지 기본 default.conf(80번 환영 화면)를 읽지 않도록 origin.conf 하나만 불러와요."""
    conf = NGINX_CONF.read_text(encoding="utf-8")
    assert "include /etc/nginx/conf.d/origin.conf;" in conf
    assert "conf.d/*.conf" not in conf
    assert "listen 80" not in conf


# ---- 2026-11-18: backend 코드가 읽는 환경변수가 운영 compose에 빠지지 않게 ----
APP_DIR = ROOT / "backend" / "app"
ENV_READ = re.compile(r"""os\.(?:getenv|environ\.get)\(\s*["']([A-Z_]+)["']|os\.environ\[\s*["']([A-Z_]+)["']\s*\]""")
LEGACY_ENV = {"DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"}  # DATABASE_URL 이 없을 때만 쓰는 예전 값


def env_names_read_by_app() -> set[str]:
    """backend/app 코드가 읽는 환경변수 이름 (여러 줄에 걸친 getenv 도 포함)."""
    names: set[str] = set()
    for path in APP_DIR.rglob("*.py"):
        for found in ENV_READ.findall(path.read_text(encoding="utf-8")):
            names.add(found[0] or found[1])
    return names


def test_app_env_vars_are_all_passed_by_compose():
    """코드가 읽는데 compose가 안 넘기면, 운영에서 조용히 기본값(localhost 등)으로 돌아요."""
    needed = env_names_read_by_app() - LEGACY_ENV
    assert "INSIGHT_ALLOWED_ORIGINS" in needed  # 여러 줄 getenv 도 찾는지
    for name in APP_SERVICES:
        missing = needed - set(service_env(name))
        assert not missing, f"{name} 에 빠진 환경변수: {sorted(missing)} → docker-compose.prod.yml x-app-environment"


def test_env_example_lists_every_compose_variable():
    """compose 가 읽는 ${이름} 은 infra/env.production.example 에도 있어야 팀원이 채울 수 있어요."""
    compose_vars = set(re.findall(r"\$\{([A-Z_]+)", COMPOSE.read_text(encoding="utf-8")))
    example = (ROOT / "infra" / "env.production.example").read_text(encoding="utf-8")
    example_vars = set(re.findall(r"^([A-Z_]+)=", example, flags=re.M))
    assert not compose_vars - example_vars, sorted(compose_vars - example_vars)


def test_uploads_are_saved_in_the_volume():
    """코드 기본값은 컨테이너에서 /backend/uploads 가 되어 권한 오류가 나요. 볼륨 위치로 고정해요."""
    backend = load_services(COMPOSE)["backend"]
    target = "/app/uploads"
    assert service_env("backend")["UPLOAD_DIR"] == target
    assert f"backend_uploads:{target}" in backend["volumes"]


def test_write_origins_follow_cors_by_default():
    """관리자 쓰기·게시판 글쓰기의 허용 주소가 비면 CORS_ORIGINS 를 따라가요 (코드 기본값 localhost 방지)."""
    env = service_env("backend")
    for key in ["INSIGHT_ALLOWED_ORIGINS", "COMMUNITY_ALLOWED_ORIGINS"]:
        assert env[key] == f"${{{key}:-${{CORS_ORIGINS}}}}"
