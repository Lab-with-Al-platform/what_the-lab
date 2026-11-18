#!/usr/bin/env bash
# 운영 RDS 접속용 SSM 터널 열기 (B11). 내 PC의 localhost:15432 → EC2 → 비공개 RDS:5432
# 절차·규칙: backend/migrations/roles/README.md
#
# 준비물: AWS CLI v2, Session Manager 플러그인, 내 IAM 사용자에 ssm:StartSession 권한
# 사용법:
#   LABBRIDGE_EC2_ID=i-0123456789abcdef0 LABBRIDGE_RDS_HOST=<RDS 주소> ./infra/db/db-tunnel.sh
# 터널을 연 다음 다른 터미널에서 (조회 전용 계정):
#   psql "host=localhost port=15432 dbname=labbridge user=labbridge_readonly sslmode=require"
# 끝나면 Ctrl+C 로 닫아요.
set -euo pipefail

LOCAL_PORT="${LOCAL_PORT:-15432}"
EC2_ID="${LABBRIDGE_EC2_ID:?LABBRIDGE_EC2_ID 필요 (운영 EC2 인스턴스 ID)}"
RDS_HOST="${LABBRIDGE_RDS_HOST:?LABBRIDGE_RDS_HOST 필요 (RDS 엔드포인트 주소)}"
REGION="${AWS_REGION:-ap-northeast-2}"

# 로컬 backend 가 이 터널(운영 DB)을 가리키고 있으면 멈춰요.
# backend 는 켜지는 순간 요청 만료·아침 브리핑을 시작하고, 봇 토큰이 있으면 실제 회원에게 DM이 나가요.
check_local_env() {
  local file
  for file in .env backend/.env; do
    if [ -f "$file" ] && grep -E "^(DATABASE_URL|DB_PORT)=.*${LOCAL_PORT}" "$file" >/dev/null 2>&1; then
      echo "멈춤: $file 이 운영 DB 터널(포트 ${LOCAL_PORT})을 가리켜요. 로컬 backend 는 운영 DB에 연결하지 않아요." >&2
      exit 1
    fi
  done
}

check_tools() {
  command -v aws >/dev/null 2>&1 || { echo "AWS CLI 가 없어요" >&2; exit 1; }
  command -v session-manager-plugin >/dev/null 2>&1 \
    || { echo "Session Manager 플러그인이 없어요 (AWS 문서: Install the Session Manager plugin)" >&2; exit 1; }
}

main() {
  check_local_env   # 도구가 없어도 이 확인은 먼저 해요
  check_tools
  echo "터널 열기: localhost:${LOCAL_PORT} → ${EC2_ID} → ${RDS_HOST}:5432"
  echo "규칙: 조회는 labbridge_readonly, 로컬 backend 켜지 않기, 끝나면 Ctrl+C"
  aws ssm start-session \
    --region "$REGION" \
    --target "$EC2_ID" \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters "host=${RDS_HOST},portNumber=5432,localPortNumber=${LOCAL_PORT}"
}

main "$@"
