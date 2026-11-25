# 협업 요청(기록 · 기한 수정 요청 · 다시 요청 · 알림) — pull 받은 뒤 세팅 안내

> 2026-11-01 · `feature/discord-schedule` PR 기준
> 이 PR을 받은 뒤 **각자 PC에서 한 번** 따라 하면 돼요. 10분 정도 걸려요.
> 디스코드 봇 · 협업 채널 · 구글 캘린더 기본 세팅은 [SETUP_DISCORD_COLLAB_CHANNEL.md](SETUP_DISCORD_COLLAB_CHANNEL.md), [SETUP_GOOGLE_CALENDAR.md](SETUP_GOOGLE_CALENDAR.md)를 먼저 끝내 두세요.

## 이번 PR에 들어간 것

협업 상세의 **요청**이 양방향이 되고, 무엇이든 기록과 알림이 남아요. 웹과 디스코드 어디서 눌러도 똑같이 동작해요.

| 기능 | 누가 | 웹 | 디스코드 |
|---|---|---|---|
| 기한 수정 요청 ([기한 얘기하기]) | 받은 사람 | 요청 줄 버튼 | [요청 관리] 패널 |
| 답하기: [기한 변경] (요청한 날이 미리 채워짐) / [지금 기한 유지] | 보낸 사람 | 주황 상자 안 버튼 | [요청 관리] 패널 |
| 다시 요청 (완료된 요청 → 진행 중, 이유 필수) | 보낸 사람 | 완료 줄 버튼 | [요청 관리] 패널 |
| 요청 기록 (누가 · 언제 · 무엇을 · 웹/디스코드) | 둘 다 | 요청 줄의 [기록 N ▾] | — |
| 알림: 협업 채널 멘션(휴대폰 푸시) + 웹 알림 종 | 상대 | 헤더 🔔 | 협업 채널 |
| `/받은요청` · `/보낸요청` (나만 보이는 목록 + 드롭다운으로 바로 처리) | 둘 다 | — | 협업 채널 |
| 아침 브리핑 (매일 9시 이후 한 번) | 해당하는 사람 | 🔔 | 협업 채널 |
| 협업이 끝날 때 열린 요청은 "협업 종료로 마감(미완료)" 기록 | 자동 | 요청 줄 표시 | — |
| 디스코드 · 구글이 잠깐 안 되면 2초 뒤 한 번 더 시도, 매일 아침 다시 맞추기 | 자동 | — | — |

새로 필요한 것은 **DB 마이그레이션 2개뿐**이에요. `.env` 에 새로 넣을 값은 없어요.

---

## 0. 먼저 확인: DB가 바뀌어 있어야 해요 ⚠️

DB가 안 바뀐 상태로 이 코드를 켜면 **협업 상세 · 알림 종 · 요청 버튼이 모두 오류**가 나요. (새 표 `collaboration_task_event`, 알림 표의 새 칸을 읽어요)

| 마이그레이션 | 하는 일 |
|---|---|
| `20261031_21` | 요청 기록 표 `collaboration_task_event` 새로 만들기 + 기존 요청의 남김 · 완료/취소 기록 채우기 |
| `20261031_22` | 알림 표에 `task_id` · `collaboration_id` · `notice_on` 칸 + 요청 알림 종류 추가, 기록 종류 `due_kept` · `ended` 추가 |

둘 다 기존 데이터를 지우거나 바꾸지 않아요.

### 공용 Supabase를 쓰는 경우 (팀 기본)
- **DB 담당자가 `20261031_21` → `20261031_22` 를 적용한 뒤에** 이 코드를 실행하세요.
- 각자 `alembic upgrade` 를 실행하지 마세요. 공용 DB는 DB 담당자만 바꿔요.
- 적용됐는지 확인 (Supabase → SQL Editor):
  ```sql
  SELECT to_regclass('public.collaboration_task_event') AS task_event,
         (SELECT count(*) FROM information_schema.columns
          WHERE table_name = 'notification' AND column_name IN ('task_id', 'collaboration_id', 'notice_on')) AS new_columns;
  ```
  `task_event` 가 `collaboration_task_event`, `new_columns` 가 `3` 이면 OK예요.

### 로컬 Docker DB를 쓰는 경우 (`labbridge-postgres` 컨테이너)
이미 데이터가 있는 DB는 init 폴더의 새 파일이 자동으로 실행되지 않아요. **순서대로 두 번** 직접 실행하세요.
```powershell
cd C:\dev\project\what_the-lab
docker exec labbridge-postgres psql -U admin -d labbridge -f /docker-entrypoint-initdb.d/025_add_task_events.sql
docker exec labbridge-postgres psql -U admin -d labbridge -f /docker-entrypoint-initdb.d/026_add_task_notifications.sql
```
- `database/init` 폴더가 컨테이너 안 `/docker-entrypoint-initdb.d` 에 연결돼 있어서 파일을 복사할 필요가 없어요.
- `CREATE TABLE` · `ALTER TABLE` · `INSERT 0 숫자` 가 오류 없이 나오면 성공이에요.
- `already exists` 가 나오면 이미 적용된 거라 괜찮아요.
- `No such container` 면 Docker가 꺼져 있어요. `docker compose up -d` 를 먼저 하세요.

확인:
```powershell
docker exec labbridge-postgres psql -U admin -d labbridge -c "\d collaboration_task_event" -c "SELECT version_num FROM insight_alembic_version;"
```
표의 칸 목록이 나오고, 개정 번호가 `20261031_22` 면 OK예요.

---

## 1. 서버 다시 켜기

| 터미널 | 폴더 | 명령 | 확인 |
|---|---|---|---|
| 백엔드 | `backend` | `uv run uvicorn app.main:app --reload` | 오류 없이 켜짐. 아침 브리핑도 여기서 같이 돌아요 |
| 디스코드 봇 | `backend` | `uv run python -m app.discord_gateway` | `명령어 등록: ['요청', '받은요청', '보낸요청']` |
| 웹 | `frontend` | `npm run dev` | — |

- 봇을 **다시 켜야** `/받은요청` · `/보낸요청` 이 등록돼요.
- 디스코드에서 새 명령어가 안 보이면 디스코드 앱을 `Ctrl+R` 로 새로고침하세요.

---

## 2. 동작 확인 (연구원 · 전문가 두 계정)

| 순서 | 할 것 | 디스코드 채널 | 웹 🔔 |
|---|---|---|---|
| 1 | 연구원: 요청 남기기 (기한 넣기) | 요청 메시지가 @전문가 | 전문가: 📌 |
| 2 | 전문가: [기한 얘기하기] (날짜 + 이유) | 🗓 @연구원 기한 수정을 요청했어요 | 연구원: 🗓 |
| 3 | 연구원: 주황 상자 [지금 기한 유지] | 📌 @전문가 지금 기한을 유지하기로 했어요 | 전문가: 📌 |
| 4 | 전문가: 다시 기한 얘기 → 연구원: [기한 변경] | 창에 **요청한 날이 채워져** 있고, 저장하면 📅 @전문가 | 전문가: 📅 |
| 5 | 전문가 [완료] → 연구원 [다시 요청] | ✅ @연구원 → ↩️ @전문가 | 각각 상대 |
| 6 | 연구원 [취소] → [되돌리기] | 🚫 @전문가 → ↩️ @전문가 | 전문가 |
| 7 | 디스코드 `/받은요청` → [처리할 요청 고르기 ▾] | 같은 메시지가 그 요청의 패널로 바뀜 | — |
| 8 | 웹 🔔 에서 알림 누르기 | — | 협업 상세의 **그 요청 줄**로 이동, 테두리 강조 |

---

## 3. 알림 규칙 (누가 · 어디로)

**한 사람이 한 일은 상대에게만** 가요. 협업 안의 일은 DM을 보내지 않아요.

| 일 | 받는 사람 | 협업 채널 멘션 (휴대폰 푸시) | 웹 🔔 | 디스코드 DM |
|---|---|---|---|---|
| 새 요청 | 받은 사람 | ✅ (요청 메시지) | ✅ | — |
| 완료 | 보낸 사람 | ✅ | ✅ | — |
| 기한 변경 · 지금 기한 유지 · 취소 · 다시 요청 | 받은 사람 | ✅ | ✅ | — |
| 기한 수정 요청 | 보낸 사람 | ✅ | ✅ | — |
| 되돌리기 | 상대 | ✅ | ✅ | — |
| 아침 브리핑 | 해당하는 사람 | ✅ (한 메시지로 묶음) | ✅ | — |
| 매칭 단계 (협업 요청 받음 · 수락 · 거절 · 협업 시작) | 지금과 같음 | — | ✅ | ✅ |

휴대폰 푸시는 디스코드 앱이 멘션을 보내 주는 방식이에요. PC 디스코드를 쓰고 있으면 PC에 먼저 오고, 한동안 안 쓰면 휴대폰으로 와요. 서버를 음소거했거나 "알림 없음"이면 오지 않아요.

---

## 4. 아침 브리핑

- 백엔드가 켜져 있으면 **매일 한국 시간 9시 이후 처음 한 번** 돌아요. 9시 이후에 서버를 켜면 1분 안에 돌아요.
- 넣는 것
  - 기한 내일 · 오늘
  - 기한 지남 (다음 날 한 번, 그 뒤로 주 1회)
  - 답 없는 기한 수정 요청 (1일 · 3일째)
  - 협업 종료 3일 전 (열린 요청이 있을 때)
- 보낼 게 없는 협업 채널에는 아무것도 안 보내요.
- 같은 날 서버를 다시 켜도 **다시 안 가요.** DB의 `uq_notification_daily` 가 막아요.
- 같은 때 진행 중 요청의 디스코드 메시지와 구글 일정을 지금 DB 상태로 다시 맞춰요. 멘션은 보내지 않아요.

---

## 5. 자주 나는 문제

| 증상 | 원인 | 해결 |
|---|---|---|
| 협업 상세에서 `relation "collaboration_task_event" does not exist` | 마이그레이션 21이 안 됨 | 0번 다시 |
| 알림 종이 안 열리거나 `column n.task_id does not exist` | 마이그레이션 22가 안 됨 | 0번의 026 실행 |
| `/받은요청` 이 디스코드에 안 보임 | 봇을 다시 안 켰거나 디스코드 캐시 | 봇 재시작 → 디스코드 `Ctrl+R` |
| 드롭다운에서 골랐는데 "적시에 응답하지 않았어요" | 예전 코드로 봇을 켬 | 최신 pull 후 봇 재시작 |
| 채널 멘션은 오는데 휴대폰 푸시가 안 옴 | 디스코드 서버 음소거 · 알림 설정 | 디스코드 서버 알림을 "@멘션만"으로 |
| 협업 채널에 아무 알림이 없음 | 봇 설정이 없거나(`DISCORD_BOT_TOKEN`) 아직 채널이 없는 협업 | [SETUP_DISCORD_COLLAB_CHANNEL.md](SETUP_DISCORD_COLLAB_CHANNEL.md) |

---

## 6. 코드 지도

| 무엇 | 파일 |
|---|---|
| 요청 규칙 (웹 · 봇 공통 함수, 기록 · 종 알림 저장) | `backend/app/routers/workspace_tasks.py` |
| 입력 규칙 (TaskInput · TalkInput · KeepInput · ReturnInput) | `backend/app/workspace_rules.py` |
| 디스코드 채널 · 구글 반영, 재시도, 다시 맞추기 | `backend/app/task_sync.py` |
| 디스코드 메시지 글자 (알림 한 줄 · 목록 · 브리핑) | `backend/app/task_text.py` |
| 디스코드 봇 (패널 · 입력 창 · `/받은요청` 드롭다운) | `backend/app/discord_gateway.py` |
| 아침 브리핑 | `backend/app/task_daily.py` (`app/main.py` 에서 시작) |
| 알림 종 저장 · 문구 · 링크 | `backend/app/notification_store.py` |
| 협업 상세 응답 (요청마다 기록 · 표시) | `backend/app/workspace_detail.py` |
| "답할 차례" 계산 (목록 · 봇) | `backend/app/workspace_store.py` 의 `TASK_FLAG_SQL` |
| 웹 요청 카드 · 창 | `frontend/src/components/workspace-detail-work.tsx` |
| 웹 알림 종 종류 · 아이콘 | `frontend/src/lib/notifications.ts` |
| 마이그레이션 | `backend/migrations/versions/20261031_21_*`, `20261031_22_*` · Docker `database/init/025`, `026` |