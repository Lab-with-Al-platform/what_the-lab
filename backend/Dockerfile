# 1. Base 이미지 및 uv 바이너리 추출
FROM python:3.13-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# 2. Builder 단계 (uv를 이용한 가상환경 및 의존성 설치)
FROM base AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# 시스템 필수 빌드 라이브러리 (필요 시)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 의존성 파일 복사 및 설치 (캐시 최적화)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# 3. Final Production Runner 단계
FROM base AS runner

WORKDIR /app

# 보안을 위한 non-root 사용자 생성
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -s /bin/bash -m appuser

# 빌드된 가상환경 복사
COPY --from=builder /app/.venv /app/.venv

# 애플리케이션 소스코드 및 마이그레이션 파일 복사
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini pyproject.toml ./

# uploads 디렉토리 생성 및 권한 부여
RUN mkdir -p /app/uploads && chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health')" || exit 1

# 기본 실행: Uvicorn 단일 Worker (지침에 따라 --workers 1 강제)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

