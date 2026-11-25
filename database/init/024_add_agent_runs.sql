-- 작업 회차 저장. Alembic 20261029_20과 같은 표·제약입니다.
-- 이미 초기화된 Docker volume에는 이 파일이 자동으로 다시 적용되지 않습니다.
-- 원문 전체·비밀값·비공개 추론은 이 표에 두지 않습니다.
CREATE TABLE insight_private.agent_runs (
    id VARCHAR(36) PRIMARY KEY,
    run_id VARCHAR(100) NOT NULL,
    step VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL,
    settings_version VARCHAR(80) NOT NULL,
    settings_hash VARCHAR(64) NOT NULL,
    input_hash VARCHAR(64) NOT NULL,
    manuscript_hash VARCHAR(64),
    attempt_count INTEGER NOT NULL,
    budget_usage JSON NOT NULL,
    error_code VARCHAR(50),
    evidence_ids JSON NOT NULL,
    bundle_id VARCHAR(120),
    lease_owner VARCHAR(80),
    lease_expires_at TIMESTAMPTZ,
    state_version INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_agent_run_id UNIQUE (run_id),
    CONSTRAINT ck_agent_run_state_version CHECK (state_version >= 1),
    CONSTRAINT ck_agent_run_attempt_count CHECK (attempt_count >= 0),
    CONSTRAINT ck_agent_run_step CHECK (
        step IN ('queued', 'researching', 'drafting', 'reviewing', 'ready_for_human')
    ),
    CONSTRAINT ck_agent_run_status CHECK (
        status IN (
            'queued', 'researching', 'drafting', 'reviewing',
            'ready_for_human', 'needs_revision', 'held', 'failed', 'cancelled'
        )
    )
);

ALTER TABLE insight_private.agent_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE insight_private.agent_runs FROM PUBLIC;

DO $protect$
DECLARE role_name TEXT;
BEGIN
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
            EXECUTE format('REVOKE ALL ON TABLE insight_private.agent_runs FROM %I', role_name);
        END IF;
    END LOOP;
END $protect$;

-- 023이 적어 둔 개정 번호를 이 변경까지 포함하도록 올립니다.
-- Alembic SQL에는 넣지 않습니다. Alembic이 책갈피를 직접 바꿉니다.
-- 이미 만들어진 volume은 이 UPDATE를 자동 실행하지 않으므로 별도 적용이 필요합니다.
UPDATE public.insight_alembic_version
SET version_num = '20261029_20'
WHERE version_num = '20261029_19';
