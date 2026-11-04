-- 진행 중 협업 마무리: 기간 연장 · 조기 완료 · 중단 알림, 종료 7일 전 알림. (alembic revision 20261104_27)
-- Docker용 database/init/031_add_collab_ending.sql 과 같은 내용입니다 (Docker 쪽에만 개정 번호 줄이 더 있어요).
-- 표는 바꾸지 않아요 (collaboration_change · ended_by · end_reason · discord_delete_at 은 이미 있어요). 알림 종류만 넓혀요.

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
  'collab_start_today',      -- 둘 다 (아침): 오늘부터 협업 시작
  -- 진행 중 협업 마무리 (20261104_27)
  'extend_requested',        -- 상대: 기간 연장을 요청했어요
  'extend_accepted',         -- 요청한 사람: 상대가 기간 연장을 수락했어요
  'extend_declined',         -- 요청한 사람: 상대가 [다시 얘기해요]
  'complete_requested',      -- 상대: 조기 완료를 요청했어요
  'complete_declined',       -- 요청한 사람: 상대가 [다시 얘기해요] (수락하면 review_ready)
  'collab_stopped',          -- 상대: 협업을 중단했어요
  'collab_week_left'         -- 둘 다 (아침): 협업이 7일 뒤에 끝나요
));

-- 030이 적어 둔 개정 번호를 이 변경까지 포함하도록 올립니다.
UPDATE public.insight_alembic_version
SET version_num = '20261104_27'
WHERE version_num = '20261104_26';