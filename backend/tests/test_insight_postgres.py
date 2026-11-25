"""명시한 전용 테스트 DB에서만 실행하는 PostgreSQL 동시 게시 검사."""

import os
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.schema import CreateSchema, DropSchema

from app.insights import editorial, service
from app.insights.database import SCHEMA, Base, build_engine
from app.insights.models import Publication
from app.insights.schemas import ApprovalInput, Draft
from tests.test_insight_workflow import ADMIN_ID, approval_body, make_draft


@pytest.mark.skipif(
    os.getenv("INSIGHT_RUN_POSTGRES_TESTS") != "true" or not os.getenv("INSIGHT_TEST_DATABASE_URL"),
    reason="전용 PostgreSQL 테스트 DB URL과 명시적인 실행 설정이 필요합니다.",
)
def test_two_postgres_workers_publish_once():
    # 실제 서비스 schema를 사용하지 않고 이번 테스트가 만든 schema만 정리합니다.
    test_schema = "insight_test_" + uuid4().hex
    engine = build_engine(os.environ["INSIGHT_TEST_DATABASE_URL"])
    translated = engine.execution_options(schema_translate_map={SCHEMA: test_schema})
    created = False
    try:
        with engine.begin() as connection:
            connection.execute(CreateSchema(test_schema))
        created = True
        Base.metadata.create_all(translated)
        with Session(translated) as session, session.begin():
            candidate = service.create_candidate(
                session, Draft.model_validate(make_draft()), ADMIN_ID
            )
            article = editorial.notes_to_article(Draft.model_validate(make_draft()))
            article["glossary"] = [{"id": "test", "label": "가상", "definition": "검증 전용"}]
            article["sections"][0]["paragraphs"] += [
                {"kind": kind, "text": "가상 검증 전용"}
                for kind in ("interpretation", "application", "caution")
            ]
            editorial.start_article_draft(
                session, candidate.id, candidate.version, ADMIN_ID, "검증 전용", article
            )
            service.submit_candidate(
                session, candidate.id, candidate.version, ADMIN_ID, "동시성 검토"
            )
            service.approve_candidate(
                session,
                candidate.id,
                ApprovalInput.model_validate(approval_body({"version": candidate.version})),
                ADMIN_ID,
            )
            candidate_id, version = candidate.id, candidate.version
        start = Barrier(2)

        def publish_once() -> str:
            start.wait(timeout=10)
            with Session(translated) as session, session.begin():
                return service.publish_candidate(
                    session,
                    candidate_id,
                    version,
                    "postgres-concurrent-test",
                    ADMIN_ID,
                    "동시에 같은 게시 명령 실행",
                ).id

        with ThreadPoolExecutor(max_workers=2) as workers:
            results = list(workers.map(lambda _: publish_once(), range(2)))
        assert results[0] == results[1]
        with Session(translated) as session:
            assert session.scalar(select(func.count()).select_from(Publication)) == 1
    finally:
        if created:
            Base.metadata.drop_all(translated)
            with engine.begin() as connection:
                connection.execute(DropSchema(test_schema))
        engine.dispose()
