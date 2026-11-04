-- Must run only against throwaway review_schema_smoke schema after migration DDL.
INSERT INTO public.collaboration_review
(collaboration_id,reviewer_id,reviewee_id,reviewer_side,expertise,communication,timeliness,quality,comment)
VALUES
(300,10,20,'researcher',4,5,4,5,'valid example'),
(300,20,10,'expert',5,4,5,4,'private bilateral feedback');
INSERT INTO public.collaboration_review_report(review_id,reporter_id,reason)
SELECT review_id,30,'false_claim' FROM public.collaboration_review WHERE reviewer_side='researcher';

DO $checks$ DECLARE review_count INTEGER; report_count INTEGER; BEGIN
  SELECT count(*) INTO review_count FROM public.collaboration_review;
  SELECT count(*) INTO report_count FROM public.collaboration_review_report;
  IF review_count != 2 OR report_count != 1 THEN
    RAISE EXCEPTION 'Review schema CRUD smoke failed: %, %', review_count,report_count;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.collaboration_review'::regclass AND relrowsecurity) THEN
    RAISE EXCEPTION 'Review RLS missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.collaboration_review_report'::regclass AND relrowsecurity) THEN
    RAISE EXCEPTION 'Report RLS missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='uq_review_collaboration_reviewer' AND contype='u'
  ) THEN RAISE EXCEPTION 'Unique reviewer constraint missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='ck_notification_type'
      AND pg_get_constraintdef(oid) LIKE '%review_ready%'
  ) THEN RAISE EXCEPTION 'Review notification type missing'; END IF;

  BEGIN
    INSERT INTO public.collaboration_review
    (collaboration_id,reviewer_id,reviewee_id,reviewer_side,expertise,communication,timeliness,quality)
    VALUES (300,10,20,'researcher',5,5,5,5);
    RAISE EXCEPTION 'Duplicate rating unexpectedly accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.collaboration_review
    (collaboration_id,reviewer_id,reviewee_id,reviewer_side,expertise,communication,timeliness,quality)
    VALUES (300,30,20,'researcher',0,5,5,5);
    RAISE EXCEPTION 'Out-of-bounds rating unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $checks$;
