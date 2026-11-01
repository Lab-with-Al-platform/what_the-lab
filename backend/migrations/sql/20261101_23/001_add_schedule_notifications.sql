-- 일정 알림: 일정 추가·변경·삭제와 아침 브리핑(내일 · 오늘 · 내일 끝남)을 알림 종에 넣어요. (alembic revision 20261101_23)
-- Docker용 database/init/027_add_schedule_notifications.sql 과 같은 내용입니다 (Docker 쪽에만 개정 번호 줄이 더 있어요).
-- 협업 안의 일이라 디스코드 DM은 보내지 않아요 (협업 채널 멘션 + 알림 종, discord_status = 'skipped').

-- 1) 알림: 어느 일정 알림인지 + 그때의 일정 글자
--    schedule_id 는 일부러 외래키를 걸지 않아요. 일정을 지워도 "무엇을 지웠는지" 알림이 남아야 하고,
--    지운 일정 번호를 비우면(SET NULL) 같은 날 아침 알림끼리 아래 중복 막기에 걸려 일정 삭제가 실패할 수 있어요.
ALTER TABLE notification
  ADD COLUMN schedule_id  BIGINT        NULL,  -- 관련 일정 (collaboration_schedule.schedule_id, 지워졌을 수 있어요)
  ADD COLUMN note         VARCHAR(200)  NULL;  -- 그때의 일정 글자 (예: 주간 미팅 · 미팅 · 11.5 (목) 14:00)

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
  'schedule_ending'     -- 여러 날 일정이 내일 끝나요
));

-- 2) 아침 알림 중복 막기에 일정도 넣어요: (받는 사람, 종류, 협업, 요청, 일정, 날짜) 하나에 한 번만
DROP INDEX uq_notification_daily;
CREATE UNIQUE INDEX uq_notification_daily
  ON notification (user_id, type, collaboration_id, (COALESCE(task_id, 0)), (COALESCE(schedule_id, 0)), notice_on)
  WHERE notice_on IS NOT NULL;
CREATE INDEX idx_notification_schedule ON notification (schedule_id) WHERE schedule_id IS NOT NULL;