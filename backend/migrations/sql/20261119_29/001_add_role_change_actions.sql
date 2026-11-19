-- 운영 이력 기록 종류에 회원 역할 변경을 더합니다. (alembic revision 20261119_29)
-- Docker용 database/init/033_add_role_change_actions.sql 과 같은 내용입니다 (Docker 쪽에만 개정 번호 줄이 더 있어요).
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
