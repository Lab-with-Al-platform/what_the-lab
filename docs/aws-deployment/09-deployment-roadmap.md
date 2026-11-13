# 09. 배포 로드맵 (Deployment Roadmap) — v4

> **상태**: `READY FOR PROVISIONING AFTER BLOCKERS` — AWS 통합 배포 방향은 결정됨(강사님 권장). 아래 차단 항목을 해결하고 팀 승인 후 리소스를 만들어요.
> **실제로 진행할 때**는 단계별 명령과 주의점을 모은 [17](17-deployment-execution-guide.md)을 따라가요.
> **철칙**: 실제 AWS 리소스 생성과 운영 전환은 팀(사용자)의 명시적 승인 후에만 해요. 운영 DB를 바꾸는 명령은 DB 담당자가 실행해요.

---

## 1. 배포 전 차단 항목 (Blockers)

| # | 항목 | 위치 | 왜 막히나 | 담당 |
|---|---|---|---|---|
| B1 | 비밀값 기본값 제거 | `docker-compose.prod.yml` (`admin123`, `JWT_SECRET` 기본값) | 환경변수를 빠뜨리면 공개된 키로 토큰 위조 가능 | 백엔드 |
| B2 | 프론트 정적 빌드 전환 | `frontend/next.config.ts`, 동적 주소 8곳, 로그인·검색 | `output: export`, 실제 번호를 주소에서 읽기, `rewrites` 제거, 이미지 최적화 대체, `NEXT_PUBLIC_API_BASE_URL=/api/v1` | 프론트 |
| B3 | `FRONTEND_URL` → `NEXT_PUBLIC_APP_URL` | `docker-compose.prod.yml` ↔ `backend/app/config.py` | 로그인 후 `localhost:3000`으로 이동 | 백엔드 |
| B4 | nginx를 API 전용으로 + 443·오리진 인증서·비밀 헤더·요청 제한 | `infra/nginx/nginx.conf` | 지금은 80번 평문, 헤더 검사 없음, frontend로 전달 | 인프라 |
| B5 | 운영용 compose에서 postgres·frontend 제거 | `docker-compose.prod.yml` | 운영 DB는 RDS, 화면은 S3 (`profiles`로 분리) | 인프라 |
| B6 | 빈 DB에 `alembic upgrade head` 리허설 | 로컬 PostgreSQL 17 | 운영 RDS를 init SQL 없이 만들 수 있는지 확인 | DB |
| B7 | ARM64 이미지 빌드 | GitHub Actions | `psycopg`, `cryptography` 등 ARM64 확인 `[UNVERIFIED]` | 인프라 |
| B8 | `t4g.micro` 부하 테스트 (시작 구성, 2026-11-13 팀 결정) | k6 등, 동시 접속 10 → 20 → 30명 단계로 micro 한계 찾기 | micro 한도·스왑 설정으로 버티는지 확인. 찾은 한계의 70%가 small 상향 기준. 실패하면 small로 시작 ([02](02-recommended-architecture.md) 2-1절) | 전체 |
| B9 | 개발용 디스코드 앱·토큰 분리 | 디스코드 개발자 포털 | 운영 봇과 개발 봇이 같은 토큰을 쓰면 중복 반응 | 디스코드 |
| B10 | CloudFront 경로·주소 연결 시험 | CloudFront Function | `/workspace/4` 직접 열기·새로고침·화면 이동·없는 주소 404 | 프론트·인프라 |
| B11 | 운영 DB 접속 절차 | IAM, SSM 터널, 조회 전용 계정 | 사람별 권한, 로컬 backend 연결 금지 | DB |
| B12 | CI 확장 + 브랜치 보호 | `.github/workflows/`, GitHub 설정 | 지금은 백엔드 일부 테스트만 돌고, CI가 실패해도 머지 가능 | 전체 |

---

## 2. 단계별 계획

### Phase 1: 로컬 컨테이너 검증 — `[COMPLETED 2026-11-05]` ([12](12-phase1-container-verification.md))
- [x] Dockerfile, `docker-compose.prod.yml`, nginx 설정 작성
- [x] 5개 컨테이너 기동, 헬스체크, 유휴 메모리 324MiB
- [ ] B1~B5 수정 PR (코드 변경 — 별도 PR로 하나씩)

### Phase 1.2: CI 정리 (AWS 없이 지금 가능, [14](14-ci-cd-pipeline.md) 8절 1~3단계)
- [ ] B12: 백엔드 전체 테스트, 빈 DB `alembic upgrade head` 검사, `push` 트리거를 `develop`·`main`으로
- [ ] `develop`·`main` 브랜치 보호(필수 검사, 리뷰 1명)

### Phase 1.5: 배포 리허설 (로컬)
- [ ] B6: 빈 PostgreSQL 17 + `alembic upgrade head` → 테이블 수·주요 컬럼을 init SQL 결과와 비교
- [ ] B7: GitHub Actions에서 arm64 이미지 빌드 → 레지스트리 업로드
- [ ] 10번 런북의 표준 배포 절차를 `deploy.sh`로 묶어 로컬에서 한 번 실행해 보기

### Phase 2: AWS 기초 리소스 (승인 후)
- [ ] AWS Budgets 경보($40 예상 / $50 실제) — **가장 먼저**
- [ ] VPC, Public 1개 + Private 2개 서브넷, 보안 그룹 2개 ([03](03-network-security.md))
- [ ] RDS PostgreSQL 17 `db.t4g.micro`, 자동 백업 7일, 삭제 방지 ([04](04-database-storage.md))
- [ ] EC2 `t4g.micro` (Amazon Linux 2023 ARM64, 크레딧 Standard), 스왑 1GB, Elastic IP, IAM 역할 — 부족하면 `t4g.small`
- [ ] S3 백업 버킷 + Lifecycle(90일 삭제)
- [ ] SSM Parameter Store에 `/labbridge/prod/*` 등록 ([05](05-discord-integration.md) 5절)

### Phase 3: 서버 기동 (아직 공개 전)
- [ ] Docker·Compose 설치, `.env.production` 생성(`chmod 600`)
- [ ] **운영 RDS에 `alembic upgrade head` → `alembic current` = `alembic heads` 확인**
- [ ] backend → nginx 기동 (discord-bot은 아직 끔)
- [ ] SSM 터널로 DB 담당자 접속·조회 전용 계정 확인 (B11)
- [ ] `curl -k https://localhost/api/v1/health` 확인

### Phase 4: 도메인·HTTPS
- [ ] S3 프론트 버킷(퍼블릭 차단, OAC) 생성 + 정적 파일 업로드
- [ ] ACM 인증서(us-east-1), CloudFront 배포(기본 경로 S3, `/api/v1/*`는 EC2 HTTPS only + 비밀 헤더, 주소 연결 함수)
- [ ] `origin.<도메인>` Let's Encrypt 인증서(DNS-01)
- [ ] CloudFront 기본 주소로 화면·API·디스코드 로그인 확인, `/workspace/4` 직접 열기·새로고침 (B10)

### Phase 5: 전환 (Go-Live) — [05](05-discord-integration.md) 4절 순서
- [ ] 디스코드 Redirect URI 추가
- [ ] Render backend·봇 정지 → EC2 discord-bot 시작 → `/일정목록` 테스트
- [ ] Route 53 DNS 전환
- [ ] 첫날: 알림 DM, 협업 채널 생성, 다음 날 아침 브리핑이 **한 번만** 오는지 확인
- [ ] 첫 주: S3 덤프 복원 테스트 1회

### Phase 5.5: 배포 자동화 ([14](14-ci-cd-pipeline.md) 8절 5~6단계)
- [ ] `deploy.yml`을 버튼 실행(`workflow_dispatch`)으로 시작 → 익숙해지면 `main` 머지 시 자동 실행 + 승인 단계

### Phase 5.8: 베타 운영 (자체 테스트 + 일부 사용자 모집, 2026-11-10·11-13 팀 결정)
- [ ] **배포 후 2주 테스트 기간**: `t4g.micro`로 운영하며 메모리·스왑·CPU 크레딧·OOM 재시작을 매일 확인, 비용은 주 1회 기록
- [ ] 2주 끝에 micro 유지 / small 상향 결정 (기준: [02](02-recommended-architecture.md) 2-1절)
- [ ] 회원 모집 (예상 50명 내외). 회원 수·동시 접속·**아침 9시 전후 CPU·메모리**를 주 1회 기록 (회원 200명을 넘으면 매일). small 상향·ALB 판단 자료로 사용 ([02](02-recommended-architecture.md) 2-1절)
- [ ] ALB 없이 EC2 1대로 운영
- [ ] 베타 사용자 의견과 장애 기록을 모아 정식 공개 전 서버 크기·ALB 여부 다시 판단
- [ ] API·worker 분리 1~6단계 (EC2 1대 안, 비용 $0) — [16](16-api-worker-split.md) 3절

### Phase 6: 이후 (별도 합의)
- API·worker 분리 7~9단계(S3 업로드, 요청 제한 이전, ALB + api 2대), 서버 크기 재판단(micro 유지·small 상향), S3 Presigned 업로드 전환, 커넥션 풀, AI 챗봇(MVP+), 인사이트 반입 자동화, 서버 크기 재검토(1~3개월 실측)
