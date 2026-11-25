# 인사이트 첫 백엔드 — 실행·검증 안내

> **관리자 화면 후속(2026-10-22):** `/admin/insights`와 우상단 계정 메뉴의 `인사이트 관리자`를 구현했습니다. 서버가 관리자 권한을 확인한 로그인 계정에만 메뉴를 표시합니다. 화면에서 후보 등록·편집·검토·승인·수동 게시·이력 확인이 가능하며, 승인과 게시·예약 시각과 실제 worker 실행은 분리되어 있습니다. 실제 계정 권한 부여나 공용 DB의 글 승인은 실행하지 않았습니다. [사용법과 실제 검증 경계](../qa/insight-admin-20261022/README.md)를 참고하세요.

> **현재 상태 보완(2026-10-22):** 아래의 메모리 회원/MySQL 분리 설명은 과거 기록입니다. 현재 회원·프로필·인사이트는 공통 Supabase/PostgreSQL 연결을 사용합니다. [팀 시작 안내](../development/SUPABASE_TEAM_ONBOARDING.md)를 우선 적용하세요. 후속으로 관리자 전용 **후보 일괄 입력 API**를 로컬 구현했습니다. 기본 미리 보기·검증 상태 초기화·기존 원고 보존 규칙과 실행 방법은 [후보 입력 검증 기록](../qa/INSIGHT_CANDIDATE_IMPORT_2026-10-22.md)에 있습니다. 실제 후보 원격 반입이나 정기 worker 활성화는 아직 하지 않았습니다.

> **2026-10-17 통합 주의:** PR #10 충돌 해결로 develop의 회원·가입·로그아웃 코드를 함께 사용합니다. 아래의 회원 메모리 저장소 설명은 2026-10-16 당시 기록입니다. 현재 회원은 MySQL, 인사이트는 PostgreSQL이며 회원 PostgreSQL 전환은 대기 중입니다. 실행에는 임시 회원 DB 설정도 필요합니다. [통합 검증 기록](../qa/PR10_MERGE_RESOLUTION_2026-10-17.md)을 먼저 읽고, 이 문서의 과거 실제 DB 검사와 이번 가상 회원 회귀 검사를 구분하세요.

기준일: 2026-10-16. 브랜치: `feature/insight-foundation`.

> 후속 적용 완료: 사용자 승인으로 개발용 `labbridge-dev`에 최초 migration을 적용했고, 실제 PostgreSQL 검사를 포함해 **29개 테스트가 통과**했다. 이후 사용자가 제공한 본인 Discord 사용자 ID를 로컬 관리자 목록에 등록하고 개발 API를 활성화했다. 실행 중인 백엔드 재시작과 실제 로그인 확인은 남아 있다. 기본 예시 설정은 계속 비활성이다. [실제 DB 검증 기록](../qa/INSIGHT_SUPABASE_MIGRATION_2026-10-16.md)에서 각 시점의 검증 범위를 구분한다.

## 1. 이번에 만든 것과 만들지 않은 것

이번 단계의 목표는 **사례 한 편을 비공개로 저장하고, 사람이 근거를 검토한 뒤, 승인한 버전만 공개 API에 한 번 게시하는 것**이다. 처음부터 수집·AI·예약 실행을 연결하면 문제가 발생한 지점을 찾기 어렵기 때문에, 먼저 이 작은 흐름의 안전장치를 확인한다.

| 완료한 로컬 구현 | 아직 하지 않은 것 |
|---|---|
| PostgreSQL 연결 코드·5개 테이블, 개발용 Supabase 적용·구조·역할 권한 검사 | 운영 DB 적용, 최소 권한 앱 계정 분리 |
| 관리자 후보 등록·수정·검토 요청·승인·공개 API | 관리자 화면, 기존 사례/트렌드 화면의 API 연결 |
| 본문 버전·승인 무효화·검토 이력 | 게시 후 정정·철회 및 다인 검수 절차 |
| 미승인 공개 차단·중복 게시 방지·예약 전 실행 차단 | 주간 수집·알림·예약 worker, 운영 스케줄 등록 |
| 주장·평가·출처·키워드 승인 상태 검사 | 원 논문 실제 재검증, 철회 여부 재조회, 대량 자료 import |
| 임시 DB 테스트·오프라인 SQL·실제 PostgreSQL 동시성 검사 | 실제 Discord 로그인·화면 E2E·부하/장애 복구 검사 |

기존 정적 게시물은 보존했다. API에서 공개했다고 기존 화면에 나타나는 단계까지 구현한 것은 아니다. 기능은 `INSIGHTS_ENABLED=false`가 기본이며, 기능이 꺼져 있으면 인사이트 API는 404를 반환한다. 기존 health·로그인 API는 그대로다.

## 2. 팀원이 먼저 확인할 결정

- 공통 DB는 **Supabase(PostgreSQL)**로 확정했다. 이번 코드가 Supabase 프로젝트를 생성하거나 기존 회원 저장소를 이행하지는 않는다.
- 제한된 개발 범위는 [D-23](../product/03_DECISION_LOG.md#d-23-인사이트-첫-백엔드와-공통-db)을 따른다. 인사이트 전체를 MVP에 편입한 것으로 해석하지 않는다.
- 편집 판단은 [운영 기준서](INSIGHT_EDITORIAL_OPERATING_STANDARD.md)를 따른다. **주 1회는 제안이지 의무가 아니다. 도움이 되는 글이 없으면 게시하지 않는다.**
- 실제 코드·자료·분류체계 차이는 [Phase 0 기록](PHASE_0_FINDINGS.md)을 읽는다.

## 3. DB 없이 먼저 테스트하기

저장소 루트에서 다음 순서로 실행한다. `uv`가 설치되어 있어야 한다.

```powershell
cd backend
uv sync --locked
uv run pytest -q
uv run ruff check app/insights app/routers/insights.py migrations tests
uv run ruff format --check app/insights app/routers/insights.py migrations tests
uv run alembic history
uv run alembic upgrade head --sql
```

각 명령의 의미:

- `sync --locked`: 팀이 공유한 `uv.lock`의 버전대로 필요한 도구를 설치한다.
- `pytest`: 실제 논문 대신 가상 사례를 사용해 기능을 검사한다. 일반 테스트는 임시 SQLite DB를 만들고 실제 `DATABASE_URL`을 더미 값으로 바꾼다. 원격 DB를 사용하지 않는다.
- `ruff check / format --check`: 코드 실수와 형식을 검사한다. 검사만 하므로 파일을 자동 수정하지 않는다.
- `alembic history`: DB 구조의 변경 순서를 조회한다. DB에 접속하지 않는다.
- `upgrade head --sql`: 적용할 PostgreSQL SQL만 화면에 출력한다. **`--sql`이 없으면 실제 DB 변경 명령이므로 구분해야 한다.**

한 편의 전체 흐름만 따라가려면 `uv run pytest -q tests/test_insight_workflow.py -k one_case`로 실행한 뒤 해당 테스트를 읽는다. `make_draft()`의 가상 출처·평가를 운영 DB에 넣지 않는다.

이번 환경에서는 임시 폴더 접근 제한 때문에 기본 권한 테스트가 실패했고, 허용된 권한으로 재실행하여 검증했다. 같은 오류를 만나면 DB 로직을 바꾸기 전에 임시 폴더 접근 권한부터 확인한다.

## 4. 데이터가 흘러가는 순서

1. `create_candidate()`는 DOI를 정규화하고 중복을 확인한 뒤 초안과 1번 본문을 저장한다.
2. `submit_candidate()`는 초안만 `pending_review`로 옮긴다.
3. `approve_candidate()`는 최신 버전·근거·평가·키워드를 검사하고 사람이 확인한 버전 번호와 승인자를 기록한다.
4. `publish_candidate()`는 승인 버전과 예약 시간을 다시 확인하고 공개 가능한 내용만 복사해 저장한다.
5. 공개 API는 원본 후보가 아니라 이 공개용 복사본만 반환한다.

`revision`은 본문의 판본, `version`은 후보 상태까지 포함한 변경 번호다. 수정하면 새 판본을 만들고 기존 승인을 취소한다. 클라이언트는 조회한 `version`을 `expected_version`으로 보내며, 다른 사람이 먼저 바꿨다면 409를 받고 다시 조회해야 한다.

`idempotency_key`는 게시 명령의 고유 번호다. 통신 문제로 **같은 명령을 재전송할 때 같은 번호**를 보내면 기존 게시물을 반환한다. DB의 고유 제약과 PostgreSQL 행 잠금도 함께 사용한다. 실제 동시 요청 보장은 아래 PostgreSQL 검사까지 통과한 뒤 판단한다.

### 5개 테이블과 판본 고정

| 테이블 | 한 가지 책임 |
|---|---|
| `sources` | DOI·출처 URL의 중복 방지 |
| `candidates` | 현재 상태·판본·승인·예약 정보 |
| `revisions` | 출처·본문·주장 근거·평가·키워드를 함께 묶은 JSON 판본 |
| `review_events` | 누가 어떤 이유로 상태를 바꿨는지 기록 |
| `publications` | 승인 판본의 공개용 복사본, 게시 명령·주소 중복 방지 |

본문과 근거를 함께 고정하면 승인 후 근거만 바뀌는 실수를 줄일 수 있다. claim·mapping 별도 테이블과 수집 작업 테이블은 후속 단계에서 분리한다. 현재 판본·이력의 불변성은 **서비스 API 규칙**이며 DB 소유자의 직접 SQL까지 차단하는 것은 아니다.

## 5. 승인 조건과 한계

- 출처 서지 확인, 필수 주장 8개, 주장별 검토 완료와 근거 위치가 필요하다.
- 원문 근거 표시는 허용된 원문 접근 수준과 맞아야 한다. AI 역할·연구자 역할·검증 방법을 초록만으로 검증 완료할 수 없다.
- 7개 평가 항목은 서버가 합산한다. 12점 만점에 9점 미만이면 보완이 필요하다. **9점 이상이라고 논문의 질이나 글의 유용성이 자동 보증되지는 않는다.**
- 편집·권리 확인은 관리자 본인이 확인해야 한다. 현재는 이미지를 업로드·수집·공개하는 기능이 없다.
- 기술 ID는 저장소의 실제 `taxonomy/v4.0/capabilities.json`에서 승인 상태를 다시 읽는다. 요청 본문에 승인 상태를 넣어 우회할 수 없다.
- 현재 CAP 항목은 `pending_review`다. 자동 승격하지 않는다. 키워드 없는 사례는 일반 `/experts`로 안내하며 CAP 기반 검색을 구현했다고 표시하지 않는다.
- 이 코드는 사람의 검토 결과를 검사·저장한다. 논문 진위·철회·저작권을 스스로 확인하는 수집/검증 에이전트가 아니다.

## 6. 개발용 Supabase 연결 전 체크

아래는 새 개발 환경에 적용할 때의 절차다. 이번 `labbridge-dev`에서는 대상·권한 확인 후 최초 적용을 완료했다. 다른 DB에 자동 적용하지 않으며 운영용 대상은 별도 확인한다.

1. 운영 DB와 분리된 개발용 Supabase 프로젝트인지 확인한다. 백업·스키마 충돌·허용된 DB 변경 권한을 확인한다.
2. 서버 전용 PostgreSQL 연결 문자열을 로컬 `.env`의 `DATABASE_URL`에 넣는다. 실제 값은 채팅·문서·브라우저에 붙이지 않는다. 직접 연결 또는 네트워크에 맞는 세션 풀 연결을 선택하고 연결 제공자의 SSL 지침을 따른다.
3. `insight_private` schema가 기존에 있으면 무조건 덮어쓰지 말고 먼저 조사한다. 최초 변경 파일은 충돌 시 실패하도록 작성했다.
4. 인사이트 schema를 Supabase Data API의 exposed schemas에 추가하지 않는다. 변경 파일은 PUBLIC 및 존재하는 anon/authenticated 역할의 schema·table 권한을 회수한다. 이는 Supabase RLS 정책이나 실제 원격 접근 차단 실측을 완료했다는 뜻이 아니다.
5. 개발 DB에 적용할 SQL을 먼저 검토한다. 팀이 대상·권한을 확인한 후에만 아래 **실제 변경 명령**을 실행한다.

```powershell
# backend 폴더에서, 확인한 개발용 DATABASE_URL만 설정한 상태로 실행
uv run alembic upgrade head
uv run alembic current
```

마이그레이션은 `insight_private`의 5개 테이블과 버전 번호용 `public.insight_alembic_version`을 사용한다. 기존 회원·프로젝트 테이블은 변경하지 않는다. 버전 비교 범위도 인사이트 schema로 제한했다. 최초 migration의 downgrade는 5개 테이블과 모든 내용을 지우므로 평소 복구 수단처럼 실행하지 않는다. 먼저 기능을 끄고 백업·영향을 확인한다.

운영에서는 마이그레이션 권한과 앱 실행 계정의 최소 권한을 분리하고 실측한다. 현재 기본 연결 코드가 그 계정을 자동 생성해 주지는 않는다.

### 관리자·기능 설정

로컬 `.env`에서 다음 항목을 운영자가 지정한다. `.env.example`에는 안전한 기본값만 공유한다.

| 변수 | 의미 |
|---|---|
| `INSIGHTS_ENABLED` | DB 준비 후 개발 환경에서만 `true`. 기본 `false` |
| `INSIGHT_ADMIN_DISCORD_IDS` | 승인 가능한 실제 Discord 고유 번호를 쉼표로 구분. 빈 값이면 모두 차단 |
| `INSIGHT_ALLOWED_ORIGINS` | 쓰기 요청을 허용할 정확한 브라우저 출처. 로컬 기본은 http://localhost:3000,http://localhost:8000 |

기존 Discord 로그인 쿠키를 사용한다. 관리자 권한은 클라이언트가 보낸 역할이 아니라 **서버가 확인한 Discord ID와 서버 설정**으로 판단한다. 쓰기 API에는 허용된 `Origin` 헤더도 필요하다. 임의 Origin 추가나 와일드카드 허용으로 오류를 피하지 않는다.

기존 회원 저장은 아직 메모리 방식이므로 서버 재시작 후 재로그인이 필요하다. 감사 이력은 재로그인 때 달라지는 임시 회원 UUID 대신 확인된 Discord ID를 사용한다. 자체 JWT가 Supabase Auth 로그인으로 자동 전환되는 구조는 아니다.

### 본인 관리자 등록 후 실제 로그인 확인

관리자 ID는 Discord 개발자 포털의 Client ID가 아니라 일반 Discord 앱에서 복사한 **사용자 ID**다. 사용자가 지정한 본인 계정만 로컬 `.env`에 넣는다. 팀 공유 예시 파일에 실제 ID를 옮기지 않는다.

1. 백엔드 터미널에서 Ctrl+C로 기존 서버를 종료하고 `backend` 폴더에서 `uv run uvicorn app.main:app --reload --port 8000`으로 다시 실행한다. `.env` 변경만으로 이미 실행 중인 서버 설정까지 바뀐다고 가정하지 않는다.
2. 프론트가 실행 중인지 확인한다. 꺼져 있다면 별도 터미널의 `frontend` 폴더에서 `npm run dev`로 실행한다.
3. 사용할 브라우저에서 `http://localhost:8000/api/v1/auth/discord/login`을 열고 **본인 계정으로 직접** 로그인·승인한다. 다른 브라우저에서 로그인한 쿠키가 자동으로 공유된다고 가정하지 않는다.
4. 같은 브라우저에서 `http://localhost:8000/api/v1/auth/me`를 열어 `discord_id`가 등록한 본인 번호와 일치하는지 확인한다.
5. 같은 브라우저에서 `http://localhost:8000/api/v1/admin/insights/candidates`를 연다. 새 DB라면 200과 빈 목록이 정상이다. 401은 로그인 미확인, 403은 로그인한 계정이 관리자 목록과 불일치, 기능 비활성 메시지의 404는 설정 반영·서버 재시작을 확인한다.

서버 재시작은 현재 회원 메모리를 비우므로 기존 쿠키가 있어도 다시 로그인해야 한다. OAuth 콜백의 실패 원인을 확인할 때 code·state·쿠키·토큰이 포함된 URL을 채팅이나 문서에 붙이지 않는다. 위 확인은 조회만 수행하며 글을 자동 승인·게시하지 않는다.

## 7. API 계약

관리자 기본 경로: `/api/v1/admin/insights/candidates`. `ID`는 후보 UUID다.

| 요청 | 입력·역할 |
|---|---|
| `POST 기본 경로` | `Draft`: source/title/slug/summary/research_field/case_type/claims/scores/keyword_ids/image_policy |
| `GET 기본 경로` | 목록. page, page_size(최대 50) |
| `GET 기본 경로/ID` | 후보 상태·판본·검토 이력 |
| `POST 기본 경로/ID/revisions` | expected_version, draft, reason. 새 판본으로 저장하고 승인 취소 |
| `POST 기본 경로/ID/submit` | expected_version, reason |
| `POST 기본 경로/ID/approve` | expected_version, reason, editorial_checked=true, rights_checked=true, 선택 scheduled_for |
| `POST 기본 경로/ID/publish` | expected_version, reason, idempotency_key |
| `GET /api/v1/insights` | 공개된 글만 목록 조회. page, page_size |
| `GET /api/v1/insights/SLUG` | 공개된 글만 상세 조회 |

`scheduled_for`는 `2026-10-23T09:00:00+09:00`처럼 시간대를 포함해야 한다. 예약 승인 자체가 자동 실행을 뜻하지 않는다. 아직 worker가 없으므로 시각이 지나도 게시 명령이 필요하다. 정확한 입력 필드는 서버의 `/docs` 또는 `app/insights/schemas.py`에서 확인한다.

대표 오류: 401 로그인 필요, 403 관리자/Origin 불일치, 404 비활성·없는 후보/게시물, 409 변경 충돌·미승인·중복, 422 입력·근거 보완 필요, 503 DB 미설정/접근 불가.

## 8. PostgreSQL 전용 검사와 이번 결과

실제 동시성 검사는 기본 비활성이다. **운영용 URL을 사용하지 말고**, 쓰고 지워도 되는 전용 테스트 DB에만 다음 환경변수를 로컬로 설정한다.

- `INSIGHT_RUN_POSTGRES_TESTS=true`
- `INSIGHT_TEST_DATABASE_URL`: 별도 테스트 DB 연결 문자열

그 후 `uv run pytest -q tests/test_insight_postgres.py`로 실행한다. 테스트는 `insight_test_<임의번호>` schema를 만들고 두 작업이 같은 게시 명령을 동시에 실행하게 한다. 검사 후 자신이 만든 schema와 테이블만 정리한다. 이 검사는 ORM 생성 테이블 기준이며 실제 migration 적용·Supabase 역할 검사를 대신하지 않는다.

2026-10-16 최초 로컬 검증 결과 (실제 DB 적용 전 기록):

- 전체 테스트 **28 passed, 1 skipped**. 건너뛴 항목은 실제 PostgreSQL 동시성 검사다.
- 권한·Origin·근거 부족·버전 충돌·승인 취소·중복 게시·미래 예약 차단·저장 재접속 검사 통과.
- PostgreSQL DDL 생성 및 Alembic 오프라인 최초 SQL 검사 통과. 원격 적용 아님.
- Ruff 검사·형식 검사, 변경 공백 검사 통과.
- 테스트 도구의 httpx 사용 중단 예고 경고 1건은 남아 있다. 기존 OAuth용 httpx 동작을 임의 변경하지 않았다.
- 실제 Discord 로그인, PostgreSQL 행 잠금·Supabase 접근 권한, 프론트 화면·예약 실행은 미검증이다.

같은 날 후속 검증에서 실제 개발 DB의 schema·모델 일치, anon/authenticated 역할 권한 차단, 공개 API 조회, PostgreSQL 동시 게시 방지를 확인했다. 이 실행에서는 **29 passed, 0 skipped**였다. 검사 전용 schema와 가상 데이터는 정리했고 실제 인사이트 테이블은 0건으로 남겼다. 평소 기본 테스트에서는 실제 DB 검사를 계속 건너뛰며, 이 결과는 별도 테스트 설정을 명시한 실행 결과다. [상세 검증 기록](../qa/INSIGHT_SUPABASE_MIGRATION_2026-10-16.md)을 참고한다.

## 9. 코드 읽기와 다음 단계

`schemas.py`(들어오는 자료 검증) → `service.py`(업무 규칙) → `routers/insights.py`(웹 요청 연결) → `tests/test_insight_workflow.py`(실제 사용 순서) 순서로 읽으면 쉽다. DB 연결은 `database.py`, 표 구조는 `models.py`다.

추가 의존성의 이유: SQLAlchemy는 Python 객체와 DB를 연결하고, psycopg는 PostgreSQL과 통신하며, Alembic은 표 구조의 변경 순서를 기록한다. pytest·Ruff는 개발 검사 도구다. LangChain·LangGraph·LLM SDK는 아직 넣지 않았다.

개발 DB·권한 확인과 실제 migration·PostgreSQL 검사는 완료했다. 다음 순서는 **관리자 계정 확인·개발 기능 활성화 → 실제 사례 한 편 수동 검토 → 관리자/공개 화면 연결 → 출처 수집 → AI 초안 → 주간 편성·예약 실행**이다. 각 단계가 검증되기 전에는 무인 실행을 켜지 않는다. AI 트렌드는 공통 출처·판본·검토·게시 구조를 검증한 후 별도 입력/검증 규칙으로 확장한다. 현재 API는 사례만 지원한다.

학습 힌트: “승인 버튼을 누른 다음 본문을 고치면, 이전 승인은 왜 사용할 수 없을까?”를 먼저 생각하고 `revise_candidate()`에서 그 답에 해당하는 줄을 찾아보자.

## 10. 2026-10-22 기존 글 이관·수집 목록 후속 상태

위 최초 단계 기록 이후 사용자 추가 승인으로 기존 공개 원고 31개를 개발 Supabase의 보존본으로 이관하고, 사례 3개·트렌드 3개를 비공개 초안으로 저장했습니다. `/admin/insights`의 **수집 후보 / 게시 중인 글**에서 각각 확인합니다. 관리자 목록 API는 `/api/v1/admin/insights/publications`이며, 수집 후보 API는 `collection_only=true`, `kind=case|trend` 필터를 지원합니다.

현재 공개 사이트는 여전히 코드의 원고를 읽습니다. 보존본이 DB에 있다는 사실과 공개 화면이 DB를 직접 읽는다는 사실을 구분해야 합니다. 기존 원고 이관은 새 승인 이력을 만들지 않으며 읽기 전용입니다. 이미지는 기존 파일 경로만 보존합니다. 새 트렌드는 수집·수정·검토 대기까지 가능하고 전용 게시 검증 연결 전에는 승인·게시가 차단됩니다. [실행·검증·출처·Phase 0 기록](../qa/insight-catalog-20261022/README.md)을 확인하세요.

## 11. 같은 날 관리자 목록·설정·수정본 작업공간 후속

상단 목록 전환 대신 좌측 메뉴와 통합 목록을 사용합니다. ‘후보 직접 등록’은 빈 편집 모달, ‘목록 새로고침’은 DB 목록 재조회이며 수집 실행이 아닙니다. 설정은 `GET/PUT /api/v1/admin/insights/collection-settings`로 팀 공통 DB에 저장합니다. GET만으로 기본 제안값을 저장하지 않습니다. 이 단계에는 수집 실행 API·스케줄러·worker가 없습니다.

공개 글을 수정하려면 ‘수정 초안 만들기’를 명시적으로 누릅니다. 전체 원고와 이전 공개 스냅샷을 보존한 새 판본을 만들며, 수정 저장은 기존 승인을 무효화합니다. 재승인과 명시적 게시 전까지 공개 API의 이전 스냅샷을 유지합니다. 이 기능이 추가됐다고 일반 사이트의 정적 원고가 DB와 자동 동기화되는 것은 아닙니다. [화면·API·검증·개발 DB 변경 기록](../qa/insight-workspace-20261022/README.md).
