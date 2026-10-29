# 인사이트 에이전트 3단계 결과

확인일: 2026-10-29. 목표: 외부 API 없이 조사→근거 점검→사례/트렌드 작성→편집→전송 파일 검사의 고정 흐름을 끝까지 실행한다.

0~2단계 원문은 덮어쓰지 않았다. 4단계 작업 저장·재개는 구현하지 않았다. 이 결과는 실제 논문이나 모델 성능을 검증한 기록이 아니다.

## 1. Git 기준

작업 시작 시 `origin/develop`은 `e0f5115`(#56 역할 계약 머지)였다. 브랜치 `feature/insight-agent-flow`는 그 지점에서 만들었다.

## 2. 주입 경계

핵심 흐름 `run_virtual_flow`는 모델 이름·공급자 SDK를 모른다. 테스트가 두 함수만 바꿔 끼운다.

| 경계 | 하는 일 | 하지 않는 일 |
|---|---|---|
| `lookup(url, profile, window)` | 가상 히트 목록 또는 접근 불가 | HTTP, 실제 논문 페이지 |
| `complete(role, payload)` | 역할별 가상 JSON | OpenAI/Anthropic SDK |
| `elapsed()` | 흐른 초 | 실제 스케줄러 |

기본 `virtual_complete`는 `no-model-called`이며 출력에 공급자 이름이 없다.

탐색 구간은 기존 `discovery_windows`를 그대로 쓴다. 사례·최신 소식·기술 해설 상한에서 멈추고, 수집 설정 `execution_available`을 켜거나 실제 수집기를 만들지 않았다.

## 3. 입력 → 처리 → 결과

| 단계 | 처리 | 성공 | 실패 코드 |
|---|---|---|---|
| 조사 | 선택 출처 × 기간 구간, 요청/시간 예산 | 근거 1건 이상 | `insufficient_candidates`, `source_error`, `held` |
| 근거 점검 | 가짜 `read_evidence_bundle` | 읽은 범위 unavailable, 날짜 미상 보존 | `source_error` |
| 작성 | 사례/트렌드 분기, 다른 slug·본문 | 메모+전체 원고 | `model_error`, `needs_revision` |
| 편집 | 품질 이슈가 있으면 수정 횟수만큼 재작성 | 이슈 없음 | 상한 후 `needs_revision` |
| 전송 검사 | `insight_transfer_v1` 바이트, `validate_transfer_bytes` | `ready_for_review` | `duplicate_slug` |

게시 승인은 항상 false다. DB 저장·관리자 승인·게시·스케줄·PR 반입은 호출하지 않는다.

후보 수 부족(`insufficient_candidates`)과 출처 오류(`source_error`)·잘못된 JSON(`model_error`)·예산 초과(`held`)는 서로 다른 결과로 남긴다.

### 수정 전후

1. 용어 풀이가 없는 가상 초안 → 편집이 `missing_glossary`를 남김
2. 같은 누락이 수정 상한까지 반복되면 강제 통과하지 않고 `needs_revision`으로 종료
3. 정상 회차는 용어 풀이·해석/적용/주의 문단을 채운 뒤 전송 검사를 통과

날짜 미상은 `precision=unknown`, `value=null`로 남기고 수집일로 채우지 않는다.

출력 파일은 테스트 `tmp_path`에만 쓴다. 운영 수집 저장 위치는 정하지 않았다.

## 4. 테스트·정적 검사

```text
backend에서:
uv run ruff check app/insights/agent_flow.py tests/test_insight_agent_flow.py
→ All checks passed

uv run pytest tests/test_insight_agent_flow.py tests/test_insight_agent_contract.py tests/test_insight_transfer.py tests/test_insight_transfer_staging.py tests/test_insight_migration.py tests/test_insight_editorial.py tests/test_insight_discovery_policy.py -q -p no:cacheprovider
→ 116 passed, 1 skipped, 1 warning / 5.67s

uv run pytest tests/test_insight_workflow.py tests/test_insight_import.py tests/test_insight_workspace.py tests/test_insight_sources.py tests/test_insight_admin_ui_api.py tests/test_insight_catalog.py tests/test_insight_views.py tests/test_insight_postgres.py -q -p no:cacheprovider
→ 99 passed, 1 skipped, 1 warning / 15.24s
```

시나리오: 가상 사례 1 + 트렌드 1 정상, 빈 결과, 접근 불가, 날짜 미상, 근거 누락, 잘못된 JSON, 동일 주소, 수정 상한, 요청 상한, 시간 상한.

| 결과 | 내용 |
|---|---|
| skip | 심볼릭 링크 권한, PostgreSQL 동시성 URL 없음 |
| warning | Starlette TestClient deprecation. 의존성 미변경 |

프론트 빌드·브라우저·실제 모델·AWS는 실행하지 않았다.

## 5. 보존한 것 / 하지 않은 것

보존: 전송 v1, 2단계 역할·도구 계약, DiscoveryPolicy 설정만, 트렌드 승인 차단, 접수 이력 미연결.

하지 않음: LangGraph, 모델 SDK, HTTP 반입, `stage_transfer_candidates` 호출, 수집 설정 활성화, 4단계 작업 저장, `.env` 수정.

## 6. 다음 단계의 차단 조건

아래가 남아 있어도 **4단계 로컬 작업 저장 설계는 진행할 수 있다.**

- 실제 네트워크 조회 없음
- 작성 예산 운영값 미정
- 프로세스 밖 상태 저장 없음

4단계로 넘어가기 전에 막히는 조건: 실제 API로 모델을 호출하거나, 전송 파일을 DB/PR에 넣거나, 승인·게시 도구를 여는 요청.
