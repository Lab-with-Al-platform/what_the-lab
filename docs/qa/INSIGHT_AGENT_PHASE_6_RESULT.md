# 인사이트 에이전트 선택 6단계 결과

확인일: 2026-10-30. 목표: 같은 가상 작업을 Python 흐름과 LangGraph로 비교해 앱 실행기 교체 필요성을 판단한다.

0~5단계 원문은 덮어쓰지 않았다. 7단계 AWS 인계 문서는 작성하지 않았다. 이 결과는 실제 논문·모델·운영 DB·AWS 실행을 검증한 기록이 아니다.

## 1. Git 기준

작업 시작 시 로컬 `develop`은 `origin/develop`과 같은 `b65540b`(#60 관리자 검토 연결 머지)였다. 브랜치 `feature/insight-agent-langgraph`는 그 지점에서 만들었다. 기존 미커밋 계획 문서·QA 이미지·PDF는 보존했고 이번 커밋에 넣지 않았다.

## 2. 실험 경계

앱 기본 실행 경로와 `backend/pyproject.toml`에는 LangGraph를 넣지 않았다. 설치는 `ai/insight-agent-langgraph/` 가상환경만 사용한다.

| 칸 | 위치 | 하는 일 |
|---|---|---|
| 개인화 추천 실험 | `ai/README.md` 기존 절 | 이번 비교와 다른 칸. 모델 학습·벡터 검색 없음 |
| LangGraph 비교 | `ai/insight-agent-langgraph/` | 가짜 회차 순서만 그래프로 감쌈 |
| 앱 실행기 | `backend/app/insights/agent_flow.py`, `agent_checkpoint.py` | 그대로 유지 |

확인한 버전: LangGraph `1.2.18` (Python `>=3.10`, Pydantic `>=2.7.4`). 실험 가상환경은 Python `3.13.14`, Pydantic `2.14.1`. 공식 문서 기준 이 작업은 **미리 정한 워크플로우**이며, 모델이 다음 단계를 고르는 에이전트가 아니다.

공식 저장 문서: `InMemorySaver`는 RAM이라 프로세스 종료 후 사라진다. `PostgresSaver`는 운영 DB 표가 생기므로 이번 실험에서 쓰지 않았다. 공식 interrupt 문서: 재개 때 노드 앞부분이 다시 돈다. `thread_id`는 회차 이름일 뿐 로그인·관리자 권한이 아니다.

## 3. 비교 결과 (가상 fixture)

3·4단계와 같은 출처 `https://example.org/fictional-study`, 가짜 조회·가짜 완성을 썼다. 실제 추론 비용 측정이 아니다.

| 상황 | Python | 그래프 | 가짜 complete 호출 |
|---|---|---|---|
| 정상 사례+트렌드 | `ready_for_review`, 묶음 2건, 게시 승인 false | 동일 | `case_writer`, `trend_writer` (2회) |
| 조회 공란 | `insufficient_candidates` | 동일 | 0 |
| 출처 접근 불가 | `source_error` / `source_unreachable` | 동일 | 0 |
| 근거 참조 누락 | `needs_revision` | 동일 | 예산 안 재시도 |
| JSON이 아닌 완성 | `model_error` | 동일 | 1회 후 중단 |
| 같은 slug | `duplicate_slug` | 동일 | 2회 후 거절 |
| 요청·시간 상한 | `held` / `budget_exhausted` | 동일 | 강제 통과 없음 |
| 작성 전 중단 | (4단계 `stop_before=drafting`) 모델 0회 | `interrupt_before=["draft"]` 모델 0회 | 0 |

같은 어댑터 RAM 저장으로는 interrupt 이후 재개가 된다. **새 `InMemorySaver`를 만들면 같은 `thread_id`라도 상태가 비어** 운영 재개가 되지 않는다. 프로세스 밖 재개·중복 반입 방지·오래된 원고 거절은 기존 `agent_runs` + 접수 이력이 그대로 맡는다. 그래프가 접수 이력·게시 승인을 대체하지 않는다.

`thread_id="spoofed-admin-thread"`로 돌려도 `publication_approved`는 false다.

## 4. 도입 판단

**결론: 앱 실행기 교체와 `backend` 기본 의존성 편입은 보류한다.**

근거:

1. 정해진 조사→점검→작성→전송 검사 분기는 이미 Python 함수로 같고, 그래프는 그 함수를 호출만 한다.
2. 운영 재개·임대·판본·중복 후보는 `agent_checkpoint.py`가 이미 프로세스 밖에 저장한다. RAM checkpointer는 이 책임을 줄이지 않는다.
3. 사람 검토 대기는 5단계 관리자 화면·기존 승인 API가 맡는다. 그래프 `Command(resume=...)`는 관리자 쿠키가 아니다.
4. 추가 의존성: `langgraph==1.2.18`과 전이가 끌어온 `langchain-core`, `langgraph-checkpoint`, `langsmith` 패키지. LangSmith 업로드는 하지 않았고, 운영에 넣으면 패키지·권한·저장 표가 늘어난다.

실험 폴더는 비교 근거로 남긴다. 결과가 좋아도 실제 수집·AWS·DB 연결을 켜지 않았다.

## 5. 테스트·정적 검사

```text
ai/insight-agent-langgraph에서:
uv sync
→ LangGraph 1.2.18 설치
uv run ruff check graph.py compare.py tests/test_compare.py
→ All checks passed
uv run pytest -q -p no:cacheprovider
→ 16 passed

backend에서:
uv run ruff check tests/test_insight_agent_langgraph_boundary.py
→ All checks passed
uv run pytest tests/test_insight_agent_langgraph_boundary.py tests/test_insight_agent_flow.py tests/test_insight_agent_checkpoint.py tests/test_insight_agent_review.py tests/test_insight_transfer_staging.py -q -p no:cacheprovider
→ 52 passed, 1 warning
```

프론트 UI를 바꾸지 않아 typecheck·eslint·next build·브라우저 캡처는 실행하지 않았다. 기존 uvicorn/`npm run dev`는 종료하지 않았다. `INSIGHTS_ENABLED`와 `ANALYTICS_COLLECTION_ENABLED`는 바꾸지 않았다.

## 6. 보존한 것 / 하지 않은 것

보존: 전송 v1, 접수 이력, 가짜 흐름, 작업 회차 표, 관리자 검토 연결, 트렌드 승인 차단, Candidate enum, `backend` 기본 의존성.

하지 않음: 앱 실행기 교체, LangGraph를 `backend/pyproject.toml`에 추가, OpenAI/Anthropic SDK, LangSmith 업로드, PostgresSaver, 운영 Supabase 연결, AWS Scheduler, `.env` 수정, 7단계 인계 문서, 개인화 추천.

## 7. 미검증

- 실제 모델 호출·실제 출처 HTTP·유료 추론 비용
- LangGraph `PostgresSaver` / `SqliteSaver`를 로컬 파일에 붙인 운영 재개
- 그래프 노드와 `agent_runs`를 한 트랜잭션으로 묶는 이중 저장
- AWS·공용 DB·관리자 실로그인 브라우저
- 1440/768/390px 화면 (UI 변경 없음)

## 8. 다음 단계에 남기는 결정 질문

아래는 이번 단계에서 열지 않았고, 정책 결정이 필요하다.

1. 트렌드 전용 승인 기준을 연결할 것인가? 현재는 차단 유지.
2. 외부 실행기(실제 모델·AWS·정기 수집)에 어떤 최소 권한을 줄 것인가? 현재는 실행 경로 없음.
3. 나중에 AWS를 붙일 때 LangGraph를 다시 검토할 것인가? 현재 비교는 **보류**이며, 클라우드 연결이 그래프 도입을 자동으로 정당화하지는 않는다.

7단계(인계 문서)는 AWS 연결 전에 별도로 진행할 수 있다. 6단계 보류가 7단계를 막지 않는다.
