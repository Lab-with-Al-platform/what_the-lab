-- 시작 전 협업: 시작일 미루기 · 취소 알림 · 전문가가 다른 협업을 시작해 닫힌 요청 · 채널 삭제 상태. (alembic revision 20261104_26)
-- Docker용 database/init/030_add_waiting_collaboration.sql 과 같은 내용입니다 (Docker 쪽에만 개정 번호 줄이 더 있어요).
-- 기존 데이터는 지우거나 바꾸지 않아요. 칸과 규칙만 넓혀요.

-- 1) 시작일 미루기: 기간 연장 · 조기 완료 요청 표(collaboration_change)에 종류 'start'
--    한 명이 요청 → 상대가 수락하면 시작일 · 종료일이 같은 만큼 밀려요 (협업 기간 길이는 그대로)
ALTER TABLE collaboration_change
  ADD COLUMN old_start_date  DATE  NULL,  -- 요청할 때의 시작일 (시작일 미루기만)
  ADD COLUMN new_start_date  DATE  NULL;  -- 미룰 새 시작일 (시작일 미루기만)

ALTER TABLE collaboration_change DROP CONSTRAINT ck_change_kind;
ALTER TABLE collaboration_change ADD CONSTRAINT ck_change_kind CHECK (kind IN ('extend', 'complete', 'start'));

ALTER TABLE collaboration_change DROP CONSTRAINT ck_change_extend;
ALTER TABLE collaboration_change ADD CONSTRAINT ck_change_extend CHECK (
  -- 연장: 새 종료일이 원래보다 뒤 + 사유 필수
  (kind = 'extend' AND new_end_date > old_end_date AND reason IS NOT NULL AND new_start_date IS NULL)
  -- 조기 완료: 새 종료일 없음
  OR (kind = 'complete' AND new_end_date IS NULL AND new_start_date IS NULL)
  -- 시작일 미루기: 새 시작일이 원래보다 뒤, 종료일도 같은 날 수만큼 뒤 + 사유 필수
  OR (kind = 'start' AND old_start_date IS NOT NULL AND new_start_date > old_start_date
      AND new_end_date - old_end_date = new_start_date - old_start_date AND reason IS NOT NULL)
);

-- 2) 협업 요청이 닫힌 이유: 전문가가 다른 협업을 시작해서 (모든 협업이 30일 안에 끝나야 새 요청을 받아요)
ALTER TABLE collaboration_request DROP CONSTRAINT ck_request_cancel_reason;
ALTER TABLE collaboration_request ADD CONSTRAINT ck_request_cancel_reason CHECK (cancel_reason IS NULL OR cancel_reason IN (
  'withdrawn',        -- 연구회원이 답 전에 취소
  'declined',         -- 수락된 요청을 연구회원이 거절
  'expert_withdrew',  -- 전문가가 수락을 취소
  'other_started',    -- 같은 연구로 협업이 다 차서 자동으로 닫힘
  'expert_busy'       -- 전문가가 다른 협업을 시작해서 자동으로 닫힘
));

-- 3) 디스코드 채널 상태: 협업이 끝나 채널을 지웠어요 (취소 · 종료 2일 뒤)
ALTER TABLE collaboration DROP CONSTRAINT ck_collaboration_discord_status;
ALTER TABLE collaboration ADD CONSTRAINT ck_collaboration_discord_status CHECK (discord_status IN (
  'pending',  -- 만들 차례
  'ready',    -- 채널 있음 (두 사람이 대화 중)
  'failed',   -- 여러 번 실패해서 멈춤 (이유는 discord_error)
  'skipped',  -- 만들지 않음 (이미 끝난 협업 등)
  'closed',   -- 협업이 끝나 읽기 전용으로 바꿈 (discord_delete_at 에 지울 때)
  'deleted'   -- 채널을 지웠어요
));

-- 4) 알림 종류: 시작 전 협업 알림 7개
ALTER TABLE notification DROP CONSTRAINT ck_notification_type;
ALTER TABLE notification ADD CONSTRAINT ck_notification_type CHECK (type IN (
  'request_received',   -- 전문가: 협업 요청이 왔어요
  'request_accepted',   -- 연구회원: 요청을 수락했어요 (기간을 조정했을 수도 있어요)
  'request_rejected',   -- 연구회원: 요청을 거절했어요
  'request_canceled',   -- 전문가: 연구회원이 요청을 취소·거절했거나 자동으로 닫혔어요
  'request_withdrawn',  -- 연구회원: 전문가가 수락을 취소했어요
  'request_expired',    -- 둘 다: 기한 안에 답(또는 선택)이 없어 만료됐어요
  'collab_started',     -- 둘 다: 협업을 시작했어요
  -- 협업 공간 요청 (한 사람이 한 일 → 상대에게)
  'task_created',       -- 받은 사람: 새 요청
  'task_done',          -- 보낸 사람: 완료했어요
  'task_canceled',      -- 받은 사람: 요청을 취소했어요
  'task_reopened',      -- 상대: 되돌렸어요 (다시 진행 중)
  'task_due',           -- 받은 사람: 기한이 바뀌었어요
  'task_due_talk',      -- 보낸 사람: 기한 수정을 요청했어요
  'task_due_kept',      -- 받은 사람: 보낸 사람이 지금 기한을 유지하기로 했어요
  'task_returned',      -- 받은 사람: 다시 요청했어요
  -- 아침 브리핑 (하루 한 번, notice_on)
  'task_due_soon',      -- 받은 사람: 기한이 내일 · 오늘이에요
  'task_overdue',       -- 받은 사람: 기한이 지났어요
  'task_talk_waiting',  -- 보낸 사람: 기한 수정 요청에 아직 답하지 않았어요
  'collab_ending',      -- 둘 다: 협업 종료 3일 전인데 열린 요청이 있어요
  -- 협업 공간 일정 (한 사람이 한 일 → 상대에게)
  'schedule_created',   -- 상대: 일정을 추가했어요 (채널 멘션)
  'schedule_changed',   -- 상대: 일정 날짜·시각을 바꿨어요 (채널 멘션)
  'schedule_edited',    -- 상대: 제목·메모만 고쳤어요 (종에만)
  'schedule_deleted',   -- 상대: 일정을 지웠어요 (채널 멘션)
  -- 일정 아침 브리핑 (하루 한 번, notice_on · 두 사람)
  'schedule_tomorrow',  -- 내일 시작하는 일정
  'schedule_today',     -- 오늘 시작하는 일정
  'schedule_ending',    -- 여러 날 일정이 내일 끝나요
  -- 협업 리뷰 (20261103_24 에서 추가)
  'review_ready',       -- 협업이 끝나 리뷰를 남길 수 있어요
  -- 알림 종에 하루 한 칸으로 묶어 보여 주는 아침 브리핑 (협업마다 한 줄)
  'daily_brief',        -- 오늘 챙길 일 (위 아침 알림들을 묶은 것. 하나하나는 읽음으로 저장하고 종에는 이것만)
  -- 시작 전 협업 (20261104_26)
  'request_busy',            -- 연구회원: 전문가가 다른 협업을 시작해서 요청이 닫혔어요
  'collab_canceled',         -- 상대: 시작 전에 협업을 취소했어요
  'start_change_requested',  -- 상대: 시작일을 미루자고 했어요
  'start_change_accepted',   -- 요청한 사람: 상대가 시작일 미루기를 수락했어요
  'start_change_declined',   -- 요청한 사람: 상대가 [다시 얘기해요]
  'collab_starting',         -- 둘 다 (아침): 내일 협업이 시작돼요
  'collab_start_today'       -- 둘 다 (아침): 오늘부터 협업 시작
));