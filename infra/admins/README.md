# 운영 화면 관리자 (`OPERATIONS_ADMIN_DISCORD_IDS`)

운영 화면(`/admin`)에 들어갈 사람을 **디스코드 사용자 ID**로 정해요. 비밀번호가 아니라 디스코드 로그인으로 들어와요.

## 할 일 (사용자 ID만 넣으면 돼요)

1. 팀원 3명에게 디스코드 사용자 ID를 받아요.
   - 디스코드 → 설정 → **고급** → **개발자 모드** 켜기 → 내 프로필 우클릭 → **사용자 ID 복사**
   - 17~20자리 숫자예요. 닉네임이 아니에요.
   - 팀 DM처럼 공개되지 않는 곳에서 받아요. 저장소·이슈·PR에는 적지 않아요 (저장소가 공개예요).
2. 파일을 복사하고 ID를 넣어요.
   ```bash
   cp infra/admins/admin-ids.example.txt infra/admins/admin-ids.txt
   # admin-ids.txt 의 관리자1= 관리자2= 관리자3= 뒤에 ID 입력 (이 파일은 git에 올라가지 않아요)
   ```
3. 한 줄로 만들어요.
   ```bash
   bash infra/admins/make-admin-ids.sh
   ```
   - 빈 칸, 숫자가 아닌 값, 같은 ID가 두 번 있으면 멈추고 알려 줘요.
   - 출력된 `OPERATIONS_ADMIN_DISCORD_IDS=...` 줄을 EC2의 `.env.production`에, 같은 값을 SSM `/labbridge/prod/OPERATIONS_ADMIN_DISCORD_IDS`에 넣어요 (AWS 연결 후).
4. 배포하면(`deploy.sh`) 3명 모두 **디스코드로 로그인하는 즉시** 운영 화면에 들어갈 수 있어요.

## 배포 후 (권장)

- 운영 화면 → 회원 상세에서 서로에게 **공통 관리자(`is_admin`)**를 부여해요.
  - 공통 관리자는 인사이트 관리까지 포함하고, 환경변수를 고치거나 다시 배포하지 않아도 화면에서 넣고 뺄 수 있어요.
  - 부여하려면 그 사람이 **한 번은 로그인해서 회원으로 등록돼 있어야** 해요.
- 환경변수 목록은 "처음 들어갈 문" 역할이에요. 공통 관리자가 정해진 뒤에도 비상용으로 남겨 둬요.
- 관리자가 바뀌면 `admin-ids.txt`를 고치고 3번부터 다시 해요. 환경변수를 바꾼 경우 backend를 다시 시작해야 반영돼요(`deploy.sh` 재실행).

## 관련 코드

- `backend/app/operations/auth.py`: `is_admin`이거나 이 목록에 있으면 운영 조회 가능
- `docker-compose.prod.yml` `x-app-environment`: backend·봇에 값을 넘겨요
