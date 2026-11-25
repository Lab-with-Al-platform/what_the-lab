"""Python 흐름과 그래프 결과의 공개 칸만 비교합니다. 실제 비용 측정이 아닙니다."""

from app.insights.agent_flow import FlowResult

# lock에 같이 들어온 패키지. 실험 폴더에서만 설치하고 앱 기본 의존성에는 넣지 않습니다.
EXPERIMENT_PACKAGES = (
    "langgraph==1.2.18",
    "langchain-core",
    "langgraph-checkpoint",
    "langgraph-prebuilt",
    "langgraph-sdk",
    "langsmith",
)


def public_metrics(result: FlowResult) -> dict:
    """원문·비밀값 없이 비교할 숫자와 결과만 남깁니다."""
    return {
        "outcome": result.outcome,
        "hold_reason": result.hold_reason,
        "model_calls": result.usage.model_calls,
        "source_requests": result.usage.source_requests,
        "revision_rounds": result.usage.revision_rounds,
        "item_count": result.item_count,
        "publication_approved": result.publication_approved,
        "has_bundle": result.bundle_bytes is not None,
    }


def extra_ops_burden() -> list[str]:
    """앱을 그래프 실행기로 바꿀 때 생기는 운영 부담입니다."""
    return [
        "LangGraph와 langchain-core, 그리고 전이가 끌어오는 langsmith 패키지",
        "InMemorySaver는 프로세스 종료 후 사라짐. 운영 재개는 기존 agent_runs가 필요함",
        "thread_id는 그래프 회차 이름일 뿐 require_admin을 대신하지 않음",
        "interrupt 재개 때 노드 앞부분이 다시 돌 수 있어 외부 쓰기는 접수 이력이 막아야 함",
        "PostgresSaver를 쓰면 운영 DB 스키마·권한이 생김. 이번 실험에서는 쓰지 않음",
    ]
