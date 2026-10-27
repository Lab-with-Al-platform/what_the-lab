-- 공개 인사이트 조회수 원본과 일별 합계. 011에서 만든 publications를 참조합니다.
-- 공용 DB의 Alembic 20261026_07과 같은 구조입니다. 조회 기록 행은 복사하지 않습니다.
CREATE TABLE insight_private.insight_page_views (
    event_id VARCHAR(36) PRIMARY KEY,
    content_id VARCHAR(36) NOT NULL REFERENCES insight_private.publications(id),
    received_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE insight_private.insight_page_view_daily (
    content_id VARCHAR(36) NOT NULL REFERENCES insight_private.publications(id),
    view_date DATE NOT NULL,
    page_views INTEGER NOT NULL,
    PRIMARY KEY (content_id, view_date)
);

ALTER TABLE insight_private.insight_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_private.insight_page_view_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE insight_private.insight_page_views FROM PUBLIC;
REVOKE ALL ON TABLE insight_private.insight_page_view_daily FROM PUBLIC;

DO $protect$
DECLARE table_name TEXT;
role_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['insight_page_views', 'insight_page_view_daily'] LOOP
        FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
                EXECUTE format('REVOKE ALL ON TABLE insight_private.%I FROM %I', table_name, role_name);
            END IF;
        END LOOP;
    END LOOP;
END $protect$;
