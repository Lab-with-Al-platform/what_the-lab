-- 이 파일은 적용 이력의 동결본입니다. 후속 변경은 새 revision으로 추가합니다.
CREATE SCHEMA community_private;
REVOKE ALL ON SCHEMA community_private FROM PUBLIC;

CREATE TABLE community_private.posts (
    id VARCHAR(36) PRIMARY KEY,
    author_id INTEGER NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
    author_name VARCHAR(100) NOT NULL,
    author_role VARCHAR(20) NOT NULL,
    title VARCHAR(120) NOT NULL,
    body TEXT NOT NULL,
    category VARCHAR(30) NOT NULL CHECK (category IN ('question','story','idea','support','chat','notice')),
    visibility VARCHAR(10) NOT NULL CHECK (visibility IN ('public','private')),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved')),
    tags JSON NOT NULL,
    area VARCHAR(30) NOT NULL,
    insight_slug VARCHAR(100),
    accepted_comment_id VARCHAR(36),
    pinned BOOLEAN NOT NULL DEFAULT FALSE,
    hidden BOOLEAN NOT NULL DEFAULT FALSE,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    version INTEGER NOT NULL CHECK (version >= 1),
    client_token VARCHAR(36) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_community_post_retry UNIQUE (author_id, client_token)
);
CREATE INDEX ix_community_public_list ON community_private.posts (visibility, hidden, deleted, created_at DESC);
CREATE INDEX ix_community_author ON community_private.posts (author_id, created_at DESC);
CREATE INDEX ix_community_category ON community_private.posts (category, status);

CREATE TABLE community_private.comments (
    id VARCHAR(36) PRIMARY KEY,
    post_id VARCHAR(36) NOT NULL REFERENCES community_private.posts(id),
    author_id INTEGER NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
    author_name VARCHAR(100) NOT NULL,
    author_role VARCHAR(20) NOT NULL,
    is_staff BOOLEAN NOT NULL DEFAULT FALSE,
    body TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    client_token VARCHAR(36) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_community_comment_retry UNIQUE (author_id, client_token)
);
CREATE INDEX ix_community_comments_post ON community_private.comments (post_id, created_at);
ALTER TABLE community_private.posts ADD CONSTRAINT fk_community_accepted
    FOREIGN KEY (accepted_comment_id) REFERENCES community_private.comments(id);

CREATE TABLE community_private.reactions (
    post_id VARCHAR(36) NOT NULL REFERENCES community_private.posts(id),
    user_id INTEGER NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
    PRIMARY KEY (post_id, user_id)
);
CREATE TABLE community_private.bookmarks (
    post_id VARCHAR(36) NOT NULL REFERENCES community_private.posts(id),
    user_id INTEGER NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
    PRIMARY KEY (post_id, user_id)
);
CREATE TABLE community_private.notifications (
    id VARCHAR(36) PRIMARY KEY,
    post_id VARCHAR(36) NOT NULL REFERENCES community_private.posts(id),
    user_id INTEGER NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_community_notifications_user ON community_private.notifications (user_id, read, created_at DESC);
CREATE TABLE community_private.reports (
    id VARCHAR(36) PRIMARY KEY,
    post_id VARCHAR(36) NOT NULL REFERENCES community_private.posts(id),
    reporter_id INTEGER NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
    reason VARCHAR(30) NOT NULL,
    detail VARCHAR(500) NOT NULL,
    handled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_community_report UNIQUE (post_id, reporter_id)
);
CREATE INDEX ix_community_reports_post ON community_private.reports (post_id, handled);
CREATE TABLE community_private.moderation_events (
    id VARCHAR(36) PRIMARY KEY,
    post_id VARCHAR(36) NOT NULL REFERENCES community_private.posts(id),
    actor_id INTEGER NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
    action VARCHAR(30) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE community_private.write_limits (
    user_id INTEGER PRIMARY KEY REFERENCES public.users(user_id) ON DELETE RESTRICT,
    window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    count INTEGER NOT NULL DEFAULT 0
);

-- 브라우저에서 Supabase Data API를 우회 호출해도 문의 내용에 접근할 수 없습니다.
DO $protect$
DECLARE table_name TEXT; role_name TEXT;
BEGIN
    FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname = 'community_private' LOOP
        EXECUTE format('ALTER TABLE community_private.%I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('REVOKE ALL ON TABLE community_private.%I FROM PUBLIC', table_name);
        FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
                EXECUTE format('REVOKE ALL ON TABLE community_private.%I FROM %I', table_name, role_name);
            END IF;
        END LOOP;
    END LOOP;
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
            EXECUTE format('REVOKE ALL ON SCHEMA community_private FROM %I', role_name);
        END IF;
    END LOOP;
END $protect$;
