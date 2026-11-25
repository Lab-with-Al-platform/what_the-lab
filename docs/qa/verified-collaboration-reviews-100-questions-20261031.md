# WHAT THE LAB · 실제 협업 종료 평가 시스템 — 100개 연쇄 점검 질문
작성: 2026-10-31 · 기준: 채택된 전문가 상세 UI와 기존 PostgreSQL 협업·알림·인증
**목적**: 설계 설명만이 아니라 각 질문을 구현 위치와 연결해 추적할 수 있게 만듭니다.

## 결정한 제품 정책
- **등록 가능한 때**: collaboration 상태가 `done` 또는 `ended_early` 로 확정된 후 30일 이내. `ongoing`·`canceled`는 평가 불가.
- **평가 단위**: 한 협업 × 한 참여자당 1개. 연구자는 AI 전문가, 전문가는 연구자를 4개 항목(1~5점)으로 평가.
- **수정**: 제출 후 48시간 내 1회만 허용, 이전 값의 감사 기록 보존.
- **공개 전문가 평점**: `done` 협업에서 *연구자가 AI 전문가에게* 남긴 평가만, 종료 후 7일 경과 후 공개. 초기에는 대기. `ended_early`와 전문가→연구자 평가는 공개 평균 제외.
- **공개 후기**: 작성자·연구명·프로젝트ID 익명화. 부적절한 리뷰 신고 → 운영자 처리 후 숨김/기각, 자동 삭제 없음.
- **데이터**: 진짜 협업 완료 기록 기반. 프론트엔드의 LOCAL DEMO 점수는 실제 집계에 포함되지 않음.

> 아래 질문의 '대응'은 소스에 설계·구현한 경로를 뜻합니다. 실제 통합 테스트 완료를 의미하지 않습니다.

## A. 종료 판단·평가 시점

| # | 꼬리 검토 질문 | 설계·구현 대응 | 근거 |
|---:|---|---|---|
| 1 | 종료 예정일 당일에 평가 가능한가? | 아니요. 서버상 상태가 done/ended_early로 확정된 뒤에만 가능 | `review_store.review_window` |
| 2 | 종료 예정일이 지났지만 cron이 지연되면? | 조회·제출 시 complete_ended_collaborations로 선반영 | `review_store.submit_review` |
| 3 | 협업 공간을 한 번도 열지 않았으면? | 시작 여부가 아닌 실제 collaboration.status로 판단 | `review_store.review_window` |
| 4 | 진행 중에 URL을 직접 호출하면? | 서버가 409로 거부 | `review_store.submit_review` |
| 5 | 시작 전 취소된 프로젝트라면? | canceled는 평가 불가 | `review_store.review_window` |
| 6 | 중도 종료됐다면? | ended_early는 제출 가능, 공개 전문성 평균에서 제외 | `review_store.public_expert_reviews` |
| 7 | 수락만 하고 협업을 시작하지 않았다면? | collaboration이 없으므로 작성 대상이 없음 | `review_store._participant` |
| 8 | 협업 종료일이 연장되면? | 완료 전에는 새 end_date 기준 자동 완료 | `workspace_store.complete_ended_collaborations` |
| 9 | 시간대 경계에서 하루 차이가 생기면? | 협업 자동 완료 판단은 Asia/Seoul DB 날짜 | `workspace_store.TODAY_KST` |
| 10 | 종료 이후 정확히 언제부터 평가 UI가 보이나? | 완료 협업 상세 및 목록의 평가 링크에서 즉시 접근 | `workspace-detail-page.tsx` |

## B. 사용자 권한·신원

| # | 꼬리 검토 질문 | 설계·구현 대응 | 근거 |
|---:|---|---|---|
| 11 | 로그인하지 않은 사람이 평가 API를 호출하면? | 서버 인증 의존성에서 401 | `security.get_current_user_id` |
| 12 | 정지 회원이 쿠키를 가지고 있다면? | ensure_active_user에서 403 | `security.ensure_active_user` |
| 13 | 다른 프로젝트 ID로 평가를 보내면? | 참여자가 아니므로 404 | `review_store._participant` |
| 14 | 연구회원이 전문가 역할로 점수를 보낼 수 있나? | 서버가 collaboration 연구 소유자를 확인해 side를 결정 | `review_store.side_for` |
| 15 | 전문가가 연구회원 역할로 제출할 수 있나? | 서버가 expert_id로 side를 결정 | `review_store.side_for` |
| 16 | 타인의 평가를 볼 수 있나? | 참가자만 자신의 내 평가 컨텍스트를 조회 | `review_store.review_context` |
| 17 | 연구자 ID·전문가 ID를 요청 바디로 위조할 수 있나? | 바디는 점수·후기만 받고 관계는 서버에서 결정 | `reviews.ReviewBody` |
| 18 | 자기 자신에게 점수 줄 수 있나? | 프로젝트 구성 검증 및 DB reviewer!=reviewee 제약 | `ck_review_people` |
| 19 | 운영 조회 전용 계정이 리뷰를 숨길 수 있나? | 아니요. is_admin=true 운영 수정 권한 별도 검증 | `reviews.require_review_moderator` |
| 20 | 외부 사이트에서 쿠키를 이용해 POST를 요청하면? | Origin을 허용된 웹사이트로 제한 | `reviews.check_review_origin` |

## C. DB 무결성·동시성

| # | 꼬리 검토 질문 | 설계·구현 대응 | 근거 |
|---:|---|---|---|
| 21 | 동일 협업에 연구자가 두 번 제출하면? | UNIQUE(collaboration_id,reviewer_id) + 409 | `uq_review_collaboration_reviewer` |
| 22 | 연구자와 전문가가 동시에 제출하면? | 같은 협업의 서로 다른 side 레코드는 각각 허용 | `uq_review_collaboration_side` |
| 23 | 같은 사용자가 두 탭에서 동시에 제출하면? | DB 고유 제약과 INSERT ON CONFLICT가 원자적으로 보호 | `review_store.submit_review` |
| 24 | API 저장 중 오류가 생기면? | 트랜잭션 롤백 | `db.transaction` |
| 25 | 잘못된 0점·6점을 제출하면? | Pydantic Field와 SMALLINT CHECK 이중 차단 | `reviews.ReviewBody` |
| 26 | 후기가 500자를 넘으면? | 프론트 maxLength + API Field + store 검증 | `review_store.clean_comment` |
| 27 | 데이터베이스에서 중복 리뷰를 수동 삽입하면? | 고유 제약이 차단 | `collaboration_review` |
| 28 | 실제 협업 테이블 삭제 시 평가가 사라지나? | RESTRICT FK로 감사 이력 보존 | `fk_collaboration_review` |
| 29 | 스키마 배포 전에 새 API를 호출하면? | 서버 오류가 발생하므로 마이그레이션 선적용이 배포 필수 | `release gate` |
| 30 | 새 Docker 볼륨과 이미 존재하는 볼륨을 같이 처리하나? | init/025는 최초 생성만, 기존 DB는 수동 적용 | `database/init/025_create_collaboration_reviews.sql` |

## D. 평가 정책·수정

| # | 꼬리 검토 질문 | 설계·구현 대응 | 근거 |
|---:|---|---|---|
| 31 | 30일이 지난 뒤 첫 평가를 작성할 수 있나? | 서버 기준 종료 후 30일까지만 | `review_store.review_window` |
| 32 | 기간 끝 시점에 클라이언트 시간을 바꾸면? | 서버 datetime과 DB now로 검증 | `review_store.review_window` |
| 33 | 정상 완료 평가의 수정 기한은? | 작성 후 48시간 이내 1회 | `review_store.edit_review` |
| 34 | 수정 버튼이 사라져도 PUT 호출하면? | DB UPDATE WHERE edit_count=0/48h 검증 | `review_store.edit_review` |
| 35 | 한 번 수정한 뒤 다시 수정할 수 있나? | edit_count 최대 1 + 409 | `ck_review_edit_count` |
| 36 | 평가 수정 전 점수/후기는 남는가? | revision_history JSONB에 이전 내용 저장 | `review_store.edit_review` |
| 37 | 수정으로 다른 사람의 평가를 변경할 수 있나? | WHERE reviewer_id=본인 | `review_store.edit_review` |
| 38 | 신고로 숨겨진 평가를 사용자가 수정할 수 있나? | visibility=visible 조건으로 제한 | `review_store.edit_review` |
| 39 | 두 사람이 제출해야만 평가 작성 자체가 가능한가? | 아니요. 각자 별도 작성 가능 | `review_store.submit_review` |
| 40 | 평가 기준은 역할에 맞게 구분되나? | 연구자→전문가/전문가→연구자 각각 4개 라벨 | `reviews.REVIEW_LABELS` |

## E. 공개 집계·평판 공정성

| # | 꼬리 검토 질문 | 설계·구현 대응 | 근거 |
|---:|---|---|---|
| 41 | 완료 직후 공개 평점이 바로 바뀌는가? | 보복성 평가 방지를 위해 종료 7일 후 공개 | `review_store.public_expert_reviews` |
| 42 | 실제 전문가 아닌 목업 점수가 섞이나? | LOCAL DEMO 전용 프론트 오버레이, 실제 API 별도 | `expert-local-demo.ts` |
| 43 | 중도 종료 평가가 공개 평균에 포함되나? | 포함되지 않음; 내부 피드백으로 유지 | `public_expert_reviews` |
| 44 | 전문가가 연구자에게 준 점수가 전문가 평점에 들어가나? | 아니요; reviewer_side=researcher 조건 | `public_expert_reviews` |
| 45 | 공개 평균의 계산식은? | 4항목 평균을 평가 단위로 합산한 후 소수 1자리 | `public_expert_reviews` |
| 46 | 후기가 0개면 0점으로 보이나? | 평가 없음 상태와 null 평균 사용 | `expert-review-summary.tsx` |
| 47 | 신고 후 숨긴 후기가 평균에서 제외되나? | visibility=visible 조건으로 제외 | `public_expert_reviews` |
| 48 | 평가의 전체 개수와 후기 노출 개수가 다른가? | 총 개수 전체, 후기 목록 최근 최대 20건 | `PUBLIC_LIMIT` |
| 49 | 공개 후기 작성자 닉네임이 노출되나? | 익명 '협업 연구회원'만 표시 | `public_expert_reviews` |
| 50 | 프로필을 비공개 전환하면 점수가 조회되나? | active+is_public 확인 후 404 | `public_expert_reviews` |

## F. 화면 구성·접근성

| # | 꼬리 검토 질문 | 설계·구현 대응 | 근거 |
|---:|---|---|---|
| 51 | 프로젝트 완료 후 어디서 평가하나? | 협업 공간 완료 목록→평가하기 링크 | `workspace-home.tsx` |
| 52 | 협업 상세에서 같은 평가를 찾을 수 있나? | 상단 완료 협업 정보 아래 리뷰 카드 | `workspace-detail-page.tsx` |
| 53 | 모바일 작은 화면에서도 네 항목을 선택하나? | 반응형 점수 선택 버튼/폼 | `collaboration-review-card.tsx` |
| 54 | 화면에 서버 기준 작성 기간이 표시되나? | submission_deadline을 한국 날짜로 안내 | `CollaborationReviewCard` |
| 55 | 필수 점수 네 개를 모두 선택하지 않으면? | 제출 버튼 비활성, 서버도 검증 | `CollaborationReviewCard` |
| 56 | 텍스트 후기는 필수인가? | 선택(공란 점수만 제출 가능) | `ReviewBody.comment` |
| 57 | 네트워크 오류 발생 시 후기가 사라지나? | 폼 값은 유지하고 오류 문구 표시 | `CollaborationReviewCard` |
| 58 | 저장 중 버튼을 중복 클릭하면? | busy 상태에서 차단, 서버 DB도 차단 | `CollaborationReviewCard` |
| 59 | 평가가 저장되면 상태가 자동 갱신되나? | POST 응답의 새 컨텍스트로 렌더링 | `submitReview` |
| 60 | 색상만으로 선택 여부가 표현되나? | 숫자·aria-pressed로도 상태 제공 | `ScorePicker` |

## G. 사이트 간 연결·알림

| # | 꼬리 검토 질문 | 설계·구현 대응 | 근거 |
|---:|---|---|---|
| 61 | 종료일에 누가 평가 기회를 알려 주나? | 자동 완료 트랜잭션이 review_ready 알림 생성 | `workspace_store.complete_ended_collaborations` |
| 62 | 연구자와 전문가 둘 다 알림을 받나? | TO_BOTH 알림 분기 | `notification_store.notify_requests` |
| 63 | 만료 cron이 여러 번 돌면 중복 알림이 오나? | 변경된 행만 RETURNING + 알림 고유 키 | `complete_ended_collaborations` |
| 64 | 종료와 알림 저장 중 서버가 죽으면? | 협업 상세/목록에서 트랜잭션으로 함께 저장 | `workspace_store.load_workspace` |
| 65 | 알림을 클릭하면 어디로 이동하나? | /workspace/{id}#review | `notification_store.load_notifications` |
| 66 | Discord DM은 어떤 URL을 보내나? | 같은 평가 링크, 알림 설정 존중 | `notification_sender.dm_text` |
| 67 | Discord 봇이 없을 때 평가 기능이 멈추나? | 사이트 알림/평가 저장은 봇과 독립 | `notification_store` |
| 68 | 전문가 프로필의 평점은 어디서 읽나? | /reviews/experts/{id}/summary | `expert-profile-view.tsx` |
| 69 | 프로필에 데모 정보가 있는데 실제 요청도 가능한가? | 목업에서는 요청 API 차단, 실제에서는 기존 모달 | `expert-profile-view.tsx` |
| 70 | 공개 후기 신고는 어떻게 접수되나? | 후기별 로그인 사용자 보고 버튼과 API | `expert-review-summary.tsx` |

## H. 악용·신고·운영

| # | 꼬리 검토 질문 | 설계·구현 대응 | 근거 |
|---:|---|---|---|
| 71 | 누가 공개 후기를 신고할 수 있나? | 활성 로그인 사용자 | `review_store.report_review` |
| 72 | 같은 리뷰에 같은 사람이 반복 신고할 수 있나? | 고유 인덱스와 409 | `uq_review_report_user` |
| 73 | 평가 작성자가 자신의 후기 신고를 할 수 있나? | 자기 신고 금지 | `review_store.report_review` |
| 74 | 비공개 리뷰도 외부에서 신고할 수 있나? | 공개 후기만 신고 허용 | `review_store.report_review` |
| 75 | 신고만으로 후기가 자동 숨겨지나? | 아니요, 운영자 판단 전에는 유지 | `review_store.report_review` |
| 76 | 운영자 화면은 누구에게 보이나? | 별도 is_admin 후기 관리 권한 | `admin-shell.tsx` |
| 77 | 운영자가 리뷰 공개 여부를 변경할 수 있나? | 신고 처리로 숨김/복원/기각 | `review_store.moderate_report` |
| 78 | 처리 근거를 남기나? | moderation_reason/moderated_by/moderated_at 및 신고 처리 결과 | `collaboration_review` |
| 79 | 운영자 아닌 사람이 직접 PUT하면? | require_review_moderator 403 | `reviews.require_review_moderator` |
| 80 | 중복 처리 요청이 들어오면? | report FOR UPDATE 및 pending 확인 후 409 | `review_store.moderate_report` |

## I. 개인정보·보안 경계

| # | 꼬리 검토 질문 | 설계·구현 대응 | 근거 |
|---:|---|---|---|
| 81 | 연구 제목이 공개 후기에 포함되나? | 공개 평점 API에서 title/연구ID 미선택 | `public_expert_reviews` |
| 82 | 상대방 닉네임이 공개되나? | 익명 레이블만 반환 | `public_expert_reviews` |
| 83 | 대상 전문가는 공개 동의한 회원인가? | expert.is_public+users.status 확인 | `public_expert_reviews` |
| 84 | PostgREST에서 리뷰 테이블을 직접 쓸 수 있나? | RLS ENABLE과 anon/authenticated/service_role 권한 REVOKE | `migration.sql` |
| 85 | 임의 정렬·SQL 파라미터를 주입할 수 있나? | API에서 정한 쿼리 상수와 바인딩 사용 | `review_store` |
| 86 | 후기에 HTML 또는 스크립트를 넣으면? | React text node로 렌더링, raw HTML 사용 없음 | `VerifiedReviewSummary` |
| 87 | 신고자가 작성한 메모가 공개되나? | 운영자 전용 API에서만 조회 | `moderation_queue` |
| 88 | 기존 평가를 수정해 이력 지우는가? | revision_history 불변 기록으로 추적 | `review_store.edit_review` |
| 89 | 운영자 리스트가 타 도메인에게 노출되나? | JWT+is_admin+허용 Origin(쓰기)에 제한 | `reviews.router` |
| 90 | 개발자 localhost Mock Data가 Vercel에 배포되나? | 프로덕션 NODE_ENV 가드, 가상 값 집계 API 미사용 | `expert-local-demo.ts` |

## J. 배포·회귀·운영 준비

| # | 꼬리 검토 질문 | 설계·구현 대응 | 근거 |
|---:|---|---|---|
| 91 | 현재 공용 DB에 신규 테이블이 생겼나? | 아니요. PR에는 마이그레이션 파일만 포함 | `deployment policy` |
| 92 | DB 데이터 파괴 없이 설치하나? | CREATE/ALTER 기반; 기존 리뷰나 사용자 삭제 없음 | `20261031_21` |
| 93 | 동일 migration을 두 번 적용해도 되나? | 아니요. Alembic 버전 관리 및 guard, 별도 운영 검토 필요 | `20261031_21 migration` |
| 94 | 개발용 기존 Docker 볼륨에서 자동 적용되나? | 아니요. 파일 수동 적용 필요 | `database/init/025` |
| 95 | 이전 앱 버전과 신규 알림 constraint 호환하나? | 기존 type들을 모두 보존하고 review_ready 추가 | `ck_notification_type` |
| 96 | 새 프론트엔드의 TypeScript 검사 경로는? | GitHub Actions frontend job 및 Vercel 빌드 | `collaboration-reviews-ci.yml` |
| 97 | 백엔드 무DB 테스트는 무엇을 검증하나? | 권한/기간/중복/점수/SQL 계약 | `test_collaboration_reviews.py` |
| 98 | 실제 DB 마이그레이션까지 CI로 검증되나? | 아니요. PostgreSQL 통합 테스트는 별도 릴리스 게이트 | `release gate` |
| 99 | 실제 Discord 수신·브라우저 E2E까지 확인했나? | 아니요. 수동 실사용 검증 필수 | `release gate` |
| 100 | develop 병합과 운영 배포가 이미 됐나? | 아니요. Draft PR에서 테스트·팀 승인 후 별도 진행 | `PR #72` |

## 배포 전 별도 실검증이 반드시 필요한 항목
1. PostgreSQL 17 로컬 DB에 신규 마이그레이션 적용, ALTER/UNIQUE/권한 검증. 데이터 초기화·볼륨 삭제 절대 금지.
2. 연구자와 전문가 각각 로그인해 실제 종료 협업의 평가 제출·중복 차단·48시간 수정·30일 마감·7일 공개지연 검증.
3. 1440/768/390px와 키보드·스크린리더로 점수 선택/후기/신고/운영 검수 화면 확인.
4. 실제 Discord DM 수신과 사이트 알림 링크가 동일한 협업으로 이동하는지 확인.
5. 개인정보 유출 검토: 실제/가상 후기 구분, 연구 제목·닉네임·비공개 합의문서 누출 없음.
6. 운영자 권한 최소화, 신고 상태별 차단, 로그 및 점수 재집계 검증.
7. PR CI와 Vercel 빌드 성공 확인 후 코드 리뷰·승인, staging DB 적용, 최종 rollback 계획 확보.

## Windows PowerShell 개발 검증
```powershell
# 프로젝트 루트: 기존 Docker DB 백업 후 DB 스키마 버전 확인
docker compose exec postgres psql -U admin -d labbridge -c "SELECT version_num FROM public.insight_alembic_version;"
# 예시: 20261029_20 이면 검토 후 SQL을 한 번만 적용 (테스트용 DB에만)
docker cp .\database\init\025_create_collaboration_reviews.sql labbridge-postgres:/tmp/025_create_collaboration_reviews.sql
docker compose exec postgres psql -v ON_ERROR_STOP=1 -U admin -d labbridge -f /tmp/025_create_collaboration_reviews.sql

# 별도 터미널: backend
cd backend
uv run pytest -q tests/test_collaboration_reviews.py
# 다른 터미널: frontend
cd frontend
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```
기존 DB 버전이 다르면 위 SQL을 강행하지 말고 현재 적용 이력을 확인하세요.
