# 진행 중 협업 마무리(기간 연장 · 조기 완료 · 협업 중단) — pull 받은 뒤 세팅 안내

> 2026-11-04 · `feature/collab-ending` 기준
> 이 작업을 받은 뒤 **각자 PC에서 한 번** 따라 하면 돼요. 5분 정도 걸려요.
> 먼저 끝나 있어야 하는 것: [시작 전 협업 세팅](SETUP_WAITING_COLLABORATION.md) (DB `20261104_26`)

## 이번에 들어간 것

시작일이 지난 **진행 중 협업**을 마무리하는 기능이에요. 조작은 **웹에서만** 하고, 디스코드는 알림만 보내요(웹 링크).
시작 전 단계의 시작일 미루기만 기존처럼 디스코드 버튼이 있어요.

협업 상세 오른쪽 위 **[⋯]** 메뉴:

| 기능 | 누가 | 규칙 |
|---|---|---|
| ⏩ **기간 연장 요청** | 한 명이 요청 → 상대 [수락] / [다시 얘기해요] | 새 종료일 + 사유 필수. 한 번에 최대 30일, 여러 번 가능 |
| ✅ **조기 완료 요청** | 한 명이 요청 → 상대 [수락하고 완료] / [다시 얘기해요] | 진행 중인 요청 0개 + 남은 일정 0개일 때만 눌려요 (아니면 회색 + 이유). 수락하면 '완료' |
| ⛔ **협업 중단** | 한 명이 바로 | 사유(5개 중 선택) + 남길 말 필수. "○○ 님이 중단" 기록 |

- 답을 기다리는 요청은 협업마다 **하나**예요. 답 기한은 3일 (종료일이 더 빠르면 종료일 다음 날 0시까지)
- [다시 얘기해요]는 거절과 같아요. 연장 · 조기 완료에는 철회가 없어요 (기한이 지나면 자동으로 닫혀요)

알림 · 채널:

| 언제 | 웹 | 디스코드 |
|---|---|---|
| 연장 · 조기 완료 요청과 답 | 🔔 + 상세 상자에 [수락] [다시 얘기해요] | 채널에 상대 멘션 + 웹 링크 (버튼 없음) |
| 종료 7일 전 | 🔔 아침 브리핑, 상세에 "기간이 더 필요하면 ⋯ → 기간 연장" | 아침 브리핑 "🗓 협업이 ○.○에 끝나요 (7일 남음)" |
| 협업이 끝남 (자동 완료 · 조기 완료 · 중단) | 상세에 어떻게 끝났는지, 평가 카드 | 마지막 메시지(평가 안내) → 채널 잠금 → **2일 뒤 삭제** |

평가:

| 끝난 방법 | 평가 |
|---|---|
| 완료 · 조기 완료 | 두 사람 다 |
| 중단 | **중단당한 사람만** (중단한 사람은 "평가 없음") |
| 전문가가 중단한 협업에서 연구회원이 남긴 평가 | 공개 평점 · LAB TRUST에 반영돼요 |

새로 필요한 것은 **DB 마이그레이션 1개**예요. `.env`에 새로 넣을 값은 없고, 새 패키지도 없어요.

---

## 1. DB가 바뀌어 있어야 해요 ⚠️

DB가 안 바뀐 상태로 이 코드를 켜면 **기간 연장 · 조기 완료 · 중단 · 7일 전 아침 브리핑**에서 알림을 저장하다가 오류가 나요.

| 마이그레이션 | Docker 파일 | 하는 일 |
|---|---|---|
| `20261104_27` | `031_add_collab_ending.sql` | 알림 종류 7개 추가 (`extend_requested` · `extend_accepted` · `extend_declined` · `complete_requested` · `complete_declined` · `collab_stopped` · `collab_week_left`) |

표 구조는 바꾸지 않고, 기존 데이터도 지우거나 바꾸지 않아요.

### 공용 Supabase (팀 기본)
- **DB 담당자가 `20261104_26` → `20261104_27`을 적용한 뒤에** 이 코드를 실행하세요. 각자 `alembic upgrade`는 실행하지 마세요.
- 확인: `SELECT version_num FROM insight_alembic_version;` → `20261104_27`

### 로컬 Docker (`labbridge-postgres`)
`backend\.env`의 DB가 `localhost:5433`인지 먼저 확인하세요.
```powershell
cd C:\dev\project\what_the-lab
docker exec labbridge-postgres psql -U admin -d labbridge -f /docker-entrypoint-initdb.d/031_add_collab_ending.sql
docker exec labbridge-postgres psql -U admin -d labbridge -c "SELECT version_num FROM insight_alembic_version;"
```
- `ALTER TABLE` 2개와 `UPDATE 1`이 나오고, 번호가 `20261104_27`이면 성공이에요.
- 번호가 `20261104_26`에 그대로면 030을 아직 안 한 거예요. [시작 전 협업 세팅](SETUP_WAITING_COLLABORATION.md)부터 하세요.
- `-1`이나 `-v ON_ERROR_STOP=1`은 붙이지 마세요.

---

## 2. 서버 · 봇 다시 켜기

**둘 다** 다시 켜세요. 끝난 협업의 채널 정리(마지막 메시지 → 잠금 → 2일 뒤 삭제)는 **웹 서버**가 15초마다 확인해요.
```powershell
cd C:\dev\project\what_the-lab\backend
uv run uvicorn app.main:app --reload --port 8000   # 터미널 1
uv run python -m app.discord_gateway               # 터미널 2
```

테스트도 한 번 돌려 보세요.
```powershell
cd C:\dev\project\what_the-lab\backend
uv run pytest -q
cd ..\frontend
npx tsc --noEmit
```

---

## 3. 확인하기

**시작일이 지난 진행 중 협업**이 필요해요 (상세 맨 위 배지가 "진행 중"). 연구회원 · 전문가 두 계정으로 번갈아 열어 보세요.

| # | 할 일 | 확인할 것 |
|---|---|---|
| 1 | 상세 오른쪽 위 [⋯] | 기간 연장 · 조기 완료 · (구분선) · 빨간 협업 중단 |
| 2 | 열린 요청이나 남은 일정이 있을 때 [⋯] | 조기 완료가 회색 + "진행 중인 요청 n개 …" 이유 |
| 3 | [기간 연장 요청] → 14일 뒤 · 사유 | 상대 🔔 + 채널 멘션(웹 링크), 상대 상세에 [수락] [다시 얘기해요], 내 [⋯]의 연장 · 조기 완료는 잠김 |
| 4 | 상대가 [수락] | 종료일 · 타임라인이 바뀜, 채널 "협업이 ○.○까지로 바뀌었어요" |
| 5 | 다시 연장 요청 → 상대가 [다시 얘기해요] + 이유 | 요청한 사람 🔔에 이유, 채널 "💬 … 다시 얘기해요" |
| 6 | 요청 · 일정을 다 끝내거나 지움 → [조기 완료 요청] → 상대 [수락하고 완료] | 상태 "완료", 두 사람 평가 카드 "평가 작성 가능", 15초 안에 채널 🎉 메시지 + 쓰기 막힘 |
| 7 | (다른 협업) [협업 중단] → 사유 + 남길 말 | 상대 🔔, 채널 ⛔ 메시지 + 쓰기 막힘, 상세 "○○ 님이 협업을 중단했어요 · 사유" |
| 8 | 7의 평가 카드 | 중단한 사람 "평가 없음", 상대는 사유가 보이고 평가 가능 |
| 9 | 2일 뒤 (또는 DB에서 `discord_delete_at`을 지난 시각으로) | 디스코드 채널이 지워지고 상세의 [디스코드 채널] 버튼이 사라짐 |

- 6 · 7번은 되돌릴 수 없어요. **로컬 Docker DB의 테스트 협업으로만** 하세요.
- 9번을 바로 보고 싶으면 (로컬만):
  ```powershell
  docker exec labbridge-postgres psql -U admin -d labbridge -c "UPDATE collaboration SET discord_delete_at = now() - interval '1 minute' WHERE collaboration_id = 협업번호;"
  ```

### 테스트 데이터 다시 비우기 (로컬만)
협업은 두고 안의 요청 · 일정 · 기간 변경 · 협업 알림만 지워요. `notification_setting`(알림 설정)은 건드리지 않아요.
```powershell
docker exec labbridge-postgres psql -U admin -d labbridge -c "DELETE FROM collaboration_task; DELETE FROM collaboration_schedule; DELETE FROM collaboration_change; DELETE FROM notification WHERE collaboration_id IS NOT NULL;"
cd C:\dev\project\what_the-lab\backend
uv run python -m scripts.google_cleanup         # 지울 목록만 보기
uv run python -m scripts.google_cleanup --run   # 구글에 남은 일정 지우기
```

---

## 바뀐 파일

| 구분 | 파일 |
|---|---|
| 마이그레이션 | `backend/migrations/versions/20261104_27_collab_ending.py` · `backend/migrations/sql/20261104_27/` · `database/init/031_add_collab_ending.sql` |
| 마무리 규칙 (새) | `backend/app/collab_ending.py` |
| API | `backend/app/routers/workspace_waiting.py` ([수락] · [다시 얘기해요]를 시작일 미루기 · 연장 · 조기 완료가 같이 써요) |
| 알림 · 채널 | `notification_store.py` · `notification_sender.py` · `task_daily.py` · `task_text.py` |
| 평가 (#77) | `review_store.py` · `reputation_store.py` |
| 웹 | `components/workspace-ending.tsx` (새) · `workspace-detail-head.tsx` · `collaboration-review-card.tsx` · `lib/workspace-detail.ts` · `lib/reviews.ts` |
| 테스트 | `tests/test_collab_ending.py` (새) |