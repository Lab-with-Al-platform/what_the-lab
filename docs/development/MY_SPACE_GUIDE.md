# 내 공간(내 이력·내 연구) 따라 하기 가이드

> LabBridge에서 **AI 전문가의 "내 이력"**과 **연구회원의 "내 연구"**를
> 내 PC에서 띄워 보고 확인하는 방법을 정리한 문서입니다.
> 회원가입·로그인은 [SIGNUP_LOGIN_GUIDE.md](SIGNUP_LOGIN_GUIDE.md)를 먼저 끝낸 상태에서 시작합니다.
> 위에서부터 순서대로 따라 하면 됩니다.

---

## 0. 한눈에 보기

### 이번 작업에서 들어간 것

| 순서 | 대상 | 한 일 |
|---|---|---|
| 1 | AI 전문가 | **내 이력** (`/my-career`): 소개·협업 조건·포트폴리오(+PDF)·경력/학력/자격증 추가·수정·삭제, 프로필 공개 켜기/끄기 |
| 2 | 공통 | 연구 분야 분류표(FIELD 83개, 대분류 10개)를 DB에 넣고 `/taxonomy/fields`로 제공 |
| 3 | 연구회원 | **내 연구** (`/my-research`): 4단계 모달로 연구 등록·임시 저장·수정·삭제, "지정한 연구" 고르기 |
| 4 | 연구회원 | **내 연구 상세** (`/my-research/{번호}`): 연구 하나를 자세히 보고, 여기서 수정·지정·삭제 |
| 5 | 가입 흐름 | 인증 버튼 중복 클릭 방지, 로그인 후 헤더 갱신, 가입 완료 문구 수정 |

### 전체 흐름

```
[디스코드 로그인 → 회원 유형 선택]   ← SIGNUP_LOGIN_GUIDE.md
   │
   ├── AI 전문가로 가입 완료
   │     헤더 프로필 ▼ → [내 이력]  /my-career
   │       ├─ 소개          할 수 있는 일(1~3) · 한 줄 소개(40자) · 도메인(연구 분야 1~5)
   │       ├─ 협업 조건      미팅 방식(온라인 / 대면 가능+지역) · 주당 시간 · 희망 보상
   │       ├─ 포트폴리오     제목 · AI로 한 일 · 사용 기술 · 내 역할 · PDF(선택, 20MB)
   │       ├─ 경력/학력/자격증 (선택)
   │       └─ 공개 스위치    필수 5개(할 수 있는 일·한 줄 소개·도메인·협업 조건·포트폴리오 1개)를
   │                          다 채워야 켤 수 있음
   │
   └── 연구회원으로 가입 완료
         헤더 프로필 ▼ → [내 연구]  /my-research
           ├─ [+ 연구 작성] → 4단계 모달: 연구 → 데이터 → 협업 → 확인
           │     [임시 저장] → status = draft (지정 불가)
           │     [등록하기]  → status = registered
           ├─ 목록 왼쪽 동그라미 → "지정한 연구" (한 사람당 1개)
           └─ 제목 클릭 → /my-research/{번호} 상세
                 [이 연구로 지정] [수정 / 이어서 작성] [삭제]
                 오른쪽: 이 연구로 협업 요청을 보낸 전문가 (요청 기능 전이라 지금은 빈 상태)
```

---

## 1. 시작 전에 확인

[SIGNUP_LOGIN_GUIDE.md](SIGNUP_LOGIN_GUIDE.md)의 1~7번이 끝나 있어야 합니다.

- [ ] Docker Desktop 켜짐, `docker compose up -d`로 MySQL 실행 중
- [ ] 저장소 맨 위 폴더에 `.env` 있음 (DB, Discord, JWT 값)
- [ ] 디스코드 로그인으로 가입까지 해 본 적 있음
- [ ] 내 브랜치가 최신 develop을 포함함 (`git fetch origin` → `git merge origin/develop`)

> 새 환경 변수는 없습니다. PDF 저장 폴더 `UPLOAD_DIR`은 선택값이고, 비워 두면 `backend/uploads/`를 씁니다.
> `backend/uploads/`는 `.gitignore`에 들어 있어서 올린 PDF가 커밋되지 않습니다.

---

## 2. DB에 새 테이블 넣기 (가장 중요)

이번 작업은 SQL 파일 3개를 추가했습니다.

| 파일 | 만드는 것 |
|---|---|
| `database/init/004_create_expert_profile_tables.sql` | 내 이력 테이블 11개 (분야 기준표 2개 포함) |
| `database/init/005_seed_research_field.sql` | 분야 기준표 데이터 (대분류 10개, 세부 분야 83개) |
| `database/init/006_create_research_tables.sql` | 내 연구 테이블 6개 |

`database/init/`의 SQL은 **DB 볼륨이 비어 있을 때 한 번만** 자동 실행됩니다.
그래서 이미 DB를 쓰고 있었다면 **자동으로 안 들어갑니다.** 아래 두 방법 중 하나를 고르세요.

### 방법 A. 지금 DB를 유지하면서 추가 (회원 데이터 유지)

DBeaver에서 파일을 열고 **반드시 004 → 005 → 006 순서로** 하나씩 실행합니다.

1. DBeaver 왼쪽에서 내 DB 연결을 선택
2. `파일 → 파일 열기`로 `004_create_expert_profile_tables.sql` 열기
3. 편집기 위쪽에서 연결과 데이터베이스(`labbridge`)가 맞는지 확인
4. **Alt + X** (스크립트 전체 실행) — `Ctrl + Enter`는 커서가 있는 한 문장만 실행하니 쓰지 마세요
5. 005, 006도 같은 방법으로 실행

| 순서가 중요한 이유 |
|---|
| 005는 004가 만든 `field_category`, `research_field`에 데이터를 넣습니다. |
| 006의 `research_domain`은 `research_field`를, `research`는 001의 `researcher_profile`을 참조합니다. |

### 방법 B. DB를 처음부터 다시 만들기 (회원 데이터 삭제)

```powershell
docker compose down -v
docker compose up -d
docker compose logs mysql
```
- `down -v`: 컨테이너를 끄고 **DB 데이터(볼륨)까지 삭제**합니다. 가입한 회원도 모두 사라져서 디스코드로 다시 가입해야 합니다.
- `up -d`: 빈 DB로 다시 켜면서 001~006을 이름 순서대로 자동 실행합니다.
- 로그에 `running /docker-entrypoint-initdb.d/006_create_research_tables.sql`까지 나오고, 마지막에 `port: 3306 ... ready for connections`가 보이면 완료입니다.

### 2-1. 제대로 들어갔는지 확인

```sql
SHOW TABLES;                                   -- 23개
SELECT COUNT(*) FROM field_category;           -- 10
SELECT COUNT(*) FROM research_field;           -- 83
SHOW TABLES LIKE 'research%';                  -- 8개 (아래 설명)
```

`SHOW TABLES LIKE 'research%'`가 **8개**인 건 정상입니다.
내 연구 테이블 6개(`research`, `research_able_work`, `research_data_type`, `research_domain`, `research_output`, `research_reward`)에
이름이 `research`로 시작하는 기존 테이블 2개(`research_field`, `researcher_profile`)가 같이 잡히기 때문입니다.

---

## 3. 서버 켜기

터미널 두 개를 씁니다. **백엔드는 꼭 `backend` 폴더에서** 실행하세요.

**터미널 1 — 백엔드**
```powershell
cd C:\dev\project\what_the-lab\backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

**터미널 2 — 프론트**
```powershell
cd C:\dev\project\what_the-lab\frontend
npm install
npm run dev
```

확인:
- http://localhost:8000/docs 에 아래 묶음이 보이면 OK
  - `expert-profile`, `expert-portfolio`, `expert-history`, `taxonomy`, `researcher-research`
- http://localhost:8000/api/v1/taxonomy/fields → 대분류 10개, 각 안에 세부 분야 목록
- http://localhost:3000 이 열림

---

## 4. AI 전문가 — 내 이력 테스트

AI 전문가로 가입한 계정으로 로그인합니다. (가입 방법은 SIGNUP_LOGIN_GUIDE 8-2)

### 4-1. 화면 들어가기

1. 오른쪽 위 프로필 ▼ → **내 이력** (`/my-career`)
2. 맨 위에 "아직 찾기 목록에 보이지 않아요"와 필수 항목 체크리스트가 보이면 OK
   - 가입 때 고른 **할 수 있는 일**은 이미 체크되어 있습니다.

### 4-2. 필수 항목 채우기

| 카드 | 해 볼 것 | 서버 규칙 |
|---|---|---|
| **소개** | 할 수 있는 일 · 한 줄 소개 · 도메인 입력 → 저장 | 할 수 있는 일 1~3개, 한 줄 소개 40자, 도메인 1~5개 |
| **협업 조건** | 온라인 / 대면 가능 선택, 대면이면 지역 입력, 주당 시간, 희망 보상 | 대면이면 지역 필수(50자) |
| **포트폴리오** | [포트폴리오 추가하기] → 제목 · AI로 한 일 · 사용 기술 · 내 역할 → 저장 | 제목 60자, 역할 200자, AI로 한 일 1~3개, 기술 10개(하나당 30자) |

다 채우면 맨 위가 "공개할 준비가 됐어요"로 바뀝니다.

### 4-3. PDF 올리기·보기·지우기

1. 포트폴리오 **수정** → PDF 칸에서 파일 선택 → 저장
2. 포트폴리오 카드에 PDF 크기가 보이면 업로드 성공
3. PDF를 누르면 새 탭에서 열림 (**본인만** 열 수 있음)
4. 수정 모달에서 PDF 삭제 → 카드에서 사라짐

| 해 볼 오류 | 기대 결과 |
|---|---|
| PDF가 아닌 파일(예: 이름만 `.pdf`로 바꾼 이미지) | "PDF 파일만 올릴 수 있어요" (415) |
| 20MB 넘는 PDF | "PDF는 20MB까지 올릴 수 있어요" (413) |

> 서버가 파일 첫 부분이 `%PDF-`로 시작하는지 직접 검사합니다. 확장자만 바꾼 파일은 막힙니다.
> 파일은 `backend/uploads/portfolios/무작위이름.pdf`로 저장되고, DB에는 저장 위치만 남습니다.

### 4-4. 경력·학력·자격증 (선택)

- 탭을 바꿔 가며 **+ 추가 → 저장 → 수정 → 삭제**를 한 번씩 해 봅니다.
- 경력의 종료 월을 비우면 "재직 중"으로 보입니다.

### 4-5. 공개 켜고 끄기

1. 맨 위 **프로필 공개** 스위치를 켬 → "연구자 찾기 목록에 공개 중이에요"
2. 다시 끔 → 언제든 끌 수 있음
3. 필수 항목 하나를 지우고(예: 포트폴리오 삭제) 다시 켜 보기
   → 마지막 포트폴리오를 지우면 **공개가 자동으로 꺼집니다**
   → 그 상태에서 스위치를 켜면 "공개하려면 먼저 채워 주세요: 포트폴리오 1개" 오류가 나면 정상

### 4-6. DBeaver로 확인

```sql
SELECT user_id, introduce, is_public FROM expert;
SELECT * FROM domain;            -- 고른 도메인(FIELD ID)
SELECT * FROM collaboration;     -- 협업 조건 1줄
SELECT * FROM reward;            -- 희망 보상
SELECT portfolio_id, title, pdf_url FROM portfolio;   -- pdf_url = portfolios/....pdf
SELECT * FROM portfolio_able_work;
SELECT * FROM portfolio_skill;
SELECT * FROM career; SELECT * FROM education; SELECT * FROM certificate;
```

---

## 5. 연구회원 — 내 연구 테스트

**연구회원으로 가입한 다른 디스코드 계정**으로 로그인합니다.
(한 계정은 한 회원 유형만 가질 수 있습니다. 하나로 테스트하려면 SIGNUP_LOGIN_GUIDE 8-3으로 초기화)

### 5-1. 연구 등록

1. 프로필 ▼ → **내 연구** (`/my-research`) → 처음이면 빈 화면과 [+ 연구 작성]
2. **[+ 연구 작성]** → 4단계 모달

| 단계 | 입력 | 서버 규칙 |
|---|---|---|
| ① 연구 | 제목(필수), 연구 내용, 분야 | 제목 60자, 내용 500자, 분야 최대 3개 |
| ② 데이터 | 데이터 종류, 데이터 상태, 공유 조건 | "조건이 있어요"면 조건 설명(100자) |
| ③ 협업 | AI에게 맡기고 싶은 일, 원하는 결과물, 보상 형태(선택), 미팅 방식(선택) | 맡길 일 최대 3개 또는 "잘 모르겠어요", 결과물 "아직 모름"은 혼자만 선택 |
| ④ 확인 | 입력 내용 요약, 각 단계로 돌아가 수정 가능 | — |

3. **[등록하기]** → 목록에 카드가 생기고 **첫 등록 연구는 자동으로 "지정한 연구"**가 됨

### 5-2. 임시 저장

1. 새 연구를 열고 제목만 쓴 뒤 **[임시 저장]**
2. 목록에 "임시 저장" 배지, 버튼은 **[이어서 작성]**, 왼쪽 동그라미 없음 (임시 저장은 지정 불가)
3. [이어서 작성] → 나머지를 채워 [등록하기] → 일반 카드로 바뀜

### 5-3. 지정한 연구 바꾸기

- 다른 연구의 왼쪽 동그라미를 누르면 그 연구가 "지정한 연구"가 되고, 기존 것은 해제됩니다.
- 지정한 연구를 삭제하면 **남은 등록 연구 중 가장 최근 것**이 자동으로 지정됩니다.

### 5-4. 상세 화면

1. 목록에서 **연구 제목**을 누름 → `/my-research/{번호}`
2. 왼쪽: 연구 내용 / 데이터 / 협업, 비어 있는 칸은 "아직 안 적었어요"
3. 위쪽 버튼과 오른쪽 버튼은 연구 상태에 따라 다름

| 연구 상태 | 위쪽 버튼 | 오른쪽 버튼 |
|---|---|---|
| 지정한 연구 | [수정] [삭제] | [이 연구로 전문가 찾기] → `/experts` |
| 등록했지만 지정 안 함 | [이 연구로 지정] [수정] [삭제] | [이 연구로 지정하고 전문가 찾기] |
| 임시 저장 | [이어서 작성] [삭제] | [이어서 작성하기] |

4. [수정] → 모달에서 고치고 저장 → 상세 화면에 바로 반영
5. [삭제] → "이 연구를 삭제할까요?" → [삭제하기] → 목록으로 돌아감
6. 주소창에 없는 번호(예: `/my-research/99999`) → "연구를 찾을 수 없어요" + [내 연구로 돌아가기]

> 오른쪽 "이 연구로 협업 요청을 보낸 전문가"는 **협업 요청 기능을 만들기 전이라 항상 빈 상태**입니다.

### 5-5. DBeaver로 확인

```sql
SELECT research_id, status, is_primary, title FROM research;   -- is_primary = 1 은 한 줄만
SELECT * FROM research_domain;      -- 고른 분야(FIELD ID)
SELECT * FROM research_able_work;   -- 맡길 일(UG ID)
SELECT * FROM research_data_type;
SELECT * FROM research_output;
SELECT * FROM research_reward;
```
연구를 지우면 딸린 5개 테이블의 줄도 같이 지워집니다 (`ON DELETE CASCADE`).

---

## 6. 테이블 구조

```
user ─┬─ 1:1 ─ expert ─┬─ 1:N ─ domain ── N:1 ── research_field ── N:1 ── field_category
      │                ├─ 1:1 ─ collaboration
      │                ├─ 1:N ─ reward
      │                ├─ 1:N ─ portfolio ─┬─ 1:N ─ portfolio_able_work ── N:1 ── able_work
      │                │                   └─ 1:N ─ portfolio_skill
      │                ├─ 1:N ─ career
      │                ├─ 1:N ─ education
      │                └─ 1:N ─ certificate
      │
      └─ 1:1 ─ researcher_profile ── 1:N ─ research ─┬─ 1:N ─ research_domain ── N:1 ── research_field
                                                     ├─ 1:N ─ research_able_work ── N:1 ── able_work
                                                     ├─ 1:N ─ research_data_type
                                                     ├─ 1:N ─ research_output
                                                     └─ 1:N ─ research_reward
```

**1:N 테이블을 만드는 규칙** (새 테이블을 만들 때도 같은 방식으로)
- 자기 PK(`..._id`, AUTO_INCREMENT) + 주인 FK(`user_id` 또는 `research_id`)
- 같은 값을 두 번 넣지 않게 `UNIQUE (주인, 값)`
- 주인이 지워지면 같이 지워지게 `ON DELETE CASCADE`

### DB에는 코드, 화면에는 문구

| 항목 | 저장 값 → 화면 문구 |
|---|---|
| 미팅 방식 | `online` 온라인만 / `offline_ok` 대면도 가능 |
| 주당 시간 | `lt5` 5시간 이하 / `5_10` 5~10시간 / `gt10` 10시간 이상 |
| 보상 | `research_fund` 연구비 / `authorship` 논문 저자·사사 / `undecided` 상의 후 결정 |
| 연구 상태 | `draft` 임시 저장 / `registered` 등록 |
| 데이터 종류 | `image` 사진·영상 / `text` 글·문서 / `table` 숫자·표 / `audio` 음성 / `etc` 기타 |
| 데이터 상태 | `none` 아직 없음 / `collecting` 모으는 중 / `raw` 있지만 정리 안 됨 / `ready` 정리됨 |
| 공유 조건 | `open` 외부 공유 가능 / `conditional` 조건이 있어요 |
| 결과물 | `analysis` 분석 결과 / `model` 학습된 모델 / `tool` 자동화 도구 / `figure` 논문용 그림·표 / `unknown` 아직 모름 |
| 분야 | `FIELD001` ~ `FIELD083` (이름은 `research_field` 테이블) |
| 할 수 있는 일 / 맡길 일 | `UG01` ~ `UG11` (이름은 `able_work` 테이블) |

> 화면 문구는 `frontend/src/lib/my-career.ts`, `my-research.ts`에 있고, 허용 코드는 각 라우터 파일 위쪽에 있습니다.
> 코드를 추가·변경할 때는 **프론트 문구와 백엔드 허용 목록을 같이** 고쳐야 합니다.

---

## 7. API 목록

모두 `/api/v1`로 시작하고, `taxonomy`와 `able-works`를 빼면 **로그인이 필요**합니다 (쿠키 `access_token`).

### 내 이력 (AI 전문가)

| 주소 | 설명 |
|---|---|
| `GET /expert/profile` | 내 이력 전체 |
| `PUT /expert/profile/intro` | 소개 저장 (할 수 있는 일·한 줄 소개·도메인) |
| `PUT /expert/collaboration` | 협업 조건 저장 |
| `PUT /expert/profile/visibility` | 공개 켜기/끄기 (켤 때 필수 항목 검사) |
| `POST /expert/portfolios` | 포트폴리오 추가 |
| `PUT /expert/portfolios/{id}` | 포트폴리오 수정 |
| `DELETE /expert/portfolios/{id}` | 포트폴리오 삭제 (PDF 파일도 같이 삭제, 마지막 하나면 공개도 꺼짐) |
| `PUT /expert/portfolios/{id}/pdf` | PDF 올리기 (본문이 파일 자체, `Content-Type: application/pdf`) |
| `GET /expert/portfolios/{id}/pdf` | PDF 보기 (본인만) |
| `DELETE /expert/portfolios/{id}/pdf` | PDF 삭제 |
| `POST · PUT /{id} · DELETE /{id}` `/expert/careers` | 경력 추가·수정·삭제 |
| `POST · PUT /{id} · DELETE /{id}` `/expert/educations` | 학력 추가·수정·삭제 |
| `POST · PUT /{id} · DELETE /{id}` `/expert/certificates` | 자격증 추가·수정·삭제 |

### 내 연구 (연구회원)

| 주소 | 설명 |
|---|---|
| `GET /researcher/researches` | 내 연구 목록 |
| `GET /researcher/researches/{id}` | 연구 하나 (상세 화면) |
| `POST /researcher/researches` | 연구 등록·임시 저장 (`status`: `draft` / `registered`), 최대 20개 |
| `PUT /researcher/researches/{id}` | 연구 수정 |
| `DELETE /researcher/researches/{id}` | 연구 삭제 |
| `PUT /researcher/researches/{id}/primary` | 이 연구를 지정 |

### 공통

| 주소 | 설명 |
|---|---|
| `GET /taxonomy/fields` | 연구 분야: 대분류 10개 안에 세부 분야 |
| `GET /expert/able-works` | 할 수 있는 일 11개 (가입 때부터 있던 API) |

**응답 규칙:** 저장·수정·삭제 API는 바뀐 한 줄이 아니라 **최신 상태 전체**를 돌려줍니다.
내 이력은 프로필 전체, 내 연구는 연구 목록 전체입니다. 화면은 받은 값으로 그대로 다시 그리면 됩니다.

**권한 규칙:** 남의 포트폴리오·이력·연구 번호를 넣으면 **404**가 납니다. "있지만 남의 것"인지도 알려 주지 않습니다.

---

## 8. 파일 구조

### 백엔드 (`backend/app/`)

| 파일 | 역할 |
|---|---|
| `form_rules.py` | 입력 검사 공통 함수 (`required_text`, `optional_text`, `unique_list`, `bad_request`) |
| `db.py` | `transaction()` 추가: 여러 테이블 저장을 하나로 묶고, 실패하면 전부 취소 |
| `config.py` | `UPLOAD_DIR` 추가 |
| `upload_store.py` | PDF를 무작위 이름으로 저장·삭제 |
| `expert_profile_store.py` | 내 이력 전체 불러오기, 공개 필수 항목 검사 |
| `research_store.py` | 내 연구 목록 불러오기, 연구회원인지 확인 |
| `routers/expert_profile.py` | 소개·협업 조건·공개 |
| `routers/expert_portfolio.py` | 포트폴리오, PDF |
| `routers/expert_history.py` | 경력·학력·자격증 |
| `routers/taxonomy.py` | 연구 분야 목록 |
| `routers/researcher_research.py` | 내 연구 등록·수정·삭제·지정·상세 |
| `main.py` | 위 라우터 5개 등록 |

### 프론트 (`frontend/src/`)

| 파일 | 역할 |
|---|---|
| `app/my-career/page.tsx` | 내 이력 주소 |
| `app/my-research/page.tsx` | 내 연구 주소 |
| `app/my-research/[id]/page.tsx` | 내 연구 상세 주소 (`[id]` = 연구 번호) |
| `components/my-space-shell.tsx` | 왼쪽 "내 공간" 틀 |
| `components/modal.tsx` | 공통 모달 (`Modal`, `ModalActions`, `Chip`, `useSaving` …) |
| `components/my-career-profile.tsx` | 내 이력 화면 |
| `components/my-career-*-modal.tsx` | 소개·협업·포트폴리오·이력 모달 4개 |
| `components/my-research-list.tsx` | 내 연구 목록 |
| `components/my-research-modal.tsx` | 연구 등록·수정 4단계 모달 |
| `components/my-research-detail.tsx` | 내 연구 상세 |
| `lib/my-career.ts`, `lib/my-research.ts` | 타입, 화면 문구, 입력 규칙 |

### 시드 스크립트

`005_seed_research_field.sql`은 **스크립트가 만든 파일**입니다. 직접 고치지 말고 다시 만드세요.
```powershell
# 저장소 맨 위 폴더에서
python database\seed\build_research_field_seed.py
```
- 입력: `taxonomy/v4.0/categories.json`, `taxonomy/v4.0/research-fields.json`
- 분류표 버전이 바뀌면 스크립트의 `TAXONOMY_VERSION`과 `TAXONOMY_DIR`을 같이 바꿉니다.

---

## 9. 자주 나는 오류

| 증상 | 원인 | 해결 |
|---|---|---|
| 내 이력·내 연구 화면에 오류 문구, 백엔드 터미널에 `Table 'labbridge.portfolio' doesn't exist` 같은 오류 | 004~006을 안 넣음 | 2번 방법 A 또는 B |
| 005 실행 시 `Table 'field_category' doesn't exist` | 004보다 005를 먼저 실행 | 004 → 005 → 006 순서로 |
| DBeaver에서 첫 줄만 실행됨 | `Ctrl + Enter`로 실행 | **Alt + X** (스크립트 전체 실행) |
| `ModuleNotFoundError: No module named 'app'` | `frontend` 등 다른 폴더에서 uvicorn 실행 | `cd backend` 후 실행 |
| `/docs`에 새 묶음이 안 보임, 화면은 `Not Found` | `main.py`에 라우터 등록 누락 | import와 `app.include_router(...)` 둘 다 확인 |
| 내 연구에서 "연구회원만 쓸 수 있어요" | AI 전문가 계정으로 들어감 | 연구회원 계정으로 로그인 |
| 공개 스위치가 안 켜짐 | 필수 항목이 남음 | 맨 위 체크리스트의 빈 항목 채우기 |
| PDF 업로드 415 | PDF가 아님 (확장자만 바꾼 파일 포함) | 실제 PDF로 |
| PDF 업로드 413 | 20MB 초과 | 파일 줄이기 |
| 다른 PC에서 받았더니 PDF가 "올린 PDF가 없어요" | PDF는 git에 안 올라감 (`backend/uploads/`) | 그 PC에서 다시 올리기 |
| 디스코드 콜백에서 `Internal Server Error` | MySQL(Docker)이 꺼져 있음 | Docker Desktop 켜고 `docker compose up -d`, 콜백 주소 새로고침 말고 **처음부터 다시 로그인** |
| `npx tsc --noEmit -p` 오류 | 마지막 `.` 빠짐 | `npx tsc --noEmit -p .` (아무것도 안 나오면 통과) |

---

## 10. 아직 안 된 것 (다음 작업)

- [ ] **협업 요청**: 연구 상세 오른쪽 "요청을 보낸 전문가" 목록, 요청 관리
- [ ] **전문가 찾기 DB 연결**: [이 연구로 전문가 찾기]는 지금 `/experts`로 이동만 함 (안홍진 담당)
- [ ] 워크스페이스 (매칭 후 협업 공간)
- [ ] 테이블 이름 정리: `collaboration`(전문가 협업 조건)은 앞으로 만들 협업 요청과 헷갈리므로 이름 변경 예정
- [ ] `expert_able_work.expert_capability` → `able_work_id`로 이름 맞추기 (Supabase 이전 때)
- [ ] 코드·문구 상수 한곳으로 모으기 (보상·미팅 코드가 내 이력과 내 연구에 따로 있음)
- [ ] PDF 저장소를 서버 폴더 → 클라우드 저장소로 (배포 전)
- [ ] 분류표는 전부 `pending_review` → 운영 승인 후 상태 변경
- [ ] 이제 쓰지 않는 `frontend/src/lib/taxonomy-options.ts` 삭제 (화면 먼저 만들 때 쓴 임시 목록, 지금은 API로 불러옴)

### 다른 작업과 연결되는 부분

- **전문가 찾기:** 전문가의 도메인은 `domain.field_id`, 연구의 분야는 `research_domain.field_id`로 **같은 FIELD ID**를 씁니다.
  할 수 있는 일(`expert_able_work`)과 맡길 일(`research_able_work`)도 **같은 UG ID**입니다. 이 둘로 연구와 전문가를 연결하면 됩니다.
- **공개 여부:** 찾기 목록에는 `expert.is_public = TRUE`인 전문가만 보여야 합니다.
- **지정한 연구:** 협업 요청을 보낼 때 기본 연구는 `research.is_primary = TRUE`인 연구입니다.

---

## 출처

- 연구 분야·할 수 있는 일: 팀 분류표 `taxonomy/v4.0` (모든 항목 `pending_review`, 운영 승인 전)
