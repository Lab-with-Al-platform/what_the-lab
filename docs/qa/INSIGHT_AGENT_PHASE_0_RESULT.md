# 인사이트 에이전트 0단계 결과

확인일: 2026-10-29. 목표: 현재 소스에서 재사용할 기능과 아직 없는 계약을 파일 근거로 정리한다. 앱 코드·migration·의존성은 바꾸지 않았다. 1단계는 구현하지 않았다.

이 문서는 [인사이트 에이전트 적용 계획](../planning/INSIGHT_AGENT_WORKFLOW_PLAN_AND_CURSOR_PROMPTS_2026-10-29.md)의 0단계 산출물이다. 2026-10-16의 다른 기록 [PHASE_0_FINDINGS.md](../ai-case-automation/PHASE_0_FINDINGS.md)와 이름이 비슷하지만 **덮어쓰지 않았다.**

## 1. Git·소스 기준

| 항목 | 확인 사실 |
|---|---|
| 현재 브랜치 | `develop` |
| HEAD | `50ee226` `docs: 구글 캘린더 안내 … (#53)` |
| `origin/develop` | 같은 해시. 앞서거나 뒤처진 커밋 없음 |
| 중첩 AGENTS | 저장소 루트 `AGENTS.md`만 있음 |
| 확인 가능한 열린 PR | `gh pr list --base develop --state open` 결과 없음 |
| 실행 중 서버 | 이번 단계에서 프로세스 목록을 단정하지 않음. 기존 서버를 끄지 않음 |
| 원격 DB revision | 접속하지 않음. **미확인** |

추적 파일의 이번 단계 변경은 이 결과 문서뿐이다. 작업 트리에 이미 있던 미커밋은 보존했다.

- 수정됨: `docs/planning/README.md` (계획 문서 링크 한 줄)
- 추적 안 됨: 계획 문서 자체, QA 스크린샷·PDF, `docs/qa/INSIGHT_AWS_READINESS_CHECKPOINT_2026-10-28.md`
- `.env`는 읽거나 출력하지 않음. 테스트는 `tests/conftest.py`가 가짜 계정·가짜 DB 주소로 덮어 씀

## 2. 사실 / 제안 / 미확인

구분 기준: **사실**은 오늘 연 파일·테스트, **제안**은 1단계 이후 설계 초안, **미확인**은 접속·권한·정책이 없어 단정하지 못한 것이다.

### 사실

- 전송 계약 `insight_transfer_v1`과 오프라인 검사기가 있다. CLI는 DB를 열지 않는다.
- 내부 반입 `stage_transfer_candidates`는 가상 SQLite 테스트에서만 호출된다. 웹·CLI·AWS 경로에 연결되어 있지 않다.
- 원본 SHA-256은 제출자가 적은 값이 아니라 받은 바이트로 계산한다. 다만 그 해시를 **묶음 접수 표에 저장하지는 않는다.** 판본 JSON의 `transfer.sha256` 메모로만 남긴다.
- 후보 중복은 출처 URL/DOI + 유형(`kind`) 단위다. 같은 `bundle_id`에 다른 원본을 넣어도 묶음 전체 거절은 없다.
- 후보 상태 enum은 `draft / pending_review / approved / published`뿐이다. 계획의 `queued / researching / ready_for_human`은 코드에 없다.
- 수집 설정은 DB에 저장할 수 있으나 응답의 `execution_available`은 항상 `false`다. 실제 수집기·모델 호출·스케줄러는 인사이트 코드에 없다.
- 승인·게시는 관리자 쿠키 + Origin 검사 + `expected_version` + 현재 판본이다. 트렌드는 `validate_evidence()`가 승인·게시를 막는다.
- 공개 사례·트렌드 화면은 `frontend/src/lib/insights.ts`를 읽는다. 프론트는 `/api/v1/insights`를 호출하지 않는다.
- Alembic 파일 head는 `20261028_17`(구글 캘린더). 버전 표 이름은 `insight_alembic_version`이다.
- 의존성에 LangGraph·OpenAI·Anthropic SDK는 없다.

### 제안 (1단계에서 확정할 초안, 오늘은 구현하지 않음)

- 접수 객체는 기존 Candidate 상태와 섞지 말고 `insight_private` 안의 별도 표로 둔다.
- `run_id`(회차)와 `bundle_id`(그 회차의 제출 묶음)를 같은 값으로 강제하지 않는다.
- 같은 `bundle_id` + 같은 원본 바이트는 이전 결과를 재사용하고 새 후보/판본/검토 이력을 만들지 않는다.
- 같은 `bundle_id` + 다른 바이트는 충돌로 거절한다. JSON 공백만 달라도 해시는 다르다.
- `dry_run=true`에서는 접수 이력을 예약하거나 쓰지 않는다.
- 권한 Capability(도구 허용)와 기술 분류 CAP ID는 다른 말이다.

### 미확인

- 원격·운영·개발 Supabase의 실제 `insight_alembic_version`
- 로컬 Docker가 지금 그 번호까지 와 있는지
- 실제 PostgreSQL에서 SAVEPOINT·유일 제약 경합이 어떻게 보이는지
- 신뢰하는 PR·커밋·기계 인증 경로
- 실제 수집 자료의 저장 위치·보관 기간
- 공개 API를 화면이 쓰도록 바꿀지 (정책 결정)
- 팀원이 로컬에서 진행 중인, 아직 PR이 없는 작업

## 3. 정확한 재사용 파일

| 역할 | 파일 | 재사용 방법 |
|---|---|---|
| JSON 계약 | `backend/app/insights/transfer_contract.py` | v1 필드를 임의로 늘리지 않음 |
| 오프라인 검사 CLI | `backend/app/insight_transfer.py` | 1단계 HTTP 반입 경로로 쓰지 않음 |
| 내부 반입 | `backend/app/insights/transfer_staging.py` | SAVEPOINT·호출자 트랜잭션·`dry_run` 기본값 유지 |
| 후보 중복·미승인 정규화 | `backend/app/insights/importing.py` | 출처+유형 보존 규칙을 유지한 채 묶음 이력을 감쌈 |
| 후보·판본·공개본 표 | `backend/app/insights/models.py` | 기존 enum에 작업 상태를 넣지 않음 |
| 스키마명 | `backend/app/insights/database.py` | `insight_private`, 테스트만 SQLite 허용 |
| 승인 근거 검사 | `backend/app/insights/service.py` | 트렌드 차단을 우회하지 않음 |
| 원고 구조 검사 | `backend/app/insights/editorial.py` | 형식 누락만 찾고 사실 승인을 대신하지 않음 |
| 관리자·Origin | `backend/app/insights/auth.py` | `actor` 문자열을 인증으로 쓰지 않음 |
| 관리자 API | `backend/app/routers/insights.py` | import는 `import_candidates`만. staging 미연결 |
| 수집 설정 | `backend/app/routers/insight_workspace.py`, `collection_policy.py`, `collection_sources.py`, `workspace_schemas.py` | 설정 저장만 재사용. 실행기는 아직 없음 |
| 공개 정적 목록 | `frontend/src/lib/insights.ts` | 미승인 후보를 배열에 넣지 않음 |
| 조회수 허용 주소 | `backend/app/insights/public_catalog.py` | 정적 slug·유형만 공개 글로 봄 |
| 가상 전송 샘플 | `backend/tests/fixtures/insight-transfer-v1.json` | 실제 논문으로 보이지 않게 유지 |
| 테스트 환경 | `backend/tests/conftest.py` | 실제 `.env` DB를 테스트에 쓰지 않음 |

관련 기준 문서: [전송 계약](../ai-case-automation/INSIGHT_TRANSFER_CONTRACT.md), [클라우드·PR 반입](../ai-case-automation/INSIGHT_CLOUD_PR_INGESTION_STANDARD.md), [편집 운영](../ai-case-automation/INSIGHT_EDITORIAL_OPERATING_STANDARD.md), [전송 검증 기록](INSIGHT_TRANSFER_VERIFICATION_2026-10-28.md), [코딩 스타일](../development/CODING_STYLE.md), [MVP 범위](../product/MVP_SCOPE.md), [결정 로그 D-23](../product/03_DECISION_LOG.md#d-23-인사이트-첫-백엔드와-공통-db).

## 4. 구현 여부 — 오늘 소스 기준

과거 문서의 “미완료”를 그대로 믿지 않고 파일을 다시 열었다.

### 묶음 접수 테이블 / 중복 처리

**부분 구현.** 후보 단위 중복은 있다. 묶음 단위 접수 이력은 없다.

- `importing.existing_candidate()`: URL 또는 DOI가 같은 출처의 같은 `kind`면 `existing_preserved`.
- 묶음 안 같은 출처+유형은 `duplicate_in_batch`.
- 다른 출처가 같은 slug를 쓰면 409.
- `models.py`에 receipt / bundle_id 유일 제약 테이블 없음. `database/init` SQL에도 없음.
- 같은 파일을 다시 넣으면 기존 후보·관리자 수정·공개본은 유지되지만, 묶음 결과가 남는 행은 없다. 전부 기존 글인 묶음도 이력이 없다.

### 작업 상태 / 체크포인트

**미구현.** `Run` 표, 단계 상태, 설정 해시, CAS version은 없다. `ai/README.md`는 개인화 추천 실험 경계만 적는다. LangGraph checkpointer도 없다. 기존 `tmp/db-checkpoints/`는 스키마 적용 전 백업 폴더이며 에이전트 재개가 아니다.

### 실제 수집·모델 호출

**미구현.** `CollectionSetting`은 설정 JSON만 보관한다. `collection_oct22.py`는 2026-10-22에 사람이 정리한 6개 초안이지 수집기가 아니다. `backend/app`에서 openai/langgraph import는 로그인·디스코드·구글 캘린더용 `httpx`만 있다. `.github/workflows`는 없다.

### 관리자 권한·승인 판본

**구현됨.** 재사용할 경계는 아래와 같다.

| 단계 | 입력 | 서버가 다시 보는 것 | 실패 |
|---|---|---|---|
| 쓰기 | 쿠키 세션 | `require_admin`, `Origin` ∈ `INSIGHT_ALLOWED_ORIGINS` | 403 |
| 기능 스위치 | 없음 | `INSIGHTS_ENABLED` | 꺼져 있으면 404 |
| 수정·제출·승인·게시 | `expected_version` | 현재 `candidate.version` | 409 |
| 승인 | `reading_checks` 6개, 권리·편집 확인 | 현재 판본 초안 + `validate_evidence` + `validate_editorial` | 422/409 |
| 게시 | `idempotency_key` | `approved_revision == current_revision` | 409 |
| 트렌드 승인·게시 | 사례와 같은 API | `validate_evidence`가 kind=trend면 422 | 차단 유지 |

`transfer_staging`의 `actor`는 테스트용 문자열이다. 인증이 아니다.

### 공개 화면 정적 / DB

**분리되어 있다.**

- 목록·상세 페이지: `frontend/src/app/cases`, `trends` → `@/lib/insights`.
- 서버 공개 API: `GET /api/v1/insights`, `GET /api/v1/insights/{slug}` → `publications` 표. 프론트 검색 결과 없음.
- 조회수 허용 목록은 정적 파일을 읽어 (kind, slug)만 인정한다. DB에 published가 있어도 공개 사이트 반영 완료로 쓰지 않는다.

## 5. Alembic 이력 (오프라인)

파일 `down_revision` 체인만 읽었다. `alembic` CLI가 `.env`를 읽지 않게 온라인 명령은 실행하지 않았다. 원격 DB는 미확인이다.

단일 head: `20261016_01` → … → `20261028_16` → **`20261028_17`**.

버전 표: `public.insight_alembic_version`. Docker 초기화는 번호가 한 벌 더 있다.

| 번호 체계 | 오늘 파일 기준 마지막 | 주의 |
|---|---|---|
| Alembic revision | `20261028_17` | `backend/migrations/versions/` |
| Docker init SQL | `021_add_google_calendar.sql` | 책갈피를 `20261028_17`로 올림. `017_alembic_version.sql`의 첫 INSERT는 `20261028_13` |

### 새 번호 충돌을 피하는 방법 (하드코딩 금지)

1. `backend/migrations/versions/*.py`의 `revision` / `down_revision`을 다시 목록으로 확인한다. 오늘 head를 문서에 박아 두고 쓰지 않는다.
2. 새 파일은 `YYYYMMDD_NN` 형식이며, `NN`은 기존 숫자 접미사 최댓값 + 1이다. 부모는 **그때의 head**다.
3. 기존 파일의 부모·본문을 고치지 않는다.
4. Docker 초기화가 필요하면 `database/init/`의 다음 세 자리 번호(오늘 파일 기준 다음은 022)를 **별도 목록 확인 후** 추가한다. Alembic 번호와 init 파일 번호는 다르다.
5. 실제 DB 적용 전에 `tests/test_insight_migration.py`처럼 `command.upgrade(..., sql=True)`로 오프라인 SQL만 검사한다. 비밀번호가 SQL에 나오면 안 된다.
6. 원격 표의 `version_num`은 접속 허용이 있을 때만 확인한다.

## 6. 테스트 결과 — 오늘 실행

가상 계정·임시 SQLite·더미 `DATABASE_URL`만 사용했다. 실제 DB 연결 문자열을 출력하지 않았다. `INSIGHT_RUN_POSTGRES_TESTS`는 켜지 않았다. 과거 162 passed를 오늘 결과로 쓰지 않는다.

```text
backend에서:
uv run pytest tests/test_insight_transfer.py tests/test_insight_transfer_staging.py tests/test_insight_migration.py tests/test_insight_editorial.py tests/test_insight_discovery_policy.py -q -p no:cacheprovider
→ 79 passed, 1 skipped, 1 warning / 9.92s

uv run pytest tests/test_insight_workflow.py tests/test_insight_import.py tests/test_insight_workspace.py tests/test_insight_sources.py tests/test_insight_admin_ui_api.py tests/test_insight_catalog.py tests/test_insight_views.py tests/test_insight_postgres.py -q -p no:cacheprovider
→ 99 passed, 1 skipped, 1 warning / 18.00s
```

| 결과 | 내용 |
|---|---|
| skip | `test_link_file_is_rejected` — Windows 심볼릭 링크 권한 부족 (기존과 같음) |
| skip | `test_two_postgres_workers_publish_once` — 전용 PostgreSQL URL 없음. **SQLite 통과로 동시성을 대체하지 않음** |
| warning | Starlette TestClient deprecation 1건. 의존성은 바꾸지 않음 |

2026-10-28 기록의 Windows TestClient 소켓 대기는 오늘 두 묶음에서 재현되지 않았다(최장 18초). 무한 재시도는 하지 않았다. Ruff·프론트 빌드·전체 저장소 테스트는 이번 0단계에서 실행하지 않았다(파이썬 미변경).

보존된 동작: 미리 보기 무저장, 메모+전체 원고 동시 준비, 외부 verified 초기화, 기존 후보·공개본 보존, 뒤쪽 실패 시 묶음 취소, 호출자 rollback, 트렌드 승인 차단, `execution_available is False`.

## 7. 강의 노트북 — 코드/Markdown만 읽음

경로 `C:\dev\course\course_multi_agents`는 존재했다. 셀은 실행하지 않았고, 환경 파일·출력·키는 복사하지 않았다.

| 노트북 | 가져올 개념 | 운영에 그대로 복사하면 안 되는 것 |
|---|---|---|
| LangGraph 3 블로그 Supervisor | 조사·작성·편집 역할 전달 | 최대 재시도 후 **강제 통과** 로그. 보류로 바꿔야 함 |
| LangGraph 5 자율 연구 HITL | 반복 상한, 사람 검토 대기 | 에이전트가 권한·기간·예산을 스스로 늘리지 않음. 스크래치패드에 민감정보 금지 |
| LangGraph 4 PostgreSQL Agents | (참고만) | 자동 DB 구성·운영 DB 질의. 수집 AI에 DB 키를 주는 구조 |
| DeepAgents 2 Subagents | 역할별 입력·출력 | 역할 = 별도 프로세스·모델·서버가 아님 |
| DeepAgents 6 HITL | approve / edit / reject 후 재개 | 그래프 `__interrupt__` bool이 관리자 DB 승인을 대체하지 않음 |
| DeepAgents 7 Middleware | 호출 수·시간 기록 | 입력 0.150 / 출력 0.600 $/1M 토큰 고정 요금표. 비밀값·전체 입력 로그 금지 |
| 보안 2·3·4 | 도구 allowlist, capability 소유자, 메시지 경로 검증 | 제출 JSON의 `agent_id`·`role`로 권한을 주지 않음. 권한 Capability ≠ CAP 기술 ID |

## 8. 다음(1단계) 입력·출력·실패·권한 표

구현은 하지 않는다. 모듈 경계를 넘기기 전에 오늘 합의한 초안이다.

| 함수/단계 | 입력 | 처리 | 성공 출력 | 실패 | 트랜잭션 | 권한 |
|---|---|---|---|---|---|---|
| 오프라인 검사 | UTF-8 JSON 바이트 | `validate_transfer_bytes` | 계약 통과 묶음 | 형식 오류 코드 2 | DB 없음 | 로컬 파일만 |
| 내부 반입 | 같은 바이트, 바깥 트랜잭션, `dry_run` | 기존 `stage_transfer_candidates` | 항목별 created/existing_preserved, 계산된 sha256, `publication_approved=false` | 형식·slug 충돌·뒤쪽 원고 실패 | 묶음 SAVEPOINT, commit은 호출자 | 호출 전 신뢰하는 주체. 함수는 인증 안 함 |
| 접수 이력 (1단계 대상) | 서버가 범위 안에서 검사한 bundle_id, 원본 바이트 해시, 반입 결과 | 새 표에 이력·후보/판본 매핑 | imported / existing_preserved / replayed | 같은 ID 다른 바이트 → conflict. 동시 삽입은 DB 제약 | 반입과 함께 성공하거나 함께 취소 | HTTP를 새로 열지 않음. 기계 인증은 이후 |
| 관리자 승인 | 쿠키, expected_version, 독자 검수 | 현재 판본 재조회 | approved | 비관리자·오래된 version·트렌드 | 요청 세션 1개 | `require_admin` |
| 공개 화면 | 정적 카탈로그 | DB publication과 분리 | 기존 글 | 미승인 글 노출 금지 | 없음 | 공개 |

1단계에서 먼저 구성할 테스트(계획 문서 그대로, 오늘은 만들지 않음): 같은 파일 2회, 같은 ID 다른 내용, 다른 ID 같은 출처, 전부 기존 글, 뒤쪽 저장 실패, 바깥 rollback, 기존 관리자 수정/공개본, preview 무저장.

## 9. 다음 단계의 차단 조건

아래가 남아 있어도 **1단계 로컬 설계·가상 DB 테스트는 진행할 수 있다.** 반대로 아래를 임의 구현하거나 정책을 바꾸면 안 된다.

- 실제 PostgreSQL 경합 미검증
- 기계 인증·신뢰하는 PR 입력 없음
- 트렌드 전용 승인 기준 미연결 (차단 유지)
- DB Publication → 공개 목록/상세 화면 미연결
- 실제 수집·모델·AWS·정기 실행 없음
- 접수 보관 기간·제출 경로 미정

1단계로 넘어가기 전에 막히는 조건: 기존 SAVEPOINT를 깨거나, Candidate 상태에 작업 enum을 섞거나, staging을 웹/CLI에 바로 연결하거나, 트렌드 승인을 우회하거나, 원격 DB에 migration을 적용하는 요청.

## 10. 이번 단계에서 하지 않은 것

앱 코드·migration·의존성 변경, 실제 DB 조회/적용, 모델/유료 호출, AWS, 커밋·push·PR·머지·배포, 1단계 구현, 노트북 실행, `.env` 출력.
