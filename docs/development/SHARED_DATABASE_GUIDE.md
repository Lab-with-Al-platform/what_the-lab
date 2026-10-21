# 팀 공통 PostgreSQL과 계정 연결

기준일: 2026-10-21. 사용자 선택에 따라 팀 기본 DB는 **Supabase**입니다. 기존 연결된 개발용 labbridge-dev에 공통 회원 구조를 추가 적용했습니다. 기존 MySQL 회원 데이터 이전·조직 이전·팀원 초대까지 완료했다는 뜻은 아닙니다.

## 1. 확인한 분리와 통합 기준

- PR #16에서 회원·프로필·연구 SQL과 드라이버는 PostgreSQL로 바뀌었습니다. 하지만 회원은 DB_*를, 인사이트는 DATABASE_URL을 따로 읽어 서로 다른 서버에 연결될 수 있었습니다.
- 이제 회원의 psycopg 연결, 인사이트의 SQLAlchemy 연결, 인사이트 Alembic이 같은 설정 해석 함수를 사용합니다. 서로 다른 라이브러리는 유지하되 접속 대상만 통일합니다. 무조건 모든 SQL을 ORM으로 다시 쓰지는 않습니다.
- 설정은 **DATABASE_URL 우선**, 없을 때만 DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD입니다. 잘못된 URL이면 다른 DB로 몰래 우회하지 않고 실패합니다. 변경 후 서버를 재시작합니다.
- 회원의 기준은 public.users입니다. 인사이트용 회원 테이블을 따로 만들지 않습니다. 내부 user_id와 Discord 고유 사용자 ID는 용도가 다릅니다. 서로 다른 DB의 user_id=1을 같은 사람으로 간주하면 안 됩니다.
- 같은 로그인 쿠키로 회원과 인사이트에 접근합니다. JWT의 내부 ID와 Discord ID가 DB 회원과 함께 일치해야 합니다. 구형 쿠키는 한 번 재로그인합니다. Discord ID는 앱 Client ID·닉네임과 다릅니다.
- 연구자/전문가 역할과 관리자 여부는 별개입니다. 활성 users.is_admin=true 회원은 인사이트를 관리할 수 있습니다. 기존 INSIGHT_ADMIN_DISCORD_IDS는 인사이트 전용 호환 지정으로만 유지하고 공통 관리자 필드를 수정하지 않습니다. 실제 권한 부여·해제는 이번 코드 작업에서 하지 않았습니다.
- 관리자라도 정지·탈퇴 상태면 접근하지 못합니다. 삭제된 사용자나 다른 Discord ID로 바뀐 내부 번호를 오래된 쿠키로 사용할 수 없습니다.

## 2. 어떤 실행 방식이 나을까?

| 방식 | 장점 | 주의점 |
|---|---|---|
| 팀 공용 Supabase 개발 DB | 팀원 PC의 Docker 설치·실행이 필요 없고 같은 회원·콘텐츠를 확인 | 인터넷 필요, 서로의 데이터 변경이 보임, 공용 DB 초기화 금지 |
| 각자 Docker PostgreSQL | 내 실험이 팀원 DB에 영향을 주지 않음 | 각 PC의 Docker/가상화 설정 필요, 데이터가 자동으로 팀원에게 공유되지 않음 |

사용자가 공용 Supabase를 선택했으므로 **Supabase가 팀 기본값, Docker는 선택**입니다. 운영 DB와 개발 DB는 분리해야 합니다. 지금 실행하는 FastAPI는 기존 DATABASE_URL을 회원·프로필·연구·인사이트에 공통 사용하고 Supabase 연결에는 SSL을 기본 적용합니다.

## 3. Supabase를 팀으로 사용하는 순서

1. 개발 프로젝트는 기존 labbridge-dev를 사용합니다. 팀 전용 Organization을 만들거나 기존 조직을 팀 전용으로 사용할지 정합니다. DB를 다시 만들 필요는 없습니다. 구체적인 조직 생성·프로젝트 이동·초대는 [따라 하기](SUPABASE_TEAM_ONBOARDING.md)를 참고하세요.
2. 각자 자기 Supabase 계정으로 로그인하고, 소유자가 Organization의 팀 설정에서 이메일로 초대합니다. 일반 개발자는 Developer를 우선 검토합니다. 개인 로그인 계정·비밀번호를 함께 쓰지 않습니다.
3. Developer도 DB 내용을 변경할 수 있으므로 데이터 보호를 대신하지 않습니다. 개인 프로젝트와 조직을 섞지 않는 편이 좋습니다. 프로젝트 단위 역할·Read-only 등의 가용성은 요금제 조건을 확인합니다.
4. DB 담당자가 개발 DB의 기존 테이블·적용 이력·백업을 먼저 점검합니다. 회원 init SQL은 Docker의 빈 DB용으로 작성돼 있어, 기존 원격 DB에 무조건 재실행하면 안 됩니다. 최초 Supabase 통합 변경은 Alembic 20261021_02로 기록했습니다. 기존 이력 테이블 이름 insight_alembic_version은 호환을 위해 유지합니다.
5. 서버의 DATABASE_URL에는 Dashboard의 Connect → Session pooler에서 복사한 주소를 넣습니다. IPv4 개발 환경에서 접근하기 쉬운 방식입니다. 호스트를 지역 이름만 보고 조합하지 않습니다. 비밀번호의 URL 예약 문자는 percent-encode합니다.
6. 팀원별 제한된 DB 접속 계정을 쓰는 방식이 더 안전합니다. 초기 공용 개발 자격증명을 사용한다면 안전한 비밀 공유 수단으로만 전달하고 저장소·채팅·스크린샷에는 올리지 않습니다. Organization 초대와 SQL 접속 자격증명은 별개입니다.
7. 각자 로컬 .env에 같은 개발 DB 대상 URL을 설정합니다. Discord 앱/Secret/JWT_SECRET은 로컬 테스트에서 각자 관리할 수 있습니다. 같은 사람이 같은 개발 DB에 로그인하면 Discord ID 기준으로 같은 회원을 찾습니다. 서비스 사용자마다 회원 레코드는 따로입니다.
8. 프론트는 로컬 FastAPI를 호출하고, FastAPI만 DB에 연결합니다. 서버 비밀번호에 NEXT_PUBLIC_을 붙이지 않습니다. Supabase Auth로 로그인 체계를 새로 만들지 않으며, 기존 Discord → FastAPI JWT를 유지합니다.
9. 직접 PostgreSQL 연결에는 Data API·anon key·service_role key가 필수가 아닙니다. 이번 변경은 회원 23개 표와 이력 표에 RLS를 활성화하고 anon/authenticated/service_role의 직접 접근 권한을 제거합니다. FastAPI의 신뢰된 DB 연결과 별개로 브라우저는 직접 조회할 수 없습니다. 프로젝트 전체의 Data API 켜기/끄기나 다른 schema의 정책은 변경하지 않았습니다.

URL 예시는 형태만 참고하고 실제 값은 채팅에 붙이지 않습니다.

```env
DATABASE_URL=postgresql://ROLE.PROJECT:ENCODED_PASSWORD@POOLER_HOST:5432/postgres?sslmode=require
```

팀원은 초기 INSIGHTS_ENABLED=false를 유지하고, 관리 기능이 필요한 담당자만 확인 후 활성화합니다. 기존 labbridge-dev에는 회원·인사이트 구조가 준비됐지만, 임의로 새 프로젝트를 만들면 자동으로 복제되지는 않습니다.

현재 개발 DB를 읽기 전용으로 점검하려면 backend 폴더에서 실행합니다.

```powershell
uv run python -m app.supabase_setup
```

--apply는 팀원 모두가 실행할 명령이 아닙니다. DB 담당자가 대상 프로젝트·백업·변경 파일을 확인한 후 한 번만 실행합니다. 첫 적용은 같은 트랜잭션에서 추가 생성·기준표·권한·인사이트 보존을 검증한 뒤 확정하며, 이미 적용한 DB는 덮어쓰지 않습니다. 후속 변경은 새 migration을 추가합니다.

## 4. Docker를 계속 사용한다면

Docker Desktop이 실행된 뒤 프로젝트 루트에서 다음 한 줄로 기존 PostgreSQL을 시작하고 준비 상태까지 기다릴 수 있습니다.

```powershell
docker compose up -d --wait postgres
```

DATABASE_URL을 비우고 .env.example의 로컬 DB_* 값을 사용합니다. 또는 Docker와 일치하는 로컬 PostgreSQL URL을 설정합니다. Supabase URL을 남겨 놓으면 Docker를 켜도 앱은 Supabase를 사용합니다.

```powershell
docker compose ps
docker compose logs --tail 30 postgres
```

DBeaver는 PostgreSQL 드라이버, localhost:5433, DB labbridge를 사용합니다. PostgreSQL 사용자명은 프로젝트의 Docker 설정을 따릅니다. 이 설정은 Supabase 자격증명과 다릅니다.

Docker Desktop/WSL 자체가 시작되지 않는 문제는 실행 명령을 감싸는 것만으로 해결되지 않습니다. 다른 팀원의 Docker를 끄거나 기존 MySQL·Qdrant 컨테이너를 자동 삭제하지 않습니다.

## 5. 공동 작업 규칙

- DB 구조 변경은 파일·PR로 검토하고 지정 담당자 한 명이 적용합니다. 공용 DB에서 reset/drop/down -v를 해결책으로 사용하지 않습니다.
- 테스트는 각자 자기 Discord 계정 또는 가상 테스트 계정으로 하고 타인의 가입 유형·프로필을 임의 초기화하지 않습니다.
- 기존 MySQL 회원·프로필·업로드 참조·연구 데이터는 코드만 바꿔 자동 이전되지 않습니다. 보존 여부를 정한 뒤 Discord ID로 대조하고 관계 데이터를 함께 옮깁니다. 내부 번호·닉네임만으로 자동 병합하지 않습니다.
- 사진/PDF 파일은 현재 로컬 backend/uploads에 남습니다. 공용 DB를 쓴다고 파일도 공유되지 않습니다. Supabase Storage 등으로 옮기는 것은 별도 개발 범위이며 이번에 구현하지 않습니다.
- JWT_SECRET이 다른 로컬 백엔드들은 쿠키를 서로 검증할 수 없습니다. 개발자별 로컬 실행에는 문제가 없지만, 같은 배포 서비스의 복수 서버는 같은 인증 설정이 필요합니다.
- 서버 실행 및 /health 성공은 DB 전체 준비나 OAuth 로그인 완료를 증명하지 않습니다. 회원 조회·프로필·인사이트 권한/테이블을 따로 확인합니다.

## 6. 공식 참고 자료

- [Supabase 팀 권한과 초대](https://supabase.com/docs/guides/platform/access-control)
- [PostgreSQL 연결과 Session pooler](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [마이그레이션·로컬 개발 흐름](https://supabase.com/docs/guides/local-development/cli-workflows)
