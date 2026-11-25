"""명시한 전용 native PostgreSQL DB에서만 실행하는 두 서버 동시성 검사."""

import os
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.schema import CreateSchema, DropSchema

from app.community import service
from app.community.models import Base, Post, WriteLimit
from app.community.schemas import CreatePost, EditPost
from app.insights.database import build_engine

pytestmark = pytest.mark.skipif(
    os.getenv("COMMUNITY_RUN_POSTGRES_TESTS") != "true"
    or not os.getenv("COMMUNITY_TEST_DATABASE_URL"),
    reason="전용 native PostgreSQL URL과 COMMUNITY_RUN_POSTGRES_TESTS=true가 필요합니다.",
)
MEMBER = {
    "user_id": 1099511627776,
    "nickname": "가상 동시성 회원",
    "user_role": "researcher",
    "is_admin": False,
}


@pytest.fixture
def postgres():
    schema = "community_test_" + uuid4().hex
    engine = build_engine(os.environ["COMMUNITY_TEST_DATABASE_URL"])
    translated = engine.execution_options(schema_translate_map={"community_private": schema})
    with engine.begin() as connection:
        connection.execute(CreateSchema(schema))
    try:
        Base.metadata.create_all(translated)
        yield translated
    finally:
        Base.metadata.drop_all(translated)
        with engine.begin() as connection:
            connection.execute(DropSchema(schema))
        engine.dispose()


def value():
    return CreatePost(
        title="가상 동시 작성",
        body="실제 개인정보 없는 전용 DB 동시성 검증용 글입니다.",
        category="question",
        visibility="public",
        client_token=uuid4(),
    )


def test_two_servers_retry_post_once(postgres):
    barrier = Barrier(2)
    body = value()

    def create_once(_):
        barrier.wait(timeout=10)
        with Session(postgres) as session, session.begin():
            return service.create_post(session, body, MEMBER).id

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(create_once, range(2)))
    assert results[0] == results[1]
    with Session(postgres) as session:
        assert session.scalar(select(func.count()).select_from(Post)) == 1
        assert session.get(WriteLimit, MEMBER["user_id"]).count == 1


def test_two_servers_edit_same_version_cannot_overwrite(postgres):
    with Session(postgres) as session, session.begin():
        post_id = service.create_post(session, value(), MEMBER).id
    barrier = Barrier(2)
    body = EditPost(**value().model_dump(exclude={"client_token"}), expected_version=1)

    def edit_once(_):
        barrier.wait(timeout=10)
        try:
            with Session(postgres) as session, session.begin():
                post = service.require_post(session, post_id, MEMBER, lock=True)
                service.edit_post(session, post, body, MEMBER)
            return 200
        except HTTPException as error:
            return error.status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(edit_once, range(2)))
    assert sorted(results) == [200, 409]
