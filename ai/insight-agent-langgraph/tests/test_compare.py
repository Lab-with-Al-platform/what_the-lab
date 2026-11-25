"""3·4단계와 같은 가상 fixture로 Python 흐름과 그래프를 비교합니다."""

import json
from datetime import UTC, datetime

from app.insights import service
from app.insights.agent_checkpoint import (
    CheckpointConflict,
    run_checkpointed_flow,
)
from app.insights.agent_contract import WritingBudget
from app.insights.agent_flow import SourceAccessError, run_virtual_flow, virtual_complete
from app.insights.collection_policy import DiscoveryPolicy
from app.insights.database import Base, build_engine
from app.insights.models import AgentRun, Candidate, TransferReceipt
from app.insights.workspace_schemas import CollectionConfig
from sqlalchemy import event, func, select
from sqlalchemy.orm import Session

from compare import extra_ops_burden, public_metrics
from graph import InsightGraphAdapter, run_graph_flow

SOURCE = "https://example.org/fictional-study"
RUN_ID = "offline-flow-001"
NOW = datetime(2026, 10, 29, 8, 0, tzinfo=UTC)
ACTOR = "fictional-local-reviewer"


def sample_config(**policy_fields: object) -> CollectionConfig:
    policy = DiscoveryPolicy.model_validate(
        {"enabled": False, "target_candidates": 2, "max_source_requests": 8, **policy_fields}
    )
    return CollectionConfig.model_validate(
        {
            "sources": [
                {
                    "name": "가상 출처",
                    "url": SOURCE,
                    "selected": True,
                    "content_kinds": ["case", "trend"],
                }
            ],
            "discovery_policy": policy.model_dump(mode="json"),
        }
    )


def ok_hit(**overrides: object) -> dict:
    hit = {
        "url": SOURCE,
        "title": "가상 연구 설명",
        "doi": None,
        "published": {"value": "2026-10-01", "precision": "day"},
        "excerpt": "가상 초록입니다.",
        "access": "ok",
    }
    hit.update(overrides)
    return hit


def lookup_hits(hits: list[dict]):
    def lookup(url: str, profile: str, _window: tuple[int, int]) -> list[dict]:
        if url != SOURCE or profile == "news":
            return []
        return hits

    return lookup


def counting_complete():
    calls: list[str] = []

    def complete(role: str, payload: dict) -> dict:
        calls.append(role)
        return virtual_complete(role, payload)

    return complete, calls


def make_engine(tmp_path, monkeypatch):
    monkeypatch.setattr(service, "approved_capabilities", lambda: [{"id": "CAP-TEST"}])
    engine = build_engine(f"sqlite:///{tmp_path / 'agent-run.db'}", allow_sqlite=True)

    @event.listens_for(engine, "connect")
    def explicit_transactions(dbapi_connection, _record) -> None:
        dbapi_connection.isolation_level = None

    @event.listens_for(engine, "begin")
    def begin_transaction(conn) -> None:
        conn.exec_driver_sql("BEGIN")

    Base.metadata.create_all(engine)
    return engine


def reopen_engine(db_path, monkeypatch):
    monkeypatch.setattr(service, "approved_capabilities", lambda: [{"id": "CAP-TEST"}])
    engine = build_engine(f"sqlite:///{db_path}", allow_sqlite=True)

    @event.listens_for(engine, "connect")
    def explicit_transactions(dbapi_connection, _record) -> None:
        dbapi_connection.isolation_level = None

    @event.listens_for(engine, "begin")
    def begin_transaction(conn) -> None:
        conn.exec_driver_sql("BEGIN")

    return engine


def test_ready_metrics_match_python_flow():
    lookup = lookup_hits([ok_hit()])
    python_complete, python_calls = counting_complete()
    graph_complete, graph_calls = counting_complete()
    python = run_virtual_flow(
        sample_config(), lookup=lookup, complete=python_complete, run_id=RUN_ID, now=NOW
    )
    graph = run_graph_flow(
        sample_config(), lookup=lookup, complete=graph_complete, run_id=RUN_ID, now=NOW
    )
    assert public_metrics(python) == public_metrics(graph)
    assert python_calls == graph_calls == ["case_writer", "trend_writer"]
    assert python.publication_approved is False
    dumped = json.dumps(graph.logs, ensure_ascii=False)
    assert "가상 초록입니다." not in dumped
    assert "excerpt" not in dumped


def test_empty_lookup_matches():
    python = run_virtual_flow(sample_config(), lookup=lookup_hits([]), run_id=RUN_ID)
    graph = run_graph_flow(sample_config(), lookup=lookup_hits([]), run_id=RUN_ID)
    assert public_metrics(python) == public_metrics(graph)
    assert graph.outcome == "insufficient_candidates"


def test_unreachable_source_matches():
    def lookup(_url: str, _profile: str, _window: tuple[int, int]) -> list[dict]:
        raise SourceAccessError("가상 접근 불가")

    python = run_virtual_flow(sample_config(), lookup=lookup, run_id=RUN_ID)
    graph = run_graph_flow(sample_config(), lookup=lookup, run_id=RUN_ID)
    assert public_metrics(python) == public_metrics(graph)
    assert graph.hold_reason == "source_unreachable"


def test_needs_revision_matches():
    writing = WritingBudget(
        max_model_calls=6, max_tokens=8000, max_revision_rounds=1, max_wall_seconds=30
    )
    python = run_virtual_flow(
        sample_config(),
        lookup=lookup_hits([ok_hit()]),
        extra_payload={"drop_evidence": True},
        writing=writing,
        run_id=RUN_ID,
    )
    graph = run_graph_flow(
        sample_config(),
        lookup=lookup_hits([ok_hit()]),
        extra_payload={"drop_evidence": True},
        writing=writing,
        run_id=RUN_ID,
    )
    assert public_metrics(python) == public_metrics(graph)
    assert graph.outcome == "needs_revision"


def test_invalid_model_json_matches():
    def complete(_role: str, _payload: dict) -> object:
        return "this-is-not-json"

    python = run_virtual_flow(
        sample_config(), lookup=lookup_hits([ok_hit()]), complete=complete, run_id=RUN_ID
    )
    graph = run_graph_flow(
        sample_config(), lookup=lookup_hits([ok_hit()]), complete=complete, run_id=RUN_ID
    )
    assert public_metrics(python) == public_metrics(graph)
    assert graph.outcome == "model_error"


def test_duplicate_slug_matches():
    python = run_virtual_flow(
        sample_config(),
        lookup=lookup_hits([ok_hit()]),
        extra_payload={"same_slug": True},
        run_id=RUN_ID,
    )
    graph = run_graph_flow(
        sample_config(),
        lookup=lookup_hits([ok_hit()]),
        extra_payload={"same_slug": True},
        run_id=RUN_ID,
    )
    assert public_metrics(python) == public_metrics(graph)
    assert graph.outcome == "duplicate_slug"


def test_request_cap_held_matches():
    second = {
        "name": "가상 출처 2",
        "url": "https://example.org/fictional-other",
        "selected": True,
        "content_kinds": ["case"],
    }
    data = sample_config(max_source_requests=1).model_dump(mode="json")
    data["sources"].append(second)
    config = CollectionConfig.model_validate(data)
    python = run_virtual_flow(config, lookup=lookup_hits([]), run_id=RUN_ID)
    graph = run_graph_flow(config, lookup=lookup_hits([]), run_id=RUN_ID)
    assert public_metrics(python) == public_metrics(graph)
    assert graph.outcome == "held"


def test_time_cap_held_matches():
    python = run_virtual_flow(
        sample_config(), lookup=lookup_hits([ok_hit()]), elapsed=lambda: 200, run_id=RUN_ID
    )
    graph = run_graph_flow(
        sample_config(), lookup=lookup_hits([ok_hit()]), elapsed=lambda: 200, run_id=RUN_ID
    )
    assert public_metrics(python) == public_metrics(graph)
    assert graph.hold_reason == "budget_exhausted"


def test_stop_before_drafting_does_not_call_model():
    complete, calls = counting_complete()
    graph = run_graph_flow(
        sample_config(),
        lookup=lookup_hits([ok_hit()]),
        complete=complete,
        run_id=RUN_ID,
        now=NOW,
        stop_before="drafting",
    )
    assert graph.outcome == "paused"
    assert calls == []
    assert graph.publication_approved is False
    assert graph.bundle_bytes is None


def test_same_adapter_can_resume_interrupt():
    complete, calls = counting_complete()
    adapter = InsightGraphAdapter(interrupt_before=("draft",))
    paused = run_graph_flow(
        sample_config(),
        lookup=lookup_hits([ok_hit()]),
        complete=complete,
        run_id=RUN_ID,
        now=NOW,
        adapter=adapter,
        stop_before="drafting",
    )
    assert paused.outcome == "paused"
    assert calls == []
    resumed = adapter.invoke_thread(RUN_ID, None)
    assert resumed.outcome == "ready_for_review"
    assert calls == ["case_writer", "trend_writer"]
    assert resumed.publication_approved is False


def test_ram_checkpointer_is_empty_in_new_adapter():
    first = InsightGraphAdapter(interrupt_before=("draft",))
    paused = run_graph_flow(
        sample_config(),
        lookup=lookup_hits([ok_hit()]),
        run_id=RUN_ID,
        now=NOW,
        adapter=first,
        stop_before="drafting",
    )
    assert paused.outcome == "paused"
    dumped = str(first.app.get_state({"configurable": {"thread_id": RUN_ID}}))
    assert "가상 초록입니다." not in dumped
    second = InsightGraphAdapter()
    snapshot = second.app.get_state({"configurable": {"thread_id": RUN_ID}})
    assert snapshot.values in ({}, None) or snapshot.values == {}
    assert snapshot.next == ()


def test_thread_id_is_not_admin_approval():
    result = run_graph_flow(
        sample_config(),
        lookup=lookup_hits([ok_hit()]),
        run_id="spoofed-admin-thread",
        now=NOW,
    )
    assert result.run_id == "spoofed-admin-thread"
    assert result.publication_approved is False


def test_agent_run_survives_reopen(tmp_path, monkeypatch):
    db_path = tmp_path / "agent-run.db"
    engine = make_engine(tmp_path, monkeypatch)
    lookup = lookup_hits([ok_hit()])
    run_checkpointed_flow(
        sample_config(), engine, lookup=lookup, run_id=RUN_ID, now=NOW, stop_after="researching"
    )
    engine.dispose()
    other = reopen_engine(db_path, monkeypatch)
    result = run_checkpointed_flow(sample_config(), other, lookup=lookup, run_id=RUN_ID, now=NOW)
    assert result.outcome == "ready_for_review"
    assert result.publication_approved is False
    other.dispose()


def test_duplicate_resume_replays_receipt(tmp_path, monkeypatch):
    engine = make_engine(tmp_path, monkeypatch)
    lookup = lookup_hits([ok_hit()])
    first = run_checkpointed_flow(
        sample_config(), engine, lookup=lookup, run_id=RUN_ID, now=NOW, actor=ACTOR
    )
    second = run_checkpointed_flow(
        sample_config(), engine, lookup=lookup, run_id=RUN_ID, now=NOW, actor=ACTOR
    )
    assert first.outcome == second.outcome == "ready_for_review"
    with Session(engine) as session:
        candidates = session.scalar(select(func.count()).select_from(Candidate))
        receipts = session.scalar(select(func.count()).select_from(TransferReceipt))
        runs = session.scalar(select(func.count()).select_from(AgentRun))
    assert candidates == 2
    assert receipts == 1
    assert runs == 1
    engine.dispose()


def test_stale_manuscript_is_not_reused(tmp_path, monkeypatch):
    engine = make_engine(tmp_path, monkeypatch)
    lookup = lookup_hits([ok_hit()])
    run_checkpointed_flow(sample_config(), engine, lookup=lookup, run_id=RUN_ID, now=NOW)
    with Session(engine) as session:
        stored = session.scalar(select(AgentRun).where(AgentRun.run_id == RUN_ID)).manuscript_hash
    other = "a" * 64
    assert stored != other
    try:
        run_checkpointed_flow(
            sample_config(),
            engine,
            lookup=lookup,
            run_id=RUN_ID,
            now=NOW,
            current_manuscript_hash=other,
        )
        raise AssertionError("stale manuscript should conflict")
    except CheckpointConflict as error:
        assert "manuscript_changed" in str(error)
    engine.dispose()


def test_ops_burden_names_extra_packages():
    notes = extra_ops_burden()
    assert any("InMemorySaver" in item for item in notes)
    assert any("thread_id" in item for item in notes)
    assert any("langsmith" in item for item in notes)
