#!/usr/bin/env bash
# admin-ids.txt 의 디스코드 사용자 ID를 OPERATIONS_ADMIN_DISCORD_IDS 한 줄로 만들어요.
# 사용법 (저장소 루트에서):  bash infra/admins/make-admin-ids.sh [파일 경로]
# 출력만 해요. AWS 나 서버를 바꾸지 않아요. 출력된 값은 채팅·이슈에 붙이지 말고 .env.production·SSM 에만 넣어요.
set -euo pipefail

FILE="${1:-infra/admins/admin-ids.txt}"
PARAM_NAME="/labbridge/prod/OPERATIONS_ADMIN_DISCORD_IDS"

[ -f "$FILE" ] || {
  echo "$FILE 이 없어요. 먼저 복사해 주세요: cp infra/admins/admin-ids.example.txt infra/admins/admin-ids.txt" >&2
  exit 1
}

ids=()
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"                       # Windows 줄바꿈(CRLF) 정리
  case "$line" in ''|'#'*) continue ;; esac  # 빈 줄·설명 줄은 건너뛰어요
  label="${line%%=*}"
  value="${line#*=}"
  value="${value//[[:space:]]/}"
  if [ -z "$value" ]; then
    echo "멈춤: '$label' 의 ID가 비어 있어요" >&2; exit 1
  fi
  if ! [[ "$value" =~ ^[0-9]{17,20}$ ]]; then
    echo "멈춤: '$label' 의 값 '$value' 는 디스코드 사용자 ID(17~20자리 숫자)가 아니에요" >&2; exit 1
  fi
  for existing in "${ids[@]+"${ids[@]}"}"; do
    [ "$existing" != "$value" ] || { echo "멈춤: '$label' 의 ID가 다른 줄과 같아요" >&2; exit 1; }
  done
  ids+=("$value")
done < "$FILE"

[ "${#ids[@]}" -gt 0 ] || { echo "멈춤: ID가 하나도 없어요" >&2; exit 1; }

joined="$(IFS=,; echo "${ids[*]}")"
echo "관리자 ${#ids[@]}명 확인했어요."
echo
echo "1) EC2 .env.production 에 넣을 줄:"
echo "OPERATIONS_ADMIN_DISCORD_IDS=$joined"
echo
echo "2) SSM 에 저장할 때 (AWS 계정 연결 후, 관리자 PC에서):"
echo "aws ssm put-parameter --region ap-northeast-2 --name $PARAM_NAME --type SecureString --overwrite --value \"$joined\""
