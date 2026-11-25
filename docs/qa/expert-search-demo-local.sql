-- WHAT THE LAB / B안 로컬 화면 검수용 가상 전문가 4명
-- 반드시 본인 PC의 Docker "labbridge-postgres"에만 사용. Supabase/공용/운영 DB에는 금지.
-- 이 파일은 자동 마이그레이션이나 Docker init SQL로 실행되지 않습니다.
-- 동일 DB에서 반복 실행해도 계정과 포트폴리오가 중복되지 않도록 구성합니다.
BEGIN;

INSERT INTO users (discord_id, nickname, user_role, signup_step, status)
VALUES
  ('whatlab-ui-demo-01', '[데모] LLM 전문가', 'expert', 'done', 'active'),
  ('whatlab-ui-demo-02', '[데모] 의료 AI 전문가', 'expert', 'done', 'active'),
  ('whatlab-ui-demo-03', '[데모] 비전 전문가', 'expert', 'done', 'active'),
  ('whatlab-ui-demo-04', '[데모] 데이터 전문가', 'expert', 'done', 'active')
ON CONFLICT (discord_id) DO NOTHING;

INSERT INTO expert (user_id, current_job, ai_career, affiliation, introduce, is_public)
SELECT u.user_id, v.job, v.career, v.affiliation, v.intro, TRUE
FROM (VALUES
  ('whatlab-ui-demo-01', 'researcher', '5_10', '시연용 AI 연구실', 'LLM 기반 연구 파이프라인과 RAG 검색 시스템 구축 경험'),
  ('whatlab-ui-demo-02', 'researcher', '3_5', '시연용 의료 AI 랩', '의료영상 분석 및 멀티모달 AI 연구 경험'),
  ('whatlab-ui-demo-03', 'freelancer', '3_5', '시연용 비전 연구팀', '컴퓨터 비전과 딥러닝 모델 최적화 경험'),
  ('whatlab-ui-demo-04', 'employee', '5_10', '시연용 데이터 스튜디오', '데이터 분석과 예측 머신러닝 시스템 설계 경험')
) AS v(discord_id, job, career, affiliation, intro)
JOIN users u ON u.discord_id = v.discord_id
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO expert_able_work (user_id, able_work_id)
SELECT u.user_id, v.work_id
FROM (VALUES
  ('whatlab-ui-demo-01', 'UG08'), ('whatlab-ui-demo-01', 'UG05'),
  ('whatlab-ui-demo-02', 'UG04'), ('whatlab-ui-demo-02', 'UG06'),
  ('whatlab-ui-demo-03', 'UG04'), ('whatlab-ui-demo-03', 'UG11'),
  ('whatlab-ui-demo-04', 'UG01'), ('whatlab-ui-demo-04', 'UG03')
) AS v(discord_id, work_id)
JOIN users u ON u.discord_id = v.discord_id
ON CONFLICT (user_id, able_work_id) DO NOTHING;

INSERT INTO expert_domain (user_id, field_id)
SELECT u.user_id, v.field_id
FROM (VALUES
  ('whatlab-ui-demo-01', 'FIELD020'),
  ('whatlab-ui-demo-02', 'FIELD011'),
  ('whatlab-ui-demo-03', 'FIELD019'),
  ('whatlab-ui-demo-04', 'FIELD061')
) AS v(discord_id, field_id)
JOIN users u ON u.discord_id = v.discord_id
ON CONFLICT (user_id, field_id) DO NOTHING;

INSERT INTO expert_collab_condition (user_id, meeting_type, available_time)
SELECT u.user_id, 'online', '5_10'
FROM users u
WHERE u.discord_id LIKE 'whatlab-ui-demo-%'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO expert_reward (user_id, reward_type)
SELECT u.user_id, 'undecided'
FROM users u
WHERE u.discord_id LIKE 'whatlab-ui-demo-%'
ON CONFLICT (user_id, reward_type) DO NOTHING;

INSERT INTO portfolio (user_id, title, role)
SELECT u.user_id, v.title, v.role
FROM (VALUES
  ('whatlab-ui-demo-01', '시연용 RAG 연구 어시스턴트', '문서 검색과 LLM 파이프라인 구축'),
  ('whatlab-ui-demo-02', '시연용 의료영상 분석', '멀티모달 모델 평가'),
  ('whatlab-ui-demo-03', '시연용 이미지 분할 모델', '컴퓨터 비전 모델 개발'),
  ('whatlab-ui-demo-04', '시연용 금융 데이터 예측', '데이터 품질 검토 및 모델링')
) AS v(discord_id, title, role)
JOIN users u ON u.discord_id = v.discord_id
WHERE NOT EXISTS (
  SELECT 1 FROM portfolio p WHERE p.user_id = u.user_id AND p.title = v.title
);

COMMIT;

-- 네 개가 조회되면 정상. 프론트에서 /experts를 새로 고침하세요.
SELECT COUNT(*) AS local_demo_experts FROM users
WHERE discord_id LIKE 'whatlab-ui-demo-%';
