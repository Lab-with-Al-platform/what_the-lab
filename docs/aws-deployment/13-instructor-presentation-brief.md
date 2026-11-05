# 13. AWS 프로덕션 인프라 구축 계획 및 강사님 자문 브리프 (Instructor Presentation Brief)

> **프로젝트**: WHAT THE LAB (LabBridge) — 연구자와 AI 전문가 연결 플랫폼  
> **목적**: AWS 서울 리전(`ap-northeast-2`) 프로덕션 인프라 구축 계획 설명 및 강사님 기술 피드백 수렴  
> **목표 예산**: **월 $50 내외 (순수 인프라 $40.67 + AI 잠정 버퍼 $10.00)**  
> **현재 단계 상태**: **`CONDITIONAL (Design review completed, awaiting instructor feedback)`**  
> **철칙**: 강사님 피드백과 사용자의 명시적 승인 전까지 실제 AWS 리소스(EC2, S3, IAM 등) 생성, 운영 DB 이전, 외부 예약 작업 활성화는 절대 진행하지 않음.

---

## 1. 프로젝트 현황 및 상태 분류 기준표

본 보고서의 모든 기술적 항목과 아키텍처 구성 요소는 아래 기준에 따라 엄밀히 구분하여 기술합니다:

- `[CONFIRMED]`: 실제 저장소 코드, 설정 파일, 스키마, 기존 QA 문서에서 직접 확인된 확정 사실 (코드 감사 완료)
- `[LOCAL_VERIFIED]`: Phase 1에서 로컬 Docker 환경을 통해 실제 컨테이너 빌드, 기동, 헬스체크 통신이 확인된 사항 (단, 브라우저/사용자 E2E 비즈니스 트랜잭션 검증과는 엄격히 구분)
- `[PROPOSED]`: AWS 프로덕션 운영을 위해 새롭게 제안하는 아키텍처 및 설정 권장안
- `[UNVERIFIED]`: 프로덕션 배포 전 런타임 E2E 테스트, 부하 테스트, 또는 실환경 검증이 필요한 미검증 사항

> 📌 **기획 및 운영 범위 원칙 (`docs/planning/` 정합성 확인)**:
> 1. **시연 완료 조건과의 분리**: 팀 피드백 체크리스트(`INSTRUCTOR_FEEDBACK_ACTION_CHECKLIST_2026-10-30.md`)에 따라, **AWS 인프라 배포와 AI 챗봇(RAG/MCP)은 핵심 웹 협업 흐름 시연 완료의 필수 조건이 아니며, 시연 이후 장기 실제 서비스를 위한 '후속 운영 확장 계획(`[후속]`)'**으로 정의되어 있습니다.
> 2. **인사이트 Phase 7 경계**: 인사이트 에이전트 Phase 7은 실제 클라우드 인프라 배포가 아니라, **외부 Claude 클라우드 예약 작업과 AWS Staging 간의 규격 인계 및 미승인 조건 정리 단계(Handover)**입니다.
> 3. **예산의 성격**: 월 $50 내외의 금액은 확정된 고정 청구액이 아니라, 아키텍처 설계를 위한 **"초기 운영 목표 예산(Budget Constraint Target)"**입니다.

---

## 2. 전체 아키텍처 도식 및 플랫폼 기능별 AWS 서비스 연결도

### 2.1 통합 인프라 아키텍처 다이어그램 (`[PROPOSED]`)

```mermaid
flowchart TB
    subgraph Clients ["🌐 클라이언트 & 외부 서비스 계층"]
        User["사용자 웹 브라우저<br>(Desktop / Mobile)"]
        Discord["Discord Platform<br>(공개/비공개 채널 & 1:1 DM)"]
        Supabase_Ext[("🐘 [대안 A] Supabase PostgreSQL<br>(labbridge-dev 관리형 DB)")]
    end

    subgraph ContentPipeline ["🤖 자동 인사이트 수집·반입 파이프라인"]
        Claude["외부 Claude 예약 작업<br>(연구사례 정기 수집)"]
        GitHubPR["GitHub Data PR<br>(data/insight_incoming/*.json)"]
        TrustedRunner["신뢰하는 반입 실행기<br>(GitHub Actions CI 검증)"]
        AdminUser["관리자 최종 검토·승인<br>(/admin/insights UI)"]
        
        Claude -.->|1. [PROPOSED] PR 자동 제출| GitHubPR
        GitHubPR -.->|2. [PROPOSED] 머지 시 트리거| TrustedRunner
    end

    subgraph AWS_Global ["🌐 AWS 글로벌 엣지 네트워크"]
        R53["Amazon Route 53<br>(DNS 호스팅)"]
        CF["Amazon CloudFront CDN<br>(정적 캐싱 & SSL 오프로딩)"]
        ACM["AWS Certificate Manager (ACM)<br>⚠️ 반드시 us-east-1(버지니아) 발급"]
        ACM -.->|인증서 연결| CF
    end

    subgraph AWS_Seoul ["☁️ AWS 서울 리전 (ap-northeast-2) - 단일 VPC (Public Subnet)"]
        S3["Amazon S3 버킷<br>(uploads / pdfs / backups)"]
        Bedrock["Amazon Bedrock 경량 AI 모델<br>(Nova Micro / Titan Text Lite / Llama 3.2)"]

        subgraph EC2_Host ["단일 Graviton EC2 (t4g.medium, ARM64, 2 vCPU, 4GB RAM)"]
            SG["🛡️ EC2 보안그룹 (L3/L4 방화벽)<br>소스를 CloudFront Prefix List로 한정"]
            IAM["IAM Role (EC2 인스턴스 프로파일)<br>S3, Bedrock, SSM 접근 권한"]
            
            subgraph Docker_Compose ["Docker Compose 격리 브리지 네트워크 (labbridge_internal)"]
                Nginx["1. Nginx 리버스 프록시 (포트 80/443 종단)<br>🔒 X-Origin-Verify-Secret 헤더 검증 (L7)<br>[Limit: 128MB]"]
                FE["2. Next.js 15 SSR 프론트엔드 (Node.js 22)<br>[Limit: 800MB]"]
                BE["3. FastAPI 백엔드 (단일 Uvicorn Worker + 알림 워커)<br>[Limit: 600MB]"]
                Bot["4. Discord Gateway 봇 (상시 WebSocket 리스너)<br>[Limit: 300MB]"]
                DB_Local[("🐘 [대안 B] PostgreSQL 17 컨테이너<br>(로컬 Docker 볼륨 마운트)<br>[Limit: 1,200MB]")]
            end
            
            EBS[("EBS gp3 50GB<br>(OS, Docker 이미지, DB 볼륨)")]
        end
    end

    %% 연결 관계
    User -->|1. HTTPS 도메인 질의| R53
    User -->|2. HTTPS 요청| CF
    CF -->|3. HTTPS 패킷 전달| SG
    SG -->|4. Prefix List 일치 패킷 통과| Nginx
    
    Nginx -->|5. SSR 페이지 요청| FE
    Nginx -->|6. /api/v1/* 라우팅| BE
    
    BE -.->|DB 선택 [대안 A]: 외부 TLS 세션 풀러| Supabase_Ext
    BE -->|DB 선택 [대안 B]: 내부 브리지 통신 (<0.5ms)| DB_Local
    
    Bot -->|내부 HTTP/트랜잭션 호출| BE
    Bot <-->|상시 WebSocket (슬래시 커맨드/버튼)| Discord
    BE -->|REST API v10 (1:1 DM 알림 / 채널 생성)| Discord
    
    BE -->|Presigned URL 발급 / 파일 저장| S3
    BE -->|RAG 검색 및 대화 추론| Bedrock
    
    TrustedRunner -->|3. [CONFIRMED] transfer_staging.py 실행| BE
    BE -->|4. [CONFIRMED] pending_review 적재| AdminUser
```

> **아키텍처 주요 설계 포인트:**
> 1. **SSL 인증서 위치**: CloudFront에 부착되는 무료 SSL 인증서는 **반드시 `us-east-1`(버지니아 북부) ACM에서 발급**되어야 합니다 (CloudFront 엣지 배포의 AWS 글로벌 제약조건).
> 2. **오리진 보호 (Prefix List + Nginx 다계층 심층 방어)**: AWS 관리형 Prefix List(`com.amazonaws.global.cloudfront.origin-facing`, 규칙 가중치 55 소모)를 EC2 Security Group 인바운드 소스로 직접 지정하여 CloudFront 엣지 외의 공인 인터넷 직접 패킷을 L3/L4에서 드롭합니다. 여기에 Nginx의 `X-Origin-Verify-Secret` 헤더 검증(L7)을 결합하여, 타인의 CloudFront 배포판을 통한 우회 접근까지 완벽히 차단합니다 (ALB/WAF 없이 월 $0의 추가 비용으로 기업급 오리진 보안 구축).
> 3. **데이터베이스 양자택일 (OR)**: `대안 A (Supabase 유지)`와 `대안 B (EC2 내부 PostgreSQL 운영)`는 배타적 선택지이며, 강사님 자문 결과에 따라 결정됩니다.
> 4. **AI 모델 및 RAG 경계**: 구형 모델(Claude 3 계열)을 배제하고 서버리스 Bedrock 최신 경량 모델(Nova Micro, Titan Text Lite)을 활용합니다. 한국어 형태소 전문 검색은 기본 Postgres에 내장되어 있지 않으므로 별도 검증 대상으로 유보합니다.
> 5. **인사이트 반입 파이프라인**: `Claude → GitHub Data PR → 신뢰하는 반입 실행기(Actions) → Backend Staging(transfer_staging.py) → 관리자 수동 승인(Publish)` 구조로 엄격히 분리하여 운영 DB 직접 접근을 원천 차단합니다.

---

### 2.2 플랫폼 비즈니스 기능별 AWS 서비스 매핑표

| 플랫폼 기능 도메인 | 사용 기술 및 통신 방식 | 담당 컨테이너 / AWS 서비스 | 상태 및 검증 범위 |
|---|---|---|---|
| **회원가입, 로그인, JWT 인증** | Next.js 15, FastAPI, PyJWT, HTTP-Only Cookie | `frontend`, `backend`, DB | `[CONFIRMED]` (코드 감사 완료)<br>`[UNVERIFIED]` (브라우저 E2E 부하) |
| **연구자-전문가 탐색 및 상세** | N-gram / FTS, 프로필 이미지, 포트폴리오 PDF | `frontend`, `backend`, Amazon S3, CloudFront | `[CONFIRMED]` (코드 감사 완료)<br>`[UNVERIFIED]` (한국어 사전 및 파일 업로드 E2E) |
| **협업 요청, 수락, 만료 (7일)** | FastAPI 수명주기 백그라운드 태스크 (`expire_forever`) | `backend` (단일 Worker), DB | `[CONFIRMED]` (코드 감사 완료)<br>`[UNVERIFIED]` (다중 워커 롤링 시 멱등성) |
| **Discord OAuth2 로그인 & 연동** | Discord REST API (Authorization Code Flow) | `backend` (`routers/auth.py`), Route 53 | `[CONFIRMED]` (엔드포인트 구현 확인) |
| **Discord 1:1 DM 알림** | Discord REST API v10, 지수 백오프, DmBlocked 예외 | `backend` (`notification_sender.py`) | `[CONFIRMED]` (전송 및 예외 로직 구현) |
| **협업 비공개 채널 자동 생성** | Discord REST API (`collab_channel.py`) | `backend`, PostgreSQL | `[CONFIRMED]` (역할/채널 생성 로직 구현) |
| **협업 채널 슬래시 커맨드/버튼** | Discord WebSocket Gateway (`discord.py`) | `discord-bot` 독립 컨테이너 | `[LOCAL_VERIFIED]` (프로세스 정상 기동)<br>`[UNVERIFIED]` (실서버 인터랙션 E2E) |
| **공통 AI 챗봇 (웹/Discord)** | `ModelProvider` 인터페이스, SSE 스트리밍 | `backend`, Bedrock 경량 모델 (Nova Micro / Titan Text Lite) | `[PROPOSED]` (초기 MVP 경량 모델 제안, 구형 Claude 제외) |
| **RAG 논문/사례 의미 검색** | PostgreSQL 내장 `pgvector`, HNSW 인덱스 | PostgreSQL 17 컨테이너, Bedrock 임베딩 | `[PROPOSED]` (향후 로드맵 단계 적용, 한국어 검색 PoC 필요) |
| **인사이트 자동 수집·반입** | 규격 검증(`insight_transfer_v1`) + 접수 이력(`transfer_receipts`) | 외부 Claude → GitHub PR → 신뢰 반입기 → Backend Staging | `[CONFIRMED]` (계약·Staging·관리자 승인 로직)<br>`[PROPOSED]` (외부 Claude PR 자동화 및 Actions 연동) |

---

## 3. Phase 1 로컬 컨테이너화 검증 결과 (`[LOCAL_VERIFIED]`)

단일 EC2 인스턴스(4GB RAM)에서 5개 컨테이너 동시 운영 가능성을 확인하기 위해 `docker-compose.prod.yml` 기반으로 로컬 실측을 수행했습니다:

### 3.1 컨테이너별 실시간 자원 측정 결과 (`docker stats`)

| 컨테이너 서비스 | 실측 CPU | 실측 메모리 (평시 기동 직후) | 메모리 Limit 설정 | 점유율 (4GB 기준) |
|---|---|---|---|---|
| **Nginx (리버스 프록시)** | 0.00% | **14.71 MiB** | 128 MiB | 약 0.36% |
| **Discord Bot (Gateway 리스너)** | 0.00% | **79.67 MiB** | 300 MiB | 약 1.99% |
| **Backend (FastAPI + Workers)** | 0.23% | **104.60 MiB** | 600 MiB | 약 2.61% |
| **Frontend (Next.js 15 SSR)** | 0.00% | **88.43 MiB** | 800 MiB | 약 2.21% |
| **PostgreSQL 17 (DB 컨테이너)** | 0.07% | **36.37 MiB** | 1,200 MiB | 약 0.91% |
| **5개 컨테이너 실측 합계** | **0.30%** | **약 323.78 MiB (0.32 GiB)** | **3,028 MiB** | **약 8.1%** |

### 3.2 런타임 통신 및 스키마 검증 실적
- **기본 통신 헬스체크 완료**: Nginx(포트 80)를 거쳐 백엔드 `/api/v1/health` (`{"status":"ok"}`) 및 프론트엔드 루트 페이지(`HTTP 200`, `x-nextjs-cache: HIT`) 기본 응답 정상 수신.
- **DB 스키마 초기화 완료**: PostgreSQL 17 컨테이너에서 31개 Init SQL 순차 실행 결과 **총 39개 관계형 테이블 정상 생성 및 Alembic 버전 `20261104_27` 일치 확인**.
- **빌드 경로 격리 해결**: 프론트엔드의 외부 참조(`data/community/insight-links.json`) 경로 문제를 해결하기 위해 빌드 컨텍스트를 프로젝트 루트(`.`)로 확장하고, 비밀정보 누출 방지를 위한 루트 [`.dockerignore`](file:///c:/Users/Peter/Desktop/모꼬지/SKN%2036기%20부트캠프/토이프로젝트/what_the_lab/.dockerignore) 작성 완료.

> ⚠️ **검증의 한계 명시 (`[UNVERIFIED]`):**  
> 컨테이너 5개가 `healthy` 상태에 도달하고 기본 헬스체크에 응답했다는 사실이 **실제 사용자 동시 접속, 로그인 세션 유지, 전문가 검색, 협업 승인 트랜잭션, Discord 실서버 봇 상호작용의 성공을 보장하지 않습니다.** 이는 애플리케이션 프로세스 패키징 및 기본 통신 검증 단계이며, 실제 비즈니스 로직 E2E 검증은 AWS 배포 전/후 테스트가 필수적입니다.

---

## 4. AWS 서울 리전(`ap-northeast-2`) 비용 재검증

서울 리전 공식 온디맨드 단가(`$0.0416/h`)를 전수 반영한 정밀 산출 내역입니다. **순수 AWS 인프라 비용과 AI 모델 사용료를 분리**하여 산정했습니다:

### 4.1 월별 예상 비용 상세 내역 (목표 예산: 월 $50 내외)

| 비용 항목 | 세부 스펙 및 단가 (서울 리전 공식 기준) | 월 예상액 (USD) | 원화 환산 (월) |
|---|---|---|---|
| **컴퓨팅 (EC2)** | `t4g.medium` (ARM64, 2vCPU, 4GB) : `$0.0416/h` × 730h | **$30.37** | 약 41,000원 |
| **Public IPv4 주소** | 고정 공인 IP 1개 : `$0.005/h` × 730h | **$3.65** | 약 4,900원 |
| **스토리지 (EBS)** | General Purpose SSD (gp3) 50GB : `$0.096/GB-월` | **$4.80** | 약 6,500원 |
| **백업 스토리지 (S3)** | S3 Standard 20GB + Glacier 백업본 | **$0.85** | 약 1,100원 |
| **DNS (Route 53)** | 호스팅 영역 1개 | **$0.50** | 약 700원 |
| **CDN / SSL (CloudFront)** | **Always Free Tier** (1TB 전송 + 1,000만 요청) + ACM 인증서 | **$0.00** | 무료 구간 |
| **모니터링 (CloudWatch)** | 기본 메트릭 및 로그 (2GB) | **$0.50** | 무료 티어 범위 |
| **AWS 순수 인프라 합계** | — | **$40.67 / 월** | **약 54,900원** |
| **AI 챗봇 모델 (잠정 버퍼)** | 초기 경량 모델 API 사용료 (일 300회 내외 대화) | **$10.00** | 약 13,500원 |
| **총합 (AWS 예상 청구 목표)** | **순수 인프라 + AI 잠정 버퍼** | **$50.67 / 월** | **약 68,400원** |

### 4.2 AI 모델 후보군 분석 및 공식 단가 검증 (100만 토큰 기준 통일)

기존에 언급되었던 Claude 3.5 Haiku 및 구형 모델은 지원 수명 주기(EOL) 및 비용 효율성 관점에서 제외하고, 현재 서비스 가능한 공식 경량 모델을 비교합니다:

| AI 모델 | 제공처 및 리전 지원 | 입력 토큰 단가 (1M당) | 출력 토큰 단가 (1M당) | 특징 및 수명 주기 관리 |
|---|---|---|---|---|
| **Amazon Nova Micro** | Bedrock (Cross-region / us-east-1) | **$0.035** / 1M 토큰 | **$0.140** / 1M 토큰 | 최신 Amazon Nova 초경량 모델, 최저 비용, 빠른 텍스트 추론 |
| **Amazon Titan Text Lite** | Bedrock 서울 리전 (`ap-northeast-2`) | **$0.150** / 1M 토큰 | **$0.200** / 1M 토큰 | 서울 리전 직접 온디맨드 제공, 네트워크 지연 최소화 |
| **Meta Llama 3.2 (3B)** | Bedrock 서버리스 추론 | **$0.150** / 1M 토큰 | **$0.200** / 1M 토큰 | 최신 3B 경량 파라미터, 연구 키워드 및 분류 적합 |
| **OpenAI `gpt-4o-mini`** | OpenAI 외부 REST API | **$0.150** / 1M 토큰 | **$0.600** / 1M 토큰 | 우수한 한국어 문맥 이해력, 외부 서킷 브레이커 후보 |

*(출처: AWS Bedrock 공식 Pricing 페이지 및 OpenAI Pricing 기준)*

> 📌 **AI 예산 표기 원칙**: 월 $10.00은 확정된 사용료가 아니라 **초기 테스트를 위한 "임시 예산(잠정 버퍼)"**입니다. 실제 토큰 소비량에 따라 변동되므로 백엔드에 서킷 브레이커 및 유저별 Rate Limiting을 반드시 구현하여 $10 상한을 방어합니다.

### 4.3 추가 잠재 비용 및 과금 리스크 방어 대책
1. **T4g CPU 크레딧 과금 위험**:
   - T4g 인스턴스가 무제한(Unlimited) 모드인 경우 베이스라인(20%) 초과 시 vCPU시간당 $0.05가 추가 청구됩니다.
   - **방어책**: 인스턴스 시작 시 **`Standard 모드`**를 강제 지정하여 버스트 소진 시 CPU 쓰로틀링만 발생하고 추가 요금은 $0이 되도록 차단합니다.
2. **CloudFront 무료 구간과 아웃바운드 데이터 전송료 (Data Transfer Out)**:
   - **적용 조건 구분**: CloudFront 비용 $0.00은 월정액 유료 상품이 아니라, AWS 모든 계정에 영구 제공되는 **Always Free Tier (월 1TB 데이터 전송, 10,000,000건의 HTTP/HTTPS 요청 무료)**를 적용한 것입니다.
   - **방어책**: 월 1TB 초과 시 종량제 요금(GB당 $0.120)이 발생하며, EC2 직접 인터넷 송출 시 GB당 $0.126가 청구되므로 모든 트래픽이 CloudFront 무료 티어를 경유하도록 Nginx에서 강제합니다.
3. **EBS 스냅샷 누적 비용**:
   - 매일 EBS 스냅샷 생성 후 삭제 주기(Lifecycle)를 지정하지 않으면 스토리지 비용(GB당 월 $0.05)이 계속 누적됩니다.
   - **방어책**: AWS Backup 또는 수명주기 관리자(DLM)를 적용해 최근 7일 치만 보관하고 자동 삭제합니다.
4. **도메인 등록/갱신 비용**:
   - Route 53에서 `.com` 도메인 신규 등록 시 연 $12~$15(월 환산 약 $1.00~$1.25)의 도메인 비용이 추가 발생합니다.

---

## 5. 미검증 영역 및 기술적 위험 (Unverified & Risks)

프로덕션 배포 전 투명하게 공유하는 5대 미검증 항목입니다:

1. **동시 사용자 부하 시의 메모리 스파이크 (`[UNVERIFIED]`):**
   - 단일 시점 실측치 324MiB는 유휴 상태 기준입니다. 동시 접속자가 몰려 Next.js SSR 동적 렌더링이 집중될 때의 메모리 증가 폭은 아직 부하 테스트(k6 등)를 거치지 않았습니다.
2. **백엔드 백그라운드 작업의 중복 실행 위험 (`[UNVERIFIED]`):**
   - Uvicorn 단일 워커(`--workers 1`)로 단일 프로세스 내부 충돌은 차단했으나, **배포 시 구버전-신버전 롤링 교체 구간이나 컨테이너 다중 실행 시에는 알림 중복 발송 위험이 존재**합니다 (`FOR UPDATE SKIP LOCKED` 보완 필요).
3. **ARM64 네이티브 빌드 호환성 (`[UNVERIFIED]`):**
   - 로컬 검증은 x86_64 환경에서 수행되었으므로, AWS Graviton(ARM64) 인스턴스에서의 Python C-extension(`psycopg`, `cryptography`, `pillow`) 컴파일 호환성은 배포 시 직접 확인되어야 합니다.
4. **`t4g.small` 다운사이징 가능 여부 (`[UNVERIFIED]`):**
   - Supabase를 사용할 경우 EC2를 `t4g.small`(2GB RAM, 월 $15.18)로 낮춰 총비용을 $35 수준으로 줄일 수 있다는 이론적 가설이 있으나, Next.js SSR(800MB 한도)과 OS 기본 사용량을 감안할 때 2GB는 OOM 위험이 있어 실부하 검증 전까지는 미검증입니다.
5. **AI API 호출 폭탄 및 무단 과금 리스크 (`[UNVERIFIED]`):**
   - 악의적인 사용자나 봇이 챗봇 API를 반복 호출할 경우 예상 예산($10)을 초과할 수 있으므로, 인증 세션별 토큰 버킷 기반 Rate Limiting 구현 전까지는 상용 노출이 불가합니다.

---

## 6. 강사님께 피드백받아야 할 5대 핵심 기술 결정사항 (Summary)

AWS 실제 배포 전, 강사님께 자문을 구하고 최종 방향을 확정할 5가지 핵심 아젠다입니다:

1. **DB 운영 전략**:
   - `대안 A (Supabase 유지)`: 이전 위험 $0, EC2 메모리 절약, 무료 일시중지 관리 필요 vs `대안 B (EC2 Docker DB)`: <0.5ms 극저지연, 완전 독립 운영, 백업 런북 자체 관리.
   - 👉 *초기 MVP의 안정성과 비용 측면에서 실무적으로 어느 쪽을 더 권장하시는지?*

2. **단일 EC2 (SPOF) 수용 및 가용성 타협**:
   - 월 $50 예산을 위해 고가 관리형 로드밸런서(ALB) 없이 단일 EC2에 Nginx+Next.js+FastAPI+Bot을 통합 운영하는 구조.
   - 👉 *초기 3~6개월 사용자 유치 단계에서 이 정도의 단일 장애점(SPOF)을 감수하는 전략이 타당한지?*

3. **FastAPI 백그라운드 태스크의 멱등성 및 분리 수준**:
   - `expire_forever`, `notification_sender`가 FastAPI Lifespan 내부에서 단일 Uvicorn 워커로 동작 중.
   - 👉 *현재 구조를 유지해도 무방한지, 아니면 초기부터 별도 Worker 컨테이너 및 DB 분산 락(`FOR UPDATE SKIP LOCKED`) 도입이 필수적인지?*

4. **Claude 외부 정기 작업과 AWS Staging 반입 경로**:
   - Claude 작업 결과(`insight_transfer_v1` JSON)를 `GitHub Data PR`로 사람이 승인하는 방식 vs `M2M Webhook API`로 백엔드에 직접 쏘는 방식.
   - 👉 *보안 및 파이프라인 관리 편의성 관점에서 어느 경로가 더 적합한지?*

5. **AI 챗봇 MVP 출시 범위 및 비용 상한선(Rate Limit) 방어**:
   - 초기 런칭 시 Bedrock 경량 모델(Nova Micro / Titan Text Lite) 기반 챗봇을 필수 포함할지, 기능 플래그로 비활성화 후 오픈할지.
   - 👉 *악의적 다중 호출로 인한 토큰 비용 폭탄을 방지하기 위한 실무적인 요청 제한(Rate Limiting) 및 서킷 브레이커 구현 권장안.*

---

## 7. Phase 2 진입 판정: **`CONDITIONAL (Design review completed, awaiting instructor feedback)`**

- **판정 근거**:
  1. Docker 멀티 컨테이너 패키징, 런타임 헬스체크, DB 스키마 초기화, 서울 리전 실단가 정정 등 **로컬 엔지니어링 검증은 완료**되었습니다.
  2. 하지만 **실제 AWS 리소스 생성 및 배포는 강사님 피드백을 통해 위 5대 결정을 확정한 뒤 사용자의 명시적 승인을 거쳐 착수**합니다.
- **다음 단계**:
  - 강사님 브리핑 진행 -> 5대 아젠다 피드백 기록 -> 사용자 배포 승인 시 Phase 2 프로비저닝(IAM, S3, EC2) 진행.
