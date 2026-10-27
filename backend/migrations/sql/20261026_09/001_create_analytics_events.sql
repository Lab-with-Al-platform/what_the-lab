-- 방문·글 이동·등록 과정의 허용 사건만 저장합니다.
-- 회원 번호, Discord, 이메일, 연구 본문은 두지 않습니다.
-- 세션 번호는 페이지 방문과 글 조회에만 있고, 등록 사건에는 없습니다.
CREATE TABLE public.analytics_events (
  event_id      VARCHAR(36)  NOT NULL,
  event_name    VARCHAR(40)  NOT NULL,
  target        VARCHAR(80)  NOT NULL,
  session_id    VARCHAR(36),
  attempt_id    VARCHAR(36),
  mode          VARCHAR(16),
  result_code   VARCHAR(40),
  reason_code   VARCHAR(32),
  research_id   BIGINT,
  received_at   TIMESTAMPTZ  NOT NULL,
  CONSTRAINT pk_analytics_events PRIMARY KEY (event_id),
  CONSTRAINT ck_analytics_events_name CHECK (event_name IN (
    'page_view', 'article_view', 'expert_search_click', 'related_article_open',
    'registration_open', 'registration_step', 'registration_advance',
    'registration_validation_failed', 'registration_save', 'registration_close',
    'registration_completed'
  )),
  CONSTRAINT ck_analytics_events_session CHECK (
    (event_name IN ('page_view', 'article_view') AND session_id IS NOT NULL)
    OR (event_name NOT IN ('page_view', 'article_view') AND session_id IS NULL)
  ),
  CONSTRAINT ck_analytics_events_attempt CHECK (
    (
      event_name = 'registration_completed'
      AND research_id IS NOT NULL
      AND session_id IS NULL
    )
    OR (
      event_name IN (
        'registration_open', 'registration_step', 'registration_advance',
        'registration_validation_failed', 'registration_save', 'registration_close'
      )
      AND attempt_id IS NOT NULL
      AND session_id IS NULL
    )
    OR (
      event_name IN ('page_view', 'article_view', 'expert_search_click', 'related_article_open')
      AND attempt_id IS NULL
      AND research_id IS NULL
    )
  )
);

-- 더할 수 있는 횟수만 일별로 모읍니다. 고유 세션 수는 이 표를 합쳐 만들지 않습니다.
CREATE TABLE public.analytics_event_daily (
  event_name    VARCHAR(40) NOT NULL,
  target        VARCHAR(80) NOT NULL,
  event_date    DATE        NOT NULL,
  event_count   INTEGER     NOT NULL,
  CONSTRAINT pk_analytics_event_daily PRIMARY KEY (event_name, target, event_date)
);

CREATE INDEX ix_analytics_events_page_received
  ON public.analytics_events (received_at)
  WHERE event_name = 'page_view';
