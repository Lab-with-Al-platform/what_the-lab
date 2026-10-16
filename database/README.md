# Database

PostgreSQL/Supabase 데이터 구조와 변경 이력을 관리합니다.

## 현재 인사이트 변경 이력

2026-10-16 확정 DB는 Supabase(PostgreSQL)입니다. 첫 인사이트 마이그레이션은 FastAPI 모델과 함께 관리하기 위해 `backend/migrations/`에 두었습니다. 이 폴더에 같은 SQL을 중복 복사하지 않습니다. 사용자 승인 후 개발용 `labbridge-dev`에 `20261016_01`을 적용하고 구조·역할 권한·동시성 검사를 완료했습니다. 운영 DB 적용이나 공개 서비스 배포는 아닙니다.

- [최초 마이그레이션](../backend/migrations/versions/20261016_01_insight_foundation.py): 서버 전용 insight_private schema와 5개 테이블
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
