# 04. 데이터베이스 및 스토리지 아키텍처 (Database & Storage) — 개정판

> **상태**: `[PROPOSED]` (기존 팀 문서 [`docs/development/SHARED_DATABASE_GUIDE.md`](file:///docs/development/SHARED_DATABASE_GUIDE.md) 기반)  
> **핵심 과제**: 1) Supabase 유지 vs EC2 DB 운영 비교 및 선택, 2) DB 커넥션 풀 개선, 3) pgvector 기반 RAG 지원, 4) S3 파일 스토리지 완전 전환.

---

## 1. 데이터베이스 운영 방식 상세 기술 분석

### 1.1 안 A: 기존 팀 공용 Supabase PostgreSQL 유지
- **접속 방식**:
  - `DATABASE_URL`에 Supabase Session Pooler(`5432`) 주소 사용 (`[CONFIRMED: SHARED_DATABASE_GUIDE.md#L39]`).
  - 연결 시 `sslmode=require` 필수 적용.
- **보안 및 권한**:
  - FastAPI 서버만 신뢰된 직접 연결(`postgres` 롤)을 맺으며, 일반 브라우저는 DB에 직접 접근 불가 (`anon/authenticated` RLS 차단 완료).
- **운영 시 주의사항**:
  - ⚠️ **무료 티어 Pause 방지**: Supabase 무료 프로젝트는 7일간 쿼리가 없으면 프로젝트가 일시 중지(Pause)됩니다. 서비스 운영 환경에서는 FastAPI의 `daily_forever()` 워커나 외부 모니터링 핑을 통해 정기적인 경량 쿼리를 유지하거나, 상용 전환 시 **Supabase Pro ($25/월)** 업그레이드를 권장합니다.

### 1.2 안 B: EC2 내부 Docker PostgreSQL 운영
- **이미지**: `pgvector/pgvector:pg17` (PostgreSQL 17 + pgvector 내장)
- **자원 할당**: 메모리 Limit `1.2GB`, `shared_buffers = 512MB`
- **Supabase에서 EC2로의 데이터 마이그레이션 절차**:
  1. Supabase Session Pooler에서 덤프 추출:
     ```bash
     pg_dump "postgresql://postgres.[PROJECT]:[PW]@[HOST]:5432/postgres?sslmode=require" \
       --clean --if-exists --no-owner --no-privileges -F c -f /tmp/supabase_migration.dump
     ```
  2. EC2 내부 Docker PostgreSQL 컨테이너로 복원:
     ```bash
     docker exec -i labbridge-postgres pg_restore -U admin -d labbridge -v /tmp/supabase_migration.dump
     ```
  3. Alembic 버전 일치 확인: `alembic current`가 최신 head `20261104_27`을 가리키는지 검증.

---

## 2. DB 커넥션 풀 (Connection Pool) 개선안

현재 코드는 요청마다 `psycopg.connect()`를 열고 닫는 무풀링 방식입니다 (`[CONFIRMED: backend/app/db.py#L11]`).

- **개선안**:
  - FastAPI 수명주기(`lifespan`) 시작 시 `psycopg_pool.ConnectionPool`을 초기화 (`min_size=4, max_size=15`).
  - Supabase Session Pooler와 EC2 내부 Docker PostgreSQL 양쪽 모두에서 커넥션 오버헤드를 80% 이상 제거.

---

## 3. pgvector 기반 RAG 임베딩 스키마

AI 챗봇 및 논문/사례 검색을 위해 신설할 벡터 테이블 스키마:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.document_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(32) NOT NULL, -- 'case', 'trend', 'paper'
    source_id VARCHAR(128) NOT NULL,   -- slug 또는 식별자
    chunk_index INT NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(1536) NOT NULL,   -- Titan Text 또는 OpenAI 호환
    metadata JSONB DEFAULT '{}'::jsonb, -- 공개여부, 권한, 키워드ID
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 코사인 유사도 검색용 HNSW 인덱스
CREATE INDEX IF NOT EXISTS idx_doc_embed_hnsw 
ON public.document_embeddings USING hnsw (embedding vector_cosine_ops);
```

---

## 4. Amazon S3 파일 스토리지 아키텍처

로컬 `backend/uploads/` 저장 방식을 S3 버킷(`whatthelab-storage-apne2-prod`)으로 전면 전환합니다.

- **업로드 흐름**:
  1. 클라이언트가 파일 메타데이터(파일명, 용량, 타입)를 백엔드에 전달.
  2. 백엔드는 MIME 타입 및 용량(이미지 5MB, PDF 20MB 제한)을 검증 후 S3 `PutObject` Presigned URL(유효기간 15분) 발급.
  3. 클라이언트가 S3로 파일 직접 바이너리 PUT 전송.
- **다운로드 및 열람 흐름**:
  - **프로필 사진**: S3 공개 객체 설정 + CloudFront 캐싱 서빙.
  - **전문가 포트폴리오 PDF**: S3 퍼블릭 완전 차단 + 세션 권한 검증 후 10분 유효 `GetObject` Presigned URL 발급.

---

## 5. 백업 및 재해 복구(DR) 자동화

- **일일 백업 스크립트 (`/opt/scripts/backup_db.sh`)**:
  - 매일 새벽 04:00 (KST)에 Docker DB(또는 Supabase) 덤프 생성 후 S3의 `backups/database/` 폴더로 즉시 업로드.
  - S3 수명주기(Lifecycle): 30일 후 Glacier 전환, 180일 후 자동 삭제.
- **실제 복원 테스트 필수**:
  - 백업 파일만 쌓아두지 않고, 월 1회 임시 컨테이너에서 덤프 파일을 복원하여 테이블 무결성과 레코드 건수를 자동 검증하는 스크립트 구비.
