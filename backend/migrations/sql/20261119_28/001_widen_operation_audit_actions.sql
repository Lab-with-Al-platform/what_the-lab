-- 운영 이력 기록 종류에 공통 관리자 부여·해제를 더합니다. (alembic revision 20261119_28)
-- Docker용 database/init/032_widen_operation_audit_actions.sql 과 같은 내용입니다 (Docker 쪽에만 개정 번호 줄이 더 있어요).
-- 표 구조와 기존 기록은 바꾸지 않아요. 허용하는 action 값만 넓혀요.

ALTER TABLE operation_audit DROP CONSTRAINT ck_operation_audit_action;
ALTER TABLE operation_audit ADD CONSTRAINT ck_operation_audit_action CHECK (action IN (
  'suspend',       -- 회원 정지
  'restore',       -- 정지 해제
  'grant_admin',   -- 공통 관리자 부여
  'revoke_admin'   -- 공통 관리자 해제
));
