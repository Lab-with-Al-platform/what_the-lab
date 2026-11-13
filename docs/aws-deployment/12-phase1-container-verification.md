# 12. Phase 1 로컬 컨테이너화 검증 명세 및 실측 결과 보고서 (Container Verification) — 개정판

> **검증 일시**: 2026-11-05  
> **검증 환경**: Docker Desktop (Engine 29.9.2, Linux/AMD64 호스트), 로컬 5개 컨테이너 통합 기동 (`docker-compose.prod.yml`)  
> **검증 대상**: `nginx`, `frontend` (Next.js 15), `backend` (FastAPI), `discord-bot` (Gateway Bot), `postgres` (PostgreSQL 17)  
> **평가 원칙**: 과장 표현을 배제하고, 로컬 단일 시점 실측 데이터와 프로덕션 런타임의 미검증 영역을 엄격히 구분함.

> **※ [v4 정정, 2026-11-09]**: 운영 EC2에서는 frontend 컨테이너도 띄우지 않아요(프론트는 S3 + CloudFront). 이 문서의 5개 컨테이너 실측은 로컬 기록으로 보존해요.
>
> **※ [v3 정정, 2026-11-06]**: 실측값(1~2절)은 그대로 보존해요. 다음은 바뀌었어요.
> - 운영 DB는 RDS로 분리하는 안이 권장안이라 운영 EC2에서는 postgres 컨테이너를 띄우지 않아요. 서버는 `t4g.small`부터 시작해요 ([02](02-recommended-architecture.md)).
> - 3절의 "방어 대책(향후 보완)" 중 `FOR UPDATE SKIP LOCKED`는 알림·구글 동기화·채널 생성에 **이미 구현**돼 있어요. 남은 위험은 아침 브리핑의 메모리 기반 하루 1회 판단이에요.
> - 5절 비용표의 EBS 단가($0.096)는 서울 공식 단가 **$0.0912**로 정정됐어요. 최신 비용은 [08](08-cost-estimate.md)을 봐요.
> - 헬스체크 통과만으로는 운영 문제(브라우저가 `localhost:8000`을 호출하는 문제 등)를 잡지 못했어요 → [09](09-deployment-roadmap.md) B2.

---

## 1. 컨테이너별 메모리 및 CPU 실제 측정 결과 (`docker stats`)

`docker compose -f docker-compose.prod.yml up -d`를 통해 5개 서비스를 기동하고 단일 시점에서 측정한 베이스라인 자원 사용량입니다:

| 컨테이너 서비스 | 실측 CPU | 실측 메모리 (Mem Usage) | 설정된 메모리 Limit | 실측 점유율 (Mem %) |
|---|---|---|---|---|
| **`labbridge-prod-nginx`** | 0.00% | **14.71 MiB** | 128 MiB | 11.49% |
| **`labbridge-prod-discord-bot`** | 0.00% | **79.67 MiB** | 300 MiB | 26.56% |
| **`labbridge-prod-backend`** | 0.23% | **104.60 MiB** | 600 MiB | 17.44% |
| **`labbridge-prod-frontend`** | 0.00% | **88.43 MiB** | 800 MiB | 11.05% |
| **`labbridge-prod-postgres`** | 0.07% | **36.37 MiB** | 1,200 MiB | 3.03% |
| **5개 서비스 총합** | **0.30%** | **약 323.78 MiB (0.32 GiB)** | **3,028 MiB** | **4GB 호스트 기준 8.1% 점유** |

### ⚠️ 자원 실측치 해석 시 주의점 및 미검증 영역 (Objective Assessment)
- **베이스라인 확인**: 초기 기동 및 단일 요청 기준 323.78 MiB는 컨테이너 구성 자체의 경량성을 입증하지만, **실제 프로덕션 환경의 OOM 위험이 0%라는 의미는 아닙니다.**
- **미검증 항목 (UNVERIFIED)**:
  1. **동시 사용자 부하 테스트**: 다수의 사용자가 동시에 Next.js SSR 페이지를 렌더링하거나 대용량 검색 쿼리를 실행할 때의 메모리 스파이크는 본 테스트에서 측정되지 않았음 (`[UNVERIFIED]`).
  2. **백그라운드 동시 실행 부하**: `expire_forever`, `notification_sender`, `google_sync`가 동시에 대량의 레코드를 처리할 때의 CPU/메모리 부하는 미검증 상태임 (`[UNVERIFIED]`).
  3. **데이터 누적 시 DB 캐시**: 실제 프로덕션 데이터가 누적되고 인덱스 조회가 늘어나면 PostgreSQL의 `shared_buffers`와 OS 캐시 사용량이 1GB 이상으로 증가할 수 있음 (`[UNVERIFIED]`).
  4. **ARM64 환경 호환성**: 본 검증은 개발자 PC(x86_64)에서 수행되었으므로, 실제 AWS Graviton(ARM64) 환경에서의 네이티브 빌드 및 동작은 Phase 2 배포 시 직접 확인되어야 함 (`[UNVERIFIED]`).

---

## 2. 런타임 헬스체크 및 엔드투엔드(E2E) 통신 검증 결과

1. **Nginx 자체 헬스체크**: `GET http://localhost/healthz` -> `HTTP/1.1 200 OK` (정상)
2. **백엔드 API 프록시 헬스체크**: `GET http://localhost/api/v1/health` -> `HTTP/1.1 200 OK`, `{"status":"ok"}` (정상)
3. **프론트엔드 SSR 렌더링**: `GET http://localhost/` -> `HTTP/1.1 200 OK`, `x-nextjs-cache: HIT` (정상)
4. **데이터베이스 무결성**: 31개 Init SQL 실행 결과 **총 39개 테이블 정상 생성 및 Alembic 버전 `20261104_27` 일치 확인**.

---

## 3. 백엔드 Uvicorn 단일 Worker와 백그라운드 작업 안정성 분석

- **단일 Worker (`--workers 1`)의 장점**:
  - 단일 Uvicorn 프로세스 내부에서는 `asyncio` 이벤트 루프를 공유하므로, 프로세스 간 메모리 경합 없이 `expire_forever`, `notification_sender`, `google_sync`가 단일 태스크로 순차 처리됩니다.
- **여전히 존재하는 위험 요소 (Risks Identified)**:
  1. **컨테이너 중복 기동 위험**: 실수로 Docker Compose를 중복 실행하거나 컨테이너를 2개 이상 스케일링(`docker compose up --scale backend=2`)할 경우, 별도의 분산 락이 없어 알림이 2번 발송되거나 캘린더 이벤트가 중복 생성될 수 있습니다.
  2. **무중단 롤링 배포 시 교체 구간**: 구버전 컨테이너가 내려가고 신버전이 올라오는 짧은 겹침 구간(Graceful Shutdown 기간) 동안 두 컨테이너가 동일한 알림 큐를 폴링할 위험이 있습니다.
- **방어 대책 (향후 보완 과제)**:
  - 알림 및 캘린더 동기화 테이블에 `status = 'processing'` 상태 플래그 및 원자적 업데이트(`UPDATE ... WHERE status = 'pending' RETURNING id`) 또는 PostgreSQL `pg_try_advisory_lock`을 적용하여 멱등성을 보장해야 합니다.

---

## 4. 빌드 문제 해결 및 Docker 보안 조치

1. **외부 참조 빌드 에러 해결**:
   - `frontend/src/lib/community.ts`에서 `../../../data/community/insight-links.json`을 참조하여 최초 빌드가 실패했던 문제를, 빌드 컨텍스트를 프로젝트 루트(`.`)로 확장하고 `COPY data ../data`를 주입하여 정상 해결.
2. **루트 `.dockerignore` 신규 작성 (비밀정보 누출 차단)**:
   - 빌드 컨텍스트가 프로젝트 루트로 넓어짐에 따라, **`.env`, `.env.*`, `archive/`, `output/`, `tmp/`, `.git/`, `*.dump` 등이 Docker 이미지에 포함되지 않도록 프로젝트 루트에 철저한 `.dockerignore`를 신규 생성 및 적용 완료**.

---

## 5. 서울 리전 비용 정정 및 $50 목표 평가

| 리소스 | 서울 리전 공식 온디맨드 단가 | 월 기준 요금 (730h) |
|---|---|---|
| **EC2 `t4g.medium` (ARM64, 2vCPU, 4GB)** | **$0.0416 / 시간** (기존 $0.0336 오기 정정) | **$30.37** |
| **Public IPv4 주소** | $0.005 / 시간 | **$3.65** |
| **EBS gp3 50GB** | $0.096 / GB-월 | **$4.80** |
| **S3 20GB + Glacier 백업** | 공식 S3 요금표 기준 | **$0.85** |
| **Route 53 + CloudWatch** | 호스팅 영역 및 기본 메트릭 | **$1.00** |
| **CloudFront** | 1TB 무료 티어 | **$0.00** |
| **AWS 순수 인프라 요금** | — | **$40.67 / 월** |
| **AI 모델 (Bedrock Claude 3.5 Haiku)** | 일 300회 대화 기준 추정 (작성 시점 기록) | **$10.00** |
| **총합 (AWS 예상 청구액)** | — | **$50.67 / 월 (약 6.8만 원)** |

> 📌 **[작성 시점 참고]**:  
> 본 12번 보고서 표에 기록된 'Bedrock Claude 3.5 Haiku' 항목은 Phase 1 로컬 컨테이너 실측 시점의 잠정 추정치(과거 기록)입니다. 실제 최신 Bedrock 지원 모델 분석(지원 종료 모델 제외, Amazon Nova Micro, Titan Text Lite 등 최신 모델 기준) 및 공식 1M 토큰 단위 요금은 [08-cost-estimate.md](file:///docs/aws-deployment/08-cost-estimate.md) 및 [13-instructor-presentation-brief.md](file:///docs/aws-deployment/13-instructor-presentation-brief.md)를 참조하십시오. 기존 로컬 컨테이너 자원 실측 결과는 사실 그대로 보존됩니다.

- **T4g 무제한 모드(Unlimited) 위험 방어**: EC2 생성 시 반드시 **`Standard 모드`**를 설정하여 버스트 크레딧 초과 시 추가 과금($0.05/vCPU-h)이 발생하지 않도록 방어책 확정.
- **초저비용 대안**: Supabase PostgreSQL을 외부 유지하고 EC2를 `t4g.small`($15.18/월)로 낮추면 **총비용 $27.96/월(약 3.8만 원)**로 추가 절감 가능.
