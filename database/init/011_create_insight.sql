-- 로컬 Docker가 공용 DB와 같은 인사이트 구조를 갖게 합니다.
-- 공개 글 내용은 복사하지 않습니다. 조회수·방문 수집 표는 이 파일에 없습니다.
CREATE SCHEMA insight_private;
REVOKE ALL ON SCHEMA insight_private FROM PUBLIC;

CREATE TABLE insight_private.sources (
    id VARCHAR(36) PRIMARY KEY,
    doi VARCHAR(255) UNIQUE,
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    access_level VARCHAR(30) NOT NULL,
    bibliography_checked BOOLEAN NOT NULL
);

CREATE TABLE insight_private.candidates (
    id VARCHAR(36) PRIMARY KEY,
    source_id VARCHAR(36) NOT NULL REFERENCES insight_private.sources(id),
    kind VARCHAR(10) NOT NULL,
    status VARCHAR(30) NOT NULL,
    version INTEGER NOT NULL,
    current_revision INTEGER NOT NULL,
    approved_revision INTEGER,
    approved_by VARCHAR(32),
    approved_at TIMESTAMPTZ,
    scheduled_for TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_candidate_source_kind UNIQUE (source_id, kind),
    CONSTRAINT ck_candidate_version CHECK (version >= 1),
    CONSTRAINT ck_candidate_status CHECK (status IN ('draft', 'pending_review', 'approved', 'published'))
);

CREATE TABLE insight_private.revisions (
    id VARCHAR(36) PRIMARY KEY,
    candidate_id VARCHAR(36) NOT NULL REFERENCES insight_private.candidates(id),
    number INTEGER NOT NULL,
    content JSON NOT NULL,
    created_by VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_candidate_revision UNIQUE (candidate_id, number)
);

CREATE TABLE insight_private.review_events (
    id VARCHAR(36) PRIMARY KEY,
    candidate_id VARCHAR(36) NOT NULL REFERENCES insight_private.candidates(id),
    revision INTEGER NOT NULL,
    action VARCHAR(30) NOT NULL,
    actor_discord_id VARCHAR(32) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE insight_private.publications (
    id VARCHAR(36) PRIMARY KEY,
    candidate_id VARCHAR(36) NOT NULL UNIQUE REFERENCES insight_private.candidates(id),
    revision INTEGER NOT NULL,
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    snapshot JSON NOT NULL,
    published_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE insight_private.collection_settings (
    id VARCHAR(30) PRIMARY KEY,
    version INTEGER NOT NULL,
    content JSON NOT NULL,
    updated_by VARCHAR(32) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_collection_settings_version CHECK (version >= 1)
);

ALTER TABLE insight_private.collection_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA insight_private FROM PUBLIC;

-- Supabase 역할이 있는 환경에서만 브라우저 역할의 직접 접근을 막습니다.
DO $protect$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON SCHEMA insight_private FROM anon;
        REVOKE ALL ON ALL TABLES IN SCHEMA insight_private FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON SCHEMA insight_private FROM authenticated;
        REVOKE ALL ON ALL TABLES IN SCHEMA insight_private FROM authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        REVOKE ALL ON SCHEMA insight_private FROM service_role;
        REVOKE ALL ON ALL TABLES IN SCHEMA insight_private FROM service_role;
    END IF;
END $protect$;
