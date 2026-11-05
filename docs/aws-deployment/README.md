# WHAT THE LAB (LabBridge) — AWS 프로덕션 인프라 설계서 (Phase 0 최종 개정판)

> **프로젝트**: WHAT THE LAB (LabBridge)  
> **리전**: AWS 서울 리전 (`ap-northeast-2`)  
> **목표 예산**: **월 $50 내외**  
> **핵심 전략**: 단일 Graviton EC2 (`t4g.medium`) + Docker Compose 멀티 컨테이너 분리 + S3 + CloudFront  
> **상태**: 기존 개발 문서(`docs/`) 및 QA 결과(Phase 0~6) 추가 분석 반영 완료 (`애플리케이션 코드 변경 및 AWS 리소스 생성 없음`)

---

## 1. 문서 목차 (Table of Contents)

| 번호 | 문서명 | 주요 내용 | 링크 |
|---|---|---|---|
| **00** | **프로젝트 감사 및 현황** | Supabase DB 현황, 인사이트 Phase 0~6 완료 자산, Discord 구현 분석 | [00-project-audit.md](file:///docs/aws-deployment/00-project-audit.md) |
| **01** | **아키텍처 옵션 비교** | Supabase 유지 vs EC2 DB vs RDS 심층 비교, Discord 분리 실행 비교 | [01-architecture-options.md](file:///docs/aws-deployment/01-architecture-options.md) |
| **02** | **최종 권장 아키텍처** | 단일 EC2 Docker Compose 아키텍처, OOM 방지 컨테이너별 메모리 제한 | [02-recommended-architecture.md](file:///docs/aws-deployment/02-recommended-architecture.md) |
| **03** | **네트워크 및 보안** | Public Subnet, 보안그룹, CloudFront 오리진 헤더 검증, SSM 파라미터 | [03-network-security.md](file:///docs/aws-deployment/03-network-security.md) |
| **04** | **데이터베이스 및 스토리지** | Supabase 연결 설정, EC2 DB 마이그레이션 절차, pgvector RAG, S3 | [04-database-storage.md](file:///docs/aws-deployment/04-database-storage.md) |
| **05** | **Discord 연동 아키텍처** | REST 기반(OAuth/DM/채널) vs Gateway(슬래시커맨드) 분리, 계정 탈취 방어 | [05-discord-integration.md](file:///docs/aws-deployment/05-discord-integration.md) |
| **06** | **AI 챗봇 및 모델 인프라** | 공통 Chat Engine, `ModelProvider` 추상화, Bedrock 기본 + Fallback | [06-ai-chatbot-infrastructure.md](file:///docs/aws-deployment/06-ai-chatbot-infrastructure.md) |
| **07** | **자동 콘텐츠 파이프라인** | Claude 외부 예약 작업 연계, `insight_transfer_v1` 계약 보존, Staging 게이트 | [07-automation-jobs.md](file:///docs/aws-deployment/07-automation-jobs.md) |
| **08** | **서울 리전 비용 분석** | 월 $30 내외(최소) / $50 내외(권장) / $70~$100(여유) 요금표 및 절감 우선순위 | [08-cost-estimate.md](file:///docs/aws-deployment/08-cost-estimate.md) |
| **09** | **배포 로드맵 및 실행 계획** | Phase 1 진입 전 필수 결정사항, 차단 조건(Blockers), 단계별 체크리스트 | [09-deployment-roadmap.md](file:///docs/aws-deployment/09-deployment-roadmap.md) |
| **10** | **운영 및 장애 복구 런북** | 단일 EC2 SPOF 고지, 메모리 점검 CLI, 긴급 재해 복구 매뉴얼 | [10-operations-runbook.md](file:///docs/aws-deployment/10-operations-runbook.md) |
| **11** | **소스코드 정합성 검토** | 실제 소스코드 전수 대조 결과, Alembic 최신 Head 동기화, Phase 1 진입 판정 | [11-source-consistency-review.md](file:///docs/aws-deployment/11-source-consistency-review.md) |
| **12** | **Phase 1 컨테이너 검증 실측** | 5개 컨테이너 실제 빌드·기동, 실측 메모리(324MiB) 및 런타임 E2E 검증 | [12-phase1-container-verification.md](file:///docs/aws-deployment/12-phase1-container-verification.md) |
| **13** | **강사님 자문 브리프 및 아키텍처 도식** | 강사님 설명용 최종 보고서, 플랫폼 기능별 AWS 매핑, 5대 핵심 기술 결정사항 | [13-instructor-presentation-brief.md](file:///docs/aws-deployment/13-instructor-presentation-brief.md) |

---

## 2. 현재 상태 판정: `CONDITIONAL (Design review completed, awaiting instructor feedback)`

- **로컬 기술 검증 상태**: 5개 컨테이너(Nginx, Frontend, Backend, Discord Bot, PostgreSQL) 패키징 및 런타임 통신 검증 완료 (`ALL PASSED`).
- **AWS 배포 보류 사유**: 강사님께 [13-instructor-presentation-brief.md](file:///docs/aws-deployment/13-instructor-presentation-brief.md)를 설명하고 5대 핵심 아젠다(DB 전략, 단일 EC2 SPOF 수용, 백그라운드 락, Claude 인입, 챗봇 MVP 범위 및 과금 방어) 피드백 수렴 후 실제 리소스 생성 착수.

---

## 3. 10대 핵심 설계 결론 요약

1. **컴퓨팅 구성**: AWS 서울 리전 단일 Graviton EC2 (`t4g.medium`, 2 vCPU, 4GB RAM) 인스턴스에서 Docker Compose로 Nginx, Frontend(Next.js 15 SSR), Backend(FastAPI), Discord Gateway Bot을 멀티 컨테이너로 분리 운영.
2. **초기 월 예산 목표 달성**: ALB, NAT Gateway 등 고가의 관리형 서비스를 배제하여 **순수 AWS 인프라 요금을 약 $40.67/월, Bedrock AI 잠정 버퍼 포함 약 $50.67/월로 제어** ($50 내외 목표 부합).
3. **OOM Crash 원천 차단**: 컨테이너별 메모리 한도(`nginx 128MB, frontend 800MB, backend 600MB, bot 300MB, db 1,200MB`)를 설정하여 단일 컨테이너 메모리 누수가 호스트 전체를 다운시키지 못하도록 보호.
4. **DB 배포 전략 유연성**: 기존 팀 공통 DB인 **Supabase PostgreSQL**을 그대로 유지하여 이전 위험을 $0으로 만드는 안(대안 A)과, 로컬 네트워크 지연을 없애기 위해 **EC2 내부 Docker PostgreSQL 17**로 이전하는 안(대안 B)을 양자택일(OR)로 설계.
5. **Discord 기능 분리**:
   - OAuth2 로그인, 1:1 DM 알림, 협업 비공개 채널 생성은 HTTP REST API로 동작.
   - 슬래시 커맨드(`/요청`, `/일정`) 및 버튼 상호작용은 독립된 `discord-bot` 컨테이너에서 WebSocket Gateway로 상시 연결.
6. **계정 탈취 방어**: Discord 계정 이메일이 기존 이메일 회원과 동일하더라도 자동 병합하지 않고 명시적 연동을 요구.
7. **기존 인사이트 자동화 자산 100% 보존**: Phase 0~6에서 검증된 `agent_contract.py`, `agent_flow.py`, `transfer_receipts`를 그대로 재사용하며, LangGraph는 정식 도입을 보류함.
8. **외부 Claude 작업과 AWS Staging의 엄격한 분리**: Claude 외부 작업에 운영 DB 비밀번호나 관리자 권한을 부여하지 않고, `insight_transfer_v1` JSON 파일/PR로만 반입.
9. **공통 AI 챗봇 및 RAG**: 웹 챗봇과 Discord 봇이 동일한 엔진을 공유하며, `ModelProvider` 추상화를 통해 Bedrock 경량 모델(Nova Micro, Titan Text Lite, Llama 3.2)과 OpenAI/Anthropic/Gemini 간 무중단 폴백 지원.
10. **S3 파일 스토리지 완전 전환**: 로컬 `backend/uploads/`를 Amazon S3 버킷으로 완전 이전하고 Presigned URL 방식으로 업로드/다운로드.
