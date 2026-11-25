# PostgreSQL·계정 공통 연결 검증

> 아래 최초 점검 뒤 사용자가 Supabase를 팀 기본 DB로 확정하고 통합을 요청했습니다. 현재 결과는 맨 아래 **후속 Supabase 확정·적용** 절을 기준으로 합니다. 초기 미완료 항목을 완료로 소급해 바꾸지 않고 실제 순서를 남깁니다.

## 범위와 기준

- 사용자 요청: PostgreSQL 통일 여부 확인 및 서로 다른 담당자가 만든 계정·설정 연결.
- 시작 시 로컬 develop과 fetch한 origin/develop은 모두 dbd2c91(PR #16)로 일치했습니다. 기존 미추적 PDF·QA 캡처는 수정·삭제하지 않았습니다.
- 작업 브랜치: feature/postgres-account-integration. 커밋·push·PR 생성·병합·배포는 이번 요청에서 수행하지 않았습니다.
- 공통 연결·인증과 문서만 변경합니다. 실제 데이터 병합·초기화·기능 확장은 하지 않습니다.

## 실제로 확인한 상태

- 회원·프로필·연구의 활성 SQL과 드라이버는 PostgreSQL로 전환됐습니다. 사용하지 않는 pymysql 의존성이 남아 있어 pyproject.toml과 uv.lock에서 제거했습니다.
- 회원 DB_*와 인사이트 DATABASE_URL이 별개였습니다. 실제 로컬 .env는 인사이트 Supabase URL과 옛 회원 포트 3309를 함께 가지고 있었습니다. 비밀번호·URL 원문은 기록하지 않습니다.
- 실행 중인 관련 컨테이너는 기존 MySQL이었고 PostgreSQL 컨테이너와 8000번 백엔드는 실행되지 않은 상태였습니다. Qdrant 등 다른 컨테이너를 건드리지 않았습니다. 런타임 상태는 확인 시점 기준입니다.
- 기존 DATABASE_URL의 Supabase에 읽기 전용 트랜잭션으로 접속했습니다. PostgreSQL 17.11, public.users 없음, insight_private.candidates 및 public.insight_alembic_version 있음. 테이블 존재 여부만 조회하고 rollback했습니다. 모든 회원/인사이트 테이블·권한을 완전 검수한 것은 아닙니다.

## 코드 통합

- app/database_config.py가 공통 대상 URL을 해석합니다. DATABASE_URL이 있으면 우선하고 없으면 DB_*를 사용합니다. URL의 암호 인코딩·sslmode 등 옵션을 회원 연결에도 전달합니다. 잘못된 URL은 비밀값을 포함하지 않는 오류로 실패하고 임의의 다른 DB로 우회하지 않습니다.
- 회원 psycopg·인사이트 SQLAlchemy·인사이트 migration이 같은 설정을 사용합니다. 기존 ORM/SQL 구현과 public/insight_private 분리는 유지합니다. migration SQL 내용과 기존 init SQL은 변경하지 않았습니다.
- 현재 사용자 검사 함수를 회원·인사이트에서 함께 사용합니다. 쿠키 서명·만료뿐 아니라 실제 users 회원 존재와 활성 상태를 확인합니다.
- JWT는 내부 user_id와 Discord 사용자 ID를 함께 검증합니다. DB 이전 시 같은 정수 번호가 다른 회원에게 배정되는 혼동을 막습니다. 구형 쿠키는 한 번 다시 로그인해야 합니다.
- users.is_admin을 조회하고 인사이트에서도 사용합니다. 기존 인사이트 전용 Discord 허용 목록은 호환하되 공통 권한을 자동 부여하지 않습니다. DB의 실제 관리자 값은 변경하지 않았습니다.

## 검증 결과

- 백엔드 pytest: **52 passed, 1 skipped**. 임시 SQLite·가상 회원·가상 Discord 응답만 사용합니다.
- 포함 항목: 동일 연결 대상·URL 우선순위·DB_* 대체·암호 및 sslmode 전달·잘못된 설정의 비밀값 비노출·공통 관리자와 인사이트 전용 권한 구별·정지/탈퇴/사라진 회원 차단·ID 재배정 쿠키 차단·구형 쿠키 재로그인·동일 Discord 콜백의 기존 회원 재사용·기존 승인/게시/중복 방지.
- PostgreSQL 동시성 테스트 1개는 전용 테스트 DB가 지정되지 않아 건너뛰었습니다. 공용 Supabase에 테스트 schema나 테스트 글을 만들지 않았습니다.
- 변경 Python 파일 Ruff 통과, git diff --check 통과. 기존 Starlette/httpx 테스트 클라이언트 deprecation 경고 1건은 유지됩니다.
- 최초 샌드박스 실행은 임시 폴더 권한으로 실패/지연되어 중단했습니다. 최종 검증은 새로 생성한 프로젝트 tmp 경로에서 권한이 허용된 실행으로 완료했습니다. 기존 파일을 테스트용으로 삭제하지 않았습니다.

## 남은 작업과 결정

- 사용자는 팀원의 Docker 설정 어려움 때문에 Supabase 공용 개발 DB와 간편한 Docker 실행을 비교 중입니다. 추천과 팀 초대/설정 절차는 [공통 안내](../development/SHARED_DATABASE_GUIDE.md)에 정리했습니다. 최종 대상은 아직 확정하지 않았습니다.
- 실파일 .env는 수정하지 않았고 백엔드를 실행하지 않았습니다. 새 코드에서는 DATABASE_URL이 회원에도 적용되므로, 회원 테이블이 없는 기존 Supabase에서 바로 로그인 테스트를 하면 안 됩니다.
- 공통 대상 확정 후 백업·기존 schema·권한을 검토하고 회원 테이블을 별도 적용해야 합니다. 기존 MySQL 회원/프로필/연구를 보존·이전할지 사용자 결정이 필요합니다. 내 PC init SQL을 기존 원격 DB에 무조건 재실행하지 않습니다.
- Supabase 조직 초대·DB 접속 계정·서비스 관리자 권한은 서로 다른 권한입니다. 이번에 어느 것도 생성·확대하지 않았습니다.
- 실제 OAuth 전체 로그인, 회원/프로필 CRUD, 실제 PostgreSQL 통합 트랜잭션, RLS/Data API 정책, 업로드 파일 공유, 배포는 미검증·미구현입니다. 현재 PDF 파일은 로컬 저장소이므로 DB만 공유해도 파일이 공유되지는 않습니다.

## 후속 Supabase 확정·적용 — 2026-10-21

### 사용자 선택과 변경 범위

- 사용자가 Supabase를 사용하는 기준으로 통합하고 조직 생성·초대 방법을 알려 달라고 요청했습니다.
- 기존 .env의 labbridge-dev 연결을 사용했습니다. 조직 생성·이메일 초대·프로젝트 조직 이동·유료 결제는 대신 실행하지 않고 [안내 문서](../development/SUPABASE_TEAM_ONBOARDING.md)로 전달합니다.
- 기존 MySQL 컨테이너·볼륨·회원·프로필·연구·업로드 파일은 보존하며 자동 이전하지 않았습니다. 공통 서버 구조의 통합과 기존 계정 데이터 이전은 구분합니다.

### 구조 추가와 보호

- 기존 public에는 insight_alembic_version만 있고 인사이트 표 5개의 데이터는 모두 0건이었습니다.
- Alembic 후속 revision 20261021_02를 추가했습니다. SQL 001~006은 PR #16 원본을 동결 복사해 미래 init 수정이 이미 적용한 migration을 바꾸지 않도록 했습니다.
- 기존 회원 표/함수가 있으면 자동 덮어쓰기를 중단합니다. 적용 전 프로젝트 번호 확인, 트랜잭션 advisory lock, 변경 전 인사이트 자료/버전 스냅샷, 한 트랜잭션의 생성·검증·확정을 사용합니다. 자동 downgrade는 회원 삭제를 막기 위해 거부합니다.
- 먼저 실제 DB에 적용한 뒤 전체 rollback하는 rehearsal을 통과했고, 같은 변경을 확정 적용했습니다. 기존 인사이트 자료가 동일함을 비교했습니다.
- 회원·프로필·연구 표 23개가 추가됐고, public 이력 표를 포함한 24개 표에 RLS를 적용했습니다. anon/authenticated/service_role의 표 접근 권한은 0건입니다. 새 identity 시퀀스와 트리거 함수의 기본 공개 권한도 제거했습니다.
- 프로젝트 전체 Data API 설정, auth/storage schema, 다른 팀원 조직/서비스 권한은 바꾸지 않았습니다. 신뢰된 backend DB 역할은 RLS 우회 권한이 있는 기존 개발 접속 역할입니다. 운영 전 제한된 서버 전용 역할 설계는 별도입니다.
- 기준표는 institution 271, able_work 11, field_category 10, research_field 83입니다. 기준표 상태 pending_review를 임의 승인하지 않았습니다.
- 재실행 시 이력 20261021_02를 확인하며 덮어쓰지 않고 점검만 합니다.

### 실제 검증

- 자동 검사 **63 passed, 1 skipped**. 실제 PostgreSQL 동시 게시 테스트는 전용 테스트 DB가 없어 미실행입니다. 변경 Python Ruff·잠금 파일 정합성·공백 검사는 통과했습니다. 기존 Starlette/httpx deprecation 경고는 유지합니다.
- 실제 Supabase + 가상 Discord 응답으로 callback → 회원 생성/JWT → 전문가 가입 → 프로필 → 관리자 403/200 → 로그아웃 401을 검증했습니다. 테스트 행과 임시 is_admin 값은 동일 연결의 바깥 트랜잭션에서 전부 rollback했습니다. 남은 테스트 회원 0건을 확인했습니다. identity 번호는 rollback 후에도 건너뛸 수 있으며, 이를 맞추려고 기존 sequence를 되돌리지 않습니다.
- 검증 스크립트: backend/scripts/verify_supabase_integration.py. 일반 팀원이 매번 실행할 필요는 없습니다. 실제 Discord 승인·토큰 교환은 가상 응답으로 대체했으므로 외부 OAuth 검증 완료로 표현하지 않습니다.
- 실제 로컬 HTTP: /health 200, /expert/able-works 200·11개, /taxonomy/fields 200·대분류 10개, /insights 200·0건. /auth/me와 /admin/insights/candidates는 비로그인 401. /auth/discord/login은 Discord로 307이며 code/state/쿠키는 출력하지 않았습니다.
- FastAPI 8000과 Next dev 3000을 실행했습니다. 현재 실행 상태는 시간에 따라 바뀔 수 있습니다. UI 소스는 변경하지 않았으며 새 디자인/모바일 시각 QA를 수행했다는 뜻은 아닙니다.

### 체크포인트와 남은 경계

- rehearsal 전: tmp/db-checkpoints/supabase-members-20261021T065921Z-6b42a65a.json
- 확정 적용 전: tmp/db-checkpoints/supabase-members-20261021T065945Z-c2a9018d.json
- 이 파일은 기존 인사이트 행과 적용 버전의 체크포인트이며 전체 schema/auth/storage를 포함하는 pg_dump 백업이 아닙니다. 기존 자료가 없는 상태의 추가 적용이었고 기존 표를 삭제하지 않았습니다. 후속 데이터 변경 전에는 정식 논리 백업이 필요합니다.
- 회원 보존/이전 방침, 조직 초대와 이전, PDF 공유 저장소, 실제 브라우저 Discord 로그인, 운영 DB/권한/백업은 별도입니다. 조직 초대 전에 개인 프로젝트가 같은 조직에 있는지 확인해야 합니다.
- 이번 작업은 커밋·push·PR 생성·병합·배포를 하지 않았습니다.

## 후속 PR 제출 전 재확인 — 2026-10-21

- 사용자가 최신 develop 확인과 통합 변경의 PR 생성을 요청했습니다. origin을 다시 fetch한 결과 develop은 여전히 dbd2c91이며 이 작업 브랜치의 시작점과 일치했습니다. 열린 중복 PR은 없었습니다.
- Supabase는 읽기 전용으로 재확인했습니다. 적용 버전은 20261021_02, 기관 271·과업 11·대분류 10·연구 분야 83, public 표 24개 모두 RLS 활성, API 역할의 표 접근 0건입니다. 재확인 시 회원은 0건이었고 개인정보 내용은 조회·출력하지 않았습니다. DB에 이미 적용됐으므로 동일 migration을 다시 실행하지 않았습니다.
- 자동 테스트 63개 통과·전용 PostgreSQL 동시성 1개 건너뜀, 변경 Python Ruff·uv 잠금 정합성 검사를 다시 통과했습니다. 실제 Discord 승인 완료 여부는 여전히 별도입니다.
- PR에는 코드·migration·동결 기준표 SQL·검증 도구·팀 설정 안내만 포함합니다. 실파일 .env, 자격증명, 로컬 자료 체크포인트, 이전 PDF·중복 캡처·업로드 파일은 포함하지 않습니다.
- 대상은 develop입니다. 사용자 요청은 PR 제출까지이며 병합·운영 배포·기존 MySQL 데이터 이전은 수행하지 않습니다.
