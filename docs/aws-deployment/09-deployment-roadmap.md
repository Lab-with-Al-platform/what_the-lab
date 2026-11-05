# 09. 배포 로드맵 및 단계별 실행 계획 (Deployment Roadmap) — 개정판

> **상태**: **`CONDITIONAL (Phase 1 로컬 검증 완료, 강사님 피드백 및 Phase 2 착수 대기)`**  
> **철칙**: 강사님 피드백과 사용자의 명시적 승인 전까지 Phase 2(실제 AWS 리소스 생성)로 절대 진입하지 않습니다.  
> **기획 및 시연 범위 원칙 (`[CONFIRMED]` docs/planning/)**:
> - `INSTRUCTOR_FEEDBACK_ACTION_CHECKLIST_2026-10-30.md` 기준, **AWS 인프라 배포 및 AI 챗봇(RAG/MCP)은 핵심 웹 협업 흐름 시연의 필수 완료 조건이 아니며, 시연 이후 장기 서비스를 위한 '후속 운영 확장 계획(`[후속]`)'**으로 관리됩니다.
> - 인사이트 에이전트 Phase 7(`INSIGHT_AGENT_WORKFLOW_PLAN_AND_CURSOR_PROMPTS_2026-10-29.md`)은 실제 AWS 인프라 배포 단계가 아니라, **Claude 클라우드 예약 작업과 AWS Staging 간의 전송 규격 인계 및 미승인 조건 정리 단계(Handover)**입니다.

---

## 1. Phase 2 진입 전 5대 필수 결정사항 및 차단 조건 (Blockers)

다음 5가지 조건이 강사님 자문을 통해 확정되지 않으면 Phase 2 인프라 생성을 시작하지 않습니다:

1. **데이터베이스 호스팅 최종 선택**:
   - `안 A (Supabase 유지)`: 초기 비용 최소화 및 데이터 이전 $0.
   - `안 B (EC2 내부 PostgreSQL 운영)`: 단일 호스트 완전 통합 및 네트워크 지연 제거.
2. **단일 EC2 (SPOF) 수용 여부**:
   - 초기 월 $50 예산 방어를 위한 다운타임 감내 수준 확인.
3. **FastAPI Lifespan 백그라운드 태스크 멱등성 보장 수준**:
   - 단일 워커 유지 vs 별도 Worker 분리 및 DB 분산 락.
4. **Claude 외부 정기 작업과 AWS Staging 반입 경로**:
   - GitHub Data PR vs M2M Webhook API.
5. **AI 챗봇 MVP 출시 범위 및 비용 상한선(Rate Limit) 방어**:
   - Bedrock 경량 모델(Nova Micro / Titan Text Lite) MVP 런칭 여부 및 일일 쿼터 제한.

---

## 2. 단계별 상세 실행 계획

### Phase 1: Dockerfile 작성 및 로컬 통합 검증 (`[COMPLETED: 12-phase1-container-verification.md]`)
- [x] Next.js 15 Standalone 멀티스테이지 `frontend/Dockerfile` 작성.
- [x] Python 3.13 / uv 기반 경량 `backend/Dockerfile` 작성.
- [x] `docker-compose.prod.yml` 작성: Nginx, Frontend, Backend, Discord Bot, (PostgreSQL).
- [x] 컨테이너별 메모리 제한(Limit) 설정 검증 (실측 합계 324MiB, 4GB 대비 8.1%).
- [x] 기본 통신 헬스체크 및 PostgreSQL 17 스키마 초기화(39개 테이블, Alembic `20261104_27`).
- [ ] *(향후 과제)*: 사용자 브라우저 동시 접속 E2E 부하 테스트.

### Phase 2: AWS 기초 인프라 프로비저닝 (강사님 피드백 후 진행)
- [ ] 기본 VPC 내 Public Subnet에 EC2 `t4g.medium` (ARM64) 1대 생성 + Elastic IP 할당.
- [ ] IAM Role (`WhatTheLabEC2Role`): S3 접근, Bedrock 호출, SSM Session Manager 권한 연결.
- [ ] S3 버킷 (`whatthelab-storage-apne2-prod`) 생성 및 수명주기 설정.
- [ ] SSM Parameter Store에 프로덕션 환경변수 등록.

### Phase 3: 서버 환경 배포 및 서비스 기동
- [ ] EC2 호스트에 Docker 및 Docker Compose 플러그인 설치.
- [ ] SSM을 통해 `.env.production` 주입 (`chmod 600`).
- [ ] 컨테이너 기동: `docker compose -f docker-compose.prod.yml up -d`.
- [ ] 헬스체크 검증: `curl http://localhost:8000/api/v1/health`.

### Phase 4: 도메인, SSL 및 CloudFront CDN 연결
- [ ] ACM에서 도메인 와일드카드 SSL 인증서 발급 (`us-east-1`).
- [ ] CloudFront 배포 생성: EC2 Elastic IP 오리진 연결, `X-Origin-Verify-Secret` 헤더 설정.
- [ ] Route 53 Alias 레코드 연결.

### Phase 5: 외부 연동 및 최종 오픈 (Go-Live)
- [ ] Discord Developer Portal Redirect URI 갱신 (`https://도메인/api/v1/auth/discord/callback`).
- [ ] Discord Gateway 봇 슬래시 커맨드 및 DM 발송 실시간 테스트.
- [ ] S3 일일 백업 Cron 등록 및 실제 복원 테스트.
- [ ] 서비스 정식 오픈.
