-- build_able_work_seed.py 가 만든 파일입니다. 직접 고치지 말고 스크립트를 다시 실행하세요.
SET NAMES utf8mb4;  -- 한글이 깨지지 않게 utf8mb4로 읽으라고 알려 줍니다.
INSERT INTO able_work (able_work_id, name, sort_order, show_default, status, taxonomy_ver) VALUES
  ('UG01', '데이터 준비·품질', 1, TRUE, 'pending_review', '4.0'),
  ('UG02', '통계·연구설계', 2, TRUE, 'pending_review', '4.0'),
  ('UG03', '예측·일반 머신러닝', 3, TRUE, 'pending_review', '4.0'),
  ('UG04', '이미지·영상 분석', 4, TRUE, 'pending_review', '4.0'),
  ('UG05', '텍스트·문서 분석', 5, TRUE, 'pending_review', '4.0'),
  ('UG06', '음성·멀티모달', 6, TRUE, 'pending_review', '4.0'),
  ('UG07', '시계열·공간·그래프', 7, TRUE, 'pending_review', '4.0'),
  ('UG08', '생성형 AI·지식 활용', 8, FALSE, 'pending_review', '4.0'),
  ('UG09', '최적화·제어·로봇', 9, FALSE, 'pending_review', '4.0'),
  ('UG10', '과학 계산·특화 분석', 10, FALSE, 'pending_review', '4.0'),
  ('UG11', '모델 개발·검증·운영', 11, FALSE, 'pending_review', '4.0');
