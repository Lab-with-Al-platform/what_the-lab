-- CI-only structural stub: not the application's full schema or a production migration.
-- Run against a fresh throwaway PostgreSQL 17 database, never existing user records.
CREATE TABLE public.users (user_id BIGINT PRIMARY KEY);
CREATE TABLE public.expert (user_id BIGINT PRIMARY KEY REFERENCES public.users(user_id));
CREATE TABLE public.research (research_id BIGINT PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES public.users(user_id));
CREATE TABLE public.collaboration (
  collaboration_id BIGINT PRIMARY KEY,
  research_id BIGINT NOT NULL REFERENCES public.research(research_id),
  expert_id BIGINT NOT NULL REFERENCES public.expert(user_id),
  status VARCHAR(20) NOT NULL,
  ended_at TIMESTAMPTZ
);
CREATE TABLE public.notification (
  notification_id BIGINT PRIMARY KEY,
  type VARCHAR(30) NOT NULL,
  CONSTRAINT ck_notification_type CHECK (type IN (
    'request_received','request_accepted','request_rejected','request_canceled',
    'request_expired','collab_started'))
);
INSERT INTO public.users (user_id) VALUES (10),(20),(30);
INSERT INTO public.expert (user_id) VALUES (20);
INSERT INTO public.research (research_id,user_id) VALUES (100,10);
INSERT INTO public.collaboration (collaboration_id,research_id,expert_id,status,ended_at)
VALUES (300,100,20,'done',now()-interval '10 days');
