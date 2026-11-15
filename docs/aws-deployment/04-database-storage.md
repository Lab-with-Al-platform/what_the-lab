# 04. 데이터베이스 및 스토리지 (Database & Storage) — v4

> **상태**: `[PROPOSED]` (근거: [`docs/development/SHARED_DATABASE_GUIDE.md`](../development/SHARED_DATABASE_GUIDE.md), `backend/migrations/`)
> **핵심 결정**: 운영 DB = **Amazon RDS PostgreSQL** (개발 DB = 공용 Supabase `labbridge-dev` 그대로)

---

## 1. 개발 DB와 운영 DB를 나누는 이유

| | 개발 DB (지금) | 운영 DB (v3) |
|---|---|---|
| 위치 | Supabase `labbridge-dev` (Session Pooler 5432) | RDS PostgreSQL 17, 서울, 비공개 서브넷 |
| 누가 쓰나 | 팀원 로컬, 테스트, 시연 준비 | 실제 회원만 (EC2의 backend·discord-bot) |
| 데이터 | 테스트·샘플 데이터 | 실제 회원·협업 데이터 |
| 백업 | Supabase Free는 **자동 백업 없음** `[CONFIRMED: supabase.com/pricing 2026-11]` | RDS 자동 백업 7일 + 시점 복원(PITR) |
| 멈춤 위험 | Free는 1주 비활성 시 일시정지 `[CONFIRMED]` | 없음 |

- 팀원이 실수로 지운 테스트 데이터가 실제 회원 데이터면 안 되기 때문에 **운영은 별도 DB**가 원칙이에요.
- 운영 DB 접속 정보(`DATABASE_URL`)는 **DB 담당자와 배포 담당자만** 알고 SSM에만 저장해요.

---

## 2. RDS 설정안

| 항목 | 값 | 비고 |
|---|---|---|
| 엔진 | PostgreSQL 17 | 로컬 Docker·CI와 같은 메이저 버전 |
| 인스턴스 | `db.t4g.micro` (2 vCPU, 1GiB) | $0.025/시간 → 월 $18.25 `[CONFIRMED: Price List 2026-10-29]` |
| 배포 | Single-AZ, ap-northeast-2a | EC2와 같은 AZ |
| 스토리지 | gp3 20GB | $0.131/GB-월 → $2.62 `[CONFIRMED]` |
| 자동 백업 | 7일 보관 | 백업 저장량이 DB 크기 이하이면 추가 요금 없음 `[UNVERIFIED]` |
| 퍼블릭 접근 | 끔 | [03](03-network-security.md) 2.2 |
| 연결 | `sslmode=require` | `DATABASE_URL`에 포함 |
| 삭제 방지 | Deletion protection 켬 | 실수 삭제 방지 |

- **연결 수**: 지금 코드는 요청마다 연결을 열고 닫아요(`backend/app/db.py`). 1GiB 인스턴스의 기본 `max_connections`는 약 100개 수준 `[UNVERIFIED]`이라 초기 규모에는 충분해요. 커넥션 풀(`psycopg_pool`)은 트래픽이 늘면 도입해요.
- **pgvector**: RDS PostgreSQL에서 확장으로 지원돼요 `[UNVERIFIED: 버전별 확인]`. AI 기능은 MVP+라 첫 배포에서는 만들지 않아요.

---

## 3. 마이그레이션 규칙 (배포보다 먼저)

### 3.1 원칙
> **"마이그레이션 적용 → 버전 확인 → 코드 배포"** 순서를 개발 DB와 운영 DB 모두에 똑같이 지켜요.
> 2026-11에 공용 DB에 마이그레이션이 덜 적용된 상태로 코드가 배포돼 특정 API만 503이 난 일이 있었어요.

### 3.2 운영 배포 때 명령 (EC2에서)
```bash
# 1) 새 이미지로 마이그레이션만 먼저 실행 (backend 이미지에 alembic.ini·migrations 포함 [CONFIRMED: backend/Dockerfile])
docker compose -f docker-compose.prod.yml run --rm backend alembic upgrade head

# 2) 운영 DB 버전이 코드의 head와 같은지 확인
docker compose -f docker-compose.prod.yml run --rm backend alembic current
docker compose -f docker-compose.prod.yml run --rm backend alembic heads

# 3) 같을 때만 컨테이너 교체 (10번 런북 2절)
```
- 버전 표는 호환을 위해 `insight_alembic_version`을 써요 (`backend/migrations/env.py`).
- 코드의 최신 head: **`20261104_27`** (2026-11-06 저장소 기준). 공용 개발 DB가 이보다 뒤처져 있으면(예: `20261101_23`) 24~27번을 먼저 적용해야 해요. 실제 DB 버전은 DB 담당자가 확인해요 `[UNVERIFIED]`.

### 3.3 빈 운영 DB를 처음 만들 때
- `database/init/*.sql`은 **로컬 Docker 빈 DB용**이에요. 운영 RDS에는 쓰지 않고 **`alembic upgrade head`로 처음부터** 만들어요.
- 첫 리비전 `20261021_02`가 SQL 묶음을 그대로 실행하고, Supabase 전용 역할(`anon` 등) 처리는 `IF EXISTS`로 감싸져 있어요 `[CONFIRMED: migrations 코드]`. 그래서 RDS에서도 될 가능성이 높지만, **배포 전에 빈 PostgreSQL 17 컨테이너에서 리허설**해서 init SQL로 만든 스키마와 테이블 수·컬럼이 같은지 비교해야 해요 `[UNVERIFIED]`.

### 3.4 개발 데이터를 옮길까?
- 기본안: **옮기지 않고 빈 운영 DB로 시작**해요 (테스트 데이터가 섞이지 않게).
- 키워드 마스터·인사이트 공개본처럼 운영에 꼭 필요한 기준 데이터만 스크립트로 넣어요. 무엇을 넣을지는 팀이 목록으로 정해요 `[PROPOSED]`.
- 만약 Supabase에서 통째로 옮겨야 한다면: Supabase 전용 스키마(`auth`, `storage` 등)는 빼고 `public`, `insight_private` 등 우리 스키마만 `--schema`로 지정해 `pg_dump -F c` → EC2에서 `pg_restore -d "$DATABASE_URL"` (파일은 EC2 호스트에 두고 실행). v2 문서의 `docker exec ... pg_restore /tmp/파일` 명령은 파일이 컨테이너 안에 없어서 실패해요.

---

## 4. 백업과 복원

| 대상 | 방법 | 보관 | 비용 |
|---|---|---|---|
| 운영 DB | RDS 자동 백업 + PITR | 7일 | 대부분 무료 범위 `[UNVERIFIED]` |
| 운영 DB (장기) | 주 1회 `pg_dump -F c` → S3 | 90일 후 삭제 (Lifecycle) | S3 $0.025/GB-월 `[CONFIRMED]` |
| 업로드 파일 | 매일 `aws s3 sync /var/lib/docker/volumes/...uploads` → S3 | 버전 관리 30일 | 용량에 비례 |
| EC2 디스크 | 필요 없음 (서버는 다시 만들면 됨) | — | — |

- **복원 테스트를 월 1회**: 최신 덤프를 임시 Postgres 컨테이너에 `pg_restore`하고 주요 테이블 행 수를 비교해요. 백업은 "복원해 봤을 때"만 백업이에요.
- Glacier 전환은 쓰지 않아요. 파일이 작아서 절약액보다 최소 보관 기간·요청 요금이 더 신경 쓰여요.

---

## 5. 파일 저장 (업로드)

- **현재 코드**: 업로드는 서버 디스크(`UPLOAD_DIR`, compose의 `backend_uploads` 볼륨)에 저장해요 `[CONFIRMED]`. 백엔드에 S3 SDK(`boto3`)는 없어요.
- **첫 배포**: EBS 볼륨에 그대로 두고 매일 S3로 백업해요.
- 프론트 정적 파일용 S3 버킷과 사용자 업로드 파일은 별개예요. 프론트 버킷에 업로드 파일을 섞지 않아요.
- **다음 단계 `[PROPOSED]`**: S3 Presigned URL 업로드(이미지 5MB, PDF 20MB 제한, PDF는 비공개 + 10분 링크)로 바꾸는 건 **앱 코드 변경**이 필요한 별도 PR이에요.

---

## 6. 로컬에서 운영 RDS에 접속하기 (v4, 강사님 피드백)

터널 여는 방법은 [03](03-network-security.md) 2.3절에 있어요. 이 절은 **누가 무엇을 해도 되는지**를 정해요.

| 상황 | 쓰는 DB | 경로 | 계정 |
|---|---|---|---|
| 평소 기능 개발 | 공용 Supabase `labbridge-dev` | 지금과 같음 | 개발 계정 |
| 운영 데이터 확인 | 운영 RDS | SSM 터널 | **조회 전용** 계정 (`labbridge_readonly`) |
| 운영 스키마 문제 분석 | 운영 RDS | SSM 터널 | DB 담당자 계정, 두 사람이 확인 |

- **운영 마이그레이션은 기본적으로 EC2에서** 실행해요 ([10](10-operations-runbook.md) 1절). 터널이 끊기면 중간에 멈출 수 있기 때문이에요.
- **로컬 backend는 운영 DB에 붙이지 않아요**: 예약 작업이 함께 시작돼서 운영 backend가 2개 있는 상태가 돼요.
- 터널로 접속할 때 `sslmode=require`는 그대로 쓸 수 있고, 주소까지 검사하는 `verify-full`은 `localhost` 때문에 실패할 수 있어요 `[UNVERIFIED]`.
- **강사님 답변 (2026-11-10, [15](15-instructor-feedback-20261110.md) #2)**: 운영은 RDS, 개발은 무료 DB(공용 Supabase)로 나누는 생각은 괜찮다. 다만 **팀원마다 개발 DB가 다르면 문제**가 생기니 하나의 개발 DB를 유지하고, 데이터를 최신으로 합쳐 두라.
  - 그래서 v4에서 제안했던 RDS 안의 별도 테스트 DB(`labbridge_test`)는 **보류**해요.
  - 팀원 로컬 개발은 **모두 공용 Supabase `labbridge-dev`** 하나를 써요. 개인 로컬 Docker DB는 빠른 실험용으로만 써요.
  - **개발 DB 최신화**: 마이그레이션은 개발 DB에 먼저 적용(지금 규칙), 시연·테스트용 기준 데이터(키워드, 공개 인사이트, 샘플 회원·협업)는 `data/`의 가상 데이터로 다시 넣을 수 있게 스크립트로 관리해요 `[PROPOSED]`. 실제 운영 회원 데이터는 개발 DB로 복사하지 않아요 (AGENTS.md: 가상·비식별 데이터만).
