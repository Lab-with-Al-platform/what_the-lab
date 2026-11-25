-- 분류표 v4.0 승인 상태를 이미 들어 있는 기준표에 맞춥니다.
-- 이름과 ID는 바꾸지 않고, 검토 중으로 남은 행만 운영 승인으로 바꿉니다.
UPDATE public.able_work
SET status = 'active'
WHERE taxonomy_ver = '4.0' AND status = 'pending_review';

UPDATE public.field_category
SET status = 'active'
WHERE taxonomy_ver = '4.0' AND status = 'pending_review';

UPDATE public.research_field
SET status = 'active'
WHERE taxonomy_ver = '4.0' AND status = 'pending_review';
