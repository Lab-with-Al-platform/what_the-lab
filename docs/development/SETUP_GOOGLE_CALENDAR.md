# 구글 캘린더 연동 — pull 받은 뒤 세팅 안내

> 2026-10-29 · PR #38(백엔드) 기준 · 실제 구글 계정으로 연결·복사·수정·삭제 확인 완료
> 이 PR을 받은 뒤 **각자 PC에서 한 번** 따라 하면 됩니다.
> **구글 설정은 선택이에요.** `.env`에 구글 값을 안 넣으면 구글 기능만 꺼지고, 나머지는 지금과 똑같이 돌아가요.
> DB 칸 추가(0번)는 **모두 꼭** 해야 해요.

## 들어간 것

| 기능 | 설명 | 새로 필요한 것 |
|---|---|---|
| 협업마다 구글 캘린더 | 누가 처음 [내 구글 캘린더에 추가]를 누를 때 서버(서비스 계정)가 "LabBridge · 협업-번호" 캘린더를 만들어요 | 서비스 계정 키 (선택) |
| 보기 전용 공유 | 누른 사람의 구글 이메일로 그 캘린더를 **보기 전용** 공유해요. 이메일은 한 번 쓰고 저장하지 않아요 | 구글 로그인 앱 값 (선택) |
| 일정 자동 복사 | LabBridge에서 일정을 추가·수정·삭제하면 몇 초 안에 그 구글 캘린더에도 반영돼요 (한쪽 방향: LabBridge → 구글) | 없음 |
| 일정 수정자 | 마지막으로 고친 사람(`updated_by`)을 남겨요 | DB 칸 |
| 일정 유형 `data` | 데이터 전달·반납·삭제 (화면은 다음 PR) | DB 칸 |
| 보안 보완 | `collaboration`, `collaboration_schedule`에 빠져 있던 Supabase 브라우저 역할 차단(RLS)을 걸어요 | 없음 |

구조 한 줄 요약: **LabBridge DB가 원본, 구글은 복사본.** 회원은 구글에서 보기·알림만 하고, 등록·수정·삭제는 LabBridge에서 해요.

```
[내 구글 캘린더에 추가] → 구글 로그인(이메일만) → 캘린더 없으면 생성 → 보기 전용 공유 → 이메일 버림
                         → 구글 캘린더 "캘린더 추가" 화면 → [추가] → 내 구글 캘린더 "다른 캘린더"에 보임
LabBridge 일정 추가·수정·삭제 → google_status=pending → 백그라운드 작업이 구글에 반영 → synced
```

### 회원 입장에서
- **협업 하나 = 구글 캘린더 하나.** 협업을 3개 하면 구글 캘린더 왼쪽 "다른 캘린더"에 3줄이 생겨요. (버튼을 누른 협업만)
- 같은 협업의 두 사람은 **같은 캘린더**를 공유받아요. 일정이 바뀌면 둘 다 같이 바뀌어요.
- 이메일을 저장하지 않아서 **협업마다 버튼을 한 번씩** 눌러요. (나중에 "새 협업도 자동 추가" 동의 기능을 붙일 수 있어요)

---

## 0. 먼저 확인: DB 칸이 있어야 해요 ⚠️

칸이 없으면 **협업 공간 화면과 일정 저장이 500 에러**가 나요. (구글 설정과 상관없이)

### 공용 Supabase를 쓰는 경우 (팀 기본)
- **DB 담당자가 마이그레이션 `20261028_17`을 적용한 뒤에** 실행하세요.
- 각자 `alembic upgrade`를 실행하지 마세요. 공용 DB는 DB 담당자만 바꿉니다.
- 적용됐는지 확인 (Supabase → SQL Editor):
  ```sql
  SELECT to_regclass('public.google_event_trash');
  ```
  `google_event_trash`가 나오면 OK, `NULL`이면 아직이에요.

### 로컬 Docker DB를 쓰는 경우 (`DATABASE_URL`을 비우고 `DB_*` 사용)
이미 데이터가 있는 DB라면 새 SQL 파일 하나만 실행하면 돼요. (DBeaver에서 **Alt + X**로 스크립트 전체 실행)
```powershell
cd C:\dev\project\what_the-lab
Get-Content database\init\021_add_google_calendar.sql | docker compose exec -T postgres psql -U admin -d labbridge
```
- 019(디스코드 칸)·020(기관 도메인)이 아직 없다면 그것부터 순서대로 실행하세요.
- 맨 마지막 `UPDATE insight_alembic_version`에서만 "relation does not exist"가 나오면 무시해도 돼요. (017을 안 넣은 DB)
- 실수로 중간까지만 실행됐다면 `already exists` 에러가 나요. 그때는 아래 확인 쿼리로 7줄이 나오는지만 보세요.
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_name IN ('collaboration', 'collaboration_schedule')
    AND column_name IN ('google_calendar_id', 'researcher_google_at', 'expert_google_at',
                        'google_status', 'google_attempts', 'google_error', 'updated_by');
  ```

---

## 1. 코드 받기

```powershell
cd C:\dev\project\what_the-lab
git fetch origin
git switch develop
git pull
```
- 새 라이브러리는 없어요. (구글 토큰은 이미 쓰는 `pyjwt`로 직접 만들어요) `uv sync`, `npm install`은 안 해도 돼요.

## 2. `.env`에 구글 값 넣기 (선택)

구글 연동까지 테스트할 사람만 하면 돼요. **안 넣으면 구글 기능만 꺼져요.**
값은 **팀 공용**이에요. 모두 같은 구글 프로젝트·같은 서비스 계정(로봇)·같은 로그인 앱을 써요.

### 2-1. 키 파일 두기
관리자에게 서비스 계정 키 파일(JSON)을 **1:1 DM**으로 받아서 아래 둘 중 한 곳에 두세요.

**A. 저장소 밖 (추천)**
```powershell
mkdir C:\dev\secrets
Move-Item $HOME\Downloads\labbridge-google.json C:\dev\secrets\labbridge-google.json
```

**B. 저장소 안 `secrets\` 폴더** — git이 무시하도록 **내 PC에만** 등록해야 해요.
```powershell
cd C:\dev\project\what_the-lab
mkdir secrets
Move-Item $HOME\Downloads\labbridge-google.json secrets\labbridge-google.json
Add-Content .git\info\exclude "`nsecrets/"
git check-ignore -v secrets\labbridge-google.json
```
- 마지막 줄 결과에 `.git/info/exclude:…:secrets/`가 나와야 해요. **아무것도 안 나오면 커밋될 수 있으니** 멈추고 물어보세요.
- `git status`에 `secrets/`가 보이면 안 돼요.

### 2-2. `.env`
저장소 맨 위 `.env`에 추가 (키 파일 경로는 2-1에서 고른 곳):
```
GOOGLE_SERVICE_ACCOUNT_FILE=C:\dev\secrets\labbridge-google.json
GOOGLE_CLIENT_ID=구글로그인클라이언트ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=구글로그인보안비밀번호
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/google/callback
```

| 값 | 뜻 | 받는 방법 |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_FILE` | 서비스 계정(로봇) **키 파일 경로**. 파일 내용이 아니라 경로만 적어요 | 키 파일을 관리자에게 **1:1 DM** |
| `GOOGLE_CLIENT_ID` | 구글 로그인 창을 띄우는 앱 번호 (비밀 아님) | 팀 채널에서 받기 |
| `GOOGLE_CLIENT_SECRET` | 구글 로그인 결과를 확인하는 **비밀값** (`GOCSPX-…`) | 관리자에게 **1:1 DM** |
| `GOOGLE_REDIRECT_URI` | 구글 로그인 뒤 돌아올 백엔드 주소. 구글 클라우드에 등록한 주소와 **한 글자도 다르면 안 돼요** | 위 값 그대로 |

- `.env`를 바꾸면 **백엔드를 껐다 켜야** 읽어요.

### 2-3. 테스트 사용자 등록 요청
구글 로그인 앱은 지금 **테스트 모드**예요. **명단에 있는 구글 계정만** 연결할 수 있어요. (최대 100명)
- 연결 테스트에 쓸 **구글 이메일**을 관리자에게 알려 주세요. 명단에 없으면 "액세스 차단됨"이 나와요.
- 회원 가입·협업이 생길 때마다 넣는 게 아니에요. **개발하는 동안 우리 팀 계정만** 넣어요. 서비스를 배포할 때 [앱 게시]를 한 번 누르면 명단 없이 모든 회원이 쓸 수 있어요. (아래 "배포할 때")

## 3. 구글 클라우드 설정 (관리자만, 이미 완료)

팀원은 할 일이 없어요. 프로젝트를 새로 만들거나 설정을 바꿀 때만 참고하세요.
**팀 공용 구글 계정**으로 로그인해서 해요. 프로젝트 이름은 `labbridge`예요.

> 결제(카드 등록)는 **필요 없어요.** Calendar API는 무료예요. (하루 요청 100만 번까지)
> 화면 위 "$300 크레딧 무료 체험 / 무료로 시작하기"는 누르지 말고 [닫기]를 누르세요. 누르면 카드 본인 확인 화면이 나와요.

| 순서 | 어디서 | 할 일 |
|---|---|---|
| 1 | `console.cloud.google.com/projectcreate` | 프로젝트 `labbridge` 만들기 (조직 없음) |
| 2 | API 라이브러리 → **Google Calendar API** | **[사용]** |
| 3 | IAM 및 관리자 → **서비스 계정** | `labbridge-calendar` 만들기. 권한·주 구성원 액세스는 **비워 둠** (자기가 만든 캘린더만 다뤄요) |
| 4 | 그 서비스 계정 → **[키]** 탭 | [키 추가] → 새 키 만들기 → **JSON** → 자동 다운로드 → 2-1처럼 보관 |
| 5 | **Google 인증 플랫폼** (`console.cloud.google.com/auth/overview`) | [시작하기] → 앱 이름 `LabBridge`, 지원 이메일, 대상 **외부**, 연락처 이메일 → [만들기] |
| 6 | 인증 플랫폼 → **대상** | 게시 상태 **테스트** 그대로. **테스트 사용자**에 팀원 구글 이메일 추가 |
| 7 | 인증 플랫폼 → **클라이언트** → [+ 클라이언트 만들기] | 유형 **웹 애플리케이션**, 리디렉션 URI `http://localhost:8000/api/v1/google/callback` |
| 8 | 7번 만들기 직후 창 | 클라이언트 ID·**보안 비밀번호**를 바로 보관 ([JSON 다운로드]). 보안 비밀번호는 **이 창에서만** 보여요 |

- 범위(scope)는 따로 추가하지 않아도 돼요. 코드가 `openid email`만 요청해요. (민감하지 않은 범위라 게시할 때 까다로운 심사가 없어요)
- 협업 캘린더의 주인은 **서비스 계정(로봇)**이에요. 공용 구글 계정의 캘린더에는 아무것도 안 생겨요.

---

## 4. 잘 됐는지 확인

| 확인할 것 | 방법 | 정상 |
|---|---|---|
| 테스트 | `cd backend` → `uv run pytest -q tests/test_google_calendar.py tests/test_workspace_rules.py tests/test_workspace_router.py` | 모두 passed |
| 구글 꺼진 상태 | `.env`에 구글 값 없이 서버 켜기 → 일정 추가 | 일정 저장 OK, `google_status = none` |
| 구글 연결 | **일반 크롬**에서 localhost:3000 로그인 상태로 `http://localhost:8000/api/v1/google/connect?collaboration_id=번호` 열기 | 구글 계정 선택 → (경고 시 고급 → 이동) → 이메일 허용 → 구글 캘린더 "캘린더 추가" → [추가] → "다른 캘린더"에 "LabBridge · 협업-번호" |
| 기존 일정 복사 | 연결 직후 구글 캘린더 | 그 협업의 기존 일정이 보임 (여러 날 일정은 시작~종료일 그대로) |
| 추가·수정·삭제 | LabBridge에서 일정 추가 / 수정 / 삭제 → 구글 새로고침 | 몇 초 안에 생김 / 바뀜 / 사라짐 |
| 일정 설명 | 구글에서 일정 클릭 | "LabBridge에서 관리하는 일정이에요… → …/workspace?schedule=번호", 생성자는 서비스 계정 |

- 협업 번호는 `SELECT collaboration_id, status FROM collaboration;`에서 `ongoing`인 번호를 쓰세요.
- 화면의 [내 구글 캘린더에 추가] 버튼은 다음 PR에서 붙어요. 지금은 위 주소로 직접 테스트해요.
- 디스코드 앱 안 브라우저에서는 구글이 로그인을 막아요. **일반 크롬**에서 하세요.
- "Google에서 확인하지 않은 앱" 경고는 테스트 모드라서 나와요. **고급 → LabBridge(으)로 이동**을 누르면 돼요.

### 알아 둘 점 (다음 PR에서 다룰 것)
- 구글 일정 설명의 `?schedule=번호` 링크는 아직 협업 공간 첫 화면만 열어요. (그 일정 창 바로 열기는 다음 PR)
- 지금은 모든 일정이 구글에서 **"바쁨"**으로 보여요. 미팅만 "바쁨", 나머지(작업·마감·데이터·기타)는 "한가함"으로 바꿀 예정이에요.
- 팀원마다 로컬 DB가 달라 협업 번호가 겹치면 로봇에 **같은 이름의 캘린더**가 여러 개 생길 수 있어요. 각 DB가 자기 캘린더 ID를 기억해서 **일정이 섞이지는 않아요.** (디스코드 채널과 같은 원리)

---

## 문제가 생기면

```sql
-- 협업 캘린더와 연결 상태
SELECT collaboration_id, google_calendar_id, researcher_google_at, expert_google_at
FROM collaboration WHERE status = 'ongoing';

-- 일정이 구글에 반영됐는지
SELECT schedule_id, title, google_status, google_attempts, google_error
FROM collaboration_schedule ORDER BY schedule_id DESC LIMIT 5;

-- 구글에서 지울 일정 대기열 (보통 비어 있어요)
SELECT * FROM google_event_trash;
```

| `google_status` | 뜻 |
|---|---|
| `none` | 이 협업에 구글 캘린더가 없어요 (아무도 연결 안 함) |
| `pending` | 구글에 반영할 차례 (15초 안에 반영) |
| `synced` | 구글과 같아요 |
| `failed` | 5번 실패해서 멈춤. `google_error`에 이유 |

| 증상 | 원인 · 해결 |
|---|---|
| 협업 공간·일정 저장에서 500 에러 | DB 칸이 없어요 → **0번** |
| `/api/v1/google/connect`가 404 | 백엔드가 예전 코드예요 → `git pull` 후 재시작 |
| 연결 주소가 `/workspace?google=off`로 돌아옴 | `.env`에 구글 값이 없거나 키 파일 경로가 틀렸어요 → **2번**, 백엔드 재시작 |
| `/workspace?google=denied` | 구글 로그인 화면에서 취소했거나 10분이 지났어요. 다시 시도 |
| `/workspace?google=failed` | `CLIENT_ID/SECRET`이나 리디렉션 주소가 틀렸거나, 서비스 계정 권한 문제 → 백엔드 터미널 에러 확인 |
| "액세스 차단됨" (구글 화면) | 그 구글 계정이 **테스트 사용자**에 없어요 → **2-3** |
| `redirect_uri_mismatch` (구글 화면) | `.env`의 `GOOGLE_REDIRECT_URI`와 구글 클라우드에 등록한 주소가 달라요 (끝의 `/`까지) |
| 일정이 계속 `pending` | 백엔드를 켤 때 키 파일을 못 읽었어요 (구글 작업이 안 켜짐) → 경로 확인 후 재시작 |
| `failed` + `403` / `429` | Calendar API가 꺼져 있거나 키가 다른 프로젝트 것, 또는 짧은 시간에 너무 많이 만들어 잠깐 막힘 → **3번** 2단계 확인, 잠시 뒤 재시도 |

---

## 배포할 때 (지금은 안 해도 돼요)

지금은 각자 `localhost`에서만 돌리니 **테스트 모드 그대로** 둬요. 서비스를 인터넷 주소(https)에 올릴 때 한 번에 해요.

- [ ] 구글 클라이언트에 리디렉션 URI 추가: `https://우리도메인/api/v1/google/callback`
- [ ] 인증 플랫폼 → 브랜딩: 앱 홈페이지·개인정보처리방침 주소, 승인된 도메인
- [ ] 서버 `.env`의 `GOOGLE_REDIRECT_URI`를 https 주소로
- [ ] 서비스 계정에 **서버 전용 키**를 새로 만들어 서버에만 두기 (팀 개발용 키와 분리 → 개발 키가 새도 서비스는 안전)
- [ ] 인증 플랫폼 → 대상 → **[앱 게시]** (이때부터 명단 없이 모든 회원 사용 가능)
- [ ] 디스코드: `/일정` 명령어 주소 등록, 디스코드 앱을 Developer Portal **Teams** 소유로 이전 (개인 계정에만 묶이지 않게)

---

## 하면 안 되는 것

- **서비스 계정 키 파일(JSON)**을 커밋하기 · 채팅방에 올리기 · git이 무시하지 않는 폴더에 두기
  → 키를 가진 사람은 협업 캘린더를 전부 읽고 고칠 수 있어요. 팀이 같은 키를 쓰니 **한 명이 새도 모두 바꿔야 해요.**
  새면: 구글 클라우드 → 서비스 계정 → [키] → 그 키 **삭제** → 새 키를 만들어 다시 1:1 DM으로 전달.
- `GOOGLE_CLIENT_SECRET`을 커밋하거나 단톡방에 올리기 (1:1 DM으로만)
- "$300 무료 체험"으로 결제 계정 연결하기 (필요 없어요)
- 회원의 구글 이메일이나 구글 토큰을 DB·로그에 남기기 (공유할 때 한 번만 쓰고 버리는 구조예요)
- 구글 캘린더에서 협업 일정을 직접 고치게 권한(`writer`) 바꾸기 → LabBridge와 어긋나요
- 개발 중에 [앱 게시] 누르기 (아무 구글 계정이나 덜 만든 기능에 들어올 수 있어요)
- 공용 Supabase에 각자 `alembic upgrade` 실행하기 (DB 담당자만)