# 14. CI/CD 자동 배포 계획 (CI/CD Pipeline) — v4

> **상태**: `[PROPOSED]` — 워크플로 파일은 아직 만들지 않았어요. 아래 YAML은 설계 예시이고 실행해 보지 않았어요.
> **목표**: "CI가 통과한 코드만, 사람이 명령을 치지 않아도 매번 같은 순서로 운영에 올라가게" 만들기 (강사님 피드백)
> **작성일**: 2026-11-10
> **강사님 말씀 (2026-11-10, [15](15-instructor-feedback-20261110.md) #5)**: "강의자료에 CI/CD 구현이 있으니 활용하라. CI가 꼭 있어야 하고, 테스트 코드가 다 OK일 때 배포되게 구성하라." → 워크플로를 만들 때 **강의자료의 CI/CD 예제를 먼저 확인**하고 이 문서의 단계에 맞춰요.

---

## 1. 용어부터

| 용어 | 뜻 | 우리 서비스에서 |
|---|---|---|
| **CI** (지속적 통합) | PR마다 테스트·타입 검사·빌드를 자동 실행 | 백엔드 테스트, 프론트 정적 빌드, 마이그레이션 검사 |
| **브랜치 보호 (필수 검사)** | CI가 실패하면 머지할 수 없게 설정 | `develop`, `main`에 설정 |
| **CD** (지속적 배포/전달) | 머지 후 CI 통과를 확인하고 자동으로 배포 | `main` 머지 → 승인 → AWS 배포 |
| **승인 단계** | 운영 배포 직전에 사람이 버튼을 눌러야 진행 | GitHub `environment: production`의 승인자 = DB 담당자 포함 |
| **OIDC** | 영구 키 없이 그때그때 짧은 AWS 권한을 받는 방식 | GitHub Actions → AWS 역할 |

---

## 2. 지금 상태 (2026-11-10 저장소 확인)

| 항목 | 상태 | 근거 |
|---|---|---|
| CI 워크플로 | `Collaboration review regression` 1개가 PR마다 실행 | `.github/workflows/collaboration-reviews-ci.yml` `[CONFIRMED]` |
| 백엔드 테스트 범위 | **지정한 몇 개 파일만** 실행 (리뷰·평판·검색·알림 문구 등). `backend/tests`의 나머지는 실행 안 함 | 같은 파일 `backend-unit` 잡 |
| 프론트 검사 | `npm test`, `tsc`, `lint`, `build` 모두 실행 | `frontend` 잡 |
| 마이그레이션 검사 | 리뷰 테이블 SQL만 확인. 빈 DB에 `alembic upgrade head`는 없음 | `review-postgres-schema` 잡 |
| `push` 트리거 | 지난 기능 브랜치 2개로 고정 (`develop`, `main` 아님) | 같은 파일 `on.push.branches` |
| 브랜치 보호·룰셋 | `develop`, `main` **둘 다 없음** → CI가 실패해도 머지 가능 | GitHub API 확인 |
| 배포 워크플로 | **없음** | `.github/workflows/` |
| 저장소 공개 여부 | 공개(PUBLIC) | GitHub API 확인 |

> 결론: **CI는 있지만 "통과해야 머지"가 강제되지 않고, CD는 아직 없어요.** v4 문서까지의 배포 절차([10](10-operations-runbook.md))는 사람이 EC2에서 명령을 순서대로 치는 수동 방식이에요.

---

## 3. 목표 흐름

```mermaid
flowchart TD
    PR["feature/* → develop PR"] --> CI["CI<br>백엔드 전체 테스트 · 프론트 정적 빌드<br>빈 DB alembic upgrade head · arm64 빌드 확인"]
    CI -->|실패| Block["머지 불가 (브랜치 보호)"]
    CI -->|통과| Dev["develop 머지"]
    Dev --> Rel["develop → main 릴리스 PR (CI 다시 실행)"]
    Rel --> Main["main 머지"]
    Main --> Build["CD 1: arm64 이미지 → ECR<br>프론트 정적 파일 빌드"]
    Build --> Approve{"CD 2: 운영 배포 승인<br>(DB 담당자)"}
    Approve -->|승인| Migrate["CD 3: SSM Run Command<br>alembic upgrade head"]
    Migrate --> Check{"CD 4: current = heads?"}
    Check -->|아니오| Stop["중단 + 디스코드 알림"]
    Check -->|예| Swap["CD 5: backend → discord-bot → nginx 교체"]
    Swap --> Front["CD 6: S3 업로드 · CloudFront 캐시 갱신"]
    Front --> Smoke{"CD 7: 헬스체크 · 주요 화면"}
    Smoke -->|실패| Rollback["이전 이미지·이전 프론트로 롤백 + 알림"]
    Smoke -->|성공| Done["배포 완료 알림"]
```

### 3.1 브랜치 역할

| 브랜치 | 역할 | 자동 실행 |
|---|---|---|
| `feature/<기능명>` | 기능 개발 (AGENTS.md 규칙) | PR 때 CI |
| `develop` | 통합·개발 DB(Supabase) 기준 | CI만 |
| `main` | **운영 배포 기준** | CI + CD |

- 운영 배포는 `develop → main` PR로만 해요. `main`에 직접 커밋하지 않는다는 AGENTS.md 규칙과 맞아요.
- 팀이 다른 브랜치 전략을 원하면 이 표만 바꾸면 돼요 `[팀 결정 필요]`.

### 3.2 팀 규칙이 이렇게 바뀌어요

| 지금 (수동) | CD 도입 후 |
|---|---|
| 개발 DB에 마이그레이션 먼저 → 버전 확인 → PR 머지 | 개발 DB 규칙은 그대로 유지 |
| 운영: 사람이 EC2에서 마이그레이션 → 확인 → 교체 | 운영: `main` 머지 → **파이프라인이** 마이그레이션 → 확인 → 교체 |

- **마이그레이션은 옛 코드와도 함께 동작해야 해요**: 파이프라인은 마이그레이션을 먼저 적용하고 코드를 나중에 바꿔요. 그래서 컬럼은 먼저 추가만 하고, 이름 변경·삭제는 다음 배포로 나눠요 (확장 → 정리 순서).
- **head가 2개 이상이면 배포하지 않아요**: 두 PR이 각각 마이그레이션을 추가하면 생길 수 있어요. CI에서 미리 막아요.

---

## 4. CI 설계 (`ci.yml`)

| 잡 | 하는 일 | 지금과 차이 |
|---|---|---|
| `backend-test` | `uv run pytest -q` (**전체**), `compileall` | 일부 파일 → 전체 |
| `frontend` | `npm test`, `tsc`, `lint`, **정적 빌드**(`output: export`) | 정적 빌드 전환 후 |
| `migration-check` | PostgreSQL 17 서비스에 **빈 DB → `alembic upgrade head`**, `alembic heads`가 1개인지 확인 | 새로 추가 |
| `backend-image` | arm64 Docker 이미지 **빌드만** (올리지 않음) | 새로 추가 |

- 트리거: `pull_request`(`develop`, `main` 대상), `push`(`develop`, `main`), `workflow_call`(CD에서 재사용).
- 브랜치 보호: 위 4개 잡을 **필수 검사**로 지정하고, PR 리뷰 1명 이상을 요구해요 (저장소 관리자가 설정).
- 기존 `review-postgres-schema` 잡은 리뷰 신뢰도 SQL 검증이라 그대로 두거나 `migration-check` 뒤에 붙여요.

```yaml
# [PROPOSED] .github/workflows/ci.yml 핵심만 — 실행해 보지 않은 예시
on:
  pull_request:
    branches: [develop, main]
  push:
    branches: [develop, main]
  workflow_call:
jobs:
  migration-check:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env: { POSTGRES_PASSWORD: ci-only, POSTGRES_DB: labbridge }
        ports: ["5432:5432"]
        options: --health-cmd "pg_isready -U postgres" --health-interval 5s --health-retries 12
    defaults: { run: { working-directory: backend } }
    env:
      DATABASE_URL: postgresql://postgres:ci-only@127.0.0.1:5432/labbridge
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v6
      - run: uv sync --locked
      - run: uv run alembic upgrade head
      - run: test "$(uv run alembic heads | wc -l)" -eq 1   # head가 하나인지
```

---

## 5. CD 설계 (`deploy.yml`)

### 5.1 단계

| 단계 | 어디서 | 내용 |
|---|---|---|
| 0. CI 재실행 | Actions | `uses: ./.github/workflows/ci.yml` — 통과해야 다음 단계 |
| 1. 빌드 | Actions (arm64) | backend 이미지 → ECR (태그 = 커밋 SHA), 프론트 정적 빌드(`NEXT_PUBLIC_API_BASE_URL=/api/v1`) → 아티팩트 |
| 2. 승인 | GitHub | `environment: production` 승인자(DB 담당자 포함)가 승인 |
| 3~5. 서버 배포 | EC2 (SSM Run Command) | `/opt/labbridge/deploy.sh <SHA>` 실행: pull → `alembic upgrade head` → `current = heads` 확인 → backend → discord-bot → nginx 교체 |
| 6. 프론트 | Actions | `aws s3 sync out/ s3://labbridge-frontend-apne2 --delete` → `cloudfront create-invalidation` |
| 7. 확인 | Actions | `/api/v1/health`, `/`, `/workspace/0` 응답 확인 → 실패 시 롤백 |
| 알림 | Actions | 결과를 팀 디스코드 채널로 (웹훅) |

- **한 번에 하나만**: `concurrency: production`으로 배포가 겹치지 않게 해요.
- **서버 접속은 SSH가 아니라 SSM Run Command**: 22번 포트를 계속 닫아 둘 수 있어요. EC2 대상 Run Command는 추가 요금이 없어요 (요금은 AWS 밖 서버 대상) `[CONFIRMED: SSM pricing 2026-11]`.
- **프론트는 API 교체 뒤에 올려요**: 새 화면이 아직 없는 API를 부르지 않게 하기 위해서예요.

### 5.2 EC2의 배포 스크립트 (`/opt/labbridge/deploy.sh`)

[10](10-operations-runbook.md) 1절의 수동 절차를 스크립트 하나로 묶은 것이에요. 파이프라인과 사람이 **같은 스크립트**를 써요.

```bash
#!/usr/bin/env bash
# [PROPOSED] 사용법: deploy.sh <이미지 태그>
set -euo pipefail
TAG="$1"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"
export IMAGE_TAG="$TAG"
$COMPOSE images > /tmp/before-deploy.txt          # 롤백 기록
$COMPOSE pull backend discord-bot
$COMPOSE run --rm backend alembic upgrade head      # 마이그레이션 먼저
CURRENT=$($COMPOSE run --rm backend alembic current | awk '{print $1}' | tail -1)
HEADS=$($COMPOSE run --rm backend alembic heads | awk '{print $1}')
[ "$CURRENT" = "$HEADS" ] || { echo "DB 버전 불일치: $CURRENT != $HEADS"; exit 1; }
$COMPOSE up -d --no-deps backend
$COMPOSE up -d --no-deps discord-bot
$COMPOSE up -d --no-deps nginx
curl -fsS http://127.0.0.1/healthz
```

### 5.3 롤백

| 실패 지점 | 자동 처리 | 사람이 할 일 |
|---|---|---|
| CI·빌드 | 배포 시작 안 함 | 코드 수정 |
| 마이그레이션·버전 확인 | 중단, 컨테이너는 이전 그대로 | **DB 담당자가 원인 확인** (자동 downgrade 안 함) |
| 컨테이너 교체 후 확인 실패 | 이전 이미지 태그로 되돌림 | 원인 확인 |
| 프론트 확인 실패 | 이전 빌드 아티팩트를 S3에 다시 올림 | 원인 확인 |

---

## 6. 권한과 비밀값

### 6.1 GitHub Actions용 AWS 역할 (`LabBridgeGitHubDeployRole`, OIDC)
- **신뢰 조건**: 이 저장소의 `main` 브랜치와 `production` 환경에서 실행될 때만 역할을 받을 수 있어요.

| 권한 | 범위 |
|---|---|
| ECR 이미지 올리기 | `labbridge-backend` 저장소만 |
| `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` | 프론트 버킷만 |
| `cloudfront:CreateInvalidation` | 해당 배포만 |
| `ssm:SendCommand`, `ssm:GetCommandInvocation` | 운영 EC2 1대 + **`deploy.sh`만 실행하는 전용 SSM 문서** |

- 아무 명령이나 실행할 수 있는 `AWS-RunShellScript` 대신, `deploy.sh <태그>`만 실행하는 전용 문서를 만들어 권한을 좁혀요 `[PROPOSED]`.
- **운영 DB 비밀번호·JWT 키는 GitHub에 두지 않아요.** EC2가 SSM Parameter Store에서 직접 읽어요 ([03](03-network-security.md) 5절).

### 6.2 GitHub에 두는 값
| 이름 | 종류 | 비고 |
|---|---|---|
| `AWS_DEPLOY_ROLE_ARN` | 변수 | 비밀 아님 |
| `CLOUDFRONT_DISTRIBUTION_ID` | 변수 | 비밀 아님 |
| `DISCORD_DEPLOY_WEBHOOK` | 비밀(Secret) | 배포 알림 채널용. 운영 봇 토큰과 다른 값 |

---

## 7. 비용

| 항목 | 비용 | 확인 |
|---|---|---|
| GitHub Actions 실행 시간 | 공개 저장소라 부담 적음 | arm64 실행 환경 무료 여부 `[UNVERIFIED]` |
| SSM Run Command (EC2 대상) | $0 | `[CONFIRMED]` |
| ECR 이미지 저장 | 약 $0.20/월 (08번 비용표에 포함) | `[UNVERIFIED]` |
| ALB, CodeDeploy, CodePipeline | 사용 안 함 | — |

---

## 8. 도입 순서 (단계적으로)

| 단계 | 내용 | AWS 필요? |
|---|---|---|
| **1** | CI를 백엔드 전체 테스트 + `migration-check`로 넓히고, `push` 트리거를 `develop`·`main`으로 정리 | 아니요 (지금 가능) |
| **2** | `develop`·`main`에 브랜치 보호(필수 검사) 켜기 | 아니요 (관리자 권한 필요) |
| **3** | 프론트 정적 빌드·arm64 이미지 빌드를 CI에 추가 ([09](09-deployment-roadmap.md) B2, B7) | 아니요 |
| **4** | `deploy.sh`를 만들어 **수동 실행**으로 첫 배포 리허설 | 예 |
| **5** | `deploy.yml`을 `workflow_dispatch`(버튼으로만 실행)로 시작 | 예 |
| **6** | 익숙해지면 `main` 머지 시 자동 실행 + 승인 단계 유지 | 예 |

---

## 9. 아직 확인하지 못한 것
- 백엔드 전체 테스트를 GitHub Actions(Linux)에서 실행했을 때 결과 (로컬 Windows 결과는 아래 9.1절)
- 공개 저장소에서 arm64 실행 환경(`ubuntu-24.04-arm`) 무료 사용 여부, ECR 요금
- 전용 SSM 문서로 `deploy.sh`만 허용하는 IAM 정책의 실제 동작
- `alembic current` 출력 형식에 맞춘 버전 비교 스크립트 (위 예시는 실행 전)

### 9.1 백엔드 전체 테스트 로컬 실행 결과 (2026-11-10)
- 명령: `uv run pytest -q` (백엔드 전체, CI와 같이 실제 DB 없이 가짜 접속 정보 사용)
- 결과: **721 passed, 4 skipped, 실패 0** · 약 4분 53초 · 경고 10개(디스코드 라이브러리 지원 종료 예정 안내, 테스트용 짧은 JWT 키)
- 의미: CI의 `backend-test`를 **전체 테스트로 넓혀도 지금 코드는 통과**해요. 실행 시간이 5분 정도라 PR마다 돌려도 부담이 크지 않아요.
- 한계: Windows 개발 PC에서 실행했어요. GitHub Actions(Linux)에서는 아직 돌려 보지 않았어요 `[UNVERIFIED]`.
