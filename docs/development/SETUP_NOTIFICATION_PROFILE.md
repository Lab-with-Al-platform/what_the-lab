# 알림 · 디스코드 DM · 프로필 설정 — pull 받은 뒤 세팅 안내

> 2026-10-26 · `feature/expert-detail` PR 기준
> 이 PR을 받은 뒤 **각자 PC에서 한 번** 따라 하면 됩니다. 10분 정도 걸려요.

## 이번 PR에 들어간 것

| 기능 | 화면 | 새로 필요한 것 |
|---|---|---|
| AI 전문가 상세 | `/experts/{id}` | 없음 |
| 알림 (사이트 안 종) | 헤더 종 아이콘 | **DB 테이블 2개** (`notification`, `notification_setting`) |
| 디스코드 DM 알림 | 디스코드 앱 | 봇 토큰 · 서버 ID (`.env`), **다시 로그인** |
| 프로필 설정 | `/settings/profile` | 사진 처리 라이브러리 `pillow` (`uv sync`) |

---

## 0. 먼저 확인: DB 테이블이 있어야 해요 ⚠️

알림 테이블이 없으면 **알림 화면뿐 아니라 협업 요청 보내기·수락·거절도 500 에러**가 나요.
요청을 처리할 때 알림을 같이 저장하기 때문이에요.

### 공용 Supabase를 쓰는 경우 (팀 기본)
- **장반석 님이 마이그레이션 `20261025_06`을 적용한 뒤에** 이 브랜치를 실행하세요.
- 각자 `alembic upgrade`를 실행하지 마세요. 공용 DB는 DB 담당자만 바꿉니다.
- 적용됐는지 확인 (Supabase → SQL Editor):
  ```sql
  SELECT to_regclass('public.notification'), to_regclass('public.notification_setting');
  ```
  두 칸 모두 이름이 나오면 OK, `NULL`이면 아직이에요.

### 로컬 Docker DB를 쓰는 경우 (`DATABASE_URL`을 비우고 `DB_*` 사용)
이미 데이터가 있는 DB라면 새 SQL 파일 하나만 실행하면 돼요.
```powershell
cd C:\dev\project\what_the-lab
Get-Content database\init\008_create_notification.sql | docker compose exec -T postgres psql -U admin -d labbridge
```
- `postgres`는 `docker-compose.yml`의 서비스 이름이에요. 다르면 그 이름으로 바꿔요.
- DB를 처음부터 새로 만드는 경우(볼륨 삭제 후 `docker compose up`)에는 `database/init/` 파일이 순서대로 자동 실행돼서 따로 할 일이 없어요.

---

## 1. 코드 받기

```powershell
cd C:\dev\project\what_the-lab
git fetch origin
git switch develop
git pull
```
- PR이 머지되기 전에 미리 보려면 `git switch feature/expert-detail` 후 `git pull`.

## 2. 백엔드 라이브러리 설치

```powershell
cd backend
uv sync
```
- 이번에 `pillow`(프로필 사진 자르기·저장)가 추가됐어요. `uv sync`를 안 하면 서버가 켜질 때 `No module named 'PIL'` 에러가 나요.
- 프론트는 새 라이브러리가 없어요. `npm install`은 안 해도 돼요.

## 3. `.env`에 디스코드 봇 값 추가

저장소 맨 위 `.env`(backend 폴더 아님)에 두 줄을 추가해요. `.env.example`에도 자리가 있어요.

```env
DISCORD_BOT_TOKEN="(차용우에게 따로 받기)"
DISCORD_GUILD_ID="(차용우에게 따로 받기)"
```

| 이름 | 뜻 |
|---|---|
| `DISCORD_BOT_TOKEN` | LabBridge 봇 비밀번호. 이 값으로 서버 초대·DM 보내기를 해요. **절대 커밋·채팅방 공유 금지** |
| `DISCORD_GUILD_ID` | LabBridge 디스코드 서버 번호. 로그인하면 이 서버에 자동으로 들어가요 |

### ⚠️ 디스코드 앱(Client ID)도 팀 공용 앱이어야 DM 테스트가 돼요
디스코드 규칙상 **봇과 로그인 앱이 같은 앱이어야** 서버 자동 참가가 돼요.
지금까지 각자 만든 개인 디스코드 앱으로 로그인했다면:

| 하고 싶은 것 | 설정 |
|---|---|
| **DM 알림까지 테스트** | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`을 **팀 공용 앱 값**으로 바꾸기 (차용우에게 따로 받기) + 봇 두 값 넣기 |
| **DM은 안 봐도 됨** (다른 기능 개발만) | 개인 앱 그대로 두고, `DISCORD_BOT_TOKEN`·`DISCORD_GUILD_ID`를 **비워 두기** |

- 봇 값을 비워 두면 디스코드 DM만 꺼지고, 로그인·종 알림·프로필 설정은 그대로 동작해요.
- 팀 공용 앱의 리디렉션 주소는 `http://localhost:8000/api/v1/auth/discord/callback`으로 이미 등록돼 있어요.
- 비밀값은 디스코드 DM 같은 1:1 경로로만 주고받아요.

## 4. 서버 켜기

```powershell
# 터미널 1
cd C:\dev\project\what_the-lab\backend
uv run uvicorn app.main:app --reload --port 8000

# 터미널 2
cd C:\dev\project\what_the-lab\frontend
npm run dev
```
- 화면 글자 크기나 스타일이 이상하면 프론트를 끄고 `Remove-Item -Recurse -Force .next` 후 다시 `npm run dev`.

## 5. 한 번 로그아웃 → 다시 로그인 (봇 값을 넣은 경우)

- 이번에 디스코드 로그인 권한에 **"서버 참가(guilds.join)"**가 추가됐어요.
- 다시 로그인하면 디스코드 승인 화면에 "서버 참가" 항목이 보여요. **허용**하면 LabBridge 서버에 자동으로 들어가요.
- 이미 로그인 중이라면: 오른쪽 위 프로필 → 로그아웃 → 다시 로그인.
- 또는 **프로필 설정 → 알림 → [디스코드 알림 연결]** 버튼으로도 같은 일을 할 수 있어요.

## 6. 잘 됐는지 확인

| 확인할 것 | 방법 | 정상 |
|---|---|---|
| 테스트 | `cd backend` → `uv run pytest` | 모두 passed |
| 종 알림 | 계정 A로 계정 B에게 협업 요청 보내기 | B 화면 오른쪽 위 종에 빨간 숫자 |
| 디스코드 DM | 위와 같이 요청 보내기 | B의 디스코드로 LabBridge 봇 DM (몇 초 안에) |
| 알림 설정 | `/settings/profile#noti` → [테스트 DM 보내기] | "테스트 DM을 보냈어요" + DM 도착 |
| 프로필 사진 | `/settings/profile` → [사진 바꾸기] | 카드와 헤더 사진이 같이 바뀜 |
| 가입 정보 수정 | 전문가: 지금 하는 일·경력 / 연구회원: 학과·직위 → [저장하기] | "저장했어요" |

---

## 문제가 생기면

| 증상 | 원인 · 해결 |
|---|---|
| 협업 요청 보내기·수락에서 500 에러 | 알림 테이블이 없어요 → **0번** 확인 |
| 서버가 안 켜짐 `No module named 'PIL'` | `uv sync` 안 함 → **2번** |
| 알림 카드에 "Not Found" | 백엔드가 예전 코드 → `git pull` 후 백엔드 재시작 |
| 알림 카드에 "지금은 디스코드 알림을 쓸 수 없어요" | `.env`에 봇 값이 없음(의도한 거면 정상). 넣었다면 백엔드 재시작 |
| 알림 카드가 "디스코드 연결 안 됨" | 다시 로그인 안 함, 또는 승인 화면에서 서버 참가를 끔 → **5번**. 개인 디스코드 앱으로 로그인 중이면 서버 참가가 안 돼요 → **3번 ⚠️** |
| 종 알림은 오는데 DM이 안 옴 | 아래 SQL로 이유 확인 |
| DM이 막혀 있어요(blocked) | 디스코드에서 LabBridge 서버 오른쪽 클릭 → 개인정보 보호 설정 → **다이렉트 메시지 허용** 켜기 → [테스트 DM 보내기] |
| 폰으로 푸시가 안 옴 | 디스코드 쪽 설정이에요. PC 디스코드가 켜져 있으면 폰 푸시를 안 보내요. 폰 알림 권한·방해 금지 모드도 확인 |
| 기관 바꾸기에서 인증번호가 안 옴 | 아직 실제 메일을 보내지 않아요. `.env`의 `APP_ENV=development`면 화면에 번호가 바로 보여요 |

DM이 안 갈 때 이유 보기 (최근 5개):
```sql
SELECT type, discord_status, discord_error, created_at
FROM notification ORDER BY created_at DESC LIMIT 5;
```
| `discord_status` | 뜻 |
|---|---|
| `pending` | 보내기 전 (15초 안에 보내요) |
| `sent` | 보냄 |
| `skipped` | 일부러 안 보냄. `discord_error`에 이유: `LabBridge 서버 미참가`(→ 5번), `DM 받기 꺼짐`·`이 종류 알림 꺼짐`(→ 프로필 설정 알림 스위치), `오래된 알림`(1시간 넘은 알림) |
| `failed` | 3번 시도했지만 실패 (디스코드 서버 문제 등) |

---

## 하면 안 되는 것

- `.env`, 봇 토큰, Client Secret 커밋하기 / 단톡방에 올리기
- 공용 Supabase에 각자 `alembic upgrade` 실행하기 (DB 담당자만)
- 테스트 데이터를 지울 때 `notification_setting` 지우기
  → 서버 참가 기록이 같이 지워져서 DM이 "LabBridge 서버 미참가"로 안 가요. 지웠다면 다시 로그인하면 돼요.
- `backend/uploads/` 폴더 커밋하기 (올린 프로필 사진. `.gitignore`에 들어 있어요)

## 참고: 새로 생긴 API

| 주소 | 설명 |
|---|---|
| `GET /api/v1/notifications` · `/unread-count` | 내 알림 목록 · 안 읽은 수 |
| `POST /api/v1/notifications/{id}/read` · `/read-all` | 읽음 처리 |
| `GET·PUT /api/v1/notifications/settings` · `POST .../settings/test` | 알림 설정 · 테스트 DM |
| `GET /api/v1/auth/discord/connect` | [디스코드 알림 연결] (끝나면 프로필 설정으로 돌아옴) |
| `PUT·DELETE /api/v1/me/photo` · `GET /api/v1/users/{id}/photo` | 프로필 사진 올리기·지우기·보기 |
| `GET·PUT /api/v1/expert/basic` | 전문가 가입 정보 |
| `PUT /api/v1/researcher/profile` | 연구회원 학과·직위 |
| `POST /api/v1/verification/change/send` · `/confirm` · `/name` | 소속 기관 바꾸기(재인증) |
