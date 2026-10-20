-- 연구회원 "내 연구"에 필요한 테이블입니다. 001, 004 다음에 실행됩니다.
SET NAMES utf8mb4;  -- 한글 COMMENT가 깨지지 않게

-- 1) 연구: researcher_profile 1 : N (연구회원만 쓸 수 있게 researcher_profile을 참조)
CREATE TABLE research (
  research_id      BIGINT        NOT NULL AUTO_INCREMENT,
  user_id          BIGINT        NOT NULL,
  status           VARCHAR(20)   NOT NULL  DEFAULT 'draft' COMMENT 'draft=임시 저장 / registered=등록',
  is_primary       BOOLEAN       NOT NULL  DEFAULT FALSE  COMMENT '지정한 연구 (한 사람당 1개, API에서 관리)',
  title            VARCHAR(60)   NOT NULL  COMMENT '연구 제목',
  description      VARCHAR(500)  NULL      COMMENT '연구 내용 (임시 저장이면 비어 있을 수 있음)',
  data_status      VARCHAR(20)   NULL      COMMENT 'none / collecting / raw / ready',
  share_policy     VARCHAR(20)   NULL      COMMENT 'open=외부 공유 가능 / conditional=조건 있음',
  share_condition  VARCHAR(100)  NULL      COMMENT 'conditional일 때 조건 설명',
  task_unsure      BOOLEAN       NOT NULL  DEFAULT FALSE  COMMENT 'AI에게 맡길 일 "잘 모르겠어요"',
  meeting_type     VARCHAR(20)   NULL      COMMENT 'online / offline_ok (선택)',
  face_to_area     VARCHAR(50)   NULL      COMMENT 'offline_ok일 때 지역',
  created_at       DATETIME      NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (research_id),
  KEY idx_research_user (user_id),
  CONSTRAINT fk_research_researcher FOREIGN KEY (user_id) REFERENCES researcher_profile(user_id) ON DELETE CASCADE
);

-- 1-1) 연구 분야: research 1 : N (분류표 FIELD, 최대 3개는 API에서 검사)
--      기준표 이름이 research_field라서, 고른 값은 research_domain으로 둡니다. (전문가의 domain과 같은 기준)
CREATE TABLE research_domain (
  research_domain_id  BIGINT       NOT NULL AUTO_INCREMENT,
  research_id         BIGINT       NOT NULL,
  field_id            VARCHAR(10)  NOT NULL  COMMENT 'research_field.field_id (예: FIELD002)',
  PRIMARY KEY (research_domain_id),
  UNIQUE KEY uq_research_domain (research_id, field_id),
  CONSTRAINT fk_rdomain_research FOREIGN KEY (research_id) REFERENCES research(research_id) ON DELETE CASCADE,
  CONSTRAINT fk_rdomain_field    FOREIGN KEY (field_id) REFERENCES research_field(field_id)
);

-- 1-2) AI에게 맡기고 싶은 일: research 1 : N (분류표 UG, 최대 3개는 API에서 검사)
CREATE TABLE research_able_work (
  research_able_work_id  BIGINT       NOT NULL AUTO_INCREMENT,
  research_id            BIGINT       NOT NULL,
  able_work_id           VARCHAR(10)  NOT NULL  COMMENT 'able_work.able_work_id (예: UG04)',
  PRIMARY KEY (research_able_work_id),
  UNIQUE KEY uq_research_able_work (research_id, able_work_id),
  CONSTRAINT fk_rwork_research FOREIGN KEY (research_id) REFERENCES research(research_id) ON DELETE CASCADE,
  CONSTRAINT fk_rwork_code     FOREIGN KEY (able_work_id) REFERENCES able_work(able_work_id)
);

-- 1-3) 데이터 종류: research 1 : N
CREATE TABLE research_data_type (
  research_data_type_id  BIGINT       NOT NULL AUTO_INCREMENT,
  research_id            BIGINT       NOT NULL,
  data_type              VARCHAR(20)  NOT NULL  COMMENT 'image / text / table / audio / etc',
  PRIMARY KEY (research_data_type_id),
  UNIQUE KEY uq_research_data_type (research_id, data_type),
  CONSTRAINT fk_rdata_research FOREIGN KEY (research_id) REFERENCES research(research_id) ON DELETE CASCADE
);

-- 1-4) 원하는 결과물: research 1 : N
CREATE TABLE research_output (
  research_output_id  BIGINT       NOT NULL AUTO_INCREMENT,
  research_id         BIGINT       NOT NULL,
  output_type         VARCHAR(20)  NOT NULL  COMMENT 'analysis / model / tool / figure / unknown',
  PRIMARY KEY (research_output_id),
  UNIQUE KEY uq_research_output (research_id, output_type),
  CONSTRAINT fk_routput_research FOREIGN KEY (research_id) REFERENCES research(research_id) ON DELETE CASCADE
);

-- 1-5) 보상 형태: research 1 : N (선택, 전문가 reward와 같은 코드)
CREATE TABLE research_reward (
  research_reward_id  BIGINT       NOT NULL AUTO_INCREMENT,
  research_id         BIGINT       NOT NULL,
  reward_type         VARCHAR(20)  NOT NULL  COMMENT 'research_fund / authorship / undecided',
  PRIMARY KEY (research_reward_id),
  UNIQUE KEY uq_research_reward (research_id, reward_type),
  CONSTRAINT fk_rreward_research FOREIGN KEY (research_id) REFERENCES research(research_id) ON DELETE CASCADE
);