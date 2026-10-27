-- 후속 동결본. 기존 글·댓글·회원·인사이트 원문을 바꾸지 않습니다.
-- 원본 public.users.user_id는 BIGINT입니다. 같은 범위를 사용합니다.
ALTER TABLE community_private.posts ALTER COLUMN author_id TYPE BIGINT;
ALTER TABLE community_private.comments ALTER COLUMN author_id TYPE BIGINT;
ALTER TABLE community_private.reactions ALTER COLUMN user_id TYPE BIGINT;
ALTER TABLE community_private.bookmarks ALTER COLUMN user_id TYPE BIGINT;
ALTER TABLE community_private.notifications ALTER COLUMN user_id TYPE BIGINT;
ALTER TABLE community_private.reports ALTER COLUMN reporter_id TYPE BIGINT;
ALTER TABLE community_private.moderation_events ALTER COLUMN actor_id TYPE BIGINT;
ALTER TABLE community_private.write_limits ALTER COLUMN user_id TYPE BIGINT;
ALTER TABLE community_private.notifications
    ADD COLUMN comment_id VARCHAR(36) REFERENCES community_private.comments(id);
CREATE INDEX ix_community_notifications_comment ON community_private.notifications(comment_id);

-- 05의 알림에는 댓글 식별자가 없어 정확한 연결을 추측하지 않습니다.
-- 기존 행은 보존하고, 새 API 알림함은 댓글이 연결된 새 알림부터 표시합니다.
ALTER TABLE community_private.comments
    ADD CONSTRAINT uq_community_comment_post UNIQUE (post_id, id);
ALTER TABLE community_private.posts
    ADD CONSTRAINT fk_community_accepted_same_post
    FOREIGN KEY (id, accepted_comment_id) REFERENCES community_private.comments(post_id, id);
ALTER TABLE community_private.posts
    ADD CONSTRAINT ck_community_accepted_resolved
    CHECK (accepted_comment_id IS NULL OR status = 'resolved');
ALTER TABLE community_private.posts
    ADD CONSTRAINT ck_community_pin_public CHECK (NOT pinned OR visibility = 'public');
CREATE INDEX ix_community_moderation_post_time
    ON community_private.moderation_events(post_id, created_at DESC);
