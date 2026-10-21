# 회원가입·로그인 따라 하기 가이드

> 2026-10-21 주의: 아래 MySQL·3309 설명은 이전 구현 기록입니다. 현재 PostgreSQL 코드와 공통 접속 설정은 [팀 공통 DB 안내](SHARED_DATABASE_GUIDE.md)가 우선이며, 로컬 Docker 전환 이력은 [PostgreSQL 전환 정리](POSTGRESQL_MIGRATION.md)를 참고하세요. DB 재연결을 위해 볼륨·기존 계정을 삭제하지 마세요.

> WHAT THE LAB의 **디스코드 로그인 → 회원 유형 선택 → 연구회원 / AI 전문가 가입 완료**까지를
> 내 PC에서 처음부터 띄워 보고 확인하는 방법을 정리한 문서입니다.
> 위에서부터 순서대로 따라 하면 됩니다.

---

## 0. 한눈에 보기

### 지금까지 들어간 작업

| 순서 | PR / 브랜치 | 한 일 |
|---|---|---|
| 1 | #6 `feature/auth-pages` | 로그인·회원가입 **화면** (회원 유형 선택, 연구회원 소속 인증·기본 정보·완료, AI 전문가 간단 프로필·완료), 헤더 모바일 버튼 정리 |
| 2 | #7 `feature/discord-login` | **FastAPI 백엔드 뼈대 + 디스코드 로그인** (OAuth2 → 자체 JWT를 httpOnly 쿠키로 발급, `/auth/me`) — 이때는 회원을 서버 메모리에 임시 저장 |
| 3 | 이번 PR | **MySQL 연결 + 가입 정보 실제 저장** (연구회원: 기관 이메일 인증 → 기관명 → 기본 정보 / AI 전문가: 할 수 있는 일·직업·경력·소속), 가입 단계에 따라 화면 이동 |

### 전체 흐름

```
[디스코드로 로그인]
   │
   ▼
처음 온 계정이면 user 테이블에 회원 생성 (user_role = NULL, signup_step = 'role')
   │
   ▼
/signup  회원 유형 선택
   ├── 연구회원 ─────────────────────────────┐
   │   /signup/researcher       기관 이메일 입력 → 기관명 자동 확인 → 인증번호 6자리
   │                            (목록에 없는 학교면 기관명 직접 입력)
   │                            → DB: researcher_profile 저장, signup_step = 'info'
   │   /signup/researcher/info  학과·직위(선택) → [가입 완료]
   │                            → DB: signup_step = 'done'
   │   /signup/researcher/done  완료 화면
   │
   └── AI 전문가 ────────────────────────────┐
       /signup/expert           할 수 있는 일(1~3개) + 지금 하는 일 + AI 경력 + 소속(선택)
                                → DB: expert, expert_able_work 저장, signup_step = 'done'
       /signup/expert/done      완료 화면

다음 로그인부터는 signup_step 을 보고 이어서 보냅니다.
   role → /signup     info → /signup/researcher/info     done → /
```

---

## 1. 준비물 (처음 한 번)

| 프로그램 | 용도 | 확인 명령 |
|---|---|---|
| **Docker Desktop** | MySQL을 컨테이너로 띄움 | `docker --version` |
| **Python 3.13 + uv** | 백엔드 실행 | `uv --version` |
| **Node.js** | 프론트 실행 | `node --version` |
| DBeaver (선택) | DB 안을 눈으로 확인 | — |
| **디스코드 개발자 앱** | 로그인 테스트 | 아래 1-1 |

> ⚠️ Docker 명령을 쓰기 전에 **Docker Desktop을 먼저 켜고** 왼쪽 아래가 `Engine running`(초록)이 될 때까지 기다리세요.
> 안 켜면 `failed to connect to the docker API at npipe:...` 오류가 납니다.

### 1-1. 디스코드 앱 만들기 (각자 한 번)

시크릿 값은 **각자 자기 앱을 만들어서** 씁니다. 채팅·저장소에 공유하지 않습니다.

1. https://discord.com/developers/applications → **New Application** → 이름 입력 → 만들기
2. 왼쪽 **OAuth2** 메뉴
3. **Client ID** 복사, **Reset Secret** → **Client Secret** 복사 (한 번만 보여 줌)
4. **Redirects** → **Add Redirect** → 아래 주소를 **한 글자도 다르지 않게** 입력 → 저장
   ```
   http://localhost:8000/api/v1/auth/discord/callback
   ```

---

## 2. `.env` 만들기

저장소 **맨 위 폴더**(`what_the-lab\`)에 `.env` 파일을 만들고 아래를 채웁니다.
`.env`는 `.gitignore`에 들어 있어서 커밋되지 않습니다. **절대 커밋하지 마세요.**

```env
APP_ENV=development

# Frontend
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1

# Backend
CORS_ORIGINS=http://localhost:3000

# Discord OAuth (1-1에서 복사한 값)
DISCORD_CLIENT_ID=여기에_클라이언트_ID
DISCORD_CLIENT_SECRET=여기에_클라이언트_시크릿
DISCORD_REDIRECT_URI=http://localhost:8000/api/v1/auth/discord/callback

# JWT (아래 명령으로 만든 값)
JWT_SECRET=여기에_랜덤_문자열

# MySQL (docker-compose가 이 값으로 DB와 계정을 만듭니다)
DB_HOST=127.0.0.1
DB_PORT=3309
DB_NAME=labbridge
DB_USER=labbridge_dev
DB_PASSWORD=개발용_비밀번호
DB_ROOT_PASSWORD=루트용_비밀번호
```

| 이름 | 의미 |
|---|---|
| `APP_ENV` | `development`일 때만 인증번호를 **화면에 보여 줍니다**. 운영에서는 `production` |
| `NEXT_PUBLIC_APP_URL` | 로그인 후 백엔드가 돌려보낼 프론트 주소 |
| `CORS_ORIGINS` | 백엔드가 요청을 받아 줄 프론트 주소 |
| `DISCORD_REDIRECT_URI` | 디스코드 앱에 등록한 Redirect와 **똑같아야** 합니다 |
| `JWT_SECRET` | 로그인 쿠키(JWT)를 서명하는 비밀 값 |
| `DB_PORT` | 내 PC에서 접속할 포트. 컨테이너 안은 3306, 밖은 **3309** |
| `DB_NAME` | 만들 데이터베이스 이름 |
| `DB_USER` / `DB_PASSWORD` | 백엔드가 쓰는 **전용 계정**. `root`는 쓸 수 없습니다 (MySQL 이미지가 막음) |
| `DB_ROOT_PASSWORD` | 관리자(root) 비밀번호. 백엔드에서는 쓰지 않습니다 |

**JWT_SECRET 만들기** (`backend` 폴더에서):
```powershell
uv run python -c "import secrets; print(secrets.token_urlsafe(32))"
```
- `secrets.token_urlsafe(32)`: 예측할 수 없는 32바이트 랜덤 값을 URL에 써도 되는 글자로 만듭니다.

> ⚠️ 주소는 **`localhost`로 통일**하세요. 프론트를 `127.0.0.1:3000`으로 열고 백엔드가 `localhost`로 쿠키를 주면,
> 브라우저가 다른 사이트로 보고 쿠키를 안 보내서 "로그인이 필요합니다"(401)가 납니다.

---

## 3. DB 띄우기

### 3-1. 실행

저장소 맨 위 폴더에서:
```powershell
docker compose up -d
docker compose logs mysql
```
- `up -d`: 컨테이너를 만들고 **백그라운드**로 켭니다 (`-d` = detached).
- `logs mysql`: MySQL 컨테이너 로그를 봅니다.

`docker-compose.yml`이 하는 일:

| 설정 | 의미 |
|---|---|
| `image: mysql:8.4` | MySQL 8.4 사용 |
| `ports: "3309:3306"` | 내 PC 3309 → 컨테이너 3306 |
| `environment: ${DB_NAME}` 등 | `.env` 값으로 DB와 계정 생성 (비밀번호를 파일에 직접 안 씀) |
| `mysql_3309_data:/var/lib/mysql` | DB 데이터를 볼륨에 보관 (껐다 켜도 유지) |
| `./database/init:/docker-entrypoint-initdb.d` | **DB가 비어 있을 때 한 번만** 이 폴더의 SQL을 이름 순서대로 실행 |

### 3-2. 정상인지 확인

로그에 이 줄들이 **순서대로**, `ERROR` 없이 나와야 합니다. (처음엔 10~20초 걸림)
```
running /docker-entrypoint-initdb.d/001_create_tables.sql
running /docker-entrypoint-initdb.d/002_seed_institutions.sql
running /docker-entrypoint-initdb.d/003_seed_able_work.sql
... ready for connections ... port: 3306
```
- 중간의 `root@localhost is created with an empty password !` 경고는 **무시해도 됩니다.** 초기화 중 잠깐 만들었다가 `.env` 비밀번호로 바꿉니다.
- `port: 0`으로 끝나는 `ready for connections`는 초기화용 임시 서버입니다. **마지막 `port: 3306`** 줄이 진짜입니다.
- 초기화 중에 접속하면 `Access denied`가 날 수 있습니다. 위 줄이 다 나올 때까지 기다리세요.

### 3-3. DBeaver로 접속 (선택)

새 연결 → MySQL

| 항목 | 값 |
|---|---|
| Server Host | `localhost` (컨테이너 이름이나 계정 이름 아님) |
| Port | `3309` |
| Database | `.env`의 `DB_NAME` |
| Username / Password | `.env`의 `DB_USER` / `DB_PASSWORD` |

> 드라이버 설정에서 `allowPublicKeyRetrieval=true`가 필요할 수 있습니다 (MySQL 8 기본 인증 방식 때문).

확인 쿼리:
```sql
SHOW TABLES;                                        -- 6개
SELECT COUNT(*) FROM institution;                   -- 271
SELECT able_work_id, name, show_default FROM able_work ORDER BY sort_order;  -- 11줄 (TRUE 7, FALSE 4)
```

### 3-4. DB를 처음 상태로 되돌리기

**SQL 파일을 고쳤을 때**는 볼륨을 지워야 다시 실행됩니다.
```powershell
docker compose down -v
docker compose up -d
```
- `down -v`: 컨테이너를 끄고 **볼륨(DB 데이터)까지 삭제**합니다. 가입한 회원도 전부 지워지니 디스코드로 다시 로그인해야 합니다.
- `-v` 없이 `down`만 하면 데이터는 남고, init SQL도 **다시 실행되지 않습니다.**

---

## 4. 테이블 구조

`database/init/001_create_tables.sql` 에서 만듭니다. 부모 테이블을 먼저 만들어야 해서 순서가 중요합니다.

```
user ─┬─ 1:1 ─ expert ── 1:N ── expert_able_work ── N:1 ── able_work (기준표, 11줄)
      └─ 1:1 ─ researcher_profile

institution (기관 목록, 이메일 도메인 → 기관명)
```

| 테이블 | 담는 것 | 핵심 컬럼 |
|---|---|---|
| `user` | 디스코드로 로그인한 모든 사람 | `discord_id`(고유), `nickname`(고유), `user_role`(NULL / researcher / expert), `signup_step`(role / info / done) |
| `expert` | AI 전문가 정보 | `user_id`(PK이자 FK), `current_job`, `ai_career`, `affiliation` |
| `able_work` | 할 수 있는 일 기준표 | `able_work_id`(UG01~UG11), `name`, `show_default`, `taxonomy_ver` |
| `expert_able_work` | 전문가가 고른 할 수 있는 일 | `user_id` + `expert_capability`(UG ID) — 둘 묶어서 UNIQUE |
| `researcher_profile` | 연구회원 정보 | `institution_name`, `institution_source`(list / manual), `department`, `position`, `is_verified` |
| `institution` | 기관 목록 | `domain`(PK, 예: `snu.ac.kr`), `name` |

### DB에는 코드, 화면에는 문구

화면 문구를 바꿔도 DB를 고치지 않아도 되도록 **코드**로 저장합니다.

| 항목 | 저장 값 → 화면 문구 |
|---|---|
| 지금 하는 일 `current_job` | `grad_student` 대학원생 / `researcher` 연구원 / `employee` 기업 재직 / `freelancer` 프리랜서 / `professor` 교수 / `etc` 기타 |
| AI 경력 `ai_career` | `lt1` 1년 미만 / `1_3` 1~3년 / `3_5` 3~5년 / `5_10` 5~10년 / `gt10` 10년 이상 |
| 직위 `position` | `undergrad` 학부연구생 / `master` 석사과정 / `phd` 박사과정 / `postdoc` 박사후연구원 / `professor` 교수 / `researcher` 연구원 |
| 할 수 있는 일 | `UG01` ~ `UG11` (이름은 `able_work` 테이블에서) |

> 항목을 추가·변경할 때는 **프론트 옵션 목록과 백엔드 허용 목록을 같이** 고쳐야 합니다.
> (예: `expert-signup-form.tsx`의 `JOB_OPTIONS` ↔ `routers/expert.py`의 `JOB_CODES`)

---

## 5. 시드 데이터 (DB에 미리 넣는 값)

`database/init/002_*.sql`, `003_*.sql` 은 **스크립트가 만든 파일**입니다. 직접 고치지 말고 스크립트를 다시 실행하세요.
이미 저장소에 들어 있으니 **처음 실행만 할 거면 이 단계는 건너뛰어도 됩니다.**

### 5-1. 기관 목록 (`002_seed_institutions.sql`)

출처: [Hipo university-domains-list](https://github.com/Hipo/university-domains-list) (MIT 라이선스) — 한국 대학 271개 도메인

```powershell
# 1) 원본 JSON 받기 → database\seed\ 폴더에 저장
#    https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json
# 2) 저장소 맨 위 폴더에서 실행
python database\seed\build_institution_seed.py
```

| 입력 (`database/seed/`) | 필수 | 역할 |
|---|---|---|
| `world_universities_and_domains.json` | ✅ | 도메인 기본 출처 (용량이 커서 커밋하지 않음) |
| `universities.csv` | — | 공공데이터 대학 목록 (한글 학교명용) |
| `manual_institutions.csv` | — | 직접 고친 값. 항상 최우선 |

- 나라를 늘리려면 스크립트의 `COUNTRY_CODES = {"KR"}`에 코드만 추가합니다. 예: `{"KR", "US"}`
- 지금은 Hipo만 써서 학교명이 **영어**로 들어갑니다. 한글 이름은 `universities.csv` / `manual_institutions.csv`로 보완 예정
- 연구기관(출연연 등)은 이번 범위에서 뺐습니다.

### 5-2. 할 수 있는 일 (`003_seed_able_work.sql`)

출처: `taxonomy/v4.0/ui-filter-groups.json` (팀 분류표)

```powershell
python database\seed\build_able_work_seed.py
```
출력: `할 수 있는 일 11개 → ...003_seed_able_work.sql`

- `taxonomy/v4.0` 폴더가 없으면 `FileNotFoundError`가 납니다 → `git fetch origin` 후 `git merge origin/develop`
- 분류표 버전이 바뀌면 스크립트의 `TAXONOMY_VERSION`과 `SOURCE_JSON` 경로를 같이 바꿉니다.
- 화면은 분류표 파일을 직접 읽지 않고 **DB(able_work)를 읽습니다.** 분류표가 바뀌면 스크립트 재실행 → `down -v` → `up -d` 해야 반영됩니다.

> 두 스크립트 모두 **저장소 맨 위 폴더**에서 실행하세요. `frontend` 폴더 등에서 실행하면 `No such file` 오류가 납니다.

---

## 6. 백엔드 실행

```powershell
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

| 명령 / 옵션 | 의미 |
|---|---|
| `uv sync` | `pyproject.toml`·`uv.lock` 기준으로 라이브러리 설치 |
| `app.main:app` | `app/main.py` 파일 안의 `app` 객체를 실행 |
| `--reload` | 코드를 저장하면 서버가 자동으로 다시 시작 |
| `--port 8000` | 8000번 포트 사용 |

확인:
- http://localhost:8000/api/v1/health → `{"status":"ok"}`
- http://localhost:8000/docs → `auth`, `verification`, `researcher`, `expert` 네 묶음이 보여야 함
- http://localhost:8000/api/v1/expert/able-works → 11개 목록

### 백엔드 파일 구조

| 파일 | 역할 |
|---|---|
| `app/main.py` | 앱 생성, CORS, **라우터 등록** (`include_router`) |
| `app/config.py` | `.env` 값 읽기 (Discord, JWT, DB, `APP_ENV`) |
| `app/db.py` | MySQL 연결 만들기 (`get_connection()`) |
| `app/security.py` | JWT 만들기·읽기, 로그인 필수 API용 `get_current_user_id` |
| `app/user_store.py` | `user` 테이블 조회·생성 |
| `app/institution_store.py` | 이메일 도메인 정리, 개인 메일·학술 메일 판별, 기관명 조회 |
| `app/routers/auth.py` | 디스코드 로그인·콜백·내 정보, 가입 단계별 이동 |
| `app/routers/verification.py` | 기관 조회, 인증번호 발송·확인, 기관명 직접 입력 |
| `app/routers/researcher.py` | 연구회원 기본 정보 조회·저장 (가입 완료) |
| `app/routers/expert.py` | 할 수 있는 일 목록, AI 전문가 가입 |

> 새 라우터 파일을 만들면 `main.py`에 **import와 `app.include_router(...)` 두 군데**를 꼭 추가하세요.
> 빠지면 `/docs`에 안 보이고 `{"detail":"Not Found"}`가 납니다.

### API 목록

| 주소 | 로그인 | 설명 |
|---|---|---|
| `GET /api/v1/auth/discord/login` | — | 디스코드 승인 화면으로. 이미 로그인했으면 가입 단계 화면으로 |
| `GET /api/v1/auth/discord/callback` | — | 회원 찾기/만들기 → JWT 쿠키 발급 → 프론트로 이동 |
| `GET /api/v1/auth/me` | ✅ | 내 정보 (`user_id`, `nickname`, `user_role`, `signup_step` …) |
| `GET /api/v1/verification/institution?email=` | — | 이메일로 기관명 조회. 개인 메일·비학술 메일이면 400 |
| `POST /api/v1/verification/email/send` | ✅ | 인증번호 6자리 생성 (5분 유효). 개발 환경이면 `dev_code`로 돌려줌 |
| `POST /api/v1/verification/email/confirm` | ✅ | 번호 확인 → 연구회원 저장, `signup_step = 'info'` |
| `POST /api/v1/verification/institution-name` | ✅ | 목록에 없는 학교일 때 기관명 직접 입력 |
| `GET /api/v1/researcher/profile` | ✅ | 내 연구회원 정보 |
| `POST /api/v1/researcher/profile` | ✅ | 학과·직위 저장 → `signup_step = 'done'` |
| `GET /api/v1/expert/able-works` | — | 할 수 있는 일 11개 |
| `POST /api/v1/expert/signup` | ✅ | AI 전문가 가입 → `signup_step = 'done'` |

**로그인 방식:** 디스코드 로그인 성공 시 백엔드가 `access_token` 쿠키(httpOnly, SameSite=Lax, 7일)를 줍니다.
프론트는 모든 요청에 `credentials: "include"`를 붙여 이 쿠키를 같이 보냅니다 (`frontend/src/lib/api.ts`).

**지켜야 할 규칙 (서버에서 검사):**
- 한 계정은 **한 회원 유형만** 가능 — 이미 정해졌으면 409
- 할 수 있는 일은 1~3개, 기준표에 있는 ID만
- 이메일 주소는 **저장하지 않고** 기관명만 저장
- 여러 테이블을 바꾸는 저장은 **트랜잭션**으로 묶어서, 하나라도 실패하면 전부 취소

---

## 7. 프론트 실행

새 터미널에서:
```powershell
cd frontend
npm install      # 처음 한 번, 또는 package.json이 바뀌었을 때
npm run dev
```
→ http://localhost:3000

### 이번에 바뀐 프론트 파일

| 파일 | 역할 |
|---|---|
| `src/lib/api.ts` | 백엔드 호출 공통 함수 `requestApi` (쿠키 포함, 오류 시 `ApiError`) |
| `src/components/researcher-verify-form.tsx` | 이메일 → 인증번호 → (필요하면) 기관명 직접 입력 |
| `src/components/researcher-info-form.tsx` | 학과·직위 입력, 가입 완료 |
| `src/components/researcher-signup-done.tsx` | 연구회원 완료 화면 (닉네임, 기관·학과) |
| `src/components/expert-signup-form.tsx` | 할 수 있는 일(DB에서 불러옴, 7개 + 더 보기 4개) 등 입력, 가입 완료 |
| `src/components/expert-welcome-title.tsx` | 전문가 완료 화면 제목에 닉네임 표시 |
| `src/app/signup/*/done/page.tsx` | 완료 화면이 위 컴포넌트를 사용 |

---

## 8. 직접 테스트하기

DB(3), 백엔드(6), 프론트(7)가 **모두 켜진 상태**에서 진행합니다.

### 8-1. 연구회원

1. http://localhost:3000/login → **디스코드로 로그인** → 승인
2. `/signup`으로 이동 → **연구회원** 선택
3. 이메일 칸에 학교 이메일 입력 후 칸 밖을 클릭
   - 예: `test@snu.ac.kr` → 기관명이 보이면 OK (실제 메일함이 없어도 됨. 메일을 보내지 않음)
   - `@gmail.com` 같은 개인 메일 → 안내 문구가 뜨고 전송 버튼이 꺼져 있어야 정상
4. **인증번호 전송** → 화면에 **개발용 인증번호 6자리**가 보임 → 입력 → 확인
   - 목록에 없는 학교 도메인(예: `test@abc.ac.kr`)이면 **기관명 직접 입력** 단계가 나옴
5. 학과·직위(선택) → **가입 완료** → 완료 화면
6. DBeaver 확인:
   ```sql
   SELECT user_id, nickname, user_role, signup_step FROM user;   -- researcher / done
   SELECT * FROM researcher_profile;                              -- 기관명, is_verified = 1
   ```
7. 로그아웃 기능이 아직 없으니, 브라우저 개발자 도구 → Application → Cookies에서 `access_token`을 지우고 다시 로그인 → **`/`로 바로 이동**하면 성공

### 8-2. AI 전문가

연구회원으로 가입한 계정은 전문가로 가입할 수 없습니다 (409). **다른 디스코드 계정**을 쓰거나 아래 8-3으로 초기화하세요.

1. 로그인 → `/signup` → **AI 전문가** 선택
2. 할 수 있는 일 칩 **7개 + [+ 더 보기 (4)]** 가 보이면 OK
3. 3개를 고르면 나머지 칩이 흐려지는지 확인
4. 지금 하는 일, AI 경력 선택 → **가입 완료** 버튼이 켜짐 → 누르기
5. 완료 화면에 "가입을 환영해요, ○○ 님!"
6. DBeaver 확인:
   ```sql
   SELECT * FROM expert;
   SELECT * FROM expert_able_work;      -- 고른 개수만큼 UG ID
   SELECT user_id, user_role, signup_step FROM user;   -- expert / done
   ```

### 8-3. 테스트 계정 초기화

계정 하나로 여러 번 테스트하고 싶을 때 (DBeaver에서, `user_id`는 실제 값으로):
```sql
DELETE FROM researcher_profile WHERE user_id = 1;
DELETE FROM expert WHERE user_id = 1;          -- expert_able_work는 CASCADE로 같이 지워짐
UPDATE user SET user_role = NULL, signup_step = 'role' WHERE user_id = 1;
```
전부 지우려면 `docker compose down -v` → `docker compose up -d` (3-4 참고)

---

## 9. 자주 나는 오류

| 증상 | 원인 | 해결 |
|---|---|---|
| `failed to connect to the docker API at npipe:...` | Docker Desktop이 꺼져 있음 | Docker Desktop 실행 → `Engine running` 확인 → `docker info` |
| 컨테이너가 바로 꺼지고 `MYSQL_USER="root"` 관련 오류 | `.env`의 `DB_USER=root` | `root`가 아닌 이름으로 (예: `labbridge_dev`) |
| 테이블이 안 생김 | 볼륨이 이미 있어서 init SQL이 안 돌았음, 또는 001 파일이 비어 있음 | 파일 확인 후 `down -v` → `up -d` |
| 한글이 `ë°ì´...`처럼 깨짐 | SQL 파일을 utf8mb4로 안 읽음 | SQL 파일 맨 위 `SET NAMES utf8mb4;` 확인 후 `down -v` |
| DBeaver `Unknown host` | Host에 계정·컨테이너 이름을 넣음 | Host는 `localhost`, Port `3309` |
| 접속 직후 `Access denied` | MySQL이 아직 초기화 중 | 로그에 `port: 3306 ... ready for connections` 뜰 때까지 대기 |
| 백엔드 시작 시 `KeyError: 'DB_NAME'` | `.env`에 DB 값이 없음 | 2번 `.env` 확인 (파일 위치는 저장소 맨 위) |
| `ModuleNotFoundError: pymysql` | 라이브러리 미설치 | `backend` 폴더에서 `uv sync` |
| `RuntimeError: 'cryptography' package is required` | MySQL 8 인증 방식에 필요한 라이브러리 미설치 | `backend` 폴더에서 `uv sync` |
| `ModuleNotFoundError: app.db` / `ImportError` | 파일이 없거나 위치가 다름 | `backend/app/` 아래 6번 표의 파일이 다 있는지 확인 |
| `{"detail":"Not Found"}` | 라우터 미등록 | `main.py`의 import + `include_router` 확인, `/docs`에 묶음이 보이는지 |
| `로그인이 필요합니다` (401) | 쿠키가 안 감 | ① 주소를 `localhost`로 통일 ② 요청에 `credentials: "include"` ③ 개발자 도구 → Cookies에 `access_token`이 있는지 |
| `이미 회원 유형이 정해진 계정이에요` (409) | 이미 가입한 계정 | 8-3으로 초기화 |
| 인증번호가 안 맞다고 나옴 | 5분 지남, 또는 백엔드 재시작 (번호는 서버 메모리에 저장) | **다시 보내기** |
| 디스코드 "잘못된 OAuth2 redirect_uri" | 앱 Redirect와 `.env` 주소가 다름 | 1-1의 4번 주소와 `DISCORD_REDIRECT_URI`를 똑같이 |
| 시드 스크립트 `FileNotFoundError: taxonomy/v4.0` | 내 브랜치가 develop보다 옛날 | `git fetch origin` → `git merge origin/develop` |
| 시드 스크립트 `No such file` | 실행 위치가 다름 | 저장소 맨 위 폴더에서 실행 |

---

## 10. 아직 안 된 것 (다음 작업)

- [ ] 로그아웃 API(쿠키 삭제) + 버튼
- [ ] 헤더에 로그인 상태 표시
- [ ] 실제 인증 메일 발송 (지금은 개발용으로 화면에 번호 표시)
- [ ] 인증번호 저장 위치 (지금은 서버 메모리 → 재시작하면 사라짐)
- [ ] 디스코드 환영 DM
- [ ] 기관명 한글화, 연구기관(출연연 등) 도메인 추가
- [ ] 분류표 버전이 바뀔 때 DB를 지우지 않고 갱신하는 방법
- [ ] 직접 입력한 기관명(`institution_source = 'manual'`) 관리자 확인 화면
- [ ] 사용하지 않는 `frontend/src/lib/email-domain.ts` 삭제
- [ ] `.env.example`에 DB 항목 반영, 옛 PostgreSQL/Supabase 항목 정리

### 다른 작업과 연결되는 부분

- **전문가 검색:** 전문가가 고른 할 수 있는 일은 `expert_able_work.expert_capability`에 **UG ID**(예: `UG04`)로 저장됩니다. 검색은 이 값을 기준으로 연결하면 됩니다.
- UG를 골랐다고 그 안의 모든 세부 기술(CAP)을 가진 것은 아닙니다. 세부 기술·연구 분야(FIELD)는 프로필 단계에서 따로 받습니다.

---

## 출처

- 기관 도메인: [Hipo/university-domains-list](https://github.com/Hipo/university-domains-list) — MIT License
- 할 수 있는 일: 팀 분류표 `taxonomy/v4.0` (모든 항목 `pending_review`, 운영 승인 전)
