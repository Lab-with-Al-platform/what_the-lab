# Database

PostgreSQL/Supabase 데이터 구조와 변경 이력을 관리합니다.

## 2026-10-21 공통 Supabase 적용

팀 기본 DB는 Supabase로 통합합니다. 회원·프로필·연구·인사이트가 서버 전용 DATABASE_URL 하나를 사용합니다. 조직 생성·초대와 실행은 [팀 시작 안내](../docs/development/SUPABASE_TEAM_ONBOARDING.md)를 참고하세요.

후속 migration `20261021_02`는 기존 개발용 labbridge-dev에 회원 23개 표·기준표를 추가하고 RLS/API 역할 접근 차단을 적용했습니다. `backend/migrations/sql/20261021_02/`는 PR #16 init SQL의 동결본입니다. 이미 적용된 SQL을 나중에 init 파일 변경에 따라 바꾸지 않기 위해 별도 보관합니다. 후속 구조 변경은 새 revision으로 만듭니다. 기존 `insight_alembic_version` 이름은 이력 호환을 위해 유지합니다.

`database/init/`는 빈 Docker DB의 선택적 초기화용입니다. 공용 Supabase에 직접 재실행하거나 기존 회원 데이터를 삭제하지 않습니다. 기존 MySQL 데이터는 보존하며 자동 이전하지 않았습니다.

후속 migration `20261021_03`은 `public.set_updated_at()`의 `search_path`를 `pg_catalog`로 고정합니다. 함수 본문·트리거·권한·회원 데이터를 바꾸지 않습니다. 새 Docker DB의 init SQL에도 같은 설정을 넣었지만, 동결된 `20261021_02` SQL은 보존합니다. 이미 초기화된 Docker 볼륨에는 init 수정이 재실행되지 않으므로 볼륨을 삭제하지 말고 후속 설정만 별도 적용하세요. [원인·적용·검증 기록](../docs/qa/SET_UPDATED_AT_SEARCH_PATH_2026-10-21.md)을 참고하세요.

## 현재 인사이트 변경 이력

2026-10-16 확정 DB는 Supabase(PostgreSQL)입니다. 첫 인사이트 마이그레이션은 FastAPI 모델과 함께 관리하기 위해 `backend/migrations/`에 두었습니다. 로컬 Docker가 같은 구조를 만들 수 있도록 `database/init/011_create_insight.sql`에 표 정의만 다시 적었습니다. 사용자 승인 후 개발용 `labbridge-dev`에 `20261016_01`을 적용하고 구조·역할 권한·동시성 검사를 완료했습니다. 운영 DB 적용이나 공개 서비스 배포는 아닙니다.

- [최초 마이그레이션](../backend/migrations/versions/20261016_01_insight_foundation.py): 서버 전용 insight_private schema와 5개 테이블
- 2026-10-27: 로컬 Docker용 `database/init/011_create_insight.sql`에 같은 구조와 수집 설정 표를 넣었습니다. 공용 DB의 글 내용은 복사하지 않습니다.
- 2026-10-27: 공용 DB에 적용된 조회수·운영 이력·방문 수집 표를 `014`~`016`에 넣었습니다. 기록 행은 복사하지 않습니다. `017`은 개정 번호 `20261028_13`만 적고, `018`이 분류 상태를 `active`로 맞춘 뒤 번호를 `20261028_14`로 올립니다.
- [실행·안전 확인 순서](../docs/ai-case-automation/FOUNDATION_RUNBOOK.md): 개발 DB 확인, 권한, 테스트, 파괴적인 되돌리기 주의
- [개발용 DB 검증 결과](../docs/qa/INSIGHT_SUPABASE_MIGRATION_2026-10-16.md): 인사이트 테이블 5개와 public의 버전 테이블 1개, 실제 콘텐츠는 0건

공개는 FastAPI의 승인 완료 스냅샷 API를 통해서만 합니다. 이 단계는 기존 회원·프로젝트 테이블을 생성하거나 변경하지 않습니다.

## 이 폴더에 둘 것

- 재현 가능한 마이그레이션 파일
- RLS 정책과 권한 설명
- 가상 데이터 기반의 최소 시드
- 스키마 변경 이유와 되돌리는 방법

## 핵심 모델 원칙

- 프로젝트 공개 상태, 모집, 실제 협업 상태를 분리합니다.
- `applications`(전문가의 참여 신청)와 `collaboration_requests`(연구자의 협업 요청)를 분리합니다.
- 최종 선정 결과와 실제 접근 권한은 `project_members`를 기준으로 판단합니다.
- 연구 원자료는 저장하지 않고 Data Readiness, 민감도, IRB/NDA 등 메타데이터만 저장합니다.
- 활성 중복 요청·신청과 정원 초과를 데이터베이스 제약 및 트랜잭션으로 막습니다.

## 금지 사항

- 실제 사용자 개인정보나 연구 데이터를 시드로 사용하지 않습니다.
- 이미 공유된 마이그레이션 파일을 조용히 수정하지 않습니다. 새 변경 파일을 추가합니다.
- Supabase 서버 전용 키를 SQL이나 문서에 넣지 않습니다.
