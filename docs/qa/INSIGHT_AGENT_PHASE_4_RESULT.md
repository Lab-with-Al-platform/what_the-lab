# 인사이트 에이전트 4단계 결과

확인일: 2026-10-29. 목표: 작업이 중단돼도 완료 결과를 불필요하게 다시 만들지 않고, 바뀐 설정/원고에는 오래된 결과를 적용하지 않는다.

0~3단계 원문은 덮어쓰지 않았다. 5단계 관리자 검토 연결은 구현하지 않았다. 이 결과는 실제 논문·모델·운영 동시성을 검증한 기록이 아니다.

## 1. Git 기준

작업 시작 시 로컬 `develop`은 `origin/develop`과 같은 `fc4b346`(#57 가짜 흐름 머지)였다. 추적 파일의 머지 충돌은 없었다. 브랜치 `feature/insight-agent-checkpoint`는 그 지점에서 만들었다. 기존 미커밋 계획 문서·QA 이미지·PDF는 보존했고 이번 커밋에 넣지 않았다.

## 2. 세 칸을 섞지 않음

| 객체 | 표 | 상태 값 | 책임 |
|---|---|---|---|
| Candidate | `insight_private.candidates` | `draft / pending_review / approved / published` | 글 |
| Receipt | `insight_private.transfer_receipts` | `imported / existing_preserved` | 묶음 접수 |
| Run | `insight_private.agent_runs` | `queued → researching → drafting → reviewing → ready_for_human` 및 `needs_revision / held / failed / cancelled` | 작업 회차 |

`ready_for_human`이어도 게시 승인이 아니다. `publication_approved`는 항상 false다.

## 3. 무엇을 저장하는가

표에 남기는 것: `run_id`, 단계, 상태, 설정 버전+내용 해시, 입력 해시, 원고 해시, 시도 수, 예산 사용, 오류 코드, 근거 ID, `bundle_id`, `state_version`(CAS), 임대 소유자/만료.

표에 남기지 않는 것: 원문 전체, 출처 초록, 비밀값, 비공개 추론, 모델 응답 본문.

Alembic `20261029_20`(부모 `20261029_19`). Docker init `024_add_agent_runs.sql`. 버전 표 이름 `insight_alembic_version` 유지. 원격 DB 적용·stamp·reset은 하지 않았다. 이미 초기화된 Docker volume에는 `024`가 자동 재적용되지 않는다.

## 4. 저장 순서와 재개

단계 직전·직후에 커밋한다. 한 트랜잭션으로 전체를 묶지 않는 이유는, 뒤 단계 저장 실패가 앞 체크포인트까지 지우지 않게 하기 위해서다.

| 상황 | 동작 |
|---|---|
| 같은 `run_id`를 다른 저장소 인스턴스로 다시 염 | SQLite 파일의 마지막 체크포인트부터 이어감 |
| 같은 run 완료 후 재개 | 작성을 다시 하지 않음. 접수가 있으면 `replayed` |
| 같은 version을 두 번 저장 | `CheckpointConflict: stale_version` |
| 설정/입력 해시가 다름 | `settings_changed` / `input_changed`. 기존 행을 덮어쓰지 않음 |
| 현재 원고 해시가 저장된 해시와 다름 | `manuscript_changed`. 오래된 완료 결과를 승인처럼 재사용하지 않음 |
| 다른 작업자의 유효 임대 | `lease_held` |
| 만료된 임대 | 다른 작업자가 이어갈 수 있음 |

운영 임대 초 `PRODUCTION_LEASE_SECONDS is None`이다. 테스트만 30초를 쓴다. 제안: worker가 종료된 뒤에는 만료를 기다렸다가 다른 worker가 이어가고, 동시에 이어가려는 두 작업자는 version/임대 충돌로 막는다. 운영 시간값은 확정하지 않았다.

### 중복 실행이 남는 구간

`DUPLICATE_EXECUTION_GAP = complete_returned_before_checkpoint_save`

가짜 `complete()`가 값을 돌려준 뒤 체크포인트 저장 전에 프로세스가 끝나면, 재개 때 작성이 한 번 더 돈다. 외부 호출 exactly-once를 주장하지 않는다. 후보·공개본 중복은 1단계 접수 이력(`stage_transfer_candidates`)이 막는다.

원문을 표에 안 넣기 때문에, 조사/작성이 이미 끝난 단계의 재개는 메모리를 다시 만든다. 이미 기록된 예산은 그 재구성에서 다시 깎지 않는다. 저장 실패 후 같은 단계를 새로 실행하면 그때의 호출은 예산에 더해진다.

## 5. 5단계용 최소 읽기/재개

HTTP·승인 API는 열지 않았다.

| 함수 | 입력 | 출력 | 하지 않는 일 |
|---|---|---|---|
| `read_run_for_review` | DB 세션, `run_id` | 단계·해시·예산·근거 ID. `publication_approved=false` | 원문 반환, 관리자 인증 |
| `run_checkpointed_flow` | 설정, 엔진, 가짜 lookup/complete, `worker_id` | `FlowResult` | 실제 모델, AWS, 웹 반입 |

## 6. 테스트·정적 검사

가상 계정·임시 SQLite·더미 `DATABASE_URL`만 사용했다. 실제 DB 연결 문자열을 출력하지 않았다. `INSIGHT_RUN_POSTGRES_TESTS`는 켜지 않았다. 오프라인 Alembic 검사는 `dotenv.load_dotenv`를 막고 `build_engine`이 호출되면 실패하게 했다.

```text
backend에서:
uv run ruff check app/insights/agent_checkpoint.py app/insights/models.py tests/test_insight_agent_checkpoint.py tests/test_insight_migration.py migrations/versions/20261029_20_agent_runs.py
→ All checks passed

uv run pytest tests/test_insight_agent_checkpoint.py tests/test_insight_agent_flow.py tests/test_insight_agent_contract.py tests/test_insight_transfer.py tests/test_insight_transfer_staging.py tests/test_insight_migration.py tests/test_insight_editorial.py tests/test_insight_discovery_policy.py -q -p no:cacheprovider
→ 128 passed, 1 skipped, 1 warning / 7.63s

uv run pytest tests/test_insight_workflow.py tests/test_insight_import.py tests/test_insight_workspace.py tests/test_insight_sources.py tests/test_insight_admin_ui_api.py tests/test_insight_catalog.py tests/test_insight_views.py tests/test_insight_postgres.py -q -p no:cacheprovider
→ 99 passed, 1 skipped, 1 warning / 21.97s
```

시나리오: 단계 직전/직후 종료 후 재개, 별도 엔진으로 재열기, 완료 run 재개, 설정 변경, stale version, 유효/만료 임대, 저장 실패·예산 누적, 이미 반입한 묶음 재개, 바뀐 원고 해시, 스냅샷에 원문 없음.

| 결과 | 내용 |
|---|---|
| skip | 심볼릭 링크 권한, PostgreSQL 동시성 URL 없음 |
| warning | Starlette TestClient deprecation. 의존성 미변경 |

프론트 빌드·브라우저·실제 모델·AWS·원격 migration 적용은 실행하지 않았다. UI를 바꾸지 않았다. SQLite UNIQUE/CAS 검사로 PostgreSQL 실제 동시성을 대체하지 않는다.

## 7. 보존한 것 / 하지 않은 것

보존: 전송 v1, 접수 이력, 3단계 가짜 흐름, 트렌드 승인 차단, Candidate enum, `execution_available` 비활성.

하지 않음: LangGraph, Redis, 모델 SDK, HTTP/CLI/AWS 실행 경로, 관리자 UI, 5단계 승인 연결, `.env` 수정, 공용 Supabase에 `20261029_20` 적용.

## 8. 다음 단계의 차단 조건

아래가 남아 있어도 **5단계 관리자 검토 연결 설계는 진행할 수 있다.**

- 실제 네트워크 조회 없음
- 작성 예산 운영값 미정
- 운영 임대 초 미정
- PostgreSQL 실제 동시성 미검증
- 공용 DB에 20번 revision 미적용

5단계로 넘어가기 전에 막히는 조건: 실제 API로 모델을 호출하거나, 에이전트 성공을 게시 승인으로 저장하거나, 트렌드 승인을 우회하거나, 승인 API를 새로 만드는 요청.
