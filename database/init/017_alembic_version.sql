-- 로컬 Docker의 개정 책갈피를 공용 DB와 같게 적습니다. 표 안의 글·회원·기록은 복사하지 않습니다.
-- 이 번호가 있으면 같은 DB에 Alembic 01부터 다시 실행하지 않습니다.
CREATE TABLE public.insight_alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT insight_alembic_version_pkc PRIMARY KEY (version_num)
);
INSERT INTO public.insight_alembic_version (version_num) VALUES ('20261028_13');
