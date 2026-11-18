-- 계정 권한이 의도대로인지 확인해요. 틀리면 오류로 멈춰요. (CI migration-check, 운영 점검용) B11
-- 실행: labbridge_migrator 또는 마스터 계정으로. 데이터는 바꾸지 않아요.
--   앱(labbridge_app)      : 모든 표 읽기·쓰기 O, 표 만들기 X
--   조회(labbridge_readonly): 모든 표 읽기 O, 쓰기 X
--   RLS 표                  : 두 계정 정책이 모두 있어야 해요 (없으면 0줄로 보여요)

\set ON_ERROR_STOP on

DO $verify$
DECLARE
    schemas text[] := ARRAY['public', 'insight_private', 'community_private'];
    app_missing int;
    readonly_wrong int;
    policy_missing int;
BEGIN
    SELECT count(*) INTO app_missing
    FROM pg_tables t
    WHERE t.schemaname = ANY(schemas)
      AND NOT (has_table_privilege('labbridge_app', format('%I.%I', t.schemaname, t.tablename), 'SELECT')
           AND has_table_privilege('labbridge_app', format('%I.%I', t.schemaname, t.tablename), 'INSERT')
           AND has_table_privilege('labbridge_app', format('%I.%I', t.schemaname, t.tablename), 'UPDATE')
           AND has_table_privilege('labbridge_app', format('%I.%I', t.schemaname, t.tablename), 'DELETE'));

    SELECT count(*) INTO readonly_wrong
    FROM pg_tables t
    WHERE t.schemaname = ANY(schemas)
      AND NOT (has_table_privilege('labbridge_readonly', format('%I.%I', t.schemaname, t.tablename), 'SELECT')
           AND NOT has_table_privilege('labbridge_readonly', format('%I.%I', t.schemaname, t.tablename), 'INSERT')
           AND NOT has_table_privilege('labbridge_readonly', format('%I.%I', t.schemaname, t.tablename), 'UPDATE')
           AND NOT has_table_privilege('labbridge_readonly', format('%I.%I', t.schemaname, t.tablename), 'DELETE'));

    SELECT count(*) INTO policy_missing
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p') AND c.relrowsecurity AND n.nspname = ANY(schemas)
      AND (SELECT count(*) FROM pg_policies p
           WHERE p.schemaname = n.nspname AND p.tablename = c.relname
             AND p.policyname IN ('labbridge_app_all', 'labbridge_readonly_select')) < 2;

    IF app_missing > 0 OR readonly_wrong > 0 OR policy_missing > 0 THEN
        RAISE EXCEPTION '권한 확인 실패: 앱 권한 빠짐 %개 표, 조회 전용 권한 틀림 %개 표, RLS 정책 빠짐 %개 표',
            app_missing, readonly_wrong, policy_missing;
    END IF;

    IF has_schema_privilege('labbridge_app', 'public', 'CREATE')
       OR has_schema_privilege('labbridge_readonly', 'public', 'CREATE') THEN
        RAISE EXCEPTION '권한 확인 실패: 앱·조회 전용 계정이 public 에 표를 만들 수 있어요';
    END IF;

    RAISE NOTICE '권한 확인 통과';
END
$verify$;
