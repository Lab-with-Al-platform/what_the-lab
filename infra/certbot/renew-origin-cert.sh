#!/usr/bin/env bash
# origin.<도메인> Let's Encrypt 인증서를 갱신하고, 바뀌었을 때만 nginx 가 새 인증서를 읽게 해요.
# systemd 타이머(labbridge-cert-renew.timer)가 하루 두 번 실행해요. 사람이 직접 실행해도 돼요.
#
#   sudo /opt/labbridge/infra/certbot/renew-origin-cert.sh          # 실제 갱신 (필요할 때만)
#   sudo DRY_RUN=1 /opt/labbridge/infra/certbot/renew-origin-cert.sh # 연습: Let's Encrypt 연습 서버로 확인만
#
# - certbot 은 만료 30일 전부터만 실제로 갱신해요. 그래서 자주 돌려도 Let's Encrypt 제한에 걸리지 않아요.
# - DNS-01 확인은 EC2 역할의 Route 53 권한(_acme-challenge.origin.* TXT 만)으로 해요.
# - 인증서 파일 내용(sha256)을 갱신 전후로 비교해서, 바뀌었을 때만 nginx -t → nginx -s reload 해요.
#   reload 는 연결을 끊지 않고 새 인증서를 읽어요. (컨테이너를 다시 만들 필요 없음)
#
# 바꿀 수 있는 값 (환경변수):
#   CERT_NAME       인증서 이름. 기본 origin.labbridges.com
#   LE_DIR          인증서 폴더. 기본 /etc/letsencrypt  (nginx 컨테이너가 읽기 전용으로 연결해요)
#   LE_WORK_DIR     certbot 작업 폴더. 기본 /var/lib/letsencrypt
#   CERTBOT_IMAGE   기본 certbot/dns-route53:latest
#   NGINX_CONTAINER 기본 labbridge-prod-nginx
#   DRY_RUN         1이면 연습만 해요 (nginx 를 건드리지 않아요)
set -euo pipefail

CERT_NAME="${CERT_NAME:-origin.labbridges.com}"
LE_DIR="${LE_DIR:-/etc/letsencrypt}"
LE_WORK_DIR="${LE_WORK_DIR:-/var/lib/letsencrypt}"
CERTBOT_IMAGE="${CERTBOT_IMAGE:-certbot/dns-route53:latest}"
NGINX_CONTAINER="${NGINX_CONTAINER:-labbridge-prod-nginx}"
DRY_RUN="${DRY_RUN:-0}"
CERT_FILE="$LE_DIR/live/$CERT_NAME/fullchain.pem"

log() { echo "[$(date '+%F %T')] $*"; }
fail() { log "실패: $*"; exit 1; }

# 인증서 파일의 지문(sha256). live/ 는 실제 파일을 가리키는 링크라서 갱신되면 값이 바뀌어요.
cert_fingerprint() {
  sha256sum "$CERT_FILE" 2>/dev/null | cut -d' ' -f1
}

# certbot 을 docker 로 한 번 실행해요. (서버에 certbot 을 설치하지 않아요)
run_certbot_renew() {
  local extra=()
  if [ "$DRY_RUN" = "1" ]; then extra+=(--dry-run); fi
  docker run --rm \
    -v "$LE_DIR:/etc/letsencrypt" \
    -v "$LE_WORK_DIR:/var/lib/letsencrypt" \
    "$CERTBOT_IMAGE" renew --cert-name "$CERT_NAME" --non-interactive "${extra[@]}"
}

# 설정을 먼저 검사하고, 통과하면 새 인증서를 읽게 해요.
reload_nginx() {
  docker exec "$NGINX_CONTAINER" nginx -t || fail "nginx 설정 검사 실패 (reload 하지 않았어요)"
  docker exec "$NGINX_CONTAINER" nginx -s reload || fail "nginx reload 실패"
}

main() {
  [ -f "$CERT_FILE" ] || fail "$CERT_FILE 이 없어요 (처음 발급은 infra/certbot/README.md 참고)"
  local before after
  before="$(cert_fingerprint)"
  log "갱신 확인 시작: $CERT_NAME (연습=$DRY_RUN)"

  run_certbot_renew || fail "갱신 실패 (docker logs·journalctl -u labbridge-cert-renew 확인)"

  if [ "$DRY_RUN" = "1" ]; then
    log "연습 성공: 실제 갱신도 이 설정으로 될 거예요 (nginx 는 그대로)"
    return 0
  fi

  after="$(cert_fingerprint)"
  if [ "$before" = "$after" ]; then
    log "갱신할 필요 없음 (만료 30일 전부터 갱신해요)"
    return 0
  fi

  log "새 인증서를 받았어요 → nginx 가 다시 읽게 해요"
  reload_nginx
  log "완료: nginx 가 새 인증서를 쓰고 있어요"
}

main "$@"
