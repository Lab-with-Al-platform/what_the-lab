-- AI 전문가 내 이력(프로필)에 필요한 테이블입니다. 001 다음에 실행됩니다.
SET NAMES utf8mb4;  -- 한글 COMMENT가 깨지지 않게

-- 1) 연구 분야 대분류 기준표: 택소노미 v4 F01~F10 (데이터는 005 시드)
CREATE TABLE field_category (
  field_category_id  VARCHAR(10)  NOT NULL  COMMENT '택소노미 대분류 ID (F01 ~ F10)',
  name               VARCHAR(50)  NOT NULL  COMMENT '화면 이름 (예: 의학·보건·약학)',
  sort_order         INT          NOT NULL  COMMENT '표시 순서',
  status             VARCHAR(20)  NOT NULL  DEFAULT 'pending_review' COMMENT 'pending_review / active / retired',
  taxonomy_ver       VARCHAR(10)  NOT NULL  COMMENT '분류표 버전 (예: 4.0)',
  PRIMARY KEY (field_category_id)
);

-- 2) 세부 연구 분야 기준표: 택소노미 v4 FIELD001~FIELD083 (데이터는 005 시드)
CREATE TABLE research_field (
  field_id           VARCHAR(10)  NOT NULL  COMMENT '택소노미 FIELD ID (FIELD001 ~ FIELD083)',
  field_category_id  VARCHAR(10)  NOT NULL  COMMENT 'field_category.field_category_id',
  name               VARCHAR(50)  NOT NULL  COMMENT '화면 이름 (예: 의료영상·영상의학)',
  sort_order         INT          NOT NULL  COMMENT '대분류 안에서의 표시 순서',
  status             VARCHAR(20)  NOT NULL  DEFAULT 'pending_review' COMMENT 'pending_review / active / retired',
  taxonomy_ver       VARCHAR(10)  NOT NULL  COMMENT '분류표 버전 (예: 4.0)',
  PRIMARY KEY (field_id),
  CONSTRAINT fk_research_field_category FOREIGN KEY (field_category_id) REFERENCES field_category(field_category_id)
);

-- 3) 도메인: 전문가가 다뤄 본 연구 분야 (expert 1 : N, 최대 5개는 API에서 검사)
CREATE TABLE domain (
  domain_id  BIGINT       NOT NULL AUTO_INCREMENT,
  user_id    BIGINT       NOT NULL,
  field_id   VARCHAR(10)  NOT NULL  COMMENT 'research_field.field_id (예: FIELD011)',
  PRIMARY KEY (domain_id),
  UNIQUE KEY uq_domain (user_id, field_id),
  CONSTRAINT fk_domain_expert FOREIGN KEY (user_id) REFERENCES expert(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_domain_field  FOREIGN KEY (field_id) REFERENCES research_field(field_id)
);

-- 4) 협업 조건: expert 1 : 1
CREATE TABLE collaboration (
  user_id         BIGINT       NOT NULL,
  meeting_type    VARCHAR(20)  NOT NULL  COMMENT 'online / offline_ok',
  face_to_area    VARCHAR(50)  NULL      COMMENT '대면 가능 지역. 온라인만이면 NULL',
  available_time  VARCHAR(20)  NOT NULL  COMMENT 'lt5 / 5_10 / gt10 (주당 가능 시간)',
  created_at      DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_collaboration_expert FOREIGN KEY (user_id) REFERENCES expert(user_id) ON DELETE CASCADE
);

-- 5) 희망 보상: expert 1 : N (여러 개 선택)
CREATE TABLE reward (
  reward_id    BIGINT       NOT NULL AUTO_INCREMENT,
  user_id      BIGINT       NOT NULL,
  reward_type  VARCHAR(20)  NOT NULL  COMMENT 'research_fund / authorship / undecided',
  PRIMARY KEY (reward_id),
  UNIQUE KEY uq_reward (user_id, reward_type),
  CONSTRAINT fk_reward_expert FOREIGN KEY (user_id) REFERENCES expert(user_id) ON DELETE CASCADE
);

-- 6) 포트폴리오: expert 1 : N
CREATE TABLE portfolio (
  portfolio_id  BIGINT        NOT NULL AUTO_INCREMENT,
  user_id       BIGINT        NOT NULL,
  title         VARCHAR(60)   NOT NULL  COMMENT '무엇을 만들었나요',
  role          VARCHAR(200)  NOT NULL  COMMENT '내 역할',
  pdf_url       VARCHAR(500)  NULL      COMMENT '포트폴리오 PDF 주소 (파일 저장소를 정한 뒤 사용)',
  created_at    DATETIME      NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (portfolio_id),
  CONSTRAINT fk_portfolio_expert FOREIGN KEY (user_id) REFERENCES expert(user_id) ON DELETE CASCADE
);

-- 6-1) 포트폴리오에서 AI로 한 일: portfolio 1 : N
CREATE TABLE portfolio_able_work (
  portfolio_able_work_id  BIGINT       NOT NULL AUTO_INCREMENT,
  portfolio_id            BIGINT       NOT NULL,
  able_work_id            VARCHAR(10)  NOT NULL  COMMENT 'able_work.able_work_id (예: UG04)',
  PRIMARY KEY (portfolio_able_work_id),
  UNIQUE KEY uq_portfolio_able_work (portfolio_id, able_work_id),
  CONSTRAINT fk_pf_work_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolio(portfolio_id) ON DELETE CASCADE,
  CONSTRAINT fk_pf_work_code      FOREIGN KEY (able_work_id) REFERENCES able_work(able_work_id)
);

-- 6-2) 포트폴리오 사용 기술: portfolio 1 : N (자유 입력)
CREATE TABLE portfolio_skill (
  portfolio_skill_id  BIGINT       NOT NULL AUTO_INCREMENT,
  portfolio_id        BIGINT       NOT NULL,
  skill_name          VARCHAR(30)  NOT NULL  COMMENT '예: PyTorch',
  PRIMARY KEY (portfolio_skill_id),
  UNIQUE KEY uq_portfolio_skill (portfolio_id, skill_name),
  CONSTRAINT fk_pf_skill_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolio(portfolio_id) ON DELETE CASCADE
);

-- 7) 경력: expert 1 : N
CREATE TABLE career (
  career_id    BIGINT       NOT NULL AUTO_INCREMENT,
  user_id      BIGINT       NOT NULL,
  company      VARCHAR(50)  NULL      COMMENT '회사·기관명 (밝히기 싫으면 NULL)',
  job          VARCHAR(50)  NOT NULL  COMMENT '직무',
  start_month  CHAR(7)      NOT NULL  COMMENT '시작 연월 (YYYY-MM)',
  end_month    CHAR(7)      NULL      COMMENT '종료 연월 (YYYY-MM). 재직 중이면 NULL',
  created_at   DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (career_id),
  CONSTRAINT fk_career_expert FOREIGN KEY (user_id) REFERENCES expert(user_id) ON DELETE CASCADE
);

-- 8) 학력: expert 1 : N
CREATE TABLE education (
  education_id    BIGINT       NOT NULL AUTO_INCREMENT,
  user_id         BIGINT       NOT NULL,
  school          VARCHAR(50)  NOT NULL  COMMENT '학교',
  major           VARCHAR(50)  NOT NULL  COMMENT '전공·학위 (예: 컴퓨터공학 석사)',
  graduated_year  CHAR(4)      NULL      COMMENT '졸업 연도 (YYYY)',
  created_at      DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (education_id),
  CONSTRAINT fk_education_expert FOREIGN KEY (user_id) REFERENCES expert(user_id) ON DELETE CASCADE
);

-- 9) 자격증: expert 1 : N
CREATE TABLE certificate (
  certificate_id  BIGINT       NOT NULL AUTO_INCREMENT,
  user_id         BIGINT       NOT NULL,
  name            VARCHAR(50)  NOT NULL  COMMENT '자격증 이름',
  issuer          VARCHAR(50)  NULL      COMMENT '발급 기관',
  acquired_year   CHAR(4)      NULL      COMMENT '취득 연도 (YYYY)',
  created_at      DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (certificate_id),
  CONSTRAINT fk_certificate_expert FOREIGN KEY (user_id) REFERENCES expert(user_id) ON DELETE CASCADE
);