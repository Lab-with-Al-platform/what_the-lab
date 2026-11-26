#!/usr/bin/env bash
# LabBridge 운영 배포 스크립트 (EC2 /opt/labbridge/deploy.sh)
# 런북(docs/aws-deployment/10-operations-runbook.md 1절)의 수동 절차를 그대로 묶었어요.
# 사람과 GitHub Actions(SSM Run Command)가 **같은 스크립트**를 써요.
#
# 사용법 (docker-compose.prod.yml 이 있는 폴더에서):
#   ./deploy.sh <backend 이미지>
#   예) ./deploy.sh 123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/labbridge-backend:3f2a1bc
#
# 순서: 기록 → 이미지 받기 → (스냅샷 확인) → 마이그레이션 → 버전 확인
#       → backend 교체·확인(실패하면 이전 이미지로 되돌림) → discord-bot → nginx → 최종 확인
#
# 바꿀 수 있는 값 (환경변수):
#   ENV_FILE              기본 .env.production
#   COMPOSE_FILES         기본 "-f docker-compose.prod.yml -f docker-compose.awslogs.yml"
#   MIGRATION_SNAPSHOT_ID 새 마이그레이션이 있을 때 필수. 먼저 찍은 RDS 스냅샷 이름 (첫 배포는 first-deploy)
#   MIGRATION_DATABASE_URL 마이그레이션·권한 맞추기용 DB 주소(표의 주인 labbridge_migrator). 없으면 ENV_FILE 값,
#                         그것도 없으면 DATABASE_URL 하나로 다 해요 (계정 분리 전). B11
#   ENABLE_DISCORD_BOT    1이면 봇을 켜요. 없으면 ENV_FILE 값, 그것도 없으면 0 (전환 전 봇 중복 방지)
#   SKIP_PULL             1이면 이미지를 받지 않아요 (로컬 리허설용)
#   STATE_DIR             기록·로그 폴더. 기본 /var/tmp/labbridge
#   HEALTH_TIMEOUT        backend 확인 최대 시간(초). 기본 90
#   BOT_SETTLE_SECONDS    봇을 켠 뒤 다시 시작하지 않는지 지켜볼 시간(초). 기본 10
set -euo pipefail

BACKEND_CONTAINER="labbridge-prod-backend"
BOT_CONTAINER="labbridge-prod-discord-bot"
NGINX_CONTAINER="labbridge-prod-nginx"

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILES="${COMPOSE_FILES:--f docker-compose.prod.yml -f docker-compose.awslogs.yml}"
STATE_DIR="${STATE_DIR:-/var/tmp/labbridge}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-90}"
BOT_SETTLE_SECONDS="${BOT_SETTLE_SECONDS:-10}"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG="$STATE_DIR/deploy-$STAMP.log"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }
fail() { log "실패: $*"; exit 1; }

# docker compose 를 정해진 파일·환경 파일로 실행해요.
compose() {
  local files
  read -r -a files <<< "$COMPOSE_FILES"
  docker compose "${files[@]}" --env-file "$ENV_FILE" "$@"
}

# ECR 이미지면 받기 전에 docker 로그인을 해요. 비밀번호는 EC2 역할 권한으로 받고 화면에 찍지 않아요.
# 예) 123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/... → 저장소 주소와 리전(4번째 칸)을 꺼내요
ecr_login() {
  local registry="${BACKEND_IMAGE%%/*}"
  case "$registry" in
    *.dkr.ecr.*.amazonaws.com) ;;
    *) return 0 ;;
  esac
  local region
  region="$(echo "$registry" | cut -d. -f4)"
  aws ecr get-login-password --region "$region" 2>>"$LOG" \
    | docker login --username AWS --password-stdin "$registry" >>"$LOG" 2>&1
}

# 마이그레이션 계정으로 backend 이미지의 명령을 실행해요.
# 주소를 명령줄(-e)에 쓰지 않고 환경변수로 넘겨요. (ps 에 비밀번호가 보이지 않게)
migrator_run() {
  if [ -n "$MIGRATION_URL" ]; then
    DATABASE_URL="$MIGRATION_URL" compose run --rm --no-deps -T backend "$@"
  else
    compose run --rm --no-deps -T backend "$@"
  fi
}

# alembic 명령 결과에서 버전 이름만 꺼내요. 예) "20261104_27 (head)" → 20261104_27
alembic_revision() {
  migrator_run alembic "$1" 2>>"$LOG" \
    | awk '/^[0-9A-Za-z_]+( \(head\))?$/ {print $1}' | tail -n 1
}

# 환경 파일에서 값 하나를 읽어요. KEY=VALUE 와 make-env.sh 가 쓰는 KEY='VALUE' 둘 다 돼요.
env_file_value() {
  local value quote="'"
  value="$(grep -E "^$1=" "$ENV_FILE" | tail -n 1 | cut -d= -f2-)" || true
  value="${value#"$quote"}"
  value="${value%"$quote"}"
  printf '%s' "$value"
}

# 지금 돌고 있는 backend 컨테이너의 이미지 (첫 배포면 빈 값)
running_backend_image() {
  docker inspect --format '{{.Config.Image}}' "$BACKEND_CONTAINER" 2>/dev/null || true
}

# backend 컨테이너 안에서 /api/v1/health 가 응답할 때까지 기다려요.
wait_backend_healthy() {
  local waited=0
  while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
    if docker exec "$BACKEND_CONTAINER" python -c \
      "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=3)" \
      >/dev/null 2>&1; then
      return 0
    fi
    sleep 3
    waited=$((waited + 3))
  done
  return 1
}

# backend 확인에 실패하면 이전 이미지로 되돌려요. DB는 건드리지 않아요.
rollback_backend() {
  local previous="$1"
  if [ -z "$previous" ] || [ "$previous" = "$BACKEND_IMAGE" ]; then
    log "되돌릴 이전 이미지가 없어요. 로그를 확인해 주세요: docker logs $BACKEND_CONTAINER"
    return
  fi
  log "이전 이미지로 되돌려요: $previous"
  BACKEND_IMAGE="$previous" compose up -d --no-deps backend >>"$LOG" 2>&1
  if [ "$BOT_ENABLED" = "1" ]; then
    BACKEND_IMAGE="$previous" compose up -d --no-deps discord-bot >>"$LOG" 2>&1
  fi
  if wait_backend_healthy; then
    log "되돌린 backend 정상"
  else
    log "되돌린 backend 도 응답하지 않아요. 바로 확인이 필요해요: docker logs $BACKEND_CONTAINER"
  fi
}

# 봇을 켜고 잠시(기본 10초) 다시 시작하지 않는지 봐요.
start_bot() {
  compose up -d --no-deps discord-bot >>"$LOG" 2>&1
  sleep "$BOT_SETTLE_SECONDS"
  local running restarts
  running="$(docker inspect --format '{{.State.Running}}' "$BOT_CONTAINER")"
  restarts="$(docker inspect --format '{{.RestartCount}}' "$BOT_CONTAINER")"
  [ "$running" = "true" ] && [ "$restarts" = "0" ] \
    || fail "discord-bot 이 켜지지 않아요 (running=$running, restarts=$restarts). docker logs $BOT_CONTAINER"
}

# nginx 를 켜고 설정을 다시 읽게 해요. (templates 를 바꿨다면 컨테이너를 새로 만들어야 해요)
start_nginx() {
  compose up -d --no-deps nginx >>"$LOG" 2>&1
  docker exec "$NGINX_CONTAINER" nginx -t >>"$LOG" 2>&1 || fail "nginx 설정 검사 실패"
  docker exec "$NGINX_CONTAINER" nginx -s reload >>"$LOG" 2>&1
}

main() {
  [ "$#" -eq 1 ] || { echo "사용법: $0 <backend 이미지>"; exit 2; }
  export BACKEND_IMAGE="$1"   # .env.production 의 BACKEND_IMAGE 보다 이 값이 먼저예요

  mkdir -p "$STATE_DIR"
  [ -f docker-compose.prod.yml ] || fail "docker-compose.prod.yml 이 있는 폴더에서 실행해 주세요"
  [ -f "$ENV_FILE" ] || fail "$ENV_FILE 이 없어요"

  # 같은 서버에서 배포가 겹치지 않게 해요 (flock 이 있는 리눅스에서만)
  if command -v flock >/dev/null 2>&1; then
    exec 9>"$STATE_DIR/deploy.lock"
    flock -n 9 || fail "다른 배포가 진행 중이에요"
  fi

  BOT_ENABLED="${ENABLE_DISCORD_BOT:-$(env_file_value ENABLE_DISCORD_BOT)}"
  BOT_ENABLED="${BOT_ENABLED:-0}"
  MIGRATION_URL="${MIGRATION_DATABASE_URL:-$(env_file_value MIGRATION_DATABASE_URL)}"
  log "배포 시작: $BACKEND_IMAGE (봇 켜기=$BOT_ENABLED, 로그 $LOG)"

  # 0) 설정 검사 + 지금 상태 기록 (롤백용)
  compose config -q 2>>"$LOG" || fail "compose 설정 오류 (필수 환경변수가 빠졌는지 확인)"
  local previous
  previous="$(running_backend_image)"
  echo "$previous" > "$STATE_DIR/previous-backend-image"
  compose images > "$STATE_DIR/before-deploy-$STAMP.txt" 2>>"$LOG" || true
  log "이전 backend 이미지: ${previous:-없음(첫 배포)}"

  # 1) 새 이미지 받기 (서버에서 빌드하지 않아요)
  if [ "${SKIP_PULL:-0}" != "1" ]; then
    ecr_login || fail "ECR 로그인 실패 (EC2 역할의 ECR 읽기 권한 확인)"
    compose pull backend >>"$LOG" 2>&1 || fail "이미지를 받지 못했어요: $BACKEND_IMAGE"
  fi

  # 2) 마이그레이션 확인 → 새 버전이 있으면 RDS 스냅샷을 찍었는지 먼저 확인
  local current heads
  current="$(alembic_revision current)" || fail "DB 버전을 읽지 못했어요 (DATABASE_URL·보안 그룹 확인)"
  heads="$(alembic_revision heads)" || fail "이미지에서 alembic head 를 읽지 못했어요"
  [ -n "$heads" ] || fail "이미지에서 alembic head 를 읽지 못했어요"
  log "DB 버전: ${current:-비어 있음} / 이미지 버전: $heads"
  if [ "$current" != "$heads" ]; then
    [ -n "${MIGRATION_SNAPSHOT_ID:-}" ] || fail "새 마이그레이션이 있어요. RDS 스냅샷을 먼저 찍고 MIGRATION_SNAPSHOT_ID=<스냅샷 이름> 으로 다시 실행해 주세요 (런북 1절). 첫 배포면 first-deploy"
    log "스냅샷 확인: $MIGRATION_SNAPSHOT_ID → alembic upgrade head"
    migrator_run alembic upgrade head >>"$LOG" 2>&1 || fail "마이그레이션 실패. 컨테이너는 이전 그대로예요. DB 담당자에게 알려 주세요"
  fi

  # 3) 버전 확인: current = heads 여야 다음 단계로
  current="$(alembic_revision current)" || fail "DB 버전을 다시 읽지 못했어요"
  [ "$current" = "$heads" ] || fail "DB 버전 불일치: current=$current heads=$heads"
  log "DB 버전 일치: $current"

  # 3-1) 앱·조회 전용 계정 권한 맞추기 (새 표·RLS 정책). 계정을 나눈 뒤에만 (B11)
  if [ -n "$MIGRATION_URL" ]; then
    migrator_run python migrations/roles/apply_grants.py >>"$LOG" 2>&1 \
      || fail "앱 계정 권한 맞추기 실패 (backend/migrations/roles/README.md)"
    log "앱·조회 전용 계정 권한 맞춤"
  else
    log "MIGRATION_DATABASE_URL 없음: 앱 계정 하나로 운영 중 (권한 맞추기 건너뜀)"
  fi

  # 4) backend 교체 → 확인 → 실패하면 이전 이미지로
  compose up -d --no-deps backend >>"$LOG" 2>&1
  if ! wait_backend_healthy; then
    rollback_backend "$previous"
    fail "새 backend 가 ${HEALTH_TIMEOUT}초 안에 응답하지 않았어요"
  fi
  log "backend 정상"

  # 5) discord-bot (전환 전에는 꺼 둬요. Render 봇과 겹치면 알림이 두 번 가요)
  if [ "$BOT_ENABLED" = "1" ]; then
    start_bot
    log "discord-bot 정상"
  else
    compose stop discord-bot >>"$LOG" 2>&1 || true
    log "discord-bot 꺼 둠 (ENABLE_DISCORD_BOT=1 이면 켜요)"
  fi

  # 6) nginx
  start_nginx
  docker exec "$NGINX_CONTAINER" wget -qO- http://127.0.0.1:8080/healthz >/dev/null 2>&1 || fail "nginx healthz 실패"
  docker exec "$NGINX_CONTAINER" wget -qO- http://backend:8000/api/v1/health >/dev/null 2>&1 || fail "nginx → backend 연결 실패"
  log "nginx 정상 (→ backend 연결 확인)"

  compose ps >>"$LOG" 2>&1 || true
  log "배포 완료: $BACKEND_IMAGE"
}

main "$@"
