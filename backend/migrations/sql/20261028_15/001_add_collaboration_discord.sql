-- 협업 전용 디스코드 채널 칸을 공통 Supabase에 추가합니다. (alembic revision 20261028_15)
-- Docker용 database/init/019 의 칸 추가와 같습니다. 개정 번호는 Alembic이 직접 바꿉니다.

-- 1) 협업마다 디스코드 비공개 채널 하나 (협업-12 같은 이름, 두 사람 + 봇만 보여요)
--    [협업 시작] 때는 pending 으로만 남기고, 백그라운드 작업이 채널을 만든 뒤 ready 로 바꿔요.
ALTER TABLE collaboration
  ADD COLUMN discord_channel_id  VARCHAR(30)   NULL,                       -- 디스코드 채널 번호 (만들기 전에는 비어 있어요)
  ADD COLUMN discord_status      VARCHAR(10)   NOT NULL  DEFAULT 'pending', -- 채널 상태 (아래 ck_collaboration_discord_status)
  ADD COLUMN discord_attempts    SMALLINT      NOT NULL  DEFAULT 0,         -- 채널 만들기 시도 횟수
  ADD COLUMN discord_error       VARCHAR(200)  NULL,                       -- 마지막 실패 이유
  ADD COLUMN discord_retry_at    TIMESTAMPTZ   NOT NULL  DEFAULT now(),     -- 이 시각 이후에 (다시) 만들어요
  ADD CONSTRAINT ck_collaboration_discord_status CHECK (discord_status IN (
    'pending',  -- 만들 차례
    'ready',    -- 채널 있음 (두 사람이 대화 중)
    'failed',   -- 여러 번 실패해서 멈춤 (이유는 discord_error)
    'skipped',  -- 만들지 않음 (이미 끝난 협업 등)
    'closed'    -- 협업이 끝나 읽기 전용으로 바꿈
  )),
  ADD CONSTRAINT uq_collaboration_discord_channel UNIQUE (discord_channel_id);  -- 채널 하나 = 협업 하나

-- 2) 이미 끝난 협업은 채널을 만들지 않아요. (진행 중인 협업은 pending 이라 채널이 생겨요)
UPDATE collaboration SET discord_status = 'skipped' WHERE status <> 'ongoing';

-- 3) 만들 차례인 협업 찾기 (백그라운드 작업이 15초마다)
CREATE INDEX idx_collaboration_discord_pending ON collaboration (discord_retry_at)
  WHERE discord_status = 'pending';