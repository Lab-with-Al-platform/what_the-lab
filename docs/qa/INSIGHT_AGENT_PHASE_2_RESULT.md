# 인사이트 에이전트 2단계 결과

확인일: 2026-10-29. 목표: 모델을 호출하기 전에 각 역할의 입력·출력·할 수 있는 도구·보류 조건을 코드로 고정한다.

0·1단계 원문 [PHASE_0](INSIGHT_AGENT_PHASE_0_RESULT.md), [PHASE_1](INSIGHT_AGENT_PHASE_1_RESULT.md)은 덮어쓰지 않았다. 3단계 가짜 모델 흐름은 구현하지 않았다.

## 1. Git 기준

작업 시작 시 브랜치는 `develop`, HEAD `fe8e95c`이며 `origin/develop`과 같았다. 1단계 접수 이력(#54)과 협업 상세 테이블(#55)이 이미 들어 있었다. 브랜치 `feature/insight-agent-contract`는 그 지점에서 만들었다.

## 2. 무엇을 고정했는가

범용 에이전트 프레임워크는 만들지 않았다. Pydantic 계약과 가짜 도구만 추가했다.

| 파일 | 역할 |
|---|---|
| `backend/app/insights/agent_contract.py` | 역할 표, 메시지, 근거, 품질, 예산, 해시·회차 검사 |
| `backend/app/insights/agent_tools.py` | 역할별 도구 허용 목록, 금지 도구, 가짜 도구, 향후 HTTPS 계약 |
| `backend/tests/test_insight_agent_contract.py` | 위조 역할·금지 도구·다른 회차·과장 근거·본문 누락·예산 소진 |

계약 버전: `insight_agent_role_v1`. 기존 `insight_transfer_v1` 필드는 바꾸지 않았다.

### 역할 표

| 코드 | 도구 | 할 수 없는 일 |
|---|---|---|
| `coordinator` | `read_run_state`, `hold_run` | 권한·예산 확대, 승인·게시 |
| `researcher` | `read_allowed_source` | DB 키, 페이지 명령 실행 |
| `evidence_checker` | `read_evidence_bundle` | AI 의견을 verified로 확정 |
| `case_writer` | `write_case_draft` | 실험 조건 발명 |
| `trend_writer` | `write_trend_draft` | 기술 소개를 적용 성과로 바꾸기 |
| `editor` | `suggest_revisions` | 사람 승인 대신하기 |

권한 Capability(도구 허용 목록)와 기술 분류 CAP ID(`keyword_ids`)는 다른 칸이다. 메시지에 `agent_id`·`claimed_role`·`capability`·`granted_tools`가 있으면 거절한다.

### 메시지 검사

`accept_role_result` 입력: 실행기가 정한 역할, 현재 `run_id`, 기대 입력 해시, 아는 근거 ID.

거절: 알 수 없는 필드, 위조 역할, 다른 회차, 해시 불일치, 필요한 근거 참조 누락, 자칭 권한. `AgentContractError`는 CLI 종료 코드 2가 아니다.

전달 경로는 `role_result`와 `tool_call`만 허용한다.

### 가짜 도구와 네트워크 계약

이번 단계는 가짜 도구만 쓴다. `read_allowed_source`는 허용 URL인지와 HTTPS 출처 형식만 보고 `fetched=false`를 반환한다. 페이지에 적힌 명령은 데이터가며 실행하지 않는다.

향후 네트워크 도구 계약(`NETWORK_FUTURE_CONTRACT`): HTTPS, 리디렉션 재검사, 내부 주소 차단, 응답 크기 1MB, 시간 10초. `implemented`는 false다.

금지 도구: 승인·게시·셸·SQL·DB 키·임의 파일·페이지 명령.

### 품질·예산

- 에이전트 `ok`여도 `publication_approved_from_agent`는 항상 false다. `verified` 주장은 보완 항목이다.
- 읽은 범위가 metadata/unavailable인데 `fulltext`를 적으면 과장이다.
- 같은 출처의 사례/트렌드는 slug와 본문을 나눠야 한다. v1 본문·용어 풀이 누락은 `needs_revision`이다.
- 탐색 예산은 기존 `DiscoveryPolicy`의 `max_source_requests`·`max_run_seconds`를 읽는다.
- 작성/편집 예산은 별도 `WritingBudget`이다. `PRODUCTION_WRITING_BUDGET is None`. 테스트 숫자는 `TEST_WRITING_BUDGET`에만 있다.
- 초과 시 `held` 또는 `needs_revision`이며 `ok`로 올리지 않는다.

사용 로그는 코드·시간·사용량·근거 ID만 남긴다.

## 3. 테스트·정적 검사

가상 JSON·가짜 도구만 사용했다. 실제 모델·네트워크·원격 DB는 호출하지 않았다.

```text
backend에서:
uv run ruff check app/insights/agent_contract.py app/insights/agent_tools.py tests/test_insight_agent_contract.py
→ All checks passed

uv run pytest tests/test_insight_agent_contract.py tests/test_insight_transfer.py tests/test_insight_transfer_staging.py tests/test_insight_migration.py tests/test_insight_editorial.py tests/test_insight_discovery_policy.py -q -p no:cacheprovider
→ 103 passed, 1 skipped, 1 warning / 5.94s

uv run pytest tests/test_insight_workflow.py tests/test_insight_import.py tests/test_insight_workspace.py tests/test_insight_sources.py tests/test_insight_admin_ui_api.py tests/test_insight_catalog.py tests/test_insight_views.py tests/test_insight_postgres.py tests/test_insight_migration.py -q -p no:cacheprovider
→ 100 passed, 1 skipped, 1 warning / 17.25s
```

| 결과 | 내용 |
|---|---|
| skip | `test_link_file_is_rejected` — Windows 심볼릭 링크 권한 |
| skip | `test_two_postgres_workers_publish_once` — 전용 PostgreSQL URL 없음 |
| warning | Starlette TestClient deprecation. 의존성은 바꾸지 않음 |

프론트 빌드·브라우저·LangGraph 설치·유료 모델 호출은 실행하지 않았다. UI를 바꾸지 않았다.

## 4. 보존한 것 / 하지 않은 것

보존: 전송 v1, 접수 이력, Candidate 상태 enum, 트렌드 승인 차단, `execution_available is False`, DiscoveryPolicy 설정 저장만.

하지 않음: LangGraph/DeepAgents/모델 SDK, HTTP/CLI 반입, 실제 수집, AWS, 작업 저장(4단계), 관리자 검토 연결(5단계), 원격 DB, `.env` 수정.

## 5. 다음 단계의 차단 조건

아래가 남아 있어도 **3단계 가짜 모델 흐름은 진행할 수 있다.**

- 실제 네트워크 도구 미구현
- 작성 예산 운영 기본값 미정
- 기계 인증·실제 모델 없음
- 작업 상태 저장 없음 (4단계)

3단계로 넘어가기 전에 막히는 조건: 실제 API 키로 모델을 호출하거나, 승인/게시 도구를 열거나, 전송 v1을 임의로 확장하거나, 수집 설정을 활성화하는 요청.
