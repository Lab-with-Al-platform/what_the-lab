-- 협업 공간 알림: 요청 알림을 사이트 알림 종에 넣고, 아침 브리핑이 하루에 한 번만 가게 해요. (alembic revision 20261031_22)
-- Docker용 database/init/026_add_task_notifications.sql 과 같은 내용입니다 (Docker 쪽에만 개정 번호 줄이 더 있어요).
-- 협업 안의 일은 디스코드 DM을 보내지 않아요 (협업 채널 멘션 + 알림 종). 그래서 이 알림들은 discord_status = 'skipped' 로 저장해요.

-- 1) 알림: 어느 요청 · 어느 협업 알림인지, 아침 알림이면 어느 날 것인지
ALTER TABLE notification
  ADD COLUMN task_id           BIGINT  NULL,  -- 관련 요청 (collaboration_task)
  ADD COLUMN collaboration_id  BIGINT  NULL,  -- 관련 협업 (누르면 협업 상세로)
  ADD COLUMN notice_on         DATE    NULL,  -- 아침 브리핑 알림의 날짜 (같은 날 두 번 안 가게)
  ADD CONSTRAINT fk_notification_task FOREIGN KEY (task_id) REFERENCES collaboration_task(task_id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_notification_collaboration FOREIGN KEY (collaboration_id) REFERENCES collaboration(collaboration_id) ON DELETE CASCADE;

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
  'collab_ending'       -- 둘 다: 협업 종료 3일 전인데 열린 요청이 있어요
));

-- 아침 브리핑 알림은 (받는 사람, 종류, 협업, 요청, 날짜) 하나에 한 번만. 서버를 껐다 켜도 두 번 안 가요
CREATE UNIQUE INDEX uq_notification_daily ON notification (user_id, type, collaboration_id, (COALESCE(task_id, 0)), notice_on)
  WHERE notice_on IS NOT NULL;
CREATE INDEX idx_notification_task ON notification (task_id) WHERE task_id IS NOT NULL;  -- 요청을 지울 때

-- 2) 요청 기록: [지금 기한 유지] + 협업이 끝날 때 열린 요청을 "미완료로 마감" (자동이라 누른 사람이 없어요)
ALTER TABLE collaboration_task_event ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE collaboration_task_event DROP CONSTRAINT ck_task_event_kind;
ALTER TABLE collaboration_task_event ADD CONSTRAINT ck_task_event_kind CHECK (kind IN (
  'created',   -- 요청 남김 (보낸 사람)
  'done',      -- 완료 (받은 사람)
  'canceled',  -- 취소 (보낸 사람)
  'reopened',  -- 되돌리기 (끝낸 사람)
  'due',       -- 기한 변경 (보낸 사람) old_due → new_due
  'due_talk',  -- 기한 얘기하기 (받은 사람) new_due = 원하는 기한(없으면 "어려워요"), note = 이유
  'returned',  -- 다시 요청 (보낸 사람, 완료된 요청을 다시 진행 중으로) note = 이유
  'due_kept',  -- 지금 기한 유지 (보낸 사람이 기한 수정 요청에 답함) note = 이유(선택)
  'ended'      -- 협업 종료로 마감 (끝나지 않은 채로 협업이 끝났어요. 누른 사람 없음)
));
ALTER TABLE collaboration_task_event ADD CONSTRAINT ck_task_event_actor CHECK (kind = 'ended' OR actor_id IS NOT NULL);  -- 마감만 누른 사람이 비어요