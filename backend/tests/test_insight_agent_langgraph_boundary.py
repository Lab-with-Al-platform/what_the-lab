"""앱 기본 실행 경로에 LangGraph가 들어오지 않았는지 검사합니다."""

from pathlib import Path


def test_backend_pyproject_and_lock_omit_langgraph():
    root = Path(__file__).resolve().parents[1]
    pyproject = (root / "pyproject.toml").read_text(encoding="utf-8").lower()
    lock = (root / "uv.lock").read_text(encoding="utf-8").lower()
    assert "langgraph" not in pyproject
    assert "langchain" not in pyproject
    assert "langgraph" not in lock
    assert "langchain" not in lock


def test_insight_modules_do_not_import_langgraph():
    import sys

    from app.insights import agent_checkpoint, agent_flow, agent_review

    leftover = [
        name
        for name in sys.modules
        if name == "langgraph" or name.startswith(("langgraph.", "langchain"))
    ]
    assert leftover == []
    assert agent_flow.FlowResult is not None
    assert agent_checkpoint.TERMINAL
    assert agent_review.REWRITE_ERROR == "human_rewrite_requested"
