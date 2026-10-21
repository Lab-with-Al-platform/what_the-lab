"""공통 Supabase에 기존 회원·프로필·연구 구조와 기준표를 추가합니다.

이미 있는 회원 표를 덮어쓰거나 MySQL 데이터를 자동 이전하지 않습니다.
"""

from pathlib import Path

from alembic import op

revision = "20261021_02"
down_revision = "20261016_01"
branch_labels = None
depends_on = None

SQL_DIRECTORY = Path(__file__).resolve().parents[1] / "sql" / revision
MEMBER_TABLES = (
    "users", "expert", "researcher_profile", "institution", "able_work",
    "expert_able_work", "field_category", "research_field", "expert_domain",
    "expert_collab_condition", "expert_reward", "portfolio", "portfolio_able_work",
    "portfolio_skill", "career", "education", "certificate", "research",
    "research_domain", "research_able_work", "research_data_type", "research_output",
    "research_reward",
)


def upgrade() -> None:
    # 같은 DB에 동시에 적용하지 않도록 트랜잭션이 끝날 때까지 잠급니다.
    op.execute("SELECT pg_advisory_xact_lock(20261021, 2)")
    op.execute("SET LOCAL search_path TO public, pg_catalog")
    names = ",".join(f"'{name}'" for name in MEMBER_TABLES)
    op.execute(f"""
        DO $guard$
        DECLARE table_name text;
        BEGIN
            FOREACH table_name IN ARRAY ARRAY[{names}] LOOP
                IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
                    RAISE EXCEPTION '회원 테이블이 이미 존재합니다. 자동 덮어쓰기 중단: %',
                        table_name;
                END IF;
            END LOOP;
            IF to_regprocedure('public.set_updated_at()') IS NOT NULL THEN
                RAISE EXCEPTION '기존 set_updated_at 함수가 있어 자동 덮어쓰기를 중단합니다.';
            END IF;
        END $guard$;
    """)
    # 이 복사본은 PR #16의 SQL을 동결한 이력입니다. database/init의 후속 수정과 분리합니다.
    paths = sorted(SQL_DIRECTORY.glob("*.sql"))
    if len(paths) != 6:
        raise RuntimeError("동결된 회원 초기화 SQL 6개가 모두 필요합니다.")
    for path in paths:
        op.execute(path.read_text(encoding="utf-8"))

    # Discord → FastAPI JWT를 사용하므로 브라우저용 Supabase 역할에는 직접 권한이 없습니다.
    # RLS 정책 없이 활성화하면 일반 API 역할은 행에 접근할 수 없고 DB 소유자는 유지됩니다.
    protected_tables = (*MEMBER_TABLES, "insight_alembic_version")
    for name in protected_tables:
        op.execute(f'ALTER TABLE public."{name}" ENABLE ROW LEVEL SECURITY')
        op.execute(f'REVOKE ALL ON TABLE public."{name}" FROM PUBLIC')
    for role in ("anon", "authenticated", "service_role"):
        for name in protected_tables:
            op.execute(f"""
                DO $permissions$ BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role}') THEN
                        REVOKE ALL ON TABLE public."{name}" FROM {role};
                    END IF;
                END $permissions$;
            """)
    # 새 표에 딸린 ID 시퀀스와 트리거 함수도 기본 공개 권한을 제거합니다.
    op.execute(f"""
        DO $sequences$
        DECLARE sequence_name text; role_name text;
        BEGIN
            FOR sequence_name IN
                SELECT pg_get_serial_sequence('public.' || table_name, column_name)
                FROM information_schema.columns
                WHERE table_schema = 'public' AND is_identity = 'YES'
                  AND table_name = ANY(ARRAY[{names}])
            LOOP
                EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC', sequence_name);
                FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
                        EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM %I',
                            sequence_name, role_name);
                    END IF;
                END LOOP;
            END LOOP;
        END $sequences$;
    """)
    op.execute("REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC")
    for role in ("anon", "authenticated", "service_role"):
        op.execute(f"""
            DO $function$ BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role}') THEN
                    REVOKE ALL ON FUNCTION public.set_updated_at() FROM {role};
                END IF;
            END $function$;
        """)


def downgrade() -> None:
    # 실수로 회원·프로필을 모두 지우지 않도록 자동 되돌리기는 제공하지 않습니다.
    raise RuntimeError("회원 데이터 삭제는 자동 실행하지 않습니다. 백업 후 별도 복구 계획이 필요합니다.")
