# 인사이트 에이전트 5단계 결과

확인일: 2026-10-30. 목표: 생성 작업의 보완 의견과 현재 원고를 기존 인사이트 관리자에서 검토할 수 있게 하며, 사람 승인과 작업 재개 권한을 판본에 묶는다.

0~4단계 원문은 덮어쓰지 않았다. 6단계 LangGraph 비교와 7단계 AWS 인계는 구현하지 않았다. 이 결과는 실제 논문·모델·운영 동시성·실제 관리자 로그인을 검증한 기록이 아니다.

## 1. Git 기준

작업 시작 시 로컬 `develop`은 `origin/develop`과 같은 `9681890`(#59 작업 회차 저장 머지)였다. 브랜치 `feature/insight-agent-review`는 그 지점에서 만들었다. 기존 미커밋 계획 문서·QA 이미지·PDF는 보존했고 이번 커밋에 넣지 않았다.

## 2. API·UI 경계 (기존 절차 재사용)

별도 AI 승인 bool·두 번째 승인 저장소를 만들지 않았다. 승인과 게시는 기존 `approve`/`publish`만 수행한다.

| 경계 | 요청 | 성공 | 실패 | 권한 |
|---|---|---|---|---|
| 후보 상세 | `GET /admin/insights/candidates/{id}` | 기존 칸 + `agent_run`(없으면 null) | 401, 403, 404 | `require_admin` |
| 통합 목록 | `GET /admin/insights/workspace` | 현재 페이지 항목에 짧은 `agent_run` | 401, 403 | `require_admin` |
| 다시 작성 요청 | `POST .../rewrite-request` | 글 상태 유지, 회차 `needs_revision`, `publication_approved=false` | 403 비관리자/Origin, 409 오래된 version·다른 회차·중복, 409 공개본 | `require_admin` + `require_trusted_origin` |
| 검토 요청 | 기존 `POST .../submit` | `pending_review` | 기존과 같음 | 기존 |
| 승인 | 기존 `POST .../approve` | 현재 판본만 `approved` | 비관리자 403, 오래된 version 409, 트렌드 422, 독자 검수 누락 422 | 기존 `reading_checks` |
| 게시 | 기존 `POST .../publish` | 공개 스냅샷 | 기존과 같음 | 기존 |

`ready_for_human`과 `rewrite_requested`는 게시 승인이 아니다. `publication_approved`는 회차 칸에서 항상 false다.

## 3. 입력 → 처리 → 결과

후보와 회차는 접수 이력(`transfer_receipt_items` → `transfer_receipts.run_id` → `agent_runs`)으로만 잇는다. Candidate 상태 enum에 작업 값을 넣지 않는다.

| 상황 | 동작 |
|---|---|
| 미승인 후보 + 연결된 회차 | 상세에 단계·한글 상태·근거 ID·현재 원고 기준 보완 의견 |
| 수동 등록·회차 없음 | `agent_run=null`, 기존 검토만 사용 |
| 다시 작성 요청 | ReviewEvent `rewrite_requested`, 회차 `needs_revision`/`human_rewrite_requested`. 현재 원고·공개본 유지 |
| 같은 요청 재전송 | 409 중복 |
| 관리자가 고친 본문 후 요청 | 제목·본문 유지. 재개 함수는 `needs_revision`을 종료 상태로 보고 덮어쓰지 않음 |
| 트렌드 승인 | 기존 `validate_evidence()` 422 유지. AI 검토 통과로 우회하지 않음 |
| 승인 뒤 다른 version | 기존 409. 이전 승인을 새 원고에 붙이지 않음 |

가짜 실행기만 사용했다. 실제 모델 호출·AWS·웹 반입 경로는 열지 않았다.

## 4. 화면

기존 좌측 사이드바·탭·목록·편집/미리보기 모달을 유지했다. 별도 관리자 앱·챗봇 패널은 없다. 상태 배지는 색+문자, 버튼은 `ADMIN_BUTTON` 크기·focus/disabled를 재사용했다.

- 목록: 미연결 후보는 기존 배지만, 연결 후보는 `사람 검토 대기` 등 회차 배지
- 승인·게시 탭: 작업 회차 칸, 근거 ID, 보완 사항, `다시 작성 요청`
- 확인 모달 Esc는 바깥 편집 창을 닫지 않음 (기존 동작 유지)

## 5. 테스트·정적 검사

가상 계정·임시 SQLite만 사용했다. 실제 DB 연결 문자열을 출력하지 않았다. `INSIGHTS_ENABLED`와 `ANALYTICS_COLLECTION_ENABLED`는 바꾸지 않았다.

```text
backend에서:
uv run ruff check app/insights/agent_review.py app/insights/schemas.py app/insights/agent_checkpoint.py app/routers/insights.py app/routers/insight_workspace.py tests/test_insight_agent_review.py
→ All checks passed

uv run pytest tests/test_insight_agent_review.py tests/test_insight_admin_ui_api.py tests/test_insight_workflow.py tests/test_insight_workspace.py tests/test_insight_agent_checkpoint.py -q -p no:cacheprovider
→ 76 passed, 1 warning

uv run pytest tests/test_insight_agent_flow.py tests/test_insight_agent_contract.py tests/test_insight_transfer.py tests/test_insight_transfer_staging.py tests/test_insight_migration.py tests/test_insight_editorial.py tests/test_insight_import.py -q -p no:cacheprovider
→ 121 passed, 1 skipped, 1 warning

uv run pytest tests/test_insight_catalog.py tests/test_insight_views.py tests/test_insight_postgres.py tests/test_insight_sources.py -q -p no:cacheprovider
→ 22 passed, 1 skipped, 1 warning

frontend에서:
npx tsc --noEmit
→ 오류 없음
npx eslint src/components/admin/insight-review.tsx src/components/admin/insight-editor-dialog.tsx src/components/admin/insight-confirm-dialog.tsx src/components/admin/insight-workspace-table.tsx src/lib/admin-insights.ts
→ 오류 없음
npm test
→ 82 passed
npx next build
→ Compiled successfully
```

시나리오: 회차 표시, 다시 작성 요청 후 원고 보존, 비관리자/Origin 403, 오래된 version·다른 회차·중복 409, 트렌드 승인 422, 관리자 수정 본문 보존, 가짜 회차 재개 시 후보 수 유지.

| 결과 | 내용 |
|---|---|
| skip | 심볼릭 링크 권한, PostgreSQL 동시성 URL 없음 |
| warning | Starlette TestClient deprecation. 의존성 미변경 |

## 6. 보존한 것 / 하지 않은 것

보존: 전송 v1, 접수 이력, 가짜 흐름, 작업 회차 표, 트렌드 승인 차단, Candidate enum, 기존 승인/게시 API, `execution_available` 비활성, 사이드바·탭·편집 모달.

하지 않음: LangGraph, Redis, 모델 SDK, AWS, 승인 API 신설, `.env` 수정, 공용 Supabase 적용, 트렌드 승인 완화, 공개 화면 DB 전환.

## 7. 미검증

- 실제 관리자 쿠키 로그인 브라우저 조작. 가상 TestClient 세션만 확인했다.
- 1440/768/390px 실기기 캡처. 검증 중 `next build`가 실행 중인 `npm run dev`의 `.next`와 겹쳐 `/admin/insights`가 일시 500이었다. 기존 개발 서버는 종료하지 않았다.
- PostgreSQL 실제 동시성, 공용 DB의 `20261029_20` 적용
- 실제 모델 호출·수집·게시 활성화

## 8. 다음 단계에 남기는 결정 질문

아래는 이번 단계에서 열지 않았고, 정책 결정이 필요하다.

1. 트렌드 전용 승인 기준을 연결할 것인가? 현재는 차단 유지.
2. 외부 실행기(실제 모델·AWS·정기 수집)에 어떤 최소 권한을 줄 것인가? 현재는 실행 경로 없음.

아래가 남아 있어도 **선택 6단계(LangGraph 비교) 또는 7단계(인계 문서)는 진행할 수 있다.**

6·7단계로 넘어가기 전에 막히는 조건: 트렌드 승인을 우회하거나, 에이전트 성공을 게시 승인으로 저장하거나, 실제 수집/AWS를 켜는 요청.
