# WHAT THE LAB · 협업 종료 후 실제 양방향 평가 시스템 — 개발·배포 인계서
**2026-10-31 | Draft PR #72 | 개발 브랜치** `feature/expert-search-dark-profile-first-20261031`

## 1. 기능 개요
| 분류 | 동작 |
|---|---|
| 누가 | 완료/중도 종료 협업에 실제로 참여한 연구회원과 전문가만 |
| 언제 | 협업 종료 상태 확정 후 30일 이내 |
| 무엇을 | 4개 항목을 각각 1~5점, 선택 후기 500자 이내 |
| 중복 방지 | 협업+평가자 / 협업+역할 DB 고유 제약, 서버 참가자 판정 |
| 수정 | 제출 뒤 48시간 이내 단 한 번, 기존 평가 값 변경 이력 보존 |
| 상대 피드백 | 완료 7일 후 해당 협업 당사자에게만 비공개 제공 |
| 전문가 공개 평점 | **정상 완료** 협업에서 **연구회원→전문가** 평가만, 완료 7일 후 |
| 중도 종료 | 개인 피드백은 저장하지만 공개 평균 집계 제외 |
| 신고/운영 | 후기 신고→관리자 검토→비공개/기각, 자동 삭제 금지 |
| 사용자 알림 | 프로젝트 자동 완료 시 사이트 종/Discord DM에서 협업 평가 위치로 연결 |
| Mock Data | localhost 개발용 별도 오버레이, 서버에 실제 평점 INSERT 금지 |

## 2. 사용자별 화면 플로우
- **연구회원**: `/workspace` → 완료 탭 → 협업 평가하기 → `/workspace/{id}#review` → 실제 전문가 4항목 점수+후기→제출. 이후 7일이 지나면 참여한 전문가 평가의 개인 피드백도 조회 가능.
- **AI 전문가**: 똑같은 종료된 협업에서 연구 준비도·소통·일정 협력·요구사항 명확성 평가. 연구회원 평점은 공개 전문가 점수에 반영되지 않음.
- **전문가 프로필 방문자**: `/experts/{id}` → '이 서비스에서 한 연구·평가' 탭 → 별점/항목별 평균/익명 후기. **0건은 미평가 상태**.
- **후기 신고자**: 공개 후기 '부적절한 후기 신고' 또는 본인 협업의 비공개 후기 신고 → 로그인/신고 사유 제출, 중복 접수 제한.
- **운영자**: `/admin/reviews` → 사유 작성 → 후기를 비공개 처리하거나 신고 기각.

## 3. 실제 변경 파일
### Backend
- `backend/app/review_store.py` : 서버 권한·30일·48시간·7일 지연·평균·중복/신고/운영 처리
- `backend/app/routers/reviews.py` : 사용자·공개·운영 API, Origin 제한
- `backend/app/main.py` : 라우터 등록
- `backend/app/workspace_store.py`, `backend/app/workspace_detail.py` : 협업 종료 업데이트·알림 원자성
- `backend/app/notification_store.py`, `backend/app/notification_sender.py` : 완료 시 평가 알림과 바로가기
### Database
- `backend/migrations/versions/20261031_21_collaboration_reviews.py` + `backend/migrations/sql/20261031_21/001_create_collaboration_reviews.sql`
- `database/init/025_create_collaboration_reviews.sql` : 새 Docker 볼륨 초기화 또는 **로컬 Docker 기존 DB에서만** 1회 수동 적용
- 테이블 `collaboration_review`, `collaboration_review_report`, `notification` 알림 종류 `review_ready` 허용
### Frontend
- `frontend/src/lib/reviews.ts`, `frontend/src/components/collaboration-review-card.tsx`
- `frontend/src/components/workspace-detail-page.tsx`, `frontend/src/components/workspace-home.tsx`
- `frontend/src/components/expert-review-summary.tsx`, `frontend/src/components/expert-profile-view.tsx`
- `frontend/src/app/admin/reviews/page.tsx`, `frontend/src/components/admin/admin-shell.tsx`, `frontend/src/lib/admin-nav.ts`

## 4. DB 적용 전에 반드시 확인 (기존 사용자 데이터 보호)
**이 PR은 DB에 자동 접속해 마이그레이션을 수행하지 않습니다.** 
1. 운영/팀 공유 Supabase에는 적용 전 백업·Migration Review·권한 확인·스테이징 리허설을 반드시 수행하세요.
2. 로컬 Docker 볼륨은 삭제하지 마세요. `docker compose down -v`, `docker volume rm` 금지.
3. 프로젝트 루트 Windows PowerShell에서 기존 상태 조회:
```powershell
docker compose ps
docker compose exec postgres psql -U admin -d labbridge -c "SELECT version_num FROM public.insight_alembic_version;"
docker compose exec postgres psql -U admin -d labbridge -c "SELECT to_regclass('public.collaboration_review') AS review_table;"
```
**기준 스키마 버전이 반드시 `20261029_20` 이고 review_table이 NULL일 때만** 다음을 사용합니다.
```powershell
docker cp .\database\init\025_create_collaboration_reviews.sql labbridge-postgres:/tmp/025_create_collaboration_reviews.sql
docker compose exec postgres psql -v ON_ERROR_STOP=1 -U admin -d labbridge -f /tmp/025_create_collaboration_reviews.sql
docker compose exec postgres psql -U admin -d labbridge -c "SELECT version_num FROM public.insight_alembic_version;"
```
기준 스키마가 다르면 강행하지 않고 누락된 팀 마이그레이션과 공용 DB 상태를 먼저 맞추세요. 파일은 `BEGIN`/guard/`COMMIT`이 있어 오류 시 전체 적용이 취소됩니다.

## 5. GitHub CI 및 운영 배포
GitHub Actions `collaboration-reviews-ci.yml`:
- 전체 프론트 `npm test` (예전에 이미 실패한 인사이트 이미지 테스트도 별도 표시)
- 평가/전문가/커뮤니티 직접 영향 테스트 + TypeScript + ESLint + Next.js 빌드 분리
- Backend 무DB 정책·권한·알림 회귀 테스트
- **PostgreSQL 17 실제 SQL 실행/DB 제약·RLS·중복 INSERT 실검증** (단순 독립 스키마, 전체 DB 연계 E2E는 아님)

## 6. 운영 준비시 남은 의사결정/리스크
- **평가 신뢰성**: 표시 점수와 총건수는 실제 협업 완료·상태·7일 경과·운영 처리 조건으로 계산.
- **개인정보/공개 정책**: 평가 시 연구 제목·연구자 실명은 공개되지 않음. 텍스트 후기에는 사용자가 민감정보를 작성할 수 있어 신고·운영 인력 및 개인정보 정책 필요.
- **보복 평가**: 상대 평가도 프로젝트 종료 7일 뒤에만 열람 가능. 연구회원→전문가 공개는 완료 7일 이후. 상대 평가 작성 여부를 실시간 알리지 않음.
- **운영 리스크**: 관리자 계정 MFA·신고 처리 로그·법적 삭제 요청·문제성 후기 재심사 절차 및 보존 기간 확정 필요.
- **성능/배포**: 실제 공유 PostgreSQL 백업, 연동 DB·Discord 통합 테스트, 1440px/768px/390px 브라우저/키보드 실사용 검수 후 병합.
- **정책 변경 여지**: 위 30일/48시간/7일은 출시 전 팀·법무·운영의 검토가 필요한 제안 정책; 코드 상 현재 적용됨.

## 7. 요청하신 100개 연쇄 질문
상세한 100개 검토·대응·근거 파일 매핑: `docs/qa/verified-collaboration-reviews-100-questions-20261031.md`.

## 8. 상태
- 코드 작업: Draft PR #72 브랜치에 반영.
- 운영 DB 변경: **하지 않음**.
- develop 병합/배포: **하지 않음**.
- CI 결과 및 PostgreSQL 통합 검증: GitHub Actions 완료 여부를 별도 확인하고 실패가 있으면 우선 수정.
