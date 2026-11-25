-- 운영 이력 기록 종류에 회원 역할 변경을 더합니다 (PostgreSQL) 032 다음에 실행됩니다.
-- Supabase용 backend/migrations/sql/20261119_29/ 과 같습니다. 아래 개정 번호만 Docker에 있습니다.
-- 이미 초기화된 Docker volume에는 이 파일이 자동으로 다시 적용되지 않습니다. (직접 실행)
-- 표 구조와 기존 기록은 바꾸지 않아요. 허용하는 action 값만 넓혀요.

ALTER TABLE operation_audit DROP CONSTRAINT ck_operation_audit_action;
ALTER TABLE operation_audit ADD CONSTRAINT ck_operation_audit_action CHECK (action IN (
  'suspend',       -- 회원 정지
  'restore',       -- 정지 해제
  'grant_admin',   -- 공통 관리자 부여
  'revoke_admin',  -- 공통 관리자 해제
  'change_role',   -- 관리자·테스트 계정 역할을 바로 바꿈
  'reset_role'     -- 일반 회원 역할을 비우고 회원 유형 선택으로 되돌림
));

-- 032가 적어 둔 개정 번호를 이 변경까지 포함하도록 올립니다.
UPDATE public.insight_alembic_version
SET version_num = '20261119_29'
WHERE version_num = '20261119_28';
