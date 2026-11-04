-- Disposable PostgreSQL CI fixture only. Must never be run on a real database.
-- Add public flags required by the exact production LAB TRUST eligibility query.
ALTER TABLE public.expert ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
INSERT INTO public.users(user_id) VALUES (31),(32),(33),(40);
INSERT INTO public.expert(user_id,is_public) VALUES (40,FALSE);
INSERT INTO public.research(research_id,user_id) VALUES (131,31),(132,32),(133,33),(134,10);
INSERT INTO public.collaboration(collaboration_id,research_id,expert_id,status,ended_at)
VALUES
 (301,131,20,'done',now()-interval '12 days'),
 (302,132,20,'done',now()-interval '11 days'),
 (303,100,20,'done',now()-interval '14 days'),
 (304,100,20,'done',now()-interval '15 days'),
 (305,100,20,'done',now()-interval '16 days'),
 (306,133,20,'done',now()-interval '2 days'),
 (307,133,20,'ended_early',now()-interval '20 days'),
 (308,131,20,'done',now()-interval '20 days');
-- 10 has 4 collaboration reviews, so only 3 most recent contribute.
INSERT INTO public.collaboration_review
 (collaboration_id,reviewer_id,reviewee_id,reviewer_side,expertise,communication,timeliness,quality,comment,visibility)
VALUES
 (301,31,20,'researcher',5,5,5,5,'researcher 31','visible'),
 (302,32,20,'researcher',5,5,5,5,'researcher 32','visible'),
 (303,10,20,'researcher',5,5,5,5,'same reviewer 1','visible'),
 (304,10,20,'researcher',5,5,5,5,'same reviewer 2','visible'),
 (305,10,20,'researcher',5,5,5,5,'same reviewer 3','visible'),
 (306,33,20,'researcher',1,1,1,1,'not released yet','visible'),
 (307,33,20,'researcher',1,1,1,1,'ended early','visible'),
 (308,31,20,'researcher',1,1,1,1,'moderated hidden','hidden');
