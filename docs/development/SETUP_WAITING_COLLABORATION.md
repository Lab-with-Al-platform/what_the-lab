# 시작 전 협업(취소 · 시작일 미루기 · 전문가 요청 받기 규칙) — pull 받은 뒤 세팅 안내

> 2026-11-04 · "시작 전 협업" PR 기준
> 이 PR을 받은 뒤 **각자 PC에서 한 번** 따라 하면 돼요. 5분 정도 걸려요.
> 먼저 끝나 있어야 하는 것: [일정 후속 세팅](SETUP_SCHEDULE_FOLLOWUP.md) (DB `20261104_25`)

## 이번에 들어간 것

요청이 수락되고 협업이 만들어진 뒤 **시작일 전까지**의 규칙이에요.

| 기능 | 웹 | 디스코드 |
|---|---|---|
| 시작 전에는 요청 · 일정 잠금 (서버도 409로 막아요) | 협업 상세에 🔒 카드, 협업 목록 [+ 일정 추가] 잠금 | `/요청` · `/일정` → "협업이 11.9 (월)에 시작돼요" 안내 (나만 보임) |
| 시작 전 안내 상자 (D-n · 채널에서 대화하기 · 시작일 미루기 · 협업 취소) | 협업 상세 맨 위 | — |
| **협업 취소**: 둘 중 누구나, 시작일 전까지. 사유 + 남길 말 필수 | [협업 취소] 창 | 채널에 상대 멘션 → 채널 잠금 → **2일 뒤 채널 삭제** |
| **시작일 미루기**: 한 명이 요청 → 상대 수락. 최대 14일 · 한 번만 · 종료일도 같은 만큼 | [시작일 미루기] 창, 상대 화면에 [수락] [다시 얘기해요] | 채널 메시지 [수락] [다시 얘기해요] 버튼 |
| 시작 하루 전 · 당일 알림 | 🔔 | 아침 브리핑 "🚀 내일 협업이 시작돼요" · "🚀 오늘부터 협업 시작" |
| **전문가 요청 받기 규칙**: 진행 중 · 시작 전 협업이 모두 30일 안에 끝나야 새 요청을 받아요 | 전문가 찾기 "11.9부터 요청 가능", 요청 창에서 막힘 | — |
| 전문가가 다른 협업을 시작하면, 그 전문가의 답 안 한 요청 · 수락해 둔 요청을 자동으로 닫고 연구회원에게 알림 | 🔔 + DM | — |

새로 필요한 것은 **DB 마이그레이션 1개**예요. `.env`에 새로 넣을 값은 없어요.
develop에 함께 들어온 #79(패키지 보안 업데이트) 때문에 `uv sync` · `npm install`은 한 번 해야 해요.

---

## 0. 코드 받기 · 패키지

```powershell
cd C:\dev\project\what_the-lab
git checkout develop
git pull origin develop

cd backend
uv sync
cd ..\frontend
npm install
```
- `uv sync`에서 `Failed to uninstall … certifi … missing RECORD file` 경고가 나오면 `uv sync --reinstall-package certifi`를 한 번 더 실행하세요.
- `npm audit fix`는 실행하지 마세요.

---

## 1. DB가 바뀌어 있어야 해요 ⚠️

DB가 안 바뀐 상태로 이 코드를 켜면 **협업 취소 · 시작일 미루기 · 아침 브리핑 · 요청 자동 닫기**에서 오류가 나요.

| 마이그레이션 | Docker 파일 | 하는 일 |
|---|---|---|
| `20261104_26` | `030_add_waiting_collaboration.sql` | 시작일 미루기 칸(`old_start_date` · `new_start_date`), 요청 닫힘 사유 `expert_busy`, 채널 상태 `deleted`, 알림 종류 7개 |

기존 데이터는 지우거나 바꾸지 않아요.

### 공용 Supabase (팀 기본)
- **DB 담당자가 `20261104_25` → `20261104_26`을 적용한 뒤에** 이 코드를 실행하세요. 각자 `alembic upgrade`는 실행하지 마세요.
- 확인: `SELECT version_num FROM insight_alembic_version;` → `20261104_26`

### 로컬 Docker (`labbridge-postgres`)
`backend\.env`의 DB가 `localhost:5433`인지 먼저 확인하세요.

**① 지금 번호 확인**
```powershell
cd C:\dev\project\what_the-lab
docker exec labbridge-postgres psql -U admin -d labbridge -c "SELECT version_num FROM insight_alembic_version; SELECT to_regclass('public.collaboration_review') AS review_table;"
```

| 나온 번호 | 할 일 |
|---|---|
| `20261104_25` | ②만 하면 돼요 |
| `20261103_24` 또는 더 이전 | [일정 후속 세팅](SETUP_SCHEDULE_FOLLOWUP.md)부터 (028 · 029) |
| `relation "insight_alembic_version" does not exist` | [일정 후속 세팅](SETUP_SCHEDULE_FOLLOWUP.md)의 1-B ②부터 |
| `20261104_26` | 이미 끝났어요 |

**② 030 실행**
```powershell
docker exec labbridge-postgres psql -U admin -d labbridge -f /docker-entrypoint-initdb.d/030_add_waiting_collaboration.sql
docker exec labbridge-postgres psql -U admin -d labbridge -c "SELECT version_num FROM insight_alembic_version;"
```
- `ALTER TABLE` 11개와 `UPDATE 1`이 나오고, 번호가 `20261104_26`이면 성공이에요.
- `-1`이나 `-v ON_ERROR_STOP=1`은 붙이지 마세요.

**새로 만든(빈) Docker 볼륨**이면 컨테이너가 처음 켜질 때 `database/init`을 번호 순서대로 자동으로 실행해요. 할 일 없어요.

---

## 2. 서버 · 봇 다시 켜기

**둘 다** 다시 켜세요. 봇은 다시 켜야 채널의 [수락] [다시 얘기해요] 버튼을 받아요. 채널 삭제(취소 2일 뒤)는 **웹 서버**가 15초마다 확인해요.
```powershell
cd C:\dev\project\what_the-lab\backend
uv run uvicorn app.main:app --reload --port 8000   # 터미널 1
uv run python -m app.discord_gateway               # 터미널 2
```
- `--reload`: 코드를 고치면 서버가 알아서 다시 켜져요. `--port 8000`: 8000번 포트로 열어요.
- 봇에는 서버의 **채널 관리(Manage Channels)** 권한이 있어야 채널을 지울 수 있어요. 채널을 만들 수 있었다면 이미 있어요. `@everyone`에는 이 권한을 주지 마세요.

---

## 3. 확인하기

시작일이 아직 안 된 협업 하나가 필요해요. 요청 → 수락 → [협업 시작] 순서로 만들고, 시작일은 3일 뒤 이후로 고르세요.

| # | 할 일 | 확인할 것 |
|---|---|---|
| 1 | 협업 상세 열기 | 맨 위 "⏳ 시작 전 · D-n" 상자, 요청 · 일정 카드는 🔒 |
| 2 | 디스코드 채널에서 `/요청` · `/일정` | "협업이 ○.○에 시작돼요" 안내 (나만 보임, 입력 창 안 열림) |
| 3 | [시작일 미루기] → 7일 뒤 · 사유 | 상대 🔔 + 채널 멘션 + [수락] [다시 얘기해요] 버튼 |
| 4 | 상대가 채널 [수락] (또는 웹 [수락]) | 시작일 · 종료일이 7일씩 밀림, 채널 "협업 기간이 … 로 바뀌었어요", [시작일 미루기]는 이제 잠김 |
| 5 | 다른 연구회원 계정으로 그 전문가에게 협업 요청 | "이 전문가는 ○.○부터 새 협업 요청을 받을 수 있어요" |
| 6 | [협업 취소] → 사유 + 남길 말 | 상대 🔔 + 채널 "❌ … 협업을 취소했어요 · 2일 뒤 삭제", 채널 쓰기 막힘, 상세 "취소" |
| 7 | 채널 삭제 바로 보기 (아래 명령, **로컬 DB만**) | 15초 안에 디스코드 채널이 지워지고 상세의 [디스코드 채널] 버튼이 사라짐 |

```powershell
docker exec labbridge-postgres psql -U admin -d labbridge -c "UPDATE collaboration SET discord_delete_at = now() WHERE status = 'canceled' AND discord_status = 'closed';"
```

---

## 자주 나는 문제

| 증상 | 원인 | 해결 |
|---|---|---|
| 취소 · 미루기에서 `violates check constraint "ck_change_kind"` 또는 `column "new_start_date" does not exist` | 030이 아직 적용 안 됨 | 1번 DB 세팅 (공용 DB면 DB 담당자에게 요청) |
| 아침 브리핑 · 취소 알림에서 `violates check constraint "ck_notification_type"` | 030이 아직 적용 안 됨 | 1번 DB 세팅 |
| 채널 [수락] 버튼을 눌러도 "상호작용 실패" | 봇을 다시 안 켬 | 봇 다시 켜기 |
| 취소한 지 2일이 지났는데 채널이 그대로 | 웹 서버가 꺼져 있었거나 봇에 채널 관리 권한이 없음 | 웹 서버를 켜 두세요. DB의 `discord_error`에 `채널 삭제 실패: …`가 있으면 봇 권한 확인 |
| 시작 전 협업인데 일정이 이미 하나 있음 | 이 규칙이 생기기 전에 넣은 일정 | 시작 전에도 **삭제**는 할 수 있어요 |

---

## 바뀐 파일

| 구분 | 파일 |
|---|---|
| 마이그레이션 | `backend/migrations/versions/20261104_26_waiting_collaboration.py` · `backend/migrations/sql/20261104_26/` · `database/init/030_add_waiting_collaboration.sql` |
| 시작 전 규칙 (새) | `backend/app/collab_waiting.py` · `backend/app/routers/workspace_waiting.py` · `backend/app/discord_waiting.py` |
| 잠금 | `workspace_store.py` (`check_started` · `expire_changes`) · `routers/workspace.py` · `routers/workspace_tasks.py` · `discord_gateway.py` · `discord_schedule.py` |
| 전문가 요청 받기 | `routers/collab_requests.py` · `request_rules.py` · `expert_search_store.py` |
| 알림 · 채널 | `notification_store.py` · `task_daily.py` · `task_text.py` · `collab_channel.py` · `discord_bot.py` · `notification_sender.py` · `google_sync.py` · `workspace_detail.py` · `main.py` |
| 웹 | `components/workspace-waiting.tsx` (새) · `workspace-detail-head.tsx` · `workspace-detail-page.tsx` · `workspace-home.tsx` · `workspace-calendar.tsx` · `collab-request-dialog.tsx` · `lib/workspace-detail.ts` · `lib/expert-search.ts` |
| 테스트 | `tests/test_collab_waiting.py` (새) |