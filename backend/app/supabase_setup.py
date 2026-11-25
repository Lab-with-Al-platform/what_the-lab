"""공통 Supabase를 점검하고 명시적으로 지정한 개발 프로젝트에만 추가 적용합니다."""

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from alembic import command
from alembic.config import Config
from sqlalchemy import Connection, text
from sqlalchemy.engine import URL
from sqlalchemy.exc import SQLAlchemyError

from app.database_config import get_database_url
from app.insights.database import build_engine

ROOT = Path(__file__).resolve().parents[2]
REVISION = "20261021_03"
INSIGHT_TABLES = ("sources", "candidates", "revisions", "review_events", "publications")


def validate_project(url: URL, confirmed_ref: str) -> None:
    """이름이 비슷한 다른 DB를 수정하지 않도록 호스트와 프로젝트 번호를 확인합니다."""
    direct = url.host == f"db.{confirmed_ref}.supabase.co"
    pooled = (
        (url.host or "").endswith(".pooler.supabase.com")
        and (url.username or "").endswith(f".{confirmed_ref}")
    )
    if not confirmed_ref or not (direct or pooled):
        raise ValueError("확인한 Supabase 프로젝트 번호와 연결 대상이 다릅니다.")


def read_insights(connection: Connection) -> dict:
    """기존 자료를 보존했는지 비교할 스냅샷입니다. 내용은 터미널에 출력하지 않습니다."""
    return {
        name: connection.execute(
            text(f"SELECT row_to_json(t) FROM insight_private.{name} AS t ORDER BY id")
        ).scalars().all()
        for name in INSIGHT_TABLES
    }


def inspect_database(connection: Connection) -> dict:
    """회원 내용이나 자격증명 대신 구조와 집계만 반환합니다."""
    public_tables = connection.execute(text(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
    )).scalars().all()
    versions = connection.execute(text(
        "SELECT version_num FROM public.insight_alembic_version"
    )).scalars().all()
    return {"public_tables": public_tables, "versions": versions}


def verify_members(connection: Connection) -> dict:
    """기준표·RLS·직접 API 접근 차단을 모두 확인한 뒤에만 적용을 확정합니다."""
    counts = {
        name: connection.execute(text(f"SELECT count(*) FROM public.{name}")).scalar_one()
        for name in ("institution", "able_work", "field_category", "research_field")
    }
    if counts != {"institution": 271, "able_work": 11, "field_category": 10, "research_field": 83}:
        raise ValueError("기준표 건수가 예상과 다릅니다. 변경을 확정하지 않습니다.")
    # 이번 적용 대상은 최초 회원 구조이며 public에는 기존 이력 테이블만 허용합니다.
    protections = connection.execute(text("""
        SELECT count(*) AS tables,
               count(*) FILTER (WHERE c.relrowsecurity) AS rls_tables
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r'
    """)).mappings().one()
    accessible = connection.execute(text("""
        SELECT count(*) FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace
        CROSS JOIN pg_roles r
        WHERE n.nspname='public' AND c.relkind='r'
          AND r.rolname IN ('anon','authenticated','service_role')
          AND has_table_privilege(r.rolname, c.oid, 'SELECT,INSERT,UPDATE,DELETE')
    """)).scalar_one()
    if protections["tables"] != 24 or protections["rls_tables"] != 24 or accessible:
        raise ValueError("회원 테이블 접근 보호가 예상과 다릅니다. 변경을 확정하지 않습니다.")
    return {"seed_counts": counts, "protected_public_tables": 24, "api_role_access": accessible}


def verify_updated_at(connection: Connection) -> dict:
    """호출자가 검색 순서를 바꾸어도 트리거의 검색 경로는 고정되어야 합니다."""
    settings = connection.execute(text("""
        SELECT proconfig FROM pg_proc
        WHERE oid = to_regprocedure('public.set_updated_at()')
    """)).scalar_one_or_none()
    if not settings or "search_path=pg_catalog" not in settings:
        raise ValueError("수정 시각 함수의 검색 경로 보호가 없습니다. 변경을 확정하지 않습니다.")
    return {"updated_at_search_path": "pg_catalog"}


def apply_members(connection: Connection, *, rehearse: bool) -> dict:
    """같은 트랜잭션에서 확인 → 기록 → 추가 적용 → 검증합니다."""
    connection.execute(text("SELECT pg_advisory_xact_lock(20261021, 2)"))
    before = inspect_database(connection)
    if before["versions"] == [REVISION]:
        return {
            "already_applied": True,
            **verify_members(connection), **verify_updated_at(connection),
        }
    if before["versions"] == ["20261021_02"]:
        # 이미 회원 표를 적용한 팀 DB는 초기화하지 않고 후속 보안 설정만 적용합니다.
        verify_members(connection)
    elif before != {"public_tables": ["insight_alembic_version"], "versions": ["20261016_01"]}:
        raise ValueError("기존 회원 구조 또는 이력이 다릅니다. 자동 적용을 중단합니다.")
    snapshot = read_insights(connection)
    checkpoint_dir = ROOT / "tmp" / "db-checkpoints"
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    checkpoint = checkpoint_dir / f"supabase-members-{stamp}-{uuid4().hex[:8]}.json"
    with checkpoint.open("x", encoding="utf-8") as output:
        json.dump({"before": before, "insight_data": snapshot}, output, ensure_ascii=False, indent=2)
    config = Config(str(ROOT / "backend" / "alembic.ini"))
    config.attributes["connection"] = connection
    command.upgrade(config, REVISION)
    result = {**verify_members(connection), **verify_updated_at(connection)}
    if read_insights(connection) != snapshot:
        raise ValueError("인사이트 자료 보존 검사가 실패했습니다. 변경을 확정하지 않습니다.")
    return {
        "rehearsal": rehearse, "checkpoint": str(checkpoint),
        "insight_counts": {key: len(value) for key, value in snapshot.items()}, **result,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="회원 구조와 기준표를 추가합니다.")
    mode.add_argument("--rehearse", action="store_true", help="적용·검증 후 전체를 rollback합니다.")
    parser.add_argument("--confirm-project-ref", default="", help="Dashboard에서 확인한 프로젝트 번호")
    args = parser.parse_args()
    engine = None
    try:
        url = get_database_url()
        if args.apply or args.rehearse:
            validate_project(url, args.confirm_project_ref)
        engine = build_engine(url)
        with engine.connect() as connection, connection.begin() as transaction:
            connection.execute(text("SET LOCAL statement_timeout = '120s'"))
            connection.execute(text("SET LOCAL lock_timeout = '5s'"))
            if args.apply or args.rehearse:
                result = apply_members(connection, rehearse=args.rehearse)
            else:
                connection.execute(text("SET TRANSACTION READ ONLY"))
                result = inspect_database(connection)
            if args.rehearse:
                transaction.rollback()
        print(json.dumps(result, ensure_ascii=False))
    except (SQLAlchemyError, ValueError) as error:
        # DB 예외에는 접속 정보가 포함될 수 있으므로 상세 traceback은 출력하지 않습니다.
        message = str(error) if isinstance(error, ValueError) else "Supabase 연결·구조 확인에 실패했습니다."
        raise SystemExit(message) from None
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    main()
