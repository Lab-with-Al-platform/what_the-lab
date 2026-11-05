# 00. 프로젝트 감사 및 현황 분석 (Project Audit) — 개정판

> **상태 표기 기준**:
> - `[CONFIRMED]`: 실제 저장소 코드, 설정 파일, 최신 QA 결과 문서에서 직접 확인된 사실
> - `[INFERRED]`: 코드 구조 및 기존 커밋/문서를 통해 합리적으로 추론된 내용
> - `[PROPOSED]`: AWS 운영을 위해 새롭게 제안하는 설계 사항
> - `[UNKNOWN]`: 현재 저장소에 정보가 없거나 향후 결정이 필요한 항목

---

## 1. 개요 및 저장소 정보

- **프로젝트명**: WHAT THE LAB (`[CONFIRMED: README.md]`)
- **서비스명**: LabBridge (`[CONFIRMED: frontend/package.json, backend/app/main.py]`)
- **서비스 목적**: 연구자와 AI 전문가 간의 매칭 및 산학·연구 협업 지원 플랫폼 (`[CONFIRMED: docs/product/MVP_SCOPE.md]`)
- **AWS 목표 리전**: `ap-northeast-2` (AWS 서울 리전) (`[PROPOSED]`)
- **운영 목표**: 단기 시연이 아닌 장기 프로덕션 서비스 운영 (초기 월 인프라 예산 목표: **$50 내외**) (`[PROPOSED]`)

---

## 2. 계층별 기술 스택 및 데이터베이스 실태 분석

### 2.1 Database 실태 (Supabase vs Docker)
- **팀 공통 개발 DB**: **Supabase PostgreSQL** (`[CONFIRMED: docs/development/SHARED_DATABASE_GUIDE.md]`)
  - 프로젝트 `labbridge-dev`, Session Pooler (`5432`)를 통해 접속.
  - Supabase Auth를 직접 쓰지 않고, PostgreSQL DB 엔진만 FastAPI가 JWT 기반으로 직접 연결하여 사용 (`RLS 활성화 및 anon/authenticated 직접 접근 차단`).
  - 설정 우선순위: `DATABASE_URL` 우선, 없을 때만 로컬 `DB_*` 환경변수 적용 (`[CONFIRMED: app/database_config.py]`).
- **로컬 Docker PostgreSQL**:
  - `docker-compose.yml`에 `postgres:17` 컨테이너 정의 (개발자 개인 로컬 테스트용 선택 사항).
- **마이그레이션 이력**:
  - `database/init/001_create_tables.sql` ~ `031_add_collab_ending.sql` (총 31개 스키마 파일).
  - Alembic 버전 테이블 이름은 호환성을 위해 `insight_alembic_version` 유지 (최신 head: `20261104_27` / 협업 디스코드 및 receipt 반영 완료).

### 2.2 Frontend
- **프레임워크**: Next.js `^15.5.29`, React `^19.1.1` (App Router 기반), Tailwind CSS `^4.1.13`.
- **렌더링 방식**: SSR (Server-Side Rendering) + Client Component (`"use client"`) 혼합.
- **정적 호스팅(S3 단독 배포) 불가**: `output: 'export'` 미사용, 동적 라우팅(`[slug]`, `[id]`) 및 `/api/v1/:path*` rewrite 프록시 사용 (`[CONFIRMED: frontend/next.config.ts]`). Node.js 22 런타임 필수.

### 2.3 Backend
- **프레임워크**: FastAPI `^0.143.0`, Uvicorn `^0.54.0`, Python `>= 3.13`, 패키지 매니저 `uv`.
- **상시 백그라운드 태스크**: FastAPI `lifespan` 내에서 `expire_forever`(협업 요청 만료), `daily_forever`, `notification_sender.run_forever`(알림 큐 발송), `google_sync.run_forever` 상시 구동 (`[CONFIRMED: backend/app/main.py]`).
- **헬스체크**: `GET /api/v1/health` 구현됨 (`{"status": "ok"}`).

---

## 3. Discord 연동 구현 현황 상세 감사

| 기능 항목 | 구현 상태 | 프로토콜 및 세부 구현 내용 | AWS 배포 시 영향 |
|---|---|---|---|
| **Discord OAuth2 로그인** | `CONFIRMED (완료)` | HTTP REST API (`https://discord.com/api/oauth2/token`, `/users/@me`). JWT 토큰 발급 및 `users.discord_id` 매핑 (`[backend/app/routers/auth.py]`) | Gateway 불필요. `DISCORD_REDIRECT_URI` 환경변수만 도메인으로 갱신 |
| **길드 자동 참여 (`guilds.join`)** | `CONFIRMED (완료)` | HTTP REST API (`PUT /guilds/{id}/members/{id}`). 로그인 시 발급받은 access_token 활용 (`[backend/app/discord_bot.py]`) | Gateway 불필요. REST API로 정상 동작 |
| **Discord 1:1 DM 알림** | `CONFIRMED (완료)` | HTTP REST API v10 (`POST /users/@me/channels` -> `POST /channels/{id}/messages`). 지수 백오프 및 `DmBlocked` 예외 처리 완비 (`[backend/app/discord_bot.py]`, `notification_sender.py`) | Gateway 불필요. 백엔드 워커에서 독립 발송 |
| **협업 전용 비공개 채널 생성** | `CONFIRMED (완료)` | HTTP REST API (`POST /guilds/{id}/channels`). 연구자+전문가+봇 3자만 열람 가능한 비공개 텍스트 채널 자동 생성 (`[backend/app/collab_channel.py]`) | Gateway 불필요. 카테고리 ID(`DISCORD_COLLAB_CATEGORY_ID`) 설정만 필요 |
| **협업 채널 슬래시 커맨드 (`/요청`, `/일정`)** | `CONFIRMED (완료)` | **WebSocket Gateway 필수 (`discord.py`)**. 채널 내 대화형 모달 및 `[요청 관리]` 버튼 인터랙션 처리 (`[backend/app/discord_gateway.py]`) | **상시 웹소켓 연결 리스너 프로세스 필요**. 독립 컨테이너로 운영 권장 |
| **계정 연동 해제** | `CONFIRMED (완료)` | 마이페이지 설정에서 연동 해제 지원 (`[backend/app/routers/auth.py]`) | 특이사항 없음 |

---

## 4. 인사이트 자동화 구현 현황 재평가 (Phase 0 ~ Phase 6)

`docs/planning/` 및 `docs/qa/INSIGHT_AGENT_PHASE_0_RESULT.md ~ PHASE_6_RESULT.md` 분석 결과, 기존에 상당한 핵심 기능이 이미 개발 및 검증되어 있음을 확인했습니다.

| 구현 항목 | 구현 상태 | 위치 및 세부 검증 내용 |
|---|---|---|
| **Insight Transfer v1** | `CONFIRMED (완료)` | 본문 Markdown, 핵심 용어 풀이, 12점 평가, 출처 서지, SHA-256 전송 무결성 검증 (`[backend/app/insights/transfer_contract.py]`) |
| **전송 묶음 접수 이력 (Receipt)** | `CONFIRMED (완료)` | `insight_private.transfer_receipts` 테이블 추가. `(trust_scope, bundle_id)` 고유키, 동일 바이트 replay, 내용 불일치 충돌(409) 방지 (`[022_add_transfer_receipts.sql]`) |
| **역할·권한·예산 계약** | `CONFIRMED (완료)` | `insight_agent_role_v1`: coordinator, researcher, evidence_checker, case_writer, trend_writer, editor 역할 고정 및 자칭 권한 거절 (`[backend/app/insights/agent_contract.py]`) |
| **가짜 모델 워크플로우** | `CONFIRMED (완료)` | 조사→근거 점검→작성→편집의 고정 파이프라인. 후보 부족, 출처 에러, 재시도 초과 제어 (`[backend/app/insights/agent_flow.py]`) |
| **작업 저장 및 중단·재개** | `CONFIRMED (완료)` | `agent_runs` 테이블을 통한 프로세스 외부 상태 저장 및 안전한 재개, 동시 실행 임대(lease) 락 (`[backend/app/insights/agent_checkpoint.py]`) |
| **관리자 검토 화면 연결** | `CONFIRMED (완료)` | `pending_review` 상태 적재 후 관리자 화면(`/admin/insights`)에서 원고 수정 및 최종 승인 연결 (`[backend/app/insights/agent_review.py]`) |
| **LangGraph 비교 실험 및 결론** | `CONFIRMED (보류)` | LangGraph 1.2.18 비교 결과, 앱 기본 실행기 편입 **보류 확정** (`[docs/qa/INSIGHT_AGENT_PHASE_6_RESULT.md]`).<br>- 근거: 고정 흐름은 기존 Python 함수로 충분, RAM checkpointer는 운영 재개에 무용, 패키지 및 복잡도 증가 방지 |
| **외부 Claude 정기 작업 연동** | `UNKNOWN (Phase 7)` | Claude 클라우드 예약 작업과의 실제 연동 및 Git PR 제출 경로는 AWS Phase 0 시점 미완료 상태 (검증 필요) |

---

## 5. 결론 및 AWS 설계 보완 방향
1. **DB 배포 전략**: Supabase PostgreSQL(팀 공통 DB)을 계속 활용할지, AWS RDS 또는 EC2 내부 Docker DB로 이전할지 철저한 비교 필요.
2. **Discord 인프라**: 슬래시 커맨드/버튼을 사용하려면 `discord_gateway` 컨테이너가 필수이나, 알림/채널 생성/로그인은 순수 REST API이므로 백엔드와 분리된 단일 Gateway 봇 컨테이너로 격리 운영하는 것이 최적.
3. **인사이트 자동화**: LangGraph 등 신규 프레임워크를 절대 도입하지 않고, 이미 완성된 `agent_contract.py`, `agent_flow.py`, `transfer_receipts`를 그대로 재사용하여 외부 Claude 작업의 인입 게이트로 연결.
