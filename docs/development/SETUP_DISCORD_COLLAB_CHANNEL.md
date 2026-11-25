# 협업 디스코드 비공개 채널 — pull 받은 뒤 세팅 안내

> 2026-10-28 · `feature/discord-collaboration` PR 기준
> 이 PR을 받은 뒤 **각자 PC에서 한 번** 따라 하면 됩니다. 5분 정도 걸려요.
> 디스코드 봇·DM 기본 세팅은 [SETUP_NOTIFICATION_PROFILE.md](SETUP_NOTIFICATION_PROFILE.md)를 먼저 끝내 두세요.

## 이번 PR에 들어간 것

협업이 확정되면(연구회원 [협업 시작하기] / 급한 요청은 전문가 수락) 그 협업만의 **디스코드 비공개 채널**이 자동으로 생겨요.

| 기능 | 어디서 보나 | 새로 필요한 것 |
|---|---|---|
| 협업 전용 비공개 채널 `협업-번호` | 디스코드 "협업" 카테고리 | **DB 칸 추가** (`collaboration`에 디스코드 칸 5개) |
| 두 사람 + 봇만 보임, 다른 회원은 안 보임 | 디스코드 | 디스코드 서버 권한 (서버 관리자가 한 번만, 이미 완료) |
| "협업 시작" DM에 💬 채널 링크 + 📅 협업 공간 주소 | 디스코드 DM | 없음 |
| 채널을 모을 카테고리 | `.env` | `DISCORD_COLLAB_CATEGORY_ID` (선택) |

흐름: [협업 시작] → DB에 "채널 만들 차례(pending)"만 표시 → 백엔드가 몇 초 안에 채널 생성 → 두 사람 DM에 링크.
디스코드가 잠깐 안 되면 1분 × 횟수 뒤 다시 시도하고, DM은 최대 3분 기다렸다가 링크 없이라도 보내요.

---

## 0. 먼저 확인: DB 칸이 있어야 해요 ⚠️

칸이 없으면 **디스코드 DM 알림 전체가 멈춰요.** (알림을 보낼 때 협업의 채널 칸을 같이 읽어요)

### 공용 Supabase를 쓰는 경우 (팀 기본)
- **DB 담당자가 마이그레이션 `20261028_15`를 적용한 뒤에** 이 브랜치를 실행하세요.
- 각자 `alembic upgrade`를 실행하지 마세요. 공용 DB는 DB 담당자만 바꿉니다.
- 적용됐는지 확인 (Supabase → SQL Editor):
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'collaboration' AND column_name LIKE 'discord%';
  ```
  5줄이 나오면 OK, 0줄이면 아직이에요.

### 로컬 Docker DB를 쓰는 경우 (`DATABASE_URL`을 비우고 `DB_*` 사용)
이미 데이터가 있는 DB라면 새 SQL 파일 하나만 실행하면 돼요. (DBeaver에서 파일 내용을 실행해도 같아요)
```powershell
cd C:\dev\project\what_the-lab
Get-Content database\init\019_add_collaboration_discord.sql | docker compose exec -T postgres psql -U admin -d labbridge
```
- 012(협업 요청 규칙)·013(협업 테이블)이 아직 없다면 그것부터 순서대로 실행하세요.
- DB를 처음부터 새로 만드는 경우(볼륨 삭제 후 `docker compose up`)에는 `database/init/` 파일이 순서대로 자동 실행돼서 따로 할 일이 없어요.
- 실행하면 진행 중인 협업은 `pending`(서버를 켜면 채널이 생겨요), 끝난 협업은 `skipped`가 돼요.

---

## 1. 코드 받기

```powershell
cd C:\dev\project\what_the-lab
git fetch origin
git switch develop
git pull
```
- 새 라이브러리는 없어요. `uv sync`, `npm install`은 안 해도 돼요.

## 2. `.env`에 카테고리 ID 넣기 (선택)

저장소 맨 위 `.env`의 `DISCORD_GUILD_ID` 아래에 한 줄 추가하세요.
```
DISCORD_COLLAB_CATEGORY_ID=협업카테고리ID
```
- 값은 팀 디스코드 서버의 **"협업" 카테고리 ID**예요. 비밀값이 아니라서 팀 채널에서 물어보면 돼요.
- 직접 찾으려면: 디스코드 사용자 설정 → 고급 → **개발자 모드** 켜기 → "협업" 카테고리 우클릭 → **ID 복사하기**
- 비워 두면 카테고리 밖(서버 맨 아래)에 만들어져요. 비공개는 그대로예요.
- `.env`를 바꾸면 **백엔드를 껐다 켜야** 읽어요.

## 3. 디스코드 서버 설정 (서버 관리자만, 이미 완료)

팀원은 할 일이 없어요. 서버를 새로 만들거나 설정이 바뀌었을 때만 확인하세요.

| 위치 | 대상 | 설정 |
|---|---|---|
| 서버 설정 → 역할 → `LabBridge` (봇 역할) | 봇 | **채널 관리하기 ✓, 역할 관리하기 ✓** |
| "협업" 카테고리 편집 → 권한 | `LabBridge` 봇 | 채널 보기 ✓, 채널 관리하기 ✓, 권한 관리 ✓ |
| "협업" 카테고리 편집 → 권한 | `@everyone` | **채널 보기 ✗**, 나머지 `/` |

- `@everyone`(일반 회원)에게는 채널 관리·역할 관리를 **절대 켜지 마세요.** 아무나 남의 협업 채널에 들어가거나 지울 수 있게 돼요.
- 일반 회원은 아무 권한도 필요 없어요. 봇이 채널마다 두 사람에게만 "보기·쓰기 허용"을 붙여 줘요.

## 4. 처음 한 번: 테스트 채널 정리

이 PR이 머지되면 그동안 테스트하며 생긴 "협업" 카테고리 안의 `협업-번호` 채널을 **서버 관리자가 전부 지우고** 깨끗하게 시작해요.
(채널 우클릭 → 채널 삭제. "협업" 카테고리는 지우지 않아요)

---

## 5. 잘 됐는지 확인

계정 두 개(연구회원·AI 전문가)가 모두 LabBridge 디스코드 서버에 들어가 있어야 해요.

| 확인할 것 | 방법 | 정상 |
|---|---|---|
| 테스트 | `cd backend` → `uv run pytest -q tests/test_discord_channel.py tests/test_discord_dm.py` | 모두 passed |
| 채널 생성 | 연구회원이 **급한 요청** → 전문가 수락 | 몇 초 안에 "협업" 카테고리에 `협업-번호` |
| 채널 주제 | 채널 이름 옆 | 연구 제목 |
| DM 링크 | 두 계정의 디스코드 DM | "OO 님과 협업을 시작했어요" + 💬 채널 링크 + 📅 협업 공간 |
| 링크 | DM의 💬 링크 클릭 | 그 채널이 바로 열림 |
| 비공개 | **관리자가 아닌 제3 계정**으로 확인 | "협업" 카테고리·채널이 안 보임 |

- 서버 주인·관리자 계정은 디스코드 규칙상 **모든 채널이 보여요.** 비공개 확인은 꼭 관리자가 아닌 계정으로 하세요.

---

## 문제가 생기면

채널 상태 보기 (최근 3개):
```sql
SELECT collaboration_id, status, discord_status, discord_channel_id, discord_error, discord_attempts
FROM collaboration ORDER BY collaboration_id DESC LIMIT 3;
```
| `discord_status` | 뜻 |
|---|---|
| `pending` | 만들 차례 (15초 안에 만들어요). `discord_error`가 있으면 실패 후 다시 시도 대기 중 |
| `ready` | 채널 있음. `discord_error`에 `서버 미참가: …`가 있으면 그 사람은 서버에 없어서 못 넣었어요 |
| `failed` | 5번 실패해서 멈춤. `discord_error`에 이유 |
| `skipped` | 일부러 안 만듦 (이미 끝난 협업) |
| `closed` | 협업이 끝나 읽기 전용 (다음 작업에서 사용 예정) |

| 증상 | 원인 · 해결 |
|---|---|
| DM이 전혀 안 감 (모든 알림) | DB 칸이 없어요 → **0번** 확인 |
| 채널이 안 생김, `discord_error`가 비어 있고 `pending` 그대로 | 백엔드가 예전 코드거나 봇 값이 없음 → `git pull` 후 백엔드 재시작, `.env`의 `DISCORD_BOT_TOKEN`·`DISCORD_GUILD_ID` 확인 |
| `discord_error`에 `403 Forbidden` | 봇이 "협업" 카테고리를 못 보거나 권한이 없어요 → **3번** 표대로 카테고리 권한에 봇 추가 |
| `discord_error`에 `404` | 서버 ID나 카테고리 ID가 틀렸어요 → `.env` 확인 |
| DM은 왔는데 💬 링크가 없음 | 채널 만들기가 3분 안에 안 됐어요 → 위 SQL로 이유 확인 |
| 한 사람만 채널이 안 보임 | 그 사람이 LabBridge 서버에 없어요 (`서버 미참가`) → 다시 로그인하면 서버에 들어가요 |

고친 뒤 바로 다시 시도하게 하기 (로컬 DB):
```sql
UPDATE collaboration SET discord_status = 'pending', discord_attempts = 0, discord_retry_at = now()
WHERE discord_status IN ('pending', 'failed');
```

---

## 하면 안 되는 것

- `@everyone`에 채널 관리·역할 관리·채널 보기 켜기 (비공개가 깨져요)
- 공용 Supabase에 각자 `alembic upgrade` 실행하기 (DB 담당자만)
- 봇 토큰을 커밋하거나 단톡방에 올리기
- 테스트 데이터(`collaboration`)만 지우고 디스코드 채널을 남겨 두기
  → 채널이 계속 쌓여요. 협업을 지울 때 `협업-번호` 채널도 같이 지워 주세요. (권한이 없으면 서버 관리자에게 요청)

참고: 팀원마다 DB가 달라 협업 번호가 겹쳐도 채널은 **늘 새로** 만들어요. 이름이 같은 채널이 둘 생길 수는 있지만, 각 채널에는 자기 협업의 두 사람만 들어가서 섞이지 않아요.