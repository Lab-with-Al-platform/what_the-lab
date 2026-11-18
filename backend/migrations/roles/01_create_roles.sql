-- 운영 RDS 계정 3개 만들기 (처음 한 번, 첫 마이그레이션 전에). B11
-- 실행: DB 담당자가 SSM 터널을 열고, RDS 마스터 계정으로 psql 에서 실행해요.
--   psql "host=localhost port=15432 dbname=labbridge user=<마스터> sslmode=require" \
--     -v migrator_password="$(openssl rand -hex 24)" \
--     -v app_password="$(openssl rand -hex 24)" \
--     -v readonly_password="$(openssl rand -hex 24)" \
--     -f backend/migrations/roles/01_create_roles.sql
-- 비밀번호는 실행 직후 SSM Parameter Store(/labbridge/prod/*)에 저장하고 화면·파일에 남기지 않아요.
--
-- | 계정                | 하는 일                                   | 쓰는 곳                         |
-- |---------------------|-------------------------------------------|---------------------------------|
-- | labbridge_migrator  | 표의 주인. 마이그레이션(alembic)만 실행   | deploy.sh MIGRATION_DATABASE_URL |
-- | labbridge_app       | 읽기·쓰기만. 표를 만들거나 지울 수 없음   | backend·봇 DATABASE_URL         |
-- | labbridge_readonly  | 읽기만. 사람이 운영 데이터를 볼 때        | SSM 터널 + psql                 |
--
-- 마스터 계정은 앱·사람이 평소에 쓰지 않아요. (RDS 마스터는 superuser가 아니라 BYPASSRLS 계정을 못 만들어요.
-- 그래서 RLS가 켜진 표는 02_grant_privileges.sql 이 계정별 정책을 붙여요.)

\set ON_ERROR_STOP on

CREATE ROLE labbridge_migrator LOGIN PASSWORD :'migrator_password';
CREATE ROLE labbridge_app LOGIN PASSWORD :'app_password' CONNECTION LIMIT 30;
CREATE ROLE labbridge_readonly LOGIN PASSWORD :'readonly_password' CONNECTION LIMIT 5;

-- 조회 전용: 실수로 쓰는 것을 한 번 더 막고, 오래 걸리는 조회는 30초에 끊어요.
ALTER ROLE labbridge_readonly SET default_transaction_read_only = on;
ALTER ROLE labbridge_readonly SET statement_timeout = '30s';

-- DB 접속은 세 계정만. 마이그레이션 계정은 스키마(insight_private 등)를 만들 수 있어야 해요.
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database()) \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO labbridge_migrator, labbridge_app, labbridge_readonly',
              current_database()) \gexec
SELECT format('GRANT CREATE ON DATABASE %I TO labbridge_migrator', current_database()) \gexec
GRANT USAGE, CREATE ON SCHEMA public TO labbridge_migrator;
