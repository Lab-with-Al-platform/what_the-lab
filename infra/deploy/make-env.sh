#!/usr/bin/env bash
# SSM Parameter Store(/labbridge/prod/*) 값으로 EC2의 .env.production 을 만들어요.
# 비밀값을 손으로 서버에 복사하지 않고, Parameter Store 한 곳에서만 관리하려고요. (docs/aws-deployment/03 5절)
#
# 사용법 (/opt/labbridge 에서):
#   ./infra/deploy/make-env.sh
#
# 규칙
#   - infra/env.production.example 에 있는 이름만 파일에 써요.
#     (사람용 READONLY_DB_PASSWORD 처럼 예시에 없는 값은 넣지 않아요)
#   - Parameter Store 에 없는 값은 예시 파일의 기본값을 써요. (봇 0, MVP+ false, 나머지 빈 값)
#   - 값은 작은따옴표로 감싸요. 비밀번호에 $ 가 있어도 compose 가 다른 값으로 바꾸지 않아요.
#   - 비밀값은 화면에 찍지 않아요. 이름만 알려 줘요.
#   - 실패하면 원래 .env.production 을 그대로 둬요. (다 쓴 뒤 한 번에 바꿔요)
#
# 필요한 권한 (EC2 역할): ssm:GetParametersByPath (/labbridge/prod, /labbridge/prod/*)
#   SecureString 기본 키(aws/ssm)는 따로 kms 권한을 주지 않아도 풀려요.
#
# 바꿀 수 있는 값 (환경변수):
#   ENV_FILE    기본 .env.production
#   KEYS_FILE   기본 infra/env.production.example
#   SSM_PATH    기본 /labbridge/prod/
#   AWS_REGION  기본 ap-northeast-2
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.production}"
KEYS_FILE="${KEYS_FILE:-infra/env.production.example}"
SSM_PATH="${SSM_PATH:-/labbridge/prod/}"
AWS_REGION="${AWS_REGION:-ap-northeast-2}"

# docker-compose.prod.yml 에서 ${이름:?} 로 꼭 있어야 하는 값이에요. 비어 있으면 이름을 알려 줘요.
REQUIRED_KEYS=(
  DATABASE_URL NEXT_PUBLIC_APP_URL CORS_ORIGINS JWT_SECRET
  DISCORD_CLIENT_ID DISCORD_CLIENT_SECRET DISCORD_REDIRECT_URI
  ORIGIN_DOMAIN ORIGIN_VERIFY_SECRET
)

fail() { echo "실패: $*" >&2; exit 1; }

declare -A ssm_values=()   # Parameter Store 에서 읽은 값 (이름 → 값)
declare -a key_order=()    # 예시 파일에 나온 순서
declare -A key_default=()  # 예시 파일의 기본값

# 예시 파일에서 "이름=기본값" 줄만 골라 순서대로 기억해요.
read_keys() {
  [ -f "$KEYS_FILE" ] || fail "$KEYS_FILE 이 없어요 (저장소를 받은 폴더에서 실행해 주세요)"
  local line name
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"   # Windows 에서 받은 파일(CRLF)이어도 값 끝에 CR 문자가 붙지 않게요
    [[ "$line" =~ ^([A-Z0-9_]+)=(.*)$ ]] || continue
    name="${BASH_REMATCH[1]}"
    key_order+=("$name")
    key_default["$name"]="${BASH_REMATCH[2]}"
  done < "$KEYS_FILE"
}

# Parameter Store 에서 값을 한 번에 읽어요. (여러 쪽이면 aws 가 알아서 이어 받아요)
# 결과는 "전체 이름<TAB>값" 한 줄씩이에요.
read_ssm() {
  local output line name value tab=$'\t'
  output="$(aws ssm get-parameters-by-path --path "$SSM_PATH" --recursive --with-decryption \
    --region "$AWS_REGION" --query 'Parameters[].[Name,Value]' --output text)" \
    || fail "Parameter Store 를 읽지 못했어요 (EC2 역할의 ssm:GetParametersByPath 권한 확인)"
  while IFS= read -r line; do
    line="${line%$'\r'}"
    [ -n "$line" ] || continue
    # 탭이 없거나 경로가 다르면 값 안에 줄바꿈이 있다는 뜻이에요. 안전하게 쓸 수 없어 멈춰요.
    [[ "$line" == "$SSM_PATH"*"$tab"* ]] || fail "줄바꿈이 든 값이 있어요. Parameter Store 값을 한 줄로 고쳐 주세요"
    name="${line%%"$tab"*}"
    value="${line#*"$tab"}"
    ssm_values["${name#"$SSM_PATH"}"]="$value"
  done <<< "$output"
}

# 작은따옴표 안에서는 작은따옴표를 쓸 수 없어서, 그런 값이 있으면 멈춰요.
check_values() {
  local name
  for name in "${!ssm_values[@]}"; do
    [[ "${ssm_values[$name]}" != *"'"* ]] || fail "$name 값에 작은따옴표(')가 있어요. 다른 문자로 바꿔 주세요"
  done
}

# 임시 파일에 다 쓴 뒤 한 번에 바꿔요. 중간에 멈춰도 원래 파일은 그대로예요.
write_env_file() {
  umask 077   # 처음부터 나만 읽을 수 있게 만들어요
  local tmp name value
  tmp="$(mktemp "${ENV_FILE}.XXXXXX")"
  trap 'rm -f "$tmp"' EXIT
  {
    echo "# make-env.sh 가 Parameter Store($SSM_PATH)에서 만든 파일이에요. 손으로 고치지 말고 Parameter Store 를 고친 뒤 다시 실행해요."
    for name in "${key_order[@]}"; do
      value="${ssm_values[$name]-${key_default[$name]}}"
      printf "%s='%s'\n" "$name" "$value"
    done
  } > "$tmp"
  chmod 600 "$tmp"
  mv -f "$tmp" "$ENV_FILE"
  trap - EXIT
}

# 무엇을 썼는지 이름만 알려 줘요. 값은 찍지 않아요.
report() {
  local name from_ssm=0 missing=() unused=()
  for name in "${key_order[@]}"; do
    if [ -n "${ssm_values[$name]+x}" ]; then from_ssm=$((from_ssm + 1)); fi
  done
  for name in "${REQUIRED_KEYS[@]}"; do
    if [ -z "${ssm_values[$name]-}" ]; then missing+=("$name"); fi
  done
  for name in "${!ssm_values[@]}"; do
    if [ -z "${key_default[$name]+x}" ]; then unused+=("$name"); fi
  done
  echo "$ENV_FILE 를 만들었어요: 값 ${#key_order[@]}개 중 Parameter Store 에서 ${from_ssm}개 (나머지는 예시 기본값)"
  if [ "${#unused[@]}" -gt 0 ]; then
    echo "서버 파일에 넣지 않은 값 (예시 파일에 없는 이름): ${unused[*]}"
  fi
  if [ "${#missing[@]}" -gt 0 ]; then
    echo "아직 비어 있는 필수 값 (이대로는 deploy.sh 가 멈춰요): ${missing[*]}"
  fi
}

main() {
  read_keys
  read_ssm
  check_values
  write_env_file
  report
}

main "$@"
