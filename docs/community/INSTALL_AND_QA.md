# 통합본 적용·실행·검증 — 2026-10-26

## 파일 적용

이 ZIP은 오늘 업로드된 `what_the-lab-develop (1)(1).zip` 766개 파일을 기준으로 게시판·FAQ V2를 병합한 **프로젝트 전체본**입니다. `what_the-lab-develop/` 아래에 frontend·backend·database·docs가 이미 제자리에 있습니다. 이전 V2 ZIP이나 이전 설치 도구를 다시 덮어쓰지 마세요.

현재 작업 폴더를 백업하거나 별도 브랜치에 보관하고 통합본을 별도 폴더에 풉니다. 기존 로컬 `.env`, `frontend/.env.local`, `backend/uploads`는 필요한 경우 직접 유지합니다. 이 ZIP에는 비밀값·업로드 원본·node_modules·.venv가 없습니다. 같은 경로의 팀 파일을 그 후에 추가 수정했다면 [변경 경로표](INTEGRATION_FILES_20261026.csv)와 diff를 검토해 병합하세요. ZIP 자체가 Git 저장소나 원격 브랜치를 갱신하지는 않습니다.

## 의존성과 환경변수

```powershell
# 통합본 프로젝트 루트에서
if (!(Test-Path .env)) { Copy-Item .env.example .env }
cd backend
uv sync --locked
# 다른 터미널
cd frontend
npm ci
```

이미 설정한 `.env`가 있으면 예제 파일로 덮어쓰지 않습니다. 원래 팀의 `DATABASE_URL`, Discord OAuth, JWT, FRONTEND/CORS 값을 사용합니다. 최신 팀의 Pillow 의존성과 lock을 보존했습니다. 게시판을 위해 frontend 실행 의존성을 추가하지 않았습니다.

`NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1` 직접 연결이 기본입니다. 같은 출처 프록시를 원할 때만 frontend/.env.local에 아래를 설정합니다.

```dotenv
NEXT_PUBLIC_API_BASE_URL=/api/v1
API_PROXY_TARGET=http://127.0.0.1:8000
```

`API_PROXY_TARGET`은 인증정보·경로 없는 서버 주소만 허용합니다. 프론트 출처를 백엔드 `CORS_ORIGINS`에 포함합니다. 별도 `COMMUNITY_ALLOWED_ORIGINS`를 쓸 때는 정확한 출처만 쉼표로 구분합니다. 환경변수 변경 후 서버를 재시작합니다. HTTPS OAuth callback이면 인증·state·재연결 쿠키에 Secure가 설정됩니다. 서로 다른 사이트의 프론트/API 배포는 기존 SameSite=Lax 정책과 함께 별도 검증해야 합니다.

## 공용 Supabase DB — 담당자만 적용

기존 [SETUP_NOTIFICATION_PROFILE.md](../development/SETUP_NOTIFICATION_PROFILE.md)의 **“각자 alembic upgrade를 실행하지 마세요. 공용 DB는 DB 담당자만 바꿉니다.”** 원칙을 따릅니다. 이 작업에서 공용 DB에 접속하거나 migration을 실행하지 않았습니다.

일반 팀원은 backend에서 상태만 확인하고 DB 담당자의 완료 안내를 기다립니다.

```powershell
uv run alembic current
uv run alembic heads
```

파일 기준 head는 `20261026_11` 하나입니다. `20261025_06`은 **협업 알림**입니다. `20261026_07`~`09`는 조회수·운영 이력·방문 수집이고, 게시판은 그 뒤의 `10`·`11`입니다. 10월 26일 통합본에 적힌 게시판 07·08은 이 저장소의 운영 조회 번호와 겹쳐서 다시 매겼습니다. 이전 게시판 V2의 06 이력은 가져오지 않습니다.

| 순서 | revision | 역할 |
|---|---|---|
| 기존 1~4 | 20261016_01 → 20261021_02 → 20261021_03 → 20261022_04 | 인사이트·공통 회원·설정 |
| 기존 5 | 20261022_05 | 협업 요청 |
| 기존 6 | 20261025_06 | 협업 알림·설정 |
| 기존 7 | 20261026_07 | 인사이트 조회수 |
| 기존 8 | 20261026_08 | 회원 정지·해제 이력 |
| 기존 9 | 20261026_09 | 방문·등록 과정 수집 |
| 새 10 | 20261026_10 | 게시판 8개 표 |
| 새 11 | 20261026_11 | BIGINT 회원·댓글 알림·무결성 |

DB 담당자는 대상·현재 revision·백업을 확인한 뒤 적용합니다. 현재가 06이면 07부터 11까지가 한 줄로 추가됩니다. 더 이전이면 아직 적용하지 않은 기존 팀 이력도 포함되므로 해당 담당자와 먼저 대조합니다. 07~09도 원격에는 아직 적용하지 않은 상태일 수 있습니다.

```powershell
# 공용 DB 담당자 전용. 기존 Alembic 이력이 일치하는 DB에서만.
uv run alembic current
uv run alembic upgrade 20261026_11
uv run alembic current
```

아래 SQL은 읽기 전용 상태 확인입니다.

```sql
SELECT version_num FROM public.insight_alembic_version;
SELECT to_regclass('public.collaboration_request'), to_regclass('public.notification');
SELECT count(*) FROM pg_tables WHERE schemaname = 'community_private'; -- 8
```

원래 팀의 01~09 migration과 SQL은 그대로입니다. 새 10·11은 public 회원·연구·협업 요청·협업 알림 행을 갱신하지 않습니다. 게시판은 `community_private`에 저장하고 기존 `public.users`를 FK로 참조합니다. 익명/인증/서비스 역할의 직접 접근을 막으므로 기존 서버 DB 연결 계정으로 API를 실행해야 합니다. `service_role` 키를 브라우저에 넣어 우회하지 않습니다.

현재 이력이 없거나 과거 게시판 V1/V2를 적용한 DB, 다른 head가 있다면 이 절차를 그대로 실행하지 않습니다. 자동 stamp·테이블 삭제·볼륨 삭제 없이 DB 담당자가 실제 이력을 대조해야 합니다. 이 ZIP은 이미 적용된 과거 게시판 DB를 이름만 바꿔 이전하는 도구를 제공하지 않습니다.

## 로컬 Docker DB

새 빈 볼륨에서는 기존 `database/init/001~008` 뒤에 `009_create_community.sql`, `010_community_integrity.sql`이 자동 실행됩니다. 009·010 내용은 Alembic 10·11 SQL과 같습니다. Docker 초기화 번호와 Alembic 개정 번호는 다릅니다. 기존 `docker-compose.yml`을 유지했습니다.

이미 **001~008이 적용된** 로컬 DB에는 담당자가 프로젝트 루트에서 아래 두 파일만 한 트랜잭션으로 실행합니다. 먼저 백업·존재 여부를 확인하고, 이미 게시판이 있다면 재실행하지 않습니다.

```powershell
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 --single-transaction -U admin -d labbridge -f /docker-entrypoint-initdb.d/009_create_community.sql -f /docker-entrypoint-initdb.d/010_community_integrity.sql
```

init 파일은 `./database/init:/docker-entrypoint-initdb.d:ro`로 마운트되어 있습니다. Docker init DB에는 Alembic 이력이 자동 생성되지 않습니다. 여기에 Supabase용 전체 `alembic upgrade`를 실행하면 기존 회원표를 중복 생성할 수 있습니다. Docker DB와 Alembic 관리 DB의 경로를 혼용하지 마세요. 기존 인사이트 관리자 DB 준비는 원래 안내를 따릅니다. 이 작업은 Docker 엔진 자체를 실행해 검증한 것은 아니며, 같은 SQL 10개를 격리 PostgreSQL 호환 엔진에서 실행했습니다.

## 실행과 관리자

```powershell
# backend 터미널
uv run uvicorn app.main:app --reload --port 8000
# frontend 터미널
npm run dev
```

`/community`, `/faq`가 메인 메뉴에 추가되었습니다. 실제 공개 글이 없는 DB에는 샘플 글·회원·공감 수를 자동 생성하지 않습니다. 게시판 운영자는 기존 `users.is_admin=true` 계정입니다. 인사이트 전용 allowlist는 게시판 권한을 부여하지 않으며 이 ZIP은 계정을 승격하지 않습니다.

태그에서 실제 전문가 찾기로 검색어를 넘깁니다. 협업 요청은 기존의 등록한 연구 선택 → 요청 전송 → 요청관리 수락/거절 → 별도 시작 과정을 따릅니다. 게시판은 비공개 내 연구·포트폴리오를 자동 반입하거나 요청을 자동 전송하지 않습니다. 상단 종은 협업 알림이며 게시판 답변은 게시판의 ‘내 글의 새 답변’에만 표시합니다. 비공개 글·댓글을 Discord DM으로 보내지 않습니다.

## 반복 검증

```powershell
cd backend
uv run pytest -q
# frontend 터미널
npm test
npm run check:community-links
npx tsc --noEmit
npm run lint
npm run build
```

실행 결과와 검증 환경의 차이는 [통합 검증 기록](INTEGRATION_VERIFICATION_20261026.md)에 있습니다. 전용 native PostgreSQL 동시성 검사는 기존 테스트 문서대로 별도 DB를 지정할 때만 실행합니다. 공용/운영 DB를 테스트 대상으로 넣지 않습니다.

별도 `verification/community-integration/`의 PGlite는 QA용이며 앱의 배포 의존성이 아닙니다. 그 폴더에서 `npm ci`, backend의 Python 환경으로 `run_pglite_check.py --project <프로젝트 루트>`를 실행합니다. native 다중 연결·실제 Supabase·실제 Discord 승인/DM·HTTPS 운영 배포 결과를 대체하지 않습니다.
