-- 일정 메시지 고치기 · 아침 브리핑 묶기. (alembic revision 20261102_24)
-- Docker용 database/init/028_add_schedule_message.sql 과 같은 내용입니다 (Docker 쪽에만 개정 번호 줄이 더 있어요).

-- 1) 일정: 채널에 올린 "일정을 추가했어요" 메시지 번호. 일정이 바뀌거나 지워지면 이 메시지를 고쳐요 (요청과 같은 방식)
ALTER TABLE collaboration_schedule
  ADD COLUMN discord_message_id  VARCHAR(30)  NULL;  -- 채널 메시지 번호 (웹 · 디스코드 어디서 추가해도). 예전 일정 · 반복 일정의 2번째부터는 비어 있어요

-- 2) 알림 종류: 아침 브리핑을 알림 종에 협업마다 하루 한 칸(daily_brief)으로
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
  -- 알림 종에 하루 한 칸으로 묶어 보여 주는 아침 브리핑 (협업마다 한 줄)
  'daily_brief'         -- 오늘 챙길 일 (위 아침 알림들을 묶은 것. 하나하나는 읽음으로 저장하고 종에는 이것만)
));