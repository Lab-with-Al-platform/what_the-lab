# WHAT THE LAB (LabBridge) — AWS 통합 배포 설계서 (v4 개정판)

> **프로젝트**: WHAT THE LAB (LabBridge)
> **리전**: AWS 서울 리전 (`ap-northeast-2`)
> **목표 예산**: **월 $50 내외** (부가세 포함 여부는 [UNVERIFIED])
> **핵심 전략**: 단일 Graviton EC2 (`t4g.small`, 부족하면 `t4g.medium`) + Docker Compose(nginx·backend·discord-bot) + **프론트 S3 + CloudFront 정적 배포** + **비공개 RDS PostgreSQL** + S3 백업
> **개정일**: 2026-11-09 (v4) — 강사님 피드백(프론트 S3+CloudFront, RDS 접속 경로) 반영
> **상태**: 설계 단계. AWS 리소스 생성·운영 DB 생성·서비스 전환은 아직 하지 않음

---

## 0. v4에서 무엇이 바뀌었나요? (먼저 읽기)

| 강사님 피드백 | v4 반영 | 근거·상태 |
|---|---|---|
| 프론트엔드는 CloudFront + S3 활용 (비용 최적화) | Next.js를 정적 파일로 빌드해 S3에 두고, CloudFront가 `/api/v1/*`만 EC2로 보냄. EC2에서 frontend 컨테이너 제거 | 임시 복사본 빌드 성공(10곳 수정 전제), 실제 CloudFront 동작은 `[UNVERIFIED]` |
| RDS private은 좋지만 접근 경로 하나 필요 | RDS는 비공개 유지. **SSM 포트 포워딩**으로 EC2를 거쳐 접속 (포트 추가 없음, $0) | AWS 공식 문서 확인, 실사용은 `[UNVERIFIED]` |

- 비용: EC2를 `t4g.small`로 두면 **AWS 월 $43.90**(거의 그대로), 부하 테스트 후 `t4g.micro`로 낮추면 **$36.31**.
- **팀 결정 (2026-11-10)**: ALB는 나중으로 미뤄요. 당분간 자체 테스트 + 일부 사용자 **베타 운영**이에요 ([15](15-instructor-feedback-20261110.md) 2-2절).
- **강사님 피드백 (2026-11-10, [15](15-instructor-feedback-20261110.md))**: 아키텍처·보안 방향은 좋다. 개발 DB는 하나로 유지하고 최신화, micro로 테스트, 비용이 크지 않으면 ALB 고려(월 약 $25라 확장 단계로 둠), CI 통과 시에만 배포, 비용은 EC2·RDS·네트워크로 나눠서.
- **CI/CD (2026-11-10 추가)**: CI가 통과한 코드만 `main` 머지 → 승인 → 파이프라인이 "마이그레이션 → 확인 → 교체" 순서로 배포 ([14](14-ci-cd-pipeline.md)). 지금은 브랜치 보호와 배포 워크플로가 없어요.
- 반드시 지킬 규칙: 터널을 연 상태로 **로컬 backend를 운영 DB에 연결하지 않아요**. backend는 켜지는 순간 예약 작업을 시작해요.

---

## 0-1. v3에서 바뀐 것 (기록)

| 구분 | v2까지 | v3 (현재) | 이유 |
|---|---|---|---|
| 배포 방향 | AWS 배포 여부 자체를 강사님께 질문 | **AWS 통합 배포로 결정** `[DECIDED]` | 강사님 권장. 디스코드 봇·알림·예약 작업처럼 24시간 켜져 있어야 하는 프로그램을 한 곳에서 같은 버전으로 운영하기 위해 |
| 운영 DB | Supabase 유지(A) 또는 EC2 내부 Postgres(B) | **RDS PostgreSQL `db.t4g.micro` (운영 전용)** `[PROPOSED]` | 공용 Supabase는 팀 **개발용** DB. 실제 회원 데이터와 분리하고, 자동 백업·시점 복원을 AWS에 맡겨 DB 담당자 부담을 줄임 |
| 서버 크기 | `t4g.medium` | **`t4g.small`부터 시작**, 부하 테스트 결과에 따라 `t4g.medium` | DB가 서버 밖(RDS)으로 나가 메모리 여유가 생김 |
| 배포 순서 | 없음 | **마이그레이션 먼저 → 버전 확인 → 컨테이너 재시작** | 2026-11 "코드는 배포됐는데 DB 마이그레이션이 덜 돼서 특정 API만 503" 사고 재발 방지 |
| 디스코드 | 봇 분리만 명시 | **운영 봇·백엔드는 언제나 1개만**, 개발용 디스코드 앱 분리 | 같은 토큰으로 두 군데서 접속하면 명령에 두 번 반응하거나 아침 브리핑이 두 번 나갈 수 있음 |
| CloudFront→EC2 | HTTP(평문) | **HTTPS(오리진 인증서)**, 보안 그룹은 443만 | 비밀 헤더가 평문으로 인터넷을 지나가지 않게. Prefix List 규칙 한도(60) 안에 들어가게 |
| AI 챗봇·RAG | $10 버퍼 포함 | **첫 배포 범위에서 제외(MVP+)**, 예산 $0 | `docs/product/MVP_SCOPE.md` 기준 MVP+. 나중에 켤 때 따로 예산 |
| 비용 | $50.67 (EBS 단가 오류 포함) | **AWS $43.89 (+부가세·도메인 포함 약 $49.5)** | 2026-11 AWS 공식 Price List로 단가 재확인 |

---

## 1. 문서 목차

| 번호 | 문서 | 주요 내용 |
|---|---|---|
| 00 | [프로젝트 감사 및 현황](00-project-audit.md) | 현재 운영 구성(Vercel·Render·Supabase), 코드 현황 |
| 01 | [아키텍처 옵션 비교](01-architecture-options.md) | DB 3안·실행 방식·프록시 비교 |
| 02 | [최종 권장 아키텍처](02-recommended-architecture.md) | EC2 + Docker Compose + RDS 구성도, 메모리 한도 |
| 03 | [네트워크 및 보안](03-network-security.md) | VPC, 보안 그룹, 오리진 HTTPS, IAM, 비밀값 |
| 04 | [데이터베이스 및 스토리지](04-database-storage.md) | RDS 운영 DB, 마이그레이션 규칙, 백업, 파일 저장 |
| 05 | [Discord 연동](05-discord-integration.md) | REST vs Gateway, "봇은 하나만" 규칙, 전환 순서 |
| 06 | [AI 챗봇 인프라 (MVP+)](06-ai-chatbot-infrastructure.md) | 나중 단계 설계, 서울 Bedrock 단가 |
| 07 | [자동 콘텐츠 파이프라인](07-automation-jobs.md) | 앱 내부 예약 작업 + 외부 Claude 반입 경계 |
| 08 | [서울 리전 비용](08-cost-estimate.md) | 공식 단가 기준 비용표, 확인/미확인 표시 |
| 09 | [배포 로드맵](09-deployment-roadmap.md) | 배포 전 차단 항목, 단계별 체크리스트 |
| 10 | [운영 런북](10-operations-runbook.md) | 표준 배포 절차, 롤백, 장애 복구 |
| 11 | [소스코드 정합성 검토 (과거 기록 + v3 정정)](11-source-consistency-review.md) | 2026-11-05 대조 결과와 정정 사항 |
| 12 | [Phase 1 컨테이너 실측 (과거 기록 + v3 정정)](12-phase1-container-verification.md) | 로컬 5개 컨테이너 실측 |
| 13 | [강사님 발표 브리프](13-instructor-presentation-brief.md) | 한 장 구성도, 비용, 결정·질문 |
| 14 | [CI/CD 자동 배포 계획](14-ci-cd-pipeline.md) | CI 통과 시에만 배포, 승인 단계, SSM Run Command 배포 스크립트 |
| 15 | [강사님 피드백 기록 (2026-11-10)](15-instructor-feedback-20261110.md) | 7교시 피드백: 개발 DB 하나 유지, micro 테스트, ALB 제안, CI 통과 후 배포, 항목별 비용 |
| 16 | [API·예약 작업·봇 분리 계획](16-api-worker-split.md) | ALB 전 준비: worker 분리, 하루 1회 작업 DB 판단, 중복 실행 잠금, 업로드 S3 전환 |

---

## 2. 현재 상태 판정: `READY FOR PROVISIONING AFTER BLOCKERS`

- **결정됨**: AWS 서울 리전 통합 배포 (강사님 권장)
- **로컬 검증됨** `[LOCAL_VERIFIED]`: 5개 컨테이너 빌드·기동·기본 HTTP 응답 (2026-11-05, x86_64)
- **배포 전 차단 항목** (자세한 내용은 [09](09-deployment-roadmap.md)):
  1. `docker-compose.prod.yml`의 비밀값 기본값 제거 (`admin123`, JWT 기본값)
  2. 프론트를 정적 빌드로 전환 (동적 주소 8곳·로그인·검색 수정, `NEXT_PUBLIC_API_BASE_URL=/api/v1` 주입)
  3. 백엔드 `FRONTEND_URL` 환경변수 이름 불일치 수정 (`config.py`는 `NEXT_PUBLIC_APP_URL`을 읽음)
  4. nginx에 443·오리진 인증서·비밀 헤더 검사·요청 제한 실제 반영
  5. 빈 PostgreSQL에서 `alembic upgrade head`만으로 운영 스키마가 만들어지는지 리허설
  6. ARM64 이미지 빌드와 `t4g.small` 부하 테스트
  7. CloudFront 경로 나누기·주소 연결 함수 시험 (`/workspace/4` 직접 열기·새로고침)
  8. 운영 DB 접속 절차와 조회 전용 계정 준비

---

## 3. 핵심 설계 결론

1. **컴퓨팅**: 서울 리전 EC2 1대(`t4g.small`, ARM64, 2 vCPU, 2GiB)에서 Docker Compose로 nginx·backend·discord-bot 3개 컨테이너 운영. 프론트는 S3 정적 파일.
2. **운영 DB**: Amazon RDS PostgreSQL 17 `db.t4g.micro` Single-AZ, 비공개 서브넷, EC2와 같은 가용 영역(AZ). 팀 개발은 계속 공용 Supabase(`labbridge-dev`).
3. **배포 순서 고정**: 이미지 준비 → `alembic upgrade head` → `alembic current` 확인 → backend → discord-bot → nginx 교체 → 프론트 S3 업로드 → CloudFront 캐시 갱신 → 동작 확인.
4. **단일 실행 원칙**: 운영 backend(백그라운드 작업 포함)와 discord-bot은 각각 정확히 1개. Uvicorn `--workers 1`.
5. **디스코드**: 로그인·DM·채널 생성은 REST(백엔드), 슬래시 명령·버튼은 Gateway(봇 컨테이너). 봇은 나가는 연결만 쓰므로 포트를 열 필요 없음.
6. **엣지**: Route 53 + CloudFront(무료 구간) + ACM(us-east-1). 기본 경로는 비공개 S3, `/api/v1/*`만 EC2(HTTPS).
7. **오리진 보호**: 보안 그룹 443 하나에 CloudFront Prefix List + nginx 비밀 헤더. "완벽 차단"이 아니라 "직접 접속을 크게 줄이는 2단계 방어".
8. **비밀값**: SSM Parameter Store(Standard, SecureString)에 저장 → 배포 때 `.env.production`(`chmod 600`)으로 내려받음. compose 파일에 기본값 금지.
9. **백업**: RDS 자동 백업(7일) + 주 1회 `pg_dump`를 S3로(장기 보관·이식용) + 월 1회 복원 테스트. 업로드 파일(EBS 볼륨)도 매일 S3로 복사.
10. **운영 DB 접속**: 비공개 RDS에는 SSM 포트 포워딩으로만 접속, 조회 전용 계정 기본. 평소 개발은 공용 Supabase.
11. **배포 자동화**: PR마다 CI, 브랜치 보호로 통과해야 머지, `main` 머지 후 승인 → SSM Run Command로 `deploy.sh` 실행 ([14](14-ci-cd-pipeline.md)).
12. **범위 밖**: AI 챗봇·RAG·Bedrock·S3 Presigned 업로드 전환은 첫 배포 이후 별도 합의.
