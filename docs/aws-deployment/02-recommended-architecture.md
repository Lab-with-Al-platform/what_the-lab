# 02. 최종 권장 아키텍처 설계 (Recommended Architecture) — 개정판

> **상태**: `[PROPOSED]`  
> **리전**: AWS 서울 리전 (`ap-northeast-2`)  
> **핵심 목표**: 월 $50 내외의 초저비용 운영, Discord Gateway 상시 연결과 알림의 안정적 분리, 컨테이너별 메모리 제한을 통한 단일 인스턴스 OOM 방지.

---

## 1. 전체 아키텍처 구성도

```mermaid
flowchart TB
    subgraph Users ["🌐 외부 사용자 및 클라이언트"]
        Browser["웹 브라우저 (사용자)"]
        DiscordApp["Discord 사용자 / 채널"]
        ClaudeTask["Claude 클라우드 정기 작업<br>(외부 인사이트 수집·분석)"]
    end

    subgraph AWS ["☁️ AWS ap-northeast-2 (Seoul)"]
        R53["Amazon Route 53 (DNS)"]
        CF["Amazon CloudFront<br>(CDN + ACM 무료 와일드카드 SSL)"]
        S3Bucket["Amazon S3 버킷<br>(uploads / pdfs / db-backups)"]
        Bedrock["Amazon Bedrock 경량 AI 모델<br>(Nova Micro / Titan Text Lite)"]

        subgraph EC2Host ["단일 EC2 인스턴스 (t4g.medium, ARM64, 2vCPU 4GB)"]
            IAM["IAM Instance Profile<br>(S3, Bedrock, SSM 권한)"]
            
            subgraph DockerNet ["Docker Compose 격리 브리지 네트워크 (labbridge_net)"]
                Nginx["1. Nginx Reverse Proxy<br>(Port 80/443 종단, 헤더 검증)<br>[메모리 한도: 128MB]"]
                FE["2. Frontend 컨테이너<br>(Next.js 15 Standalone SSR)<br>[메모리 한도: 800MB]"]
                BE["3. Backend API 컨테이너<br>(FastAPI + notification_sender)<br>[메모리 한도: 600MB]"]
                Bot["4. Discord Gateway Bot<br>(discord.py 상시 리스너)<br>[메모리 한도: 300MB]"]
                LocalDB[("5. PostgreSQL 17 (선택)<br>(pgvector 내장 컨테이너)<br>[메모리 한도: 1.2GB]")]
            end
            
            EBS[("EBS gp3 (50GB)<br>컨테이너 로그 & 볼륨")]
        end
    end

    subgraph ExternalDB ["🐘 데이터베이스 선택지"]
        Supabase[("Supabase PostgreSQL (labbridge-dev)<br>팀 공통 DB 유지 (Session Pooler)")]
    end

    %% 트래픽 흐름
    Browser -->|1. HTTPS| R53 --> CF
    CF -->|2. Custom Header 포함 전달| Nginx
    Nginx -->|/api/v1/*| BE
    Nginx -->|SSR/정적 페이지| FE
    
    %% DB 연결 (선택에 따름)
    BE -.->|안 A: 외부 연결| Supabase
    BE -->|안 B: 내부 로컬 연결| LocalDB
    Bot -->|내부 비즈니스 로직| BE
    
    %% 외부 서비스 통신
    Bot <-->|상시 WebSocket| DiscordApp
    BE -->|알림 발송 REST API v10| DiscordApp
    BE -->|파일 업로드 Presigned URL| S3Bucket
    BE -->|AI 챗봇 / RAG 추론| Bedrock
    
    %% Claude 인입
    ClaudeTask -->|Git PR 또는 Staging API| BE
```

---

## 2. Docker Compose 컨테이너 자원 분배 및 안전 장치 (OOM 방지)

단일 EC2 호스트(`t4g.medium` 4GB RAM)에서 특정 컨테이너의 메모리 누수로 인해 전체 서버가 다운(OOM Crash)되는 사고를 방지하기 위해 엄격한 리소스 한도(Resource Limit)를 설정합니다.

### 2.1 컨테이너별 메모리/CPU 할당 명세

| 서비스명 | 권장 메모리 Limit | 예약 메모리(Reservations) | CPU Limit | 재시작 정책 | 로깅 제한 |
|---|---|---|---|---|---|
| **nginx** | `128 MB` | `64 MB` | 0.25 vCPU | `unless-stopped` | 10MB x 3개 |
| **frontend** | `800 MB` (최대 1GB) | `384 MB` | 0.75 vCPU | `unless-stopped` | 10MB x 3개 |
| **backend** | `600 MB` (최대 768MB) | `256 MB` | 0.75 vCPU | `unless-stopped` | 10MB x 3개 |
| **discord-bot** | `300 MB` (최대 384MB) | `128 MB` | 0.25 vCPU | `unless-stopped` | 10MB x 3개 |
| **postgres** (안 B 적용 시) | `1.2 GB` | `512 MB` | 0.50 vCPU | `unless-stopped` | 10MB x 3개 |
| **OS 및 시스템 버퍼** | 약 `1.0 GB` 확보 | — | — | — | — |
| **합계 (Total)** | **약 2.9 GB ~ 3.5 GB / 4.0 GB** (완전 안전 영역 유지) | — | — | — | — |

> [!TIP]
> **안 A (Supabase 유지 시)의 이점**:
> PostgreSQL 컨테이너(`1.2GB`)가 빠지므로, 더 저렴한 **`t4g.small` (2GB RAM, 월 약 $13)**으로도 인프라를 충분히 구동할 수 있어 비용을 극대화하여 절감할 수 있습니다.

---

## 3. 컨테이너 장애 복구 및 생명주기 관리

1. **Graceful Shutdown**:
   - `stop_grace_period: 30s`를 지정하여 백엔드 비동기 워커가 진행 중인 Discord 알림 발송이나 DB 트랜잭션을 안전하게 커밋하고 종료할 수 있도록 보장합니다.
2. **Discord Gateway Bot 자동 재연결**:
   - Discord 네트워크 일시 단절 시 `discord.py` 라이브러리의 지수 백오프 자동 재연결(`reconnect=True`)이 작동하며, 치명적 에러로 종료되더라도 Docker의 `restart: unless-stopped` 정책에 의해 3초 내에 자동 재부팅됩니다.
3. **로그 로테이션 (Log Rotation)**:
   - 모든 컨테이너에 `json-file` 드라이버와 `max-size: "10m"`, `max-file: "3"`을 강제하여 Docker 로그가 디스크(EBS)를 가득 채우는 사고를 원천 방지합니다.
4. **Health Check 구성**:
   - Nginx: `curl -f http://localhost/ || exit 1`
   - Backend: `curl -f http://localhost:8000/api/v1/health || exit 1`
   - Frontend: `curl -f http://localhost:3000/ || exit 1`
