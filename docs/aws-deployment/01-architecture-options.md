# 01. AWS 아키텍처 옵션 비교 분석 (Architecture Options) — v3

> **v4 (2026-11-09)**: 강사님 피드백으로 프론트는 S3 + CloudFront 정적 배포로 바뀌었어요. 아래 3절의 nginx는 API 전용으로 남아요 ([02](02-recommended-architecture.md)).
>
> **v3 결론 (2026-11-06)**: 운영 DB는 **안 C(RDS) `db.t4g.micro` Single-AZ**를 권장안으로 바꿨어요. 개발 DB는 공용 Supabase를 그대로 써요. 서버는 DB가 빠지므로 `t4g.small`부터 시작해요. 비용은 [08](08-cost-estimate.md) 기준 AWS 월 $43.89예요. 아래 표의 v2 판단은 비교 기록으로 남기고, 틀린 사실은 바로잡았어요.

> **문서 목적**: WHAT THE LAB 서비스를 AWS 서울 리전(`ap-northeast-2`)에 월 $50 내외의 초저비용으로 안정 운영하기 위한 핵심 인프라 옵션들을 심층 비교합니다.

---

## 1. 데이터베이스 배포 전략 심층 비교 (Supabase vs EC2 DB vs RDS)

기존 팀 공통 DB가 **Supabase PostgreSQL**(`docs/development/SHARED_DATABASE_GUIDE.md`)로 구축되어 있는 현황을 바탕으로 3가지 전략을 비교합니다.

| 비교 항목 | 안 A: 기존 Supabase 유지 | 안 B: EC2 내부 PostgreSQL (Docker) | 안 C: AWS RDS PostgreSQL 이전 |
|---|---|---|---|
| **초기 월 운영비** | **$0** (무료 플랜) / 운영용 Pro **$25/월~** | **$0** (EBS 용량 약 $2~$3/월만 추가) | **`db.t4g.micro` $18.25 + gp3 20GB $2.62 = $20.87/월** (서울 공식 단가, v3 정정) |
| **데이터 이전 위험** | **위험 $0** (현재 DB와 계정 데이터 100% 보존) | **보통** (`pg_dump` 후 EC2로 데이터 이관 필요) | **보통~높음** (덤프 이관 및 RDS 설정 필요) |
| **마이그레이션 호환성** | `[CONFIRMED]` 완벽 호환 (Alembic `insight_alembic_version` 연동 중) | 완벽 호환 (동일 PostgreSQL 17) | 완벽 호환 |
| **pgvector 확장 지원** | `[CONFIRMED]` 공식 내장 지원 | `pgvector/pgvector:pg17` 이미지로 지원 | RDS 파라미터 그룹 설정으로 지원 |
| **백업 및 복원** | **Free 플랜은 자동 백업 없음**(Pro부터 제공, supabase.com/pricing 2026-11) — v3 정정 | **수동 스크립트 작성 필수** (S3 업로드 Cron) | AWS 콘솔 PITR(시점 복원) 자동화 |
| **인증 및 기존 ID 유지** | `users.user_id` 및 Discord ID 완전 유지 | 덤프 복원 시 완전 유지 | 덤프 복원 시 완전 유지 |
| **네트워크 지연/보안** | 서울 리전 간 공인망 SSL 통신 (지연 약 10~25ms) | **로컬 브리지 통신 (< 0.5ms)**, 외부 직접 노출 차단 | **VPC Private Subnet (< 1ms)**, 외부 차단 |
| **팀 협업 환경 영향** | 팀원 로컬 개발 환경(`develop`)과 100% 동일 유지 | 로컬 개발과 운영 DB 분리 필요 | 로컬 개발과 운영 DB 분리 필요 |
| **무료 플랜 중단 위험** | ⚠️ **7일 비활성 시 일시 중지(Pause) 위험** (상용 서비스 시 Pro $25 권장) | 중단 위험 없음 (EC2 실행 중 상시 가동) | 중단 위험 없음 |
| **장기 운영 적합성** | 초기~중기 우수 (관리 부담 최소) | 초기 초저비용에 최적, 트래픽 증가 시 분리 필요 | 대규모 서비스에 최적 |

### 1.1 DB 전략 평가 및 결론
- **Phase 1 초기 권장 결론**:
  - **1순위 (초극단 절약 $30): 안 A (Supabase 유지)**: 데이터 이전 작업 없이 AWS에는 Frontend/Backend/Bot만 배포하여 위험을 $0으로 만들고 비용을 극소화함. (단, Supabase 무료 플랜의 일시정지 방지를 위해 주기적 헬스체크 핑 필요).
  - **2순위 (안정적 $50 권장): 안 B (EC2 내부 PostgreSQL 운영)**: Supabase의 네트워크 지연 및 외부 의존성을 제거하고, EC2 인스턴스 내부에서 Docker 볼륨 + S3 자동 백업으로 통합 운영.
  - ~~안 C (RDS)는 초기 월 $50 예산 초과 위험이 있으므로 유보~~ → **v3: DB를 서버 밖으로 빼면 EC2를 `t4g.small`로 줄일 수 있어 RDS를 넣어도 AWS 월 $43.89로 예산 안에 들어와요. 운영 데이터 분리·자동 백업·시점 복원 때문에 v3 권장안이에요.**

---

## 2. Discord 연동 컴포넌트 실행 방식 비교

코드 감사 결과, OAuth 로그인/DM 알림/채널 생성은 HTTP REST API로 동작하며, **오직 `/요청`, `/일정` 슬래시 커맨드 및 버튼 인터랙션만 WebSocket Gateway 연결을 요구**합니다 (`[CONFIRMED]`).

| 실행 구성 | 1. Backend 프로세스 통합 | 2. Docker Compose 멀티 컨테이너 (권장) | 3. ECS Fargate 분리 서비스 | 4. AWS Lambda |
|---|---|---|---|---|
| **프로세스 격리** | 낮음 (FastAPI 재시작 시 봇도 재시작) | **높음** (Web API 배포 중에도 봇 세션 유지) | 매우 높음 (독립 클러스터 태스크) | 적용 불가 |
| **장애 전파** | 봇 메모리 누수 시 Web API 다운 위험 | **장애 격리 완벽** (컨테이너별 자원 제한) | 장애 격리 완벽 | — |
| **상시 WebSocket** | 지원 | **지원 (`restart: always` 자동 재연결)** | 지원 | **지원 불가 (연결 유지 불가로 탈락)** |
| **추가 비용** | $0 | **$0 (동일 EC2 자원 공유)** | 태스크당 월 $15~$25 추가 | — |
| **운영 복잡도** | 매우 단순 | **단순 (`docker-compose.yml` 관리)** | 중간 (태스크 정의, 클러스터) | — |

- **결론**: **옵션 2 (Docker Compose 멀티 컨테이너 분리)**가 가장 안정적입니다.
  - `backend` (FastAPI REST API + notification_sender)
  - `discord-bot` (`python -m app.discord_gateway` 상시 웹소켓 리스너)

---

## 3. 리버스 프록시 및 HTTPS 종단 옵션 비교 (Nginx vs Caddy)

| 비교 항목 | 옵션 1: Nginx + CloudFront | 옵션 2: Caddy (단독 호스팅) | 옵션 3: Nginx + Certbot (Let's Encrypt) |
|---|---|---|---|
| **SSL 인증서** | **ACM 무료 와일드카드 SSL (CloudFront)** | Let's Encrypt 자동 발급 내장 | Certbot Cron 갱신 필요 |
| **정적 에셋 캐싱** | **CloudFront 글로벌 엣지 로케이션 자동 캐싱** | 호스트 자체 캐시 (트래픽 EC2 집중) | 호스트 자체 캐시 (트래픽 EC2 집중) |
| **오리진 보호** | **Prefix List (L3/L4) + Custom Header (L7) 다계층 차단** | 직접 공인 IP 노출 | 직접 공인 IP 노출 |
| **구성 난이도** | 표준적이며 널리 검증됨 | 설정이 극도로 간결함 | 무난함 |

- **결론**: **옵션 1 (CloudFront + ACM + Prefix List + Nginx 오리진 검증)**을 유지해요. 단, v3에서 **CloudFront→EC2 구간도 HTTPS**(오리진에 Let's Encrypt 인증서, DNS-01)로 바꾸고 보안 그룹은 443만 열어요 ([03](03-network-security.md)). "완벽 차단"이 아니라 직접 접속을 크게 줄이는 2단계 방어예요.
