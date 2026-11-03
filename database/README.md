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
- 2026-10-27: 공용 DB에 적용된 조회수·운영 이력·방문 수집 표를 `014`~`016`에 넣었습니다. 기록 행은 복사하지 않습니다. `017`은 개정 번호 `20261028_13`만 적고, `018`이 분류 상태를 `active`로 맞춘 뒤 번호를 `20261028_14`로 올립니다. `019`는 협업 디스코드 칸을 추가하고 번호를 `20261028_15`로 올립니다. `020`은 메일 수신을 확인한 대학·연구기관 도메인을 기관 표에 넣고 번호를 `20261028_16`으로 올립니다.
- 2026-11-01: `025`는 요청 기록 표 `collaboration_task_event`를 만들고 기존 요청의 남김·완료/취소 기록을 채운 뒤 번호를 `20261031_21`로, `026`은 알림 표에 요청 알림 칸·종류를 더하고 번호를 `20261031_22`로 올립니다. 이미 데이터가 있는 Docker DB는 [요청 기능 세팅 안내](../docs/development/SETUP_WORKSPACE_TASKS.md)대로 두 파일을 직접 실행합니다.
- 2026-11-02: `027`은 알림 표에 일정 알림 칸(`schedule_id` · `note`)·종류를 더하고 아침 알림 중복 막기에 일정을 넣은 뒤 번호를 `20261101_23`으로 올립니다. 이미 데이터가 있는 Docker DB는 [일정 기능 세팅 안내](../docs/development/SETUP_WORKSPACE_SCHEDULES.md)대로 직접 실행합니다.

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


## 2026-11-03 develop + 기능 통합 검증 브랜치 주의

- 팀 develop에 추가된 순차 마이그레이션: `20261031_21`(협업 요청 기록), `20261031_22`(협업 알림), `20261101_23`(일정 알림).
- 리뷰 Feature의 이전 `20261031_21`과 동일 revision 충돌을 방지하기 위해 검증용 통합 브랜치에서 협업 평가는 `20261103_24`로 재배치했습니다.
- 빈 로컬 Docker DB의 SQL 초기화 순서: `025_add_task_events.sql` → `026_add_task_notifications.sql` → `027_add_schedule_notifications.sql` → `028_create_collaboration_reviews.sql`.
- 실제 기동 DB에 이미 025번을 적용했거나 과거 리뷰 테이블을 적용했다면 **재실행하지 말고 수동으로 DB 현황을 확인**해야 합니다. `database/init`은 기존 볼륨에 자동 재실행되지 않으며 공유 Supabase·운영 DB에 적용해서는 안 됩니다.
