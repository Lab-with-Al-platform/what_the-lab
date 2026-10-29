# 인사이트 에이전트 1단계 결과

확인일: 2026-10-29. 목표: 전송 묶음의 접수 이력과 원고를 함께 저장하며, 재입력·충돌·실패에도 기존 글을 보존한다.

0단계 원문 [INSIGHT_AGENT_PHASE_0_RESULT.md](INSIGHT_AGENT_PHASE_0_RESULT.md)는 덮어쓰지 않았다. 계획 문서 2.1의 검토 메모(가짜 환경변수 ≠ `.env` 미열람, CLI 종료 코드 ≠ 내부 예외)를 이 단계 테스트 경계에 반영했다. 2단계 이후는 구현하지 않았다.

## 1. Git·번호 재확인

작업 시작 시 `develop` HEAD는 `50ee226`이었고 `origin/develop`과 같았다. 브랜치 `feature/insight-receipt`는 그 지점에서 만들었다.

Alembic `revision`/`down_revision`을 다시 목록으로 확인한 뒤 새 파일만 추가했다. 기존 부모·017 stamp는 수정하지 않았다.

| 번호 체계 | 작업 시작 시 마지막 | 이번 추가 | 비고 |
|---|---|---|---|
| Alembic revision | `20261028_17` (단일 head) | `20261029_18`, 부모 `20261028_17` | 버전 표 이름 `insight_alembic_version` 유지 |
| Docker init SQL | `021_add_google_calendar.sql` | `022_add_transfer_receipts.sql` | Alembic 번호와 init 파일 번호는 다르다 |

이미 초기화된 Docker volume에는 `022`가 자동 재적용되지 않는다. 원격 DB 적용·stamp·reset은 하지 않았다.

## 2. 무엇을 저장하는가

`insight_private.transfer_receipts`와 `transfer_receipt_items`를 추가했다. Candidate 상태(`draft/pending_review/approved/published`)에는 작업 enum을 넣지 않았다.

| 칸 | 의미 |
|---|---|
| `trust_scope` | 서버/호출자가 정한 신뢰 범위. 기본값 `local-virtual`. JSON·`actor`로 고를 수 없음 |
| `bundle_id` | 그 범위 안에서 유일. `(trust_scope, bundle_id)` UNIQUE |
| `run_id` | 회차. 여러 묶음을 가질 수 있어 유일하지 않음 |
| `sha256` | 받은 원본 바이트의 해시. 제출자가 적은 값이 아님 |
| `outcome` | 최초 결과만 저장: `imported` / `existing_preserved` |
| 매핑 | 당시 `candidate_id`·`revision_number`·`action`. replay 때 현재 판본으로 바꾸지 않음 |

이번 요청의 행동 값 `replayed`·`conflict`는 응답에만 쓴다. 표에 `processing` 행을 남기지 않는다.

## 3. 입력 → 처리 → 결과

함수: `stage_transfer_candidates`. HTTP/CLI/AWS에는 연결하지 않았다.

| 조건 | 처리 | 이번 응답 |
|---|---|---|
| `dry_run=true`(기본) | 기존 미리 보기. 접수 행을 예약·저장하지 않음 | `receipt_outcome` 없음 |
| 같은 범위+같은 `bundle_id`+같은 바이트 | 최초 스냅샷·매핑 재사용. 새 후보/판본/검토 이력 없음 | `receipt_outcome=replayed`, `created=0` |
| 같은 범위+같은 `bundle_id`+다른 바이트 | 거절. JSON 공백만 달라도 해시가 다름 | HTTP 409. CLI 종료 코드 2가 아님 |
| 다른 `bundle_id`+같은 출처 | 기존 후보 보존 + **새 접수 행** | `existing_preserved` |
| 전부 기존 글인 묶음 | 접수 행은 남김. 원고·수정·공개본은 그대로 | `existing_preserved` |
| 뒤쪽 원고 실패 / 바깥 rollback | SAVEPOINT 또는 호출자 rollback으로 접수까지 함께 취소 | 접수 행 0 |
| 서로 다른 `trust_scope` | 같은 `bundle_id`여도 충돌하지 않음 | 접수 행 2개 |

동시 삽입은 조회 후 삽입만으로 안전하다고 주장하지 않는다. UNIQUE가 같은 ID를 막고, `IntegrityError`면 이미 있는 접수를 다시 읽어 같은 해시면 replay·다르면 409로 돌린다. 이 경합 경로는 **SQLite에서 UNIQUE만 확인**했고, 실제 PostgreSQL 동시 실행은 미검증이다.

형식 오류는 기존처럼 `TransferError`다. 오프라인 CLI의 종료 코드 2는 `python -m app.insight_transfer`만의 처리 결과이며, 내부 반입 함수가 그 숫자를 반환하지 않는다.

## 4. 테스트·정적 검사

가상 계정·임시 SQLite·더미 `DATABASE_URL`만 사용했다. 실제 DB 연결 문자열을 출력하지 않았다. `INSIGHT_RUN_POSTGRES_TESTS`는 켜지 않았다.

오프라인 Alembic 검사에서 `dotenv.load_dotenv`를 빈 함수로 막고 `build_engine`이 호출되면 실패하게 했다. 앱의 `config.py`/`env.py` 운영 로더는 전면 변경하지 않았다. `env.py`는 오프라인 모드에서도 `load_dotenv`를 호출하므로, **테스트가 파일 읽기를 가로챈 것**과 **소스에서 호출 자체가 없어진 것**은 다르다.

```text
backend에서:
uv run ruff check app/insights/models.py app/insights/transfer_staging.py tests/test_insight_transfer_staging.py tests/test_insight_migration.py migrations/versions/20261029_18_transfer_receipts.py
→ All checks passed

uv run pytest tests/test_insight_transfer.py tests/test_insight_transfer_staging.py tests/test_insight_migration.py tests/test_insight_editorial.py tests/test_insight_discovery_policy.py -q -p no:cacheprovider
→ 86 passed, 1 skipped, 1 warning / 10.02s

uv run pytest tests/test_insight_workflow.py tests/test_insight_import.py tests/test_insight_workspace.py tests/test_insight_sources.py tests/test_insight_admin_ui_api.py tests/test_insight_catalog.py tests/test_insight_views.py tests/test_insight_postgres.py -q -p no:cacheprovider
→ 99 passed, 1 skipped, 1 warning / 26.37s
```

| 결과 | 내용 |
|---|---|
| skip | `test_link_file_is_rejected` — Windows 심볼릭 링크 권한 부족 |
| skip | `test_two_postgres_workers_publish_once` — 전용 PostgreSQL URL 없음. SQLite 통과로 동시성을 대체하지 않음 |
| warning | Starlette TestClient deprecation 1건. 의존성은 바꾸지 않음 |

프론트 빌드·브라우저·전체 저장소 테스트·실제 DB migration 적용은 실행하지 않았다. UI를 바꾸지 않았다.

## 5. 보존한 것 / 하지 않은 것

보존: 미리 보기 무저장, 메모+전체 원고 동시 준비, 외부 verified 초기화, 기존 후보·관리자 수정·공개본 보존, 뒤쪽 실패 시 묶음 취소, 호출자 트랜잭션, 트렌드 승인 차단, `execution_available is False`, 전송 v1 필드.

하지 않음: HTTP/CLI 실제 반입, 기계 인증, AWS, LangGraph, 원격 DB 적용, Candidate 상태에 queued/researching 추가, 공개 화면의 정적 목록을 DB로 전환, 트렌드 승인 우회, `.env` 수정.

## 6. 다음 단계의 차단 조건

아래가 남아 있어도 **2단계 로컬 계약 설계는 진행할 수 있다.** 반대로 아래를 임의 구현하면 안 된다.

- 실제 PostgreSQL 접수 경합 미검증
- 기계 인증·신뢰하는 PR 입력 없음
- 트렌드 전용 승인 기준 미연결 (차단 유지)
- DB Publication → 공개 목록/상세 화면 미연결
- 실제 수집·모델·AWS·정기 실행 없음
- 접수 보관 기간·제출 경로 미정
- 이미 만들어진 Docker volume에 `022` 미적용

2단계로 넘어가기 전에 막히는 조건: 접수 이력을 Run 상태와 섞거나, staging을 웹/CLI에 바로 연결하거나, 원격 DB에 migration을 적용하는 요청.
