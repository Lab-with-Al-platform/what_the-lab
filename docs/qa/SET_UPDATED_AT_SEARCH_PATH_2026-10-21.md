# 수정 시각 함수 검색 경로 보안 보완

## 원인과 변경 범위

Supabase Security Advisor의 `Function Search Path Mutable` 경고는
`public.set_updated_at()`에 함수 전용 `search_path`가 없어서 발생했습니다.
`search_path`는 이름만 적은 함수나 표를 어느 영역에서 찾을지 정하는 검색 순서입니다.
호출자의 설정에 따라 검색 순서가 달라지는 상태를 없애는 보안 보완이며,
이 경고만으로 실제 침해가 발생했다고 판단하지 않습니다.

후속 Alembic revision은 `20261021_03`이며 직전 revision은 `20261021_02`입니다.

```sql
ALTER FUNCTION public.set_updated_at() SET search_path = pg_catalog;
```

이 함수는 `now()` 등 PostgreSQL 기본 기능만 사용하므로 `pg_catalog`로 제한합니다.
함수 본문·소유자·실행 권한·기존 트리거 연결을 바꾸지 않습니다.
기존 표의 데이터를 수정하거나 회원·인사이트를 다시 초기화하지 않습니다.
버전 이력만 `20261021_03`으로 전진합니다.

[Supabase 공식 경고 설명](https://supabase.github.io/splinter/0011_function_search_path_mutable/)은
함수 검색 경로를 명시하도록 안내하며 일반적으로 빈 경로와 완전한 이름을 권장합니다.
이번에는 기존 본문을 보존하면서 PostgreSQL 기본 영역만 명시하는 방법을 택했습니다.
향후 함수에서 업무 테이블을 참조한다면 `public.표이름`처럼 영역을 명시하고 다시 검토해야 합니다.

## 코드 반영

- 기존 revision과 `backend/migrations/sql/20261021_02/` 동결본은 수정하지 않았습니다.
- 새 revision은 `ALTER FUNCTION`만 실행합니다. 보안 설정을 자동 해제하는 downgrade는 차단합니다.
- `app.supabase_setup`의 목표 버전은 `20261021_03`입니다. 최초 인사이트 DB와 회원 구조 적용 완료 DB 모두 구분하여 처리합니다. 회원 구조가 이미 있으면 기존 보호 검증 후 후속 revision만 실행합니다.
- 최신 버전 재실행 시에는 회원 보호와 함수 설정을 검사하고 `already_applied`로 종료합니다.
- 빈 Docker DB의 `database/init/001_create_tables.sql`에도 같은 검색 경로를 명시했습니다. 기존 Docker 볼륨에는 init 수정이 자동 반영되지 않습니다. 이 때문에 볼륨을 삭제해서는 안 됩니다.

## 개발용 Supabase 실제 적용 결과

대상은 기존 `labbridge-dev`이며 호스트·계정의 프로젝트 번호 일치를 확인했습니다.
2026-10-21에 적용 후 취소하는 리허설을 먼저 통과한 뒤 실제 적용했습니다.

| 확인 항목 | 결과 |
|---|---|
| 최종 DB revision | `20261021_03` |
| 함수 설정 | `search_path=pg_catalog` |
| 함수 동일성 | OID·본문·소유자·실행 권한·invoker 등 메타데이터 유지 |
| 기존 트리거 | 6개 연결 유지 |
| 데이터 보존 | 회원·기준표 23개 + 인사이트 5개 표의 행 수/내용 지문이 변경 전후 동일 |
| RLS/API 권한 | public 24개 표 RLS 유지, 검사한 Supabase Data API 역할의 직접 테이블 접근 0 |
| 기준표 | institution 271 / able_work 11 / field_category 10 / research_field 83 유지 |
| 같은 값 UPDATE | 세션 전용 임시 표에서 기존 updated_at 유지 |
| 값이 바뀐 UPDATE | 호출자 경로를 변경한 상태에서도 PostgreSQL 기준 현재 시각으로 갱신 |
| 재실행 | `already_applied=true`, 함수 보호 확인 |
| 회원 흐름 회귀 | 가상 Discord 응답 + 실제 DB로 회원 callback·전문가 가입/조회·관리자 권한·로그아웃 검사 통과 |

회원 흐름 검사의 가상 회원·프로필·임시 관리자 값은 모두 rollback했고 잔여 테스트 행은 0입니다.
PostgreSQL의 ID 시퀀스는 rollback해도 증가할 수 있으며 이를 강제로 되돌리지 않았습니다.
리허설과 적용 전 인사이트 체크포인트는 Git에서 제외한 `tmp/db-checkpoints/`에 저장했습니다.
이 체크포인트는 인사이트 비교용 자료이며 전체 DB 백업은 아닙니다.

## 자동 검사와 검증 경계

- 백엔드 전체: **75 passed, 1 skipped**. 별도 PostgreSQL 동시성 검사용 환경변수가 없어 해당 검사 1개는 생략했습니다.
- 수정 Python 파일 Ruff 검사 통과.
- offline SQL에서 `20261021_02 → 20261021_03`은 함수 설정과 Alembic 버전 변경만 생성함을 확인했습니다.
- 신규 Docker DB의 초기화 SQL은 문자열 회귀 검사만 했고, Docker 볼륨을 새로 생성하여 실행하지 않았습니다.
- 실제 Discord 인증 서버를 통한 브라우저 로그인은 이번 검사에 포함하지 않았습니다.
- Security Advisor 웹 화면을 직접 새로고침하지 않았습니다. DB 카탈로그의 함수 설정은 직접 확인했습니다. Dashboard의 Security Advisor에서 **Refresh** 후 해당 경고가 사라지는지 확인하세요. 다른 Info 제안 전체를 해결한 작업은 아닙니다.
- 기존 Starlette/httpx 테스트 도구 사용 중단 예정 경고 1개는 이번 보안 수정과 무관하며 남겨 두었습니다.

## 팀에서 재확인하는 방법

아래 명령은 `backend` 폴더에서 실행합니다. `.env`의 `DATABASE_URL`이 의도한 DB인지 먼저 확인하며 실제 값을 채팅이나 Git에 올리지 않습니다.

```powershell
# 조회만 수행합니다. 공용 labbridge-dev에는 이미 03이 적용되어 있습니다.
uv run python -m app.supabase_setup

# 별도 개발 프로젝트가 이전 버전일 때만 대상 번호를 확인해 사용합니다.
uv run python -m app.supabase_setup --rehearse --confirm-project-ref <확인한-프로젝트-번호>
uv run python -m app.supabase_setup --apply --confirm-project-ref <확인한-프로젝트-번호>
```

기존 Docker init으로 만든 DB는 Alembic 이력이 다를 수 있으므로 전체 migration을 무조건 실행하지 않습니다.
먼저 함수와 변경 이력을 확인한 뒤 위 `ALTER FUNCTION`만 승인된 연결에서 별도 적용할 수 있습니다.
다른 DB·운영 배포·Data API/RLS 정책 변경·사용자 데이터 이전은 이 작업 범위가 아닙니다.
