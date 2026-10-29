"""작업 저장·재개를 임시 SQLite만으로 검사합니다. 실제 DB·모델 호출은 하지 않습니다."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import event, func, select, update
from sqlalchemy.orm import Session

from app.insights import service
from app.insights.agent_checkpoint import (
    DUPLICATE_EXECUTION_GAP,
    PRODUCTION_LEASE_SECONDS,
    CheckpointConflict,
    CheckpointStoreError,
    config_fingerprints,
    read_run_for_review,
    run_checkpointed_flow,
    save_run,
)
from app.insights.agent_flow import virtual_complete
from app.insights.collection_policy import DiscoveryPolicy
from app.insights.database import Base, build_engine
from app.insights.models import AgentRun, Candidate, TransferReceipt
from app.insights.workspace_schemas import CollectionConfig

SOURCE = "https://example.org/fictional-study"
RUN_ID = "offline-checkpoint-001"
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


def ok_hit() -> dict:
    return {
        "url": SOURCE,
        "title": "가상 연구 설명",
        "doi": None,
        "published": {"value": "2026-10-01", "precision": "day"},
        "excerpt": "가상 초록입니다.",
        "access": "ok",
    }


def lookup_hits(hits: list[dict]):
    def lookup(url: str, profile: str, _window: tuple[int, int]) -> list[dict]:
        if url != SOURCE or profile == "news":
            return []
        return hits

    return lookup


@pytest.fixture
def db_path(tmp_path):
    return tmp_path / "agent-run.db"


@pytest.fixture
def engine(db_path, monkeypatch):
    monkeypatch.setattr(service, "approved_capabilities", lambda: [{"id": "CAP-TEST"}])
    engine = build_engine(f"sqlite:///{db_path}", allow_sqlite=True)

    @event.listens_for(engine, "connect")
    def explicit_transactions(dbapi_connection, _record) -> None:
        dbapi_connection.isolation_level = None

    @event.listens_for(engine, "begin")
    def begin_transaction(conn) -> None:
        conn.exec_driver_sql("BEGIN")

    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


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


def run_row(engine) -> AgentRun:
    with Session(engine) as session:
        return session.scalar(select(AgentRun).where(AgentRun.run_id == RUN_ID))


def count_rows(engine, model) -> int:
    with Session(engine) as session:
        return session.scalar(select(func.count()).select_from(model))


def test_stop_after_each_step_then_resume(engine):
    lookup = lookup_hits([ok_hit()])
    queued = run_checkpointed_flow(
        sample_config(), engine, lookup=lookup, run_id=RUN_ID, now=NOW, stop_after="queued"
    )
    assert queued.outcome == "paused"
    assert run_row(engine).step == "queued"

    researching = run_checkpointed_flow(
        sample_config(), engine, lookup=lookup, run_id=RUN_ID, now=NOW, stop_after="researching"
    )
    assert researching.outcome == "paused"
    assert run_row(engine).step == "drafting"
    assert run_row(engine).evidence_ids == ["virtual-ev-1"]

    drafting = run_checkpointed_flow(
        sample_config(), engine, lookup=lookup, run_id=RUN_ID, now=NOW, stop_after="drafting"
    )
    assert drafting.outcome == "paused"
    assert run_row(engine).step == "reviewing"

    done = run_checkpointed_flow(sample_config(), engine, lookup=lookup, run_id=RUN_ID, now=NOW)
    assert done.outcome == "ready_for_review"
    assert done.publication_approved is False
    assert run_row(engine).status == "ready_for_human"
    assert run_row(engine).manuscript_hash


def test_stop_before_drafting_does_not_call_model(engine):
    calls: list[str] = []

    def complete(role: str, payload: dict) -> dict:
        calls.append(role)
        return virtual_complete(role, payload)

    lookup = lookup_hits([ok_hit()])
    run_checkpointed_flow(
        sample_config(), engine, lookup=lookup, run_id=RUN_ID, now=NOW, stop_after="researching"
    )
    paused = run_checkpointed_flow(
        sample_config(),
        engine,
        lookup=lookup,
        complete=complete,
        run_id=RUN_ID,
        now=NOW,
        stop_before="drafting",
    )
    assert paused.outcome == "paused"
    assert calls == []
    assert run_row(engine).status == "researching"


def test_reopen_store_instance_resumes(engine, db_path, monkeypatch):
    lookup = lookup_hits([ok_hit()])
    run_checkpointed_flow(
        sample_config(), engine, lookup=lookup, run_id=RUN_ID, now=NOW, stop_after="researching"
    )
    engine.dispose()
    other = reopen_engine(db_path, monkeypatch)
    result = run_checkpointed_flow(sample_config(), other, lookup=lookup, run_id=RUN_ID, now=NOW)
    assert result.outcome == "ready_for_review"
    snapshot = None
    with Session(other) as session:
        snapshot = read_run_for_review(session, RUN_ID)
    other.dispose()
    assert snapshot is not None
    assert snapshot.publication_approved is False
    assert "excerpt" not in snapshot.budget_usage
    assert snapshot.manuscript_hash


def test_same_run_second_resume_does_not_rewrite(engine):
    lookup = lookup_hits([ok_hit()])
    first = run_checkpointed_flow(sample_config(), engine, lookup=lookup, run_id=RUN_ID, now=NOW)
    version = run_row(engine).state_version
    second = run_checkpointed_flow(sample_config(), engine, lookup=lookup, run_id=RUN_ID, now=NOW)
    assert first.outcome == second.outcome == "ready_for_review"
    assert run_row(engine).state_version >= version
    assert count_rows(engine, AgentRun) == 1


def test_settings_change_does_not_overwrite(engine):
    lookup = lookup_hits([ok_hit()])
    run_checkpointed_flow(
        sample_config(), engine, lookup=lookup, run_id=RUN_ID, now=NOW, stop_after="researching"
    )
    original = run_row(engine)
    original_hash = original.settings_hash
    changed = sample_config(max_source_requests=3)
    with pytest.raises(CheckpointConflict, match="settings_changed"):
        run_checkpointed_flow(changed, engine, lookup=lookup, run_id=RUN_ID, now=NOW)
    assert run_row(engine).settings_hash == original_hash
    assert run_row(engine).step == "drafting"


def test_stale_version_conflicts(engine):
    lookup = lookup_hits([ok_hit()])
    run_checkpointed_flow(
        sample_config(), engine, lookup=lookup, run_id=RUN_ID, now=NOW, stop_after="queued"
    )
    with Session(engine) as session, session.begin():
        row = session.scalar(select(AgentRun).where(AgentRun.run_id == RUN_ID))
        save_run(session, RUN_ID, row.state_version, attempt_count=row.attempt_count)
        with pytest.raises(CheckpointConflict, match="stale_version"):
            save_run(session, RUN_ID, 1, attempt_count=99)
    assert run_row(engine).attempt_count != 99


def test_other_worker_active_lease_conflicts(engine):
    lookup = lookup_hits([ok_hit()])
    run_checkpointed_flow(
        sample_config(),
        engine,
        lookup=lookup,
        run_id=RUN_ID,
        now=NOW,
        worker_id="virtual-worker-a",
        stop_after="researching",
    )
    with pytest.raises(CheckpointConflict, match="lease_held"):
        run_checkpointed_flow(
            sample_config(),
            engine,
            lookup=lookup,
            run_id=RUN_ID,
            now=NOW,
            worker_id="virtual-worker-b",
            lease_seconds=30,
        )


def test_expired_lease_can_be_taken_by_another_worker(engine):
    lookup = lookup_hits([ok_hit()])
    run_checkpointed_flow(
        sample_config(),
        engine,
        lookup=lookup,
        run_id=RUN_ID,
        now=NOW,
        worker_id="virtual-worker-a",
        stop_after="researching",
    )
    with Session(engine) as session, session.begin():
        session.execute(
            update(AgentRun)
            .where(AgentRun.run_id == RUN_ID)
            .values(lease_expires_at=NOW - timedelta(seconds=1))
        )
    result = run_checkpointed_flow(
        sample_config(),
        engine,
        lookup=lookup,
        run_id=RUN_ID,
        now=NOW,
        worker_id="virtual-worker-b",
    )
    assert result.outcome == "ready_for_review"
    assert PRODUCTION_LEASE_SECONDS is None


def test_save_failure_keeps_last_checkpoint_and_budget_accumulates(engine):
    lookup = lookup_hits([ok_hit()])
    run_checkpointed_flow(
        sample_config(), engine, lookup=lookup, run_id=RUN_ID, now=NOW, stop_after="researching"
    )
    before = run_row(engine)
    assert before.budget_usage["model_calls"] == 0
    calls = {"n": 0}

    def complete(role: str, payload: dict) -> dict:
        calls["n"] += 1
        return virtual_complete(role, payload)

    def boom() -> None:
        raise CheckpointStoreError(DUPLICATE_EXECUTION_GAP)

    with pytest.raises(CheckpointStoreError, match=DUPLICATE_EXECUTION_GAP):
        run_checkpointed_flow(
            sample_config(),
            engine,
            lookup=lookup,
            complete=complete,
            run_id=RUN_ID,
            now=NOW,
            after_model=boom,
        )
    after_fail = run_row(engine)
    assert after_fail.step == "drafting"
    assert after_fail.budget_usage["model_calls"] == 0
    assert calls["n"] == 2
    resumed = run_checkpointed_flow(
        sample_config(), engine, lookup=lookup, complete=complete, run_id=RUN_ID, now=NOW
    )
    assert resumed.outcome == "ready_for_review"
    assert resumed.usage.model_calls >= 2
    assert calls["n"] == 4


def test_already_imported_bundle_resume_replays_receipt(engine):
    lookup = lookup_hits([ok_hit()])
    first = run_checkpointed_flow(
        sample_config(), engine, lookup=lookup, run_id=RUN_ID, now=NOW, actor=ACTOR
    )
    assert first.outcome == "ready_for_review"
    assert count_rows(engine, Candidate) == 2
    assert count_rows(engine, TransferReceipt) == 1
    second = run_checkpointed_flow(
        sample_config(), engine, lookup=lookup, run_id=RUN_ID, now=NOW, actor=ACTOR
    )
    assert second.outcome == "ready_for_review"
    assert count_rows(engine, Candidate) == 2
    assert count_rows(engine, TransferReceipt) == 1


def test_changed_manuscript_hash_is_not_reused(engine):
    lookup = lookup_hits([ok_hit()])
    run_checkpointed_flow(sample_config(), engine, lookup=lookup, run_id=RUN_ID, now=NOW)
    stored = run_row(engine).manuscript_hash
    other = "a" * 64
    assert stored != other
    with pytest.raises(CheckpointConflict, match="manuscript_changed"):
        run_checkpointed_flow(
            sample_config(),
            engine,
            lookup=lookup,
            run_id=RUN_ID,
            now=NOW,
            current_manuscript_hash=other,
        )
    assert run_row(engine).manuscript_hash == stored
    assert run_row(engine).status == "ready_for_human"


def test_review_snapshot_omits_source_text(engine):
    lookup = lookup_hits([ok_hit()])
    run_checkpointed_flow(
        sample_config(), engine, lookup=lookup, run_id=RUN_ID, now=NOW, stop_after="researching"
    )
    with Session(engine) as session:
        snapshot = read_run_for_review(session, RUN_ID)
    dumped = str(snapshot)
    assert "가상 초록입니다." not in dumped
    assert snapshot.evidence_ids == ["virtual-ev-1"]
    _, settings_hash, input_hash = config_fingerprints(sample_config())
    assert snapshot.settings_hash == settings_hash
    assert snapshot.input_hash == input_hash
