-- 협업 요청 규칙 보완 (급한 요청 · 전문가 기간 조정 · 연구자 선택 기한 · 취소 이유). (PostgreSQL) 007, 008 다음에 실행됩니다.
-- 같은 내용이 Supabase용 backend/migrations/sql/20261027_07/ 에도 있습니다. 둘을 함께 고칩니다.

-- 1) 협업 요청에 칸 추가 (기존 요청은 기본값으로 채워져요)
ALTER TABLE collaboration_request
  ADD COLUMN is_urgent            BOOLEAN       NOT NULL  DEFAULT FALSE,  -- 급해요: 내일부터 시작 가능, 수락하면 바로 협업 시작
  ADD COLUMN accepted_start_date  DATE          NULL,                     -- 전문가가 조정해서 수락한 시작일 (그대로 수락이면 비어 있음)
  ADD COLUMN accepted_end_date    DATE          NULL,                     -- 전문가가 조정해서 수락한 종료일
  ADD COLUMN select_expires_at    TIMESTAMPTZ   NULL,                     -- 수락된 뒤 연구자가 [협업 시작]을 눌러야 하는 기한
  ADD COLUMN cancel_reason        VARCHAR(20)   NULL,                     -- canceled일 때 이유 (아래 ck_request_cancel_reason)
  ADD COLUMN cancel_text          VARCHAR(200)  NULL;                     -- 전문가가 수락을 취소하며 남긴 말 (선택)

ALTER TABLE collaboration_request
  ADD CONSTRAINT ck_request_cancel_reason CHECK (cancel_reason IS NULL OR cancel_reason IN (
    'withdrawn',        -- 연구회원이 답 전에 취소
    'declined',         -- 수락된 요청을 연구회원이 거절
    'expert_withdrew',  -- 전문가가 수락을 취소
    'other_started'     -- 같은 연구로 협업이 다 차서 자동으로 닫힘
  )),
  ADD CONSTRAINT ck_request_accepted_period CHECK (
    (accepted_start_date IS NULL AND accepted_end_date IS NULL)
    OR (accepted_start_date IS NOT NULL AND accepted_end_date >= accepted_start_date)
  );

-- 2) 알림 종류 추가: 전문가가 수락을 취소했어요 (연구회원에게)
ALTER TABLE notification DROP CONSTRAINT ck_notification_type;
ALTER TABLE notification ADD CONSTRAINT ck_notification_type CHECK (type IN (
  'request_received',   -- 전문가: 협업 요청이 왔어요
  'request_accepted',   -- 연구회원: 요청을 수락했어요 (기간을 조정했을 수도 있어요)
  'request_rejected',   -- 연구회원: 요청을 거절했어요
  'request_canceled',   -- 전문가: 연구회원이 요청을 취소·거절했거나 자동으로 닫혔어요
  'request_withdrawn',  -- 연구회원: 전문가가 수락을 취소했어요
  'request_expired',    -- 둘 다: 기한 안에 답(또는 선택)이 없어 만료됐어요
  'collab_started'      -- 둘 다: 협업을 시작했어요
));