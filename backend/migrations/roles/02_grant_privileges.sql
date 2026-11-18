-- 앱·조회 전용 계정 권한 맞추기 (마이그레이션 뒤에 매번). B11
-- 실행: 표의 주인(labbridge_migrator)으로. deploy.sh 가 alembic upgrade 다음에 자동으로 실행해요.
-- 몇 번을 실행해도 결과가 같아요. 새 마이그레이션이 표를 만들어도 이 파일만 다시 돌리면 돼요.
--
-- 왜 정책(POLICY)이 필요하나요?
--   표 53개에 RLS(행 단위 보안)가 켜져 있어요 (Supabase API 역할을 막으려고 켠 것).
--   RLS 표는 주인이 아닌 계정에게 정책이 없으면 **0줄**로 보여요. 그래서 계정마다 "전부 허용" 정책을 붙여요.
--   anon·authenticated·service_role 은 여전히 막혀 있어요 (정책 대상이 아니에요).

DO $grants$
DECLARE
    schema_name text;
    target record;
    schemas text[] := ARRAY['public', 'insight_private', 'community_private'];
BEGIN
    FOREACH schema_name IN ARRAY schemas LOOP
        CONTINUE WHEN to_regnamespace(schema_name) IS NULL;

        -- 앱: 읽기·쓰기 (표 만들기·지우기·구조 바꾸기는 안 됨)
        -- public 스키마 사용(USAGE)은 PostgreSQL 기본값으로 모두에게 있어요. 주인이 아니라 GRANT 하면 경고만 나요.
        IF schema_name <> 'public' THEN
            EXECUTE format('GRANT USAGE ON SCHEMA %I TO labbridge_app, labbridge_readonly', schema_name);
        END IF;
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO labbridge_app', schema_name);
        EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO labbridge_app', schema_name);
        EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA %I TO labbridge_app', schema_name);

        -- 조회 전용: 읽기만
        EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO labbridge_readonly', schema_name);
        EXECUTE format('GRANT SELECT ON ALL SEQUENCES IN SCHEMA %I TO labbridge_readonly', schema_name);

        -- 이 파일을 깜빡해도 새 표의 기본 권한은 따라가게 (RLS 정책은 아래 반복문이 붙여요)
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO labbridge_app', schema_name);
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO labbridge_app', schema_name);
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT ON TABLES TO labbridge_readonly', schema_name);
    END LOOP;

    -- RLS가 켜진 표마다 계정별 정책 (이미 있으면 건너뛰어요)
    FOR target IN
        SELECT n.nspname AS schema_name, c.relname AS table_name
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r', 'p') AND c.relrowsecurity AND n.nspname = ANY(schemas)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = target.schema_name
                       AND tablename = target.table_name AND policyname = 'labbridge_app_all') THEN
            EXECUTE format('CREATE POLICY labbridge_app_all ON %I.%I FOR ALL TO labbridge_app USING (true) WITH CHECK (true)',
                           target.schema_name, target.table_name);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = target.schema_name
                       AND tablename = target.table_name AND policyname = 'labbridge_readonly_select') THEN
            EXECUTE format('CREATE POLICY labbridge_readonly_select ON %I.%I FOR SELECT TO labbridge_readonly USING (true)',
                           target.schema_name, target.table_name);
        END IF;
    END LOOP;
END
$grants$;
