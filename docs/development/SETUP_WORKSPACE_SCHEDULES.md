# 협업 일정(시각 · 알림 · /일정 · 구글 버튼) — pull 받은 뒤 세팅 안내

> 2026-11-02 · `feature/discord-schedules` PR 기준
> 이 PR을 받은 뒤 **각자 PC에서 한 번** 따라 하면 돼요. 5분 정도 걸려요.
> 요청 기능 세팅([SETUP_WORKSPACE_TASKS.md](SETUP_WORKSPACE_TASKS.md))을 먼저 끝내 두세요. (DB `20261031_22` 까지)

## 이번 PR에 들어간 것

| 기능 | 웹 | 디스코드 |
|---|---|---|
| 일정 **시각** 입력 (하루짜리 미팅 · 기타만, 선택) | 일정 창의 시각 칸 (목록 · 상세 둘 다) | `/일정` 입력 창 |
| 일정 추가 · 날짜/시각 변경 · 삭제 → **상대에게 알림** | 🔔 | 협업 채널 멘션 (휴대폰 푸시) + [일정 관리] 버튼 |
| 제목 · 메모만 고침 → 상대 🔔 에만 (폰은 안 울려요) | 🔔 | — |
| 아침 브리핑에 일정: 내일 시작 · 오늘 · 내일 끝남(여러 날 일정) → 두 사람 | 🔔 | 협업 채널 "☀️ 오늘 챙길 일" |
| `/일정` (종류 고르기 · 매주반복) · `/일정목록` (2주 · 드롭다운으로 수정 · 삭제) | — | 협업 채널 |
| 협업 목록 달력 위 [📅 구글 캘린더], "지금 할 일"의 [구글 캘린더에 추가] 동작 | 협업 목록 | — |
| 구글 캘린더: 끝 시각을 비우면 1시간짜리로 (전에는 0분 일정) | — | — |

새로 필요한 것은 **DB 마이그레이션 1개**예요. `.env` 에 새로 넣을 값은 없어요.

---

## 0. 먼저: DB가 바뀌어 있어야 해요 ⚠️

DB가 안 바뀐 상태로 이 코드를 켜면 **일정 추가 · 수정 · 삭제와 알림 종이 오류**가 나요. (알림 표의 새 칸 `schedule_id` · `note` 를 써요)

| 마이그레이션 | 하는 일 |
|---|---|
| `20261101_23` | 알림 표에 `schedule_id` · `note` 칸, 일정 알림 종류 7개, 아침 알림 중복 막기에 일정 포함 |

기존 데이터는 지우거나 바꾸지 않아요. 일정 표(`collaboration_schedule`)는 그대로예요. (시각 칸은 처음부터 있었어요)

### 공용 Supabase를 쓰는 경우 (팀 기본)
- **DB 담당자가 `20261031_22` → `20261101_23` 을 적용한 뒤에** 이 코드를 실행하세요.
- 각자 `alembic upgrade` 를 실행하지 마세요. 공용 DB는 DB 담당자만 바꿔요.
- 적용됐는지 확인 (Supabase → SQL Editor):
  ```sql
  SELECT version_num FROM insight_alembic_version;
  ```
  `20261101_23` 이면 OK예요.

### 로컬 Docker DB를 쓰는 경우 (`labbridge-postgres` 컨테이너)
이미 데이터가 있는 DB는 init 폴더의 새 파일이 자동으로 실행되지 않아요. 직접 한 번 실행하세요.
```powershell
cd C:\dev\project\what_the-lab
docker exec labbridge-postgres psql -U admin -d labbridge -f /docker-entrypoint-initdb.d/027_add_schedule_notifications.sql
```
- `ALTER TABLE` 3개 · `DROP INDEX` · `CREATE INDEX` 2개가 나오면 성공이에요.
- 마지막에 `relation "public.insight_alembic_version" does not exist` 가 나오면 무시하세요. 로컬 DB에는 개정 번호 표가 없어서 그 한 줄만 실패해요. (025 · 026 때와 같아요)
- **`-1` 이나 `-v ON_ERROR_STOP=1` 을 붙이지 마세요.** 그 한 줄 실패 때문에 전부 취소돼요.

---

## 1. 서버 · 봇 다시 켜기

새 코드는 다시 켜야 반영돼요. **둘 다** 켜 두세요.

```powershell
# 터미널 1: 웹 서버 (평소처럼)
# 터미널 2: 디스코드 봇
cd C:\dev\project\what_the-lab\backend
uv run python -m app.discord_gateway
```
봇 로그에 `명령어 등록: ['요청', '받은요청', '보낸요청', '일정', '일정목록']` 이 나오면 돼요.
디스코드에서 `/일정` 이 안 보이면 디스코드 앱을 새로고침(`Ctrl+R`) 하세요.

- 구글 캘린더 반영은 **웹 서버**가 15초마다 해요. 디스코드에서 넣은 일정도 웹 서버가 켜져 있어야 구글에 들어가요.

---

## 2. 디스코드에서 적는 법

**날짜** (요청 기한과 같은 규칙): `11.5` · `11월 5일` · `내일` · `3일 뒤` · `다음 주 목요일`
**기간** (작업 기간): `11.3~11.7` · `내일~다음 주 금요일`
**시각** (미팅 · 기타, 비워도 됨): `14:00` · `14:00~15:30` · `오후 2시` · `오후 2시~3시 반` · `2pm` · `10am~11:30am`

- `2` 처럼 숫자만 쓰면 오전/오후를 몰라서 다시 적어 달라고 해요.
- 끝 시각에 오전/오후(am/pm)가 없으면 시작과 같은 쪽으로 봐요 (`오후 2시~3시` → 14:00~15:00).

---

## 3. 확인하기

| # | 할 일 | 확인할 것 |
|---|---|---|
| 1 | 웹: 협업 목록 [+ 일정 추가] → 미팅, 14:00~15:00 | 달력에 `14:00 일정명`, 상대 🔔 "일정을 추가했어요", 채널에 상대 멘션 + [일정 관리] |
| 2 | 웹: 시각을 16:00 으로 수정 | 상대 🔔 · 채널 "14:00~15:00 → 16:00" |
| 3 | 웹: 메모만 수정 | 상대 🔔 "일정 내용을 고쳤어요" (채널엔 안 올라감) |
| 4 | 디스코드: `/일정 종류:미팅` → `11.5` · `오후 2시` | 나에게 "✅ 일정을 추가했어요", 채널에 상대 멘션, 웹 달력에 보임 |
| 5 | 채널 메시지 [일정 관리] → [수정] / [삭제] | 웹에도 반영, 채널에 상대 멘션 |
| 6 | 디스코드: `/일정목록` | 2주 일정 + 드롭다운 → 고르면 [수정] [삭제] [← 목록으로] |
| 7 | 웹: 협업 목록 | 구글에 추가한 협업이 있으면 달력 위 [📅 구글 캘린더] |
| 8 | 다음 날 9시 이후 | 채널 "☀️ **오늘 챙길 일**" 에 내일/오늘 일정 줄 (두 사람 멘션) |

---

## 이번 PR에서 바뀐 파일

| 구분 | 파일 |
|---|---|
| 마이그레이션 | `backend/migrations/versions/20261101_23_*` · `backend/migrations/sql/20261101_23/` · Docker `database/init/027` |
| 일정 알림 | `backend/app/schedule_notice.py` (새) · `notification_store.py` · `task_daily.py` · `task_text.py` |
| 일정 저장 (웹 · 디스코드 공통) | `backend/app/routers/workspace.py` (`save_schedule` · `edit_schedule` · `remove_schedule`) |
| 디스코드 | `backend/app/discord_schedule.py` (새) · `discord_gateway.py` |
| 구글 | `backend/app/google_calendar.py` (끝 시각 없으면 1시간) |
| 웹 | `workspace-schedule-dialog.tsx` (시각) · `workspace-calendar.tsx` · `workspace-home.tsx` (구글 버튼) · `workspace-detail-head.tsx` (타임라인 시각) · `lib/notifications.ts` · `lib/workspace.ts` |
| 테스트 | `test_schedule_notice.py` (새) · `test_discord_schedule.py` (새) · `test_google_calendar.py` · `test_workspace_router.py` · `test_task_daily.py` · `test_community_integration.py` |