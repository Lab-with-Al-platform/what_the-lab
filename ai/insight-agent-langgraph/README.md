# 인사이트 에이전트 LangGraph 비교 실험

이 폴더는 **선택 6단계 로컬 실험**입니다. 앱의 실행기를 교체하지 않습니다. AWS·실제 모델·운영 DB와 연결하지 않습니다.

## 경계

- 넣는 곳: `ai/insight-agent-langgraph/` 만. `backend/pyproject.toml` 기본 의존성에는 LangGraph를 넣지 않습니다.
- 호출하는 것: 기존 `RoleResult`·가짜 도구·예산·접수 이력·작업 회차 저장 함수.
- 호출하지 않는 것: OpenAI/Anthropic SDK, LangSmith, 운영 Supabase, 관리자 쿠키, AWS Scheduler.
- `thread_id`는 그래프 회차 이름일 뿐, 로그인·관리자 권한을 대신하지 않습니다.

개인화 추천 실험과 이 비교는 다른 칸입니다. 추천 모델·벡터 검색은 여기에도 없습니다.

## 설치·재현

확인한 버전: LangGraph `1.2.18` (Python `>=3.10`, Pydantic `>=2.7.4`). 이 저장소 백엔드는 Python `>=3.13`, Pydantic `>=2.10,<3`입니다.

```text
cd ai/insight-agent-langgraph
uv sync
uv run pytest -q
```

설치가 안 되면 버전을 추측해 `backend`에 넣지 말고, 위 명령을 다시 적고 막힌 이유를 결과 문서에 남깁니다.

## RAM 저장 vs 프로세스 밖 저장

공식 문서: `InMemorySaver`는 프로세스가 끝나면 사라집니다. 운영 재개는 기존 `agent_runs` 표가 맡습니다. 그래프를 저장해도 접수 이력·게시 승인은 따로입니다.

## 현재 판단

비교 결과는 **앱 실행기 교체 보류**입니다. 근거와 미검증은 `docs/qa/INSIGHT_AGENT_PHASE_6_RESULT.md`에 있습니다. AWS를 나중에 연결해도 이 폴더가 상시 클라우드 실행기가 되지는 않습니다.
