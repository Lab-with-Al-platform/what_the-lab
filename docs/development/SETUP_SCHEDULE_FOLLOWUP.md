# 일정 후속(메시지 고치기 · 반복 일정 일괄 수정 · 아침 브리핑 묶기 · 구글 정리) — pull 받은 뒤 세팅 안내

> 2026-11-04 · `feature/schedule-followup` PR 기준
> 이 PR을 받은 뒤 **각자 PC에서 한 번** 따라 하면 돼요. 10분 정도 걸려요.
> 먼저 끝나 있어야 하는 것: [요청 세팅](SETUP_WORKSPACE_TASKS.md) (DB `20261031_22`) · [일정 세팅](SETUP_WORKSPACE_SCHEDULES.md) (DB `20261101_23`)
> 디스코드 봇 · 구글 캘린더 기본 세팅: [SETUP_DISCORD_COLLAB_CHANNEL.md](SETUP_DISCORD_COLLAB_CHANNEL.md) · [SETUP_GOOGLE_CALENDAR.md](SETUP_GOOGLE_CALENDAR.md)

## 이번 PR에 들어간 것

| 기능 | 웹 | 디스코드 | 구글 캘린더 |
|---|---|---|---|
| 일정이 바뀌면 채널의 "일정을 추가했어요" 메시지를 지금 내용으로, 지우면 ~~취소선~~으로 | — | 협업 채널 | — |
| 반복 일정 "이 날짜 이후 모두" 수정 (날짜를 옮기면 모두 같은 만큼, 알림은 한 번) | 일정 창 체크 | [이 날짜 이후 모두 수정] | 같이 바뀜 |
| 아침 브리핑 줄이기: 미팅 · 기타는 당일, 결과물 마감은 전날, 작업 기간은 끝나기 전날만 | 🔔 | "☀️ 오늘 챙길 일" | — |
| 알림 종에 아침 브리핑을 협업마다 하루 한 칸(☀️)으로 묶기 | 🔔 | — | — |
| 연도 없이 지난 날(예: 11.2에 `10.30`)을 적으면 "이미 지난 날이에요" 안내 | — | `/일정` · `/요청` 입력 창 | — |
| `/일정목록`에서 제목을 누르면 그 일정 메시지로 이동 | — | `/일정목록` | — |
| **구글에는 앞으로 볼 것만**: 완료 · 취소 요청과 지난 일정은 빠지고, `[협업] 협업 시작`(시작 전만) · `[협업] 협업 종료일`이 들어가요 | — | — | 자동 (매일 아침 정리) |
| **웹 달력에는 다 남기기**: 지난 일정 · 완료 요청(✓)은 흐리게. 요청 목록 · 다가오는 일정에는 열린 요청만 | 협업 목록 달력 | — | — |

새로 필요한 것은 **DB 마이그레이션 2개**예요. 하나는 #77 협업 리뷰 `20261103_24`, 하나는 이 PR의 `20261104_25`예요.
`.env`에 새로 넣을 값은 없고, 새 패키지도 없어요. (`uv sync` · `npm install`은 필요 없어요)

---

## 0. 코드 받기

```powershell
cd C:\dev\project\what_the-lab
git checkout develop
git pull origin develop
```

---

## 1. DB가 바뀌어 있어야 해요 ⚠️

DB가 안 바뀐 상태로 이 코드를 켜면 **일정 추가 · 수정 · 삭제, 알림 종, 아침 브리핑이 오류**가 나요. (새 칸 `discord_message_id`, 새 알림 종류 `daily_brief`를 써요)

| 순서 | 마이그레이션 | Docker 파일 | 하는 일 |
|---|---|---|---|
| 1 | `20261103_24` | `028_create_collaboration_reviews.sql` | 협업 리뷰 표 2개, 알림 종류 `review_ready` (#77) |
| 2 | `20261104_25` | `029_add_schedule_message.sql` | 일정 표에 `discord_message_id` 칸, 알림 종류 `daily_brief` (이 PR) |

기존 일정 · 요청 · 알림 데이터는 지우거나 바꾸지 않아요.

### 1-A. 공용 Supabase를 쓰는 경우 (팀 기본)
- **DB 담당자가 `20261101_23` → `20261103_24` → `20261104_25` 순서로 적용한 뒤에** 이 코드를 실행하세요.
- 각자 `alembic upgrade`를 실행하지 마세요. 공용 DB는 DB 담당자만 바꿔요.
- 적용됐는지 확인 (Supabase → SQL Editor):
  ```sql
  SELECT version_num FROM insight_alembic_version;
  ```
  `20261104_25`이면 OK예요.

### 1-B. 로컬 Docker DB를 쓰는 경우 (`labbridge-postgres` 컨테이너)

> 먼저 `backend\.env`의 DB 주소가 **`localhost:5433` (로컬 Docker)** 인지 확인하세요. 아래 명령은 로컬 DB에만 실행해요.

**새로 만든(빈) Docker 볼륨**이면 컨테이너가 처음 켜질 때 `database/init`의 파일을 번호 순서대로 자동으로 실행해요. 할 일 없어요.

**이미 데이터가 있는 볼륨**이면 새 파일이 자동으로 실행되지 않아요. 아래를 한 번 따라 하세요.

**① 지금 상태 확인**
```powershell
docker exec labbridge-postgres psql -U admin -d labbridge -c "SELECT to_regclass('public.insight_alembic_version') AS version_table, to_regclass('public.collaboration_review') AS review_table; SELECT column_name FROM information_schema.columns WHERE table_name = 'notification' AND column_name IN ('schedule_id', 'note');"
```
- `to_regclass('표이름')`: 그 표가 있으면 이름을, 없으면 빈칸을 보여 줘요.
- 아래쪽에 `schedule_id` · `note` 두 줄이 **안 나오면** 일정 세팅(027)이 아직이에요. [일정 세팅](SETUP_WORKSPACE_SCHEDULES.md)부터 하고 오세요.
- `review_table`에 이미 이름이 나오면 ②~④는 건너뛰고 ⑤의 029만 실행하세요.

**② 개정 번호 표가 없으면 (`version_table` 빈칸) 로컬에만 만들기**

028은 시작할 때 개정 번호가 `20261101_23`인지 검사해요. 오래된 볼륨에는 이 표가 없어서 028 전체가 취소되기 때문에 미리 만들어 둬요.
```powershell
docker exec labbridge-postgres psql -U admin -d labbridge -c "CREATE TABLE public.insight_alembic_version (version_num VARCHAR(32) PRIMARY KEY); INSERT INTO public.insight_alembic_version VALUES ('20261101_23');"
```
`version_table`에 이름이 이미 나왔다면 번호만 확인하세요. (`SELECT version_num FROM insight_alembic_version;` → `20261101_23`이어야 해요)

**③ 예전 브랜치에서 `daily_brief` 알림이 생겼다면 지우기**

PR 리뷰 중에 이 브랜치를 미리 받아서 쓴 사람만 해당돼요. 028이 다시 만드는 알림 종류 규칙에는 `daily_brief`가 없어서, 이 줄이 남아 있으면 028이 취소돼요.
```powershell
docker exec labbridge-postgres psql -U admin -d labbridge -c "SELECT count(*) FROM notification WHERE type = 'daily_brief';"
# 1 이상이면 (알림 종의 '오늘 챙길 일' 요약 줄만 지워요. 다른 알림 · 알림 설정은 그대로)
docker exec labbridge-postgres psql -U admin -d labbridge -c "DELETE FROM notification WHERE type = 'daily_brief';"
```

**④ 028 실행 (협업 리뷰)**
```powershell
docker exec labbridge-postgres psql -U admin -d labbridge -f /docker-entrypoint-initdb.d/028_create_collaboration_reviews.sql
```
마지막에 `COMMIT`이 나오면 성공이에요. `ROLLBACK`이나 `ERROR`가 나오면 ①~③을 다시 확인하세요. (이 파일은 한 덩어리라서 한 줄만 실패해도 전부 취소돼요)

**⑤ 029 실행 (이 PR)**
```powershell
docker exec labbridge-postgres psql -U admin -d labbridge -f /docker-entrypoint-initdb.d/029_add_schedule_message.sql
```
- `ALTER TABLE` 3개와 `UPDATE 1`이 나오면 성공이에요.
- 이 브랜치를 미리 받아서 옛 `028_add_schedule_message.sql`을 실행했던 사람은 `column "discord_message_id" … already exists` 오류가 하나 나와요. **무시하세요.** 나머지 줄(알림 종류 규칙)은 그대로 반영돼요.
- **`-1`이나 `-v ON_ERROR_STOP=1`을 붙이지 마세요.** 위 오류 하나 때문에 전부 취소돼요.

**⑥ 확인**
```powershell
docker exec labbridge-postgres psql -U admin -d labbridge -c "SELECT version_num FROM insight_alembic_version;"
```
`20261104_25`이면 끝이에요.

---

## 2. 서버 · 봇 다시 켜기

새 코드는 다시 켜야 반영돼요. **둘 다** 켜 두세요.

```powershell
# 터미널 1: 웹 서버 (구글 반영 15초마다 · 아침 브리핑 · 매일 아침 구글 정리도 여기서 돌아요)
cd C:\dev\project\what_the-lab\backend
uv run uvicorn app.main:app --reload --port 8000

# 터미널 2: 디스코드 봇
cd C:\dev\project\what_the-lab\backend
uv run python -m app.discord_gateway

# 터미널 3: 프론트
cd C:\dev\project\what_the-lab\frontend
npm run dev
```
- `--reload`: 코드를 고치면 서버가 알아서 다시 켜져요. `--port 8000`: 8000번 포트로 열어요.
- 봇 로그에 `명령어 등록: ['요청', '받은요청', '보낸요청', '일정', '일정목록']`이 나오면 돼요.

---

## 3. (구글 캘린더를 쓰는 경우) 예전에 남은 구글 일정 정리

이 PR 전에 완료한 요청(✅), 지난 일정, DB에서 직접 지운 일정은 구글 캘린더에 남아 있을 수 있어요. 한 번 정리하세요.

> ⚠️ **로컬 Docker DB일 때만** 실행하세요. 공용 Supabase를 보고 있을 때 실행하면 다른 팀원 협업의 구글 일정까지 정리돼요. 공용 DB 정리는 리드에게 요청하세요.

```powershell
cd C:\dev\project\what_the-lab\backend
uv run python -m scripts.google_cleanup              # 지울 목록만 보여 줘요 (아무것도 안 지워요)
uv run python -m scripts.google_cleanup --run        # 목록을 확인한 뒤 실제로 지워요
uv run python -m scripts.google_cleanup --collab 3   # 3번 협업 캘린더만
```
- `--run`: 이 옵션이 있을 때만 실제로 지워요. 없으면 목록만 보여 줘요.
- `--collab 번호`: 그 협업의 구글 캘린더만 처리해요.
- 지우는 것: 이 서비스가 넣은 일정(번호가 `lbs` · `lbt` · `lbc`로 시작) 중에서, DB에 없거나 지난 일정, 완료 · 취소 요청, 끝난 협업의 시작일/종료일
- 안 지우는 것: 사람이 구글에서 직접 만든 일정
- `[협업] 협업 시작` · `[협업] 협업 종료일`은 다음 날 아침에 자동으로 들어가요. 바로 넣고 싶으면 협업 화면에서 [구글 캘린더에 추가]를 한 번 더 누르세요.

---

## 4. 확인하기

| # | 할 일 | 확인할 것 |
|---|---|---|
| 1 | 웹: 일정 추가 → 날짜 · 시각 수정 | 채널의 **원래** "일정을 추가했어요" 메시지가 새 내용으로 바뀌고, 상대 멘션이 새로 와요 |
| 2 | 웹 또는 디스코드: 그 일정 삭제 | 원래 메시지가 ~~취소선~~ "🗑 …"로 바뀌어요 |
| 3 | 매주 반복 일정 추가 → 2번째 일정 수정 창에서 "이 날짜 이후 반복 일정도 모두 바꾸기" 체크 후 날짜를 하루 미룸 | 2번째부터 모두 하루씩 밀리고, 알림은 한 번만 와요 |
| 4 | 디스코드 `/일정 종류:미팅` → 날짜에 지난 날(연도 없이) | "이미 지난 날이에요 · 2026.10.30처럼 연도까지" 안내, 저장 안 됨 |
| 5 | 디스코드 `/일정목록` | 일정 제목이 링크 (이 PR 이후에 추가한 일정부터) |
| 6 | 웹 협업 목록 달력 | 지난 일정 · 완료한 요청(✓)이 흐리게 보이고, 범례에 "✓ 완료 · 흐림 = 지난 일정 · 완료". 요청 목록 · 다가오는 일정에는 완료한 요청이 없어요 |
| 7 | 웹: 요청 하나 [완료] | 구글 캘린더에서 그 요청이 사라져요 (15초 안에) |
| 8 | 구글 캘린더 | 지난 일정 · 완료 요청 없이, 앞으로의 일정 · 열린 요청 · `[협업] 협업 종료일`만 보여요 |
| 9 | 다음 날 9시 이후 | 채널 "☀️ **오늘 챙길 일**", 웹 🔔에는 협업마다 ☀️ 한 칸 |

---

## 자주 나는 문제

| 증상 | 원인 | 해결 |
|---|---|---|
| 일정 저장 · 알림 종에서 `column "discord_message_id" does not exist` | 029가 아직 적용 안 됨 | 1번 DB 세팅 (공용 DB면 DB 담당자에게 적용 요청) |
| 아침 브리핑 · 리뷰에서 `violates check constraint "ck_notification_type"` | 028 또는 029의 알림 종류 규칙이 아직 적용 안 됨 | 1-B의 ④ · ⑤ |
| 028 실행 결과가 `ROLLBACK` / `Expected local schema baseline 20261101_23` | 개정 번호 표가 없거나 번호가 다름 | 1-B의 ② |
| 028 실행 중 `ck_notification_type … is violated by some row` | 예전 브랜치에서 생긴 `daily_brief` 알림이 남아 있음 | 1-B의 ③ |
| `npx tsc`에서 `Need to install the following packages: tsc@…`가 뜸 | `frontend` 폴더가 아닌 곳에서 실행함 | `n`을 누르고 `cd frontend`로 이동한 뒤 다시 실행 |
| 디스코드에 `/일정`이 안 보임 | 봇을 다시 안 켰거나 디스코드 앱 캐시 | 봇을 다시 켜고, 디스코드에서 `Ctrl+R` |
| 구글에 완료한 요청이 계속 남아 있음 | 이 PR 전에 완료한 요청 | 3번 정리 스크립트 |

---

## 이번 PR에서 바뀐 파일

| 구분 | 파일 |
|---|---|
| 마이그레이션