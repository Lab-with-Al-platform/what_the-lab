# 17. 배포 실행 가이드 — 내가 할 일 순서대로 (Deployment Execution Guide)

> **상태**: `[PROPOSED]` — 실제로 진행하면서 명령·화면 이름이 다르면 이 문서를 고쳐요.
> **작성일**: 2026-11-13
> **이 문서의 역할**: 09번(로드맵)은 "무엇을 해야 하나", 이 문서는 **"내가 어떤 순서로, 어디서, 무엇을 누르고 실행하나"**예요. 각 단계 끝의 **💡 알아 둘 것**은 그 단계에서 처음 만나는 개념이나 실수하기 쉬운 점이에요.
> **확정된 구성**: S3 + CloudFront 프론트 / EC2 `t4g.micro` 1대(Docker Compose: nginx·backend·discord-bot) / 비공개 RDS `db.t4g.micro` / ALB 없음 / AWS 월 약 $36.31 ([08](08-cost-estimate.md)).

---

## 전체 흐름 한눈에

| 단계 | 할 일 | 어디서 | AWS 비용 시작? | 예상 시간 `[ESTIMATE]` |
|---|---|---|---|---|
| 0 | 역할 나누기, 준비물 | 팀 | — | 반나절 |
| 1 | 코드 준비 PR (B1~B5, B12) | GitHub | 아니요 | 3~5일 |
| 2 | 로컬 리허설 (B6, B7) | 내 PC, GitHub Actions | 아니요 | 1일 |
| 3 | AWS 계정 보안·예산 경보 | AWS 콘솔 | 아니요 | 1~2시간 |
| 4 | 네트워크 (VPC·서브넷·보안 그룹) | AWS 콘솔 | 아니요 | 1시간 |
| 5 | 운영 DB (RDS) | AWS 콘솔 | **예** | 1시간 |
| 6 | 서버 (EC2) + 스왑 + Docker | AWS 콘솔, SSM | **예** | 2시간 |
| 7 | 비밀값 (SSM Parameter Store) | AWS 콘솔 | 아니요 | 1시간 |
| 8 | 이미지 → 마이그레이션 → 기동 | GitHub Actions, EC2 | 소액 | 반나절 |
| 9 | 도메인·인증서·S3·CloudFront | AWS 콘솔 | 소액 | 반나절~1일 |
| 10 | micro 부하 테스트 (B8) | 내 PC (k6) | — | 반나절 |
| 11 | 모니터링 (대시보드·로그·경보) | CloudWatch | 소액 | 2시간 |
| 12 | 전환하는 날 (Render → AWS) | 디스코드, Render, Route 53 | — | 2시간 + 하루 관찰 |
| 13 | 자동 배포 연결 (CI/CD) | GitHub | — | 1~2일 |
| 14 | 2주 테스트 운영 → micro 유지/small 결정 | CloudWatch, 기록표 | — | 2주 |

- **순서가 중요한 곳**: 1 → 2를 끝내기 전에 5·6(비용이 나가는 리소스)을 만들지 않아요. 만들어 놓고 코드가 준비 안 되면 빈 서버 요금만 나가요.
- **11(모니터링)은 12(전환)보다 먼저** 해요. 실제 사용자가 들어오기 전에 그래프가 보여야 2주 기록을 처음부터 남길 수 있어요.

---

## 0단계. 역할 나누기와 준비물

| 역할 | 하는 일 | 이 문서 단계 |
|---|---|---|
| 인프라 담당 (나) | AWS 리소스 생성, 서버 설정, 모니터링 | 3~11, 14 |
| 백엔드 담당 | B1·B3·B5 코드, 로그에 비밀값이 안 찍히는지 확인 | 1 |
| 프론트 담당 | B2 정적 빌드 전환, B10 주소 시험 | 1, 9 |
| DB 담당 | B6 리허설, **운영 RDS 마이그레이션 실행·확인**, B11 조회 전용 계정 | 2, 8 |
| 디스코드 담당 | B9 개발용 앱 분리, 전환 날 봇 확인 | 1, 12 |

준비물 (내 PC):
- AWS CLI v2, **Session Manager 플러그인** (SSM 접속·터널에 필요)
- Docker Desktop, k6 (부하 테스트)
- 도메인 (아직 없다면 Route 53에서 사거나, 다른 곳에서 산 뒤 Route 53으로 연결)

> 💡 **알아 둘 것**: 운영 DB를 바꾸는 명령(`alembic upgrade`, 복원)은 **DB 담당자가 실행하거나 옆에서 확인**하기로 했어요 ([10](10-operations-runbook.md) 머리말). 혼자 진행하더라도 8단계는 DB 담당자와 시간을 맞춰요.

---

## 1단계. 코드 준비 (AWS 없이 지금 가능)

09번 차단 항목 중 **코드 수정**이 필요한 것들이에요. AGENTS.md 규칙대로 **한 PR에 한 목적**으로 나눠요.

| PR | 내용 | 차단 항목 |
|---|---|---|
| ① | compose 비밀값 기본값 제거 (`${JWT_SECRET:?…}`), `FRONTEND_URL` → `NEXT_PUBLIC_APP_URL` | B1, B3 |
| ② | 운영 compose 정리: postgres·frontend 제거, **micro 메모리 한도**(nginx 48 / backend 384 / bot 192MB, [02](02-recommended-architecture.md) 2-1절), 로그 `awslogs` ([10](10-operations-runbook.md) 5.3절), 이미지 `image:` 주소 사용 | B5 |
| ③ | nginx API 전용 + 443 + 비밀 헤더 검사 + 요청 제한 | B4 |
| ④ | 프론트 정적 빌드 (`output: export`, 동적 주소 8곳, 로그인·검색) | B2 |
| ⑤ | CI 확장 (백엔드 전체 테스트, 빈 DB 마이그레이션 검사) + 브랜치 보호 | B12 |
| ⑥ | 개발용 디스코드 앱 분리 (코드 변경 없이 포털 설정 + `.env` 안내) | B9 |

> 💡 **알아 둘 것**
> - 지금 `docker-compose.prod.yml`의 메모리 한도는 로컬 5개 컨테이너용(1200M·600M 등)이에요. **micro용 값으로 바꾸지 않으면** 1GiB 서버에서 한도가 의미가 없어요.
> - 저장소가 **공개(PUBLIC)**예요. `.env`, 키 파일, 실제 도메인의 비밀 헤더 값이 커밋되지 않게 PR마다 확인해요.

---

## 2단계. 로컬 리허설

1. **B6 빈 DB 마이그레이션**: 로컬에서 빈 PostgreSQL 17을 띄우고 `alembic upgrade head` → 테이블 수를 init SQL 결과와 비교 (DB 담당).
2. **B7 ARM64 이미지**: GitHub Actions에서 `linux/arm64` backend 이미지를 빌드해 봐요. 이 단계에서는 레지스트리에 올리지 않고 빌드 성공만 봐도 돼요.
3. 10번 1절 배포 명령을 로컬 compose로 한 번 따라 해 봐요 (`deploy.sh` 초안).

> 💡 **알아 둘 것**: t4g는 **ARM(Graviton)** CPU라서, 내 PC(x86)에서 만든 이미지는 그대로 돌지 않아요. 그래서 이미지는 GitHub Actions에서 arm64로 만들어요 ([02](02-recommended-architecture.md) 2절).

---

## 3단계. AWS 계정 보안·예산 경보 (가장 먼저)

1. **루트 계정 MFA 켜기**: 루트(처음 가입한 이메일) 계정은 이 뒤로 거의 쓰지 않아요.
2. **사람별 로그인 만들기**: IAM Identity Center(권장) 또는 IAM 사용자를 팀원마다 만들어요. 공용 계정·공용 Access Key는 만들지 않아요.
3. **리전을 서울(ap-northeast-2)로**: 콘솔 오른쪽 위에서 확인해요. 다른 리전에 만들면 문서의 가격·설정과 달라져요.
4. **AWS Budgets 경보**: 월 예상 $40, 실제 $50에 메일 알림 ([09](09-deployment-roadmap.md) Phase 2).
5. **요금제 확인**: 새 계정은 **Free 플랜(6개월, 크레딧)**으로 시작해요. 실제 서비스를 계속 운영하려면 **Paid 플랜으로 바꿀 시점**을 정해야 해요. Paid로 바꿔도 남은 크레딧은 계속 쓰이고, 계정 생성 후 12개월에 만료돼요 `[CONFIRMED: aws.amazon.com/free FAQ]`.

> 💡 **알아 둘 것**
> - Free 플랜은 크레딧을 다 쓰거나 기간이 끝나면 **계정이 닫힐 수 있다**고 안내돼요 `[UNVERIFIED: 정확한 조건은 aws.amazon.com/free에서 다시 확인]`. 베타 중에 서비스가 멈추지 않도록, 크레딧 잔액과 만료일을 Billing 화면에서 매주 확인해요.
> - RDS 12개월 무료는 2025-07-15 이전 계정만 해당돼서 우리 새 계정에는 없어요 ([08](08-cost-estimate.md) 4절).

---

## 4단계. 네트워크 (VPC·서브넷·보안 그룹)

[03](03-network-security.md) 1~2절 그대로 만들어요.

1. VPC `10.0.0.0/16`, 인터넷 게이트웨이 연결
2. 서브넷 3개: Public `10.0.1.0/24`(2a, EC2), Private A `10.0.11.0/24`(2a, RDS), Private C `10.0.12.0/24`(2c, 빈 서브넷)
3. 보안 그룹 2개
   - `sg-labbridge-ec2`: Inbound **443만**, 출발지 = CloudFront Prefix List. **22번은 열지 않아요**
   - `sg-labbridge-rds`: Inbound 5432, 출발지 = `sg-labbridge-ec2`

> 💡 **알아 둘 것**
> - **NAT Gateway는 만들지 않아요.** VPC 마법사가 기본으로 NAT를 만들어 주는 경우가 있는데, 그러면 월 수십 달러가 나가요 `[UNVERIFIED: 서울 단가]`. 마법사의 "NAT 게이트웨이: 없음"을 꼭 확인해요.
> - 22번(SSH)을 안 여는 대신 **SSM Session Manager**로 접속해요. 6단계에서 IAM 역할을 붙여야 접속이 돼요.

---

## 5단계. 운영 DB (RDS) — 여기서부터 요금 시작

[04](04-database-storage.md) 2절 설정대로 만들어요.

| 항목 | 값 |
|---|---|
| 엔진 | PostgreSQL 17 |
| 인스턴스 | `db.t4g.micro`, Single-AZ, ap-northeast-2a |
| 스토리지 | gp3 20GB, **스토리지 자동 확장 끄기 또는 상한 설정** |
| 서브넷 그룹 | Private A + Private C |
| 퍼블릭 접근 | **아니요** |
| 보안 그룹 | `sg-labbridge-rds` |
| 자동 백업 | 7일 / 삭제 방지 켬 |
| 마스터 비밀번호 | 길고 무작위. **바로 7단계 SSM에 저장** |

> 💡 **알아 둘 것**
> - 만들 때 "Multi-AZ", "Performance Insights 유료 보관", "Enhanced Monitoring"이 켜져 있으면 비용이 늘어요. 기본값을 한 번씩 확인해요.
> - **앱이 마스터 계정으로 접속하지 않게** 앱용 계정(`labbridge_app`)과 조회 전용 계정(`labbridge_readonly`, B11)을 따로 만드는 걸 권해요. 8단계에서 DB 담당자와 함께 만들어요.

---

## 6단계. 서버 (EC2 t4g.micro)

1. **IAM 역할 `LabBridgeEC2Role`** 먼저 만들기 ([03](03-network-security.md) 4절): SSM, 비밀값 읽기, S3 백업, Route 53, **ECR 이미지 받기**, **CloudWatch Agent**, **로그 보내기**
2. EC2 생성: Amazon Linux 2023 **ARM64**, `t4g.micro`, Public 서브넷, `sg-labbridge-ec2`, 위 IAM 역할, EBS gp3 30GB, **크레딧 사양 Standard**, 키 페어 없음
3. **Elastic IP** 1개 연결
4. Systems Manager → Session Manager → **세션 시작**으로 접속되는지 확인
5. 스왑 1GB, Docker·Compose 설치

```bash
# 스왑 1GB (재부팅해도 유지)
sudo dd if=/dev/zero of=/swapfile bs=1M count=1024
sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -m    # Swap 줄에 1023 정도가 보이면 성공

# Docker
sudo dnf install -y docker && sudo systemctl enable --now docker
# Compose 플러그인 설치 방법은 Docker 공식 문서 기준으로 확인 [UNVERIFIED: AL2023 패키지 이름]
docker compose version
```

> 💡 **알아 둘 것**
> - **크레딧 사양**: t4g는 기본이 **Unlimited**일 수 있어요 `[UNVERIFIED]`. Unlimited면 크레딧이 바닥나도 느려지지 않는 대신 **추가 요금**이 붙어요. 우리는 비용을 예측하려고 **Standard**로 정했어요 ([09](09-deployment-roadmap.md) Phase 2). 생성 화면의 "고급 세부 정보"에서 확인해요.
> - **Elastic IP는 서버에 붙어 있어도 시간당 요금**이 나가요($3.65/월, 08번에 포함). 서버를 지웠는데 IP만 남기면 계속 요금이 나가니, 정리할 때 같이 "릴리스"해요.
> - 서버 시간대는 UTC여도 괜찮아요. 아침 브리핑은 코드가 한국 시간(`KST`, `Asia/Seoul`)으로 계산해요 (`backend/app/task_daily.py`) `[CONFIRMED: 코드 확인]`.

---

## 7단계. 비밀값 (SSM Parameter Store)

[05](05-discord-integration.md) 5절 목록을 `/labbridge/prod/<키>`로 등록해요. 비밀은 **SecureString**, 일반 값은 String.

- `DATABASE_URL` (앱용 계정, `sslmode=require`), `JWT_SECRET` (32자 이상 무작위), 디스코드 값들, `CORS_ORIGINS`, `NEXT_PUBLIC_APP_URL`, `ORIGIN_VERIFY_SECRET`
- 배포 스크립트가 이 값을 읽어 EC2의 `/opt/labbridge/.env.production`(`chmod 600`)을 만들어요.

> 💡 **알아 둘 것**: 운영용 디스코드 값은 **운영 앱**의 값이에요. 개발용 앱(B9)의 토큰을 넣으면 개발 봇과 운영 봇이 같은 토큰으로 겹쳐요 ([05](05-discord-integration.md) 3절).

---

## 8단계. 이미지 → 마이그레이션 → 기동 (아직 비공개)

1. ECR 저장소 `labbridge-backend` 생성 → GitHub Actions(또는 내 PC의 buildx)로 arm64 이미지 올리기
2. EC2에 `/opt/labbridge/`를 만들고 `docker-compose.prod.yml`, `deploy.sh`, `.env.production`을 둬요.
3. **DB 담당자와 함께** 마이그레이션 ([04](04-database-storage.md) 3절):

```bash
cd /opt/labbridge
export COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"
$COMPOSE run --rm backend alembic upgrade head
$COMPOSE run --rm backend alembic current   # 이 두 줄의 결과가
$COMPOSE run --rm backend alembic heads     # 같아야 다음 단계로
```

4. backend → nginx만 켜요. **discord-bot은 아직 켜지 않아요** (Render 봇이 아직 돌고 있어요).
5. `curl -k https://localhost/api/v1/health` 확인

> 💡 **알아 둘 것**
> - backend가 켜지는 순간 **예약 작업 4개(요청 만료·아침 브리핑·알림·구글 동기화)도 같이 시작**해요 ([16](16-api-worker-split.md) 1절). 빈 운영 DB라 보낼 대상이 없어서 지금은 괜찮지만, 개발 DB 데이터를 옮겨 왔다면 **실제 회원에게 DM이 나갈 수 있어요.** 이 단계에서는 `DISCORD_BOT_TOKEN`을 비워 두는 것도 방법이에요.
> - `alembic current`와 `heads`가 다르면 **멈추고** DB 담당자와 확인해요. 지난번 "특정 API만 503" 사고가 이 순서를 어겨서 생겼어요.

---

## 9단계. 도메인·인증서·S3·CloudFront

1. **Route 53 호스팅 영역** (다른 곳에서 산 도메인이면 그 등록처에서 네임서버를 Route 53 값으로 바꿔요)
2. **ACM 인증서는 반드시 `us-east-1`(버지니아)에서** 발급 — CloudFront용이라서예요. DNS 검증 레코드는 Route 53에 자동 추가 버튼이 있어요.
3. **오리진 인증서**: EC2에서 Let's Encrypt로 `origin.<도메인>` 인증서 발급 (DNS-01, Route 53 권한 사용)
4. **S3 프론트 버킷** `labbridge-frontend-apne2`: 퍼블릭 액세스 차단 켬 → 정적 빌드 결과 업로드
5. **CloudFront 배포** ([03](03-network-security.md) 3절):
   - 기본 경로 → S3 (OAC)
   - `/api/v1/*` → `origin.<도메인>` HTTPS only + 비밀 헤더(`ORIGIN_VERIFY_SECRET`), 캐시 끔
   - 주소 연결 함수(CloudFront Function), HTTP → HTTPS 리디렉션
6. CloudFront 기본 주소(`xxxx.cloudfront.net`)로 화면·API·디스코드 로그인, `/workspace/4` 직접 열기·새로고침 (B10)

> 💡 **알아 둘 것**
> - CloudFront 설정 변경은 전 세계에 퍼지는 데 **몇 분**이 걸려요. 바꾸고 바로 안 되면 잠시 기다려요.
> - 프론트를 다시 올린 뒤 옛 화면이 보이면 **캐시 무효화**(`/*`)를 해요. 한 달 1,000건까지는 무료로 안내돼요 `[UNVERIFIED]`.
> - 403이 나오면 대부분 비밀 헤더 값 불일치나 OAC 버킷 정책 문제예요 ([10](10-operations-runbook.md) 4.6절).

---

## 10단계. micro 부하 테스트 (B8)

- k6로 CloudFront 주소의 API에 동시 접속 **10 → 20 → 30명**을 차례로 걸어요 ([09](09-deployment-roadmap.md) B8).
- 볼 것: 응답 시간, 오류율, 서버 메모리·스왑, CPU 크레딧
- 느려지기 시작한 동시 접속 수 = **micro 한계**. 그 **70%**가 운영 중 small 상향 기준이에요 ([02](02-recommended-architecture.md) 2-1절).
- 여기서 버티지 못하면 전환 전에 small로 바꿔요 (EC2 정지 → 인스턴스 유형 변경 → 시작, 몇 분).

> 💡 **알아 둘 것**: 부하 테스트가 **CPU 크레딧을 많이 써요.** 테스트 직후 크레딧 잔액이 낮은 상태로 전환하지 말고, 몇 시간 쉬게 한 뒤 전환해요. 또한 쓰기 API(협업 요청 등)는 부하 테스트 대상에서 빼요. 실제 DM이 나갈 수 있어요.

---

## 11단계. 모니터링 (대시보드·로그·경보)

자세한 명령과 설정값은 **[10](10-operations-runbook.md) 5절**에 있어요. 여기서는 순서만 정리해요.

1. **CloudWatch Agent 설치** → 메모리·스왑·디스크 지표 (10번 5.2절)
2. **로그 그룹 3개 + 보관 14일** → compose `awslogs` 확인 (5.3절)
3. **대시보드 `LabBridge-Beta`** 만들기: CPU, CPU 크레딧, 메모리·스왑, 디스크, RDS 4개, 오류 로그 (5.4절)
4. **SNS 메일 구독 확인** → **경보 5개** (5.5절)
5. **기록표** 준비 (5.6절)

> 💡 **알아 둘 것**
> - EC2 **메모리는 기본 그래프에 없어요.** "모니터링 탭에 메모리가 없네?" 하면 Agent 설치 전이라 그래요.
> - SNS 구독 확인 메일을 누르지 않으면 경보가 울려도 메일이 안 와요. 스팸함도 확인해요.
> - 경보 테스트: 경보 임계값을 잠깐 낮춰서(예: CPU > 1%) 메일이 오는지 확인하고 되돌려요.

---

## 12단계. 전환하는 날 (Render → AWS)

[05](05-discord-integration.md) 4절 순서 그대로예요.

1. 디스코드 개발자 포털에 새 Redirect URI 추가
2. **Render의 backend와 봇 정지** → 곧바로 EC2 discord-bot 시작 → 로그에서 Gateway 연결 확인 → `/일정목록`
3. Route 53에서 도메인을 CloudFront로 연결
4. 첫날: 알림 DM, 협업 채널 생성, **다음 날 아침 브리핑이 한 번만** 오는지
5. 첫 주: S3 덤프 복원 테스트 1회
6. 하루 지켜본 뒤 옛 Redirect URI 삭제, Render 서비스 삭제, Vercel 정리

> 💡 **알아 둘 것**
> - **봇이 두 개 켜져 있는 시간이 없게** 2번을 짧게 해요. 두 개가 겹치면 명령에 두 번 반응해요.
> - DNS 변경은 반영까지 몇 분~몇 시간 걸릴 수 있어요. 전환은 사용자가 적은 시간에 해요.
> - 회원 모집 전에 **개인정보 처리방침**과 수집 동의 화면이 있는지 확인해요. 디스코드 로그인으로 이메일 등 개인정보를 받기 때문이에요 `[UNVERIFIED: 법적 요건은 팀에서 별도 확인]`.

---

## 13단계. 자동 배포 연결 (CI/CD)

[14](14-ci-cd-pipeline.md) 8절 순서예요.

1. GitHub OIDC 역할 `LabBridgeGitHubDeployRole` (main 브랜치·`production` 환경만)
2. GitHub `production` 환경 + 승인자 지정
3. `deploy.yml`을 **버튼 실행**(`workflow_dispatch`)으로 시작 → 익숙해지면 `main` 머지 시 자동 + 승인

> 💡 **알아 둘 것**: 처음 몇 번은 자동 배포를 켜기보다 버튼으로 실행하면서 10번 1절의 6단계 확인을 사람이 같이 봐요. 실패했을 때 어디서 멈췄는지 익숙해져야 자동으로 돌려도 안심이 돼요.

---

## 14단계. 2주 테스트 운영

- 매일 아침 9시 10분쯤 [10](10-operations-runbook.md) 5.6절 기록표를 채워요.
- 경보 메일이 오면 [10](10-operations-runbook.md) 4절 장애 대응을 따라요.
- 매주: Billing에서 실제 비용과 크레딧 잔액, S3 백업 날짜
- 2주 끝: 기록표로 **micro 유지 / small 상향** 결정 ([02](02-recommended-architecture.md) 2-1절), 회원 수 추이로 ALB 재검토 시점 확인 ([15](15-instructor-feedback-20261110.md) 2-2절)

---

## 마지막 정리: 더 알아 두면 좋은 것

### 비용이 몰래 나가는 곳
| 항목 | 왜 | 막는 법 |
|---|---|---|
| NAT Gateway | VPC 마법사가 자동으로 만들 수 있음 | "없음" 선택, 결제 화면에서 확인 |
| 남은 Elastic IP | 서버를 지워도 IP가 남으면 요금 | 정리할 때 릴리스 |
| EBS 스냅샷·RDS 수동 스냅샷 | 자동으로 지워지지 않음 | 보관 기간을 정하고 지우기 |
| 로그 보관 기간 "만료 없음" | 계속 쌓임 | 로그 그룹마다 14~30일 |
| t4g Unlimited 크레딧 | 크레딧이 바닥나면 추가 요금 | Standard로 설정 |
| 다른 리전에 만든 리소스 | 화면에 안 보여서 잊어버림 | 리전을 서울로 고정, Billing의 리전별 비용 확인 |

### 보안 기본기
- 루트 계정 MFA, 사람별 로그인, **Access Key를 만들지 않기** (GitHub는 OIDC)
- 22번 포트 닫기, RDS 퍼블릭 접근 끔, 저장소가 공개라 비밀값 커밋 금지
- 운영 DB 터널을 연 상태로 **로컬 backend를 켜지 않기** ([04](04-database-storage.md) 6절)

### 운영 습관
- 배포는 항상 **마이그레이션 → 버전 확인 → 교체** 순서 ([10](10-operations-runbook.md) 1절)
- backend·discord-bot은 **항상 1개** (`--scale` 금지)
- 서버 크기를 바꾸거나 큰 설정을 바꾸기 전에 RDS 스냅샷 1개

### 아직 확인하지 못한 것
- AWS Free 플랜이 닫히는 정확한 조건, t4g 기본 크레딧 사양, NAT·로그 검색 단가, 대시보드·경보 무료 개수
- AL2023에서 Docker Compose 플러그인 설치 방법, Docker dual logging 동작
- CloudWatch Agent 설정·compose `awslogs` 설정을 실제 서버에서 실행해 보지 않았어요
