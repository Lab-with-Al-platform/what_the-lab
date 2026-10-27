-- 이미 들어 있는 분류표 v4.0 행의 승인 상태를 active로 맞춥니다.
-- 새 시드는 처음부터 active라서 바뀌는 행이 없을 수 있습니다. 이름과 ID는 바꾸지 않습니다.
UPDATE public.able_work
SET status = 'active'
WHERE taxonomy_ver = '4.0' AND status = 'pending_review';

UPDATE public.field_category
SET status = 'active'
WHERE taxonomy_ver = '4.0' AND status = 'pending_review';

UPDATE public.research_field
SET status = 'active'
WHERE taxonomy_ver = '4.0' AND status = 'pending_review';

-- 017이 적어 둔 개정 번호를 이 변경까지 포함하도록 올립니다.
UPDATE public.insight_alembic_version
SET version_num = '20261028_14'
WHERE version_num = '20261028_13';
