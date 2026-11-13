# 10. 운영 런북 (Operations Runbook) — v4

> **상태**: `[PROPOSED]` — 실제 배포 후 명령과 경로를 다시 확인해서 고쳐요.
> **핵심 위험**: EC2 1대 구성이라 서버가 멈추면 API·디스코드 봇이 함께 멈춰요(단일 장애점). 화면 파일은 S3에 있어 열리지만 데이터는 불러오지 못해요. 데이터는 RDS에 있어서 서버를 잃어도 남아요.
> **약속**: 운영 DB를 바꾸는 명령(`alembic upgrade`, 복원)은 DB 담당자가 실행하거나 확인해요.

---

## 1. 표준 배포 절차 (매번 같은 순서)

> **CI/CD 도입 후**: 아래 명령은 EC2의 `/opt/labbridge/deploy.sh`로 묶여서 GitHub Actions가 SSM Run Command로 실행해요 ([14](14-ci-cd-pipeline.md)). 사람이 직접 실행하는 건 리허설이나 비상시뿐이고, 그때도 **같은 스크립트**를 써요.

```bash
cd /opt/labbridge
export COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

# 0) 지금 상태 기록 (롤백용)
$COMPOSE images > /tmp/before-deploy.txt
$COMPOSE run --rm backend alembic current

# 1) 새 이미지 받기 (서버에서 빌드하지 않음)
$COMPOSE pull

# 2) DB 마이그레이션 먼저
$COMPOSE run --rm backend alembic upgrade head

# 3) 버전 확인: current 와 heads 가 같아야 다음 단계로
$COMPOSE run --rm backend alembic current
$COMPOSE run --rm backend alembic heads

# 4) 컨테이너 교체 (backend → discord-bot → nginx)
$COMPOSE up -d --no-deps backend
$COMPOSE up -d --no-deps discord-bot
$COMPOSE up -d --no-deps nginx

# 5) 프론트 올리기 (GitHub Actions가 실행, out/ 은 정적 빌드 결과)
aws s3 sync out/ s3://labbridge-frontend-apne2 --delete
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"

# 6) 확인
curl -fsS https://<도메인>/api/v1/health
$COMPOSE logs --tail=50 discord-bot   # Gateway 연결 로그
$COMPOSE ps                            # backend·discord-bot 이 각각 1개인지
```

- **3번에서 버전이 다르면 멈추고** DB 담당자에게 알려요. 코드만 먼저 올리면 지난번처럼 특정 API만 503이 날 수 있어요.
- PR 머지 규칙도 같아요: 마이그레이션이 들어간 PR은 **운영 DB 적용·확인 후** 배포해요.
- 프론트 업로드는 API 교체 **뒤에** 해요. 새 화면이 아직 없는 API를 부르지 않게 하기 위해서예요.
- `--scale backend=2` 같은 명령은 쓰지 않아요 ([02](02-recommended-architecture.md) 3절).

---

## 2. 롤백

| 상황 | 방법 |
|---|---|
| 코드만 문제 (마이그레이션 없음) | `/tmp/before-deploy.txt`의 이전 이미지 태그로 되돌리고 `up -d` |
| 화면만 문제 | 이전 Actions 빌드 결과를 S3에 다시 올리고 캐시 갱신 |
| 마이그레이션이 포함됨 | **먼저 DB 담당자와 판단**. 보통은 새 마이그레이션이 옛 코드와 함께 동작하도록(컬럼 추가만 등) 만들어서 코드만 되돌려요. `alembic downgrade`는 데이터 손실 가능성을 확인한 뒤에만 |
| 데이터가 잘못 바뀜 | RDS 시점 복원(PITR)으로 **새 인스턴스**를 만들어 비교 후 전환 |

---

## 3. 일상 점검

```bash
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
$COMPOSE logs --tail=100 backend | grep -i "error\|DmBlocked\|브리핑"
$COMPOSE logs --tail=50 nginx
```
- 메모리가 한도의 80%를 자주 넘으면 [02](02-recommended-architecture.md) 2-1절의 small 상향 기준을 봐요. CloudWatch 대시보드·경보 설정은 5절이에요.
- 매주: AWS 청구 대시보드, S3 백업 파일 날짜 확인.
- 매월: 최신 덤프로 복원 테스트([04](04-database-storage.md) 4절).

---

## 4. 장애 대응

### 4.1 EC2가 통째로 멈춤 (목표 복구 시간 45분 이내 `[UNVERIFIED]`)
1. 같은 설정으로 새 EC2 생성 (ARM64, 지금 쓰는 크기 `t4g.micro` 또는 `t4g.small`, 같은 보안 그룹·IAM 역할)
2. Elastic IP를 새 인스턴스에 다시 연결 (CloudFront·DNS 변경 불필요)
3. SSM에서 `.env.production` 다시 생성, 오리진 인증서 재발급(DNS-01)
4. 표준 배포 절차 1~5번 실행 (DB는 RDS에 그대로 있음)
5. 업로드 파일은 S3 백업에서 볼륨으로 복원

### 4.2 운영 DB 문제
- **RDS 자체 장애**: Single-AZ라 AWS 복구를 기다리거나, 최신 자동 백업으로 새 인스턴스 복원 후 `DATABASE_URL` 교체.
- **장기 백업에서 복원** (S3의 `pg_dump -F c` 파일):
  ```bash
  aws s3 cp s3://labbridge-backup-apne2/db/latest.dump /tmp/latest.dump
  pg_restore --no-owner --no-privileges -d "$RESTORE_DATABASE_URL" /tmp/latest.dump
  ```
  (덤프는 custom 형식이라 `psql`이 아니라 `pg_restore`로 복원해요. 먼저 임시 DB에 복원해서 확인해요.)

### 4.3 디스코드
| 증상 | 확인 | 조치 |
|---|---|---|
| 슬래시 명령 무반응 | `$COMPOSE logs discord-bot` | `$COMPOSE restart discord-bot`. 다른 곳에서 같은 토큰으로 봇이 켜져 있지 않은지 확인 |
| 같은 명령에 두 번 반응 | 봇이 2개 접속 중 | Render·팀원 로컬 봇 종료, 필요하면 토큰 재발급 |
| DM 알림이 안 옴 | backend 로그 `DmBlocked`, `notification.discord_status` | 회원이 DM을 막았는지, 봇 토큰이 유효한지 |
| 아침 브리핑이 두 번 옴 | backend가 2개였는지 | backend 1개로 정리 |

### 4.4 운영 DB에 접속해야 할 때 (SSM 터널)
1. [03](03-network-security.md) 2.3절의 명령으로 터널을 열어요 (EC2가 켜져 있어야 해요).
2. `psql "host=localhost port=15432 dbname=labbridge user=labbridge_readonly sslmode=require"`
3. 끝나면 터널을 닫아요. **터널을 연 채로 로컬 backend를 켜지 않아요** ([04](04-database-storage.md) 6절).

### 4.5 화면이 안 열리거나 새로고침 시 404
- CloudFront Function이 주소를 맞게 연결하는지, S3 업로드와 캐시 갱신이 끝났는지 확인.

### 4.6 사이트가 403
- CloudFront 비밀 헤더 값과 nginx `ORIGIN_VERIFY_SECRET`이 같은지, 오리진 인증서가 만료되지 않았는지 확인.

---

## 5. 모니터링: 대시보드·로그·경보 (2주 테스트 기간용, 2026-11-13 추가)

> **한 줄 요약**: AWS 웹 콘솔의 **CloudWatch**에서 봐요. CPU·CPU 크레딧·RDS 지표는 기본으로 보이고, **EC2 메모리·스왑·디스크는 CloudWatch Agent를 설치해야** 보여요. 컨테이너별 메모리는 서버에서 `docker stats`로 봐요.

### 5.1 무엇이 기본이고 무엇을 설정해야 하나

| 보고 싶은 것 | 기본 제공 | 어디서 | 비용 |
|---|---|---|---|
| EC2 CPU 사용률, **CPU 크레딧 잔액**(`CPUCreditBalance`), 네트워크, 상태 검사 | ✅ | EC2 → 인스턴스 → 모니터링 탭 | 무료 (5분 간격) |
| RDS CPU, 남은 메모리(`FreeableMemory`), 연결 수, 남은 저장 공간 | ✅ | RDS → DB → 모니터링 탭 | 무료 |
| **EC2 메모리 %, 스왑 %, 디스크 %** | ❌ | CloudWatch Agent 설치 후 `CWAgent` 네임스페이스 | 사용자 지정 지표 3개. 무료 범위(10개) 안 `[UNVERIFIED]` |
| 컨테이너별 메모리 (nginx·backend·bot) | ❌ | 서버에서 `docker stats` | 무료 |
| 컨테이너 로그 | ❌ | CloudWatch Logs (compose 로그 설정 변경) | 수집 $0.76/GB `[CONFIRMED: 서울 2026-11-05]` |

- small 상향 기준 5가지 중 3가지가 메모리 관련이라([02](02-recommended-architecture.md) 2-1절) **Agent 설치는 필수**예요.

### 5.2 CloudWatch Agent (메모리·스왑·디스크)

1. EC2 역할 `LabBridgeEC2Role`에 관리형 정책 **`CloudWatchAgentServerPolicy`**를 붙여요 ([03](03-network-security.md) 4절에 추가).
2. 서버에 설치하고 설정 파일을 만들어요.

```bash
sudo dnf install -y amazon-cloudwatch-agent
sudo tee /opt/aws/amazon-cloudwatch-agent/etc/labbridge.json > /dev/null <<'JSON'
{
  "metrics": {
    "append_dimensions": { "InstanceId": "${aws:InstanceId}" },
    "metrics_collection_interval": 60,
    "metrics_collected": {
      "mem":  { "measurement": ["mem_used_percent"] },
      "swap": { "measurement": ["swap_used_percent"] },
      "disk": { "measurement": ["used_percent"], "resources": ["/"] }
    }
  }
}
JSON
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/labbridge.json
```

3. 5분쯤 뒤 CloudWatch → 지표 → `CWAgent`에서 `mem_used_percent`가 보이면 성공이에요.

`[PROPOSED: 실제 서버에서 실행해 보지 않은 예시]`

### 5.3 로그 수집 (CloudWatch Logs)

1. 로그 그룹을 **먼저 손으로** 만들고 보관 기간을 정해요. 보관 기간이 없으면 계속 쌓여 비용이 늘어요.
   - `/labbridge/prod/backend`, `/labbridge/prod/discord-bot`, `/labbridge/prod/nginx` → 보관 **14일** (베타 기간)
2. EC2 역할에 이 로그 그룹에만 `logs:CreateLogStream`, `logs:PutLogEvents` 권한을 줘요.
3. `docker-compose.prod.yml`의 서비스별 `logging`을 바꿔요 (B5 PR에 함께).

```yaml
    logging:
      driver: awslogs
      options:
        awslogs-region: ap-northeast-2
        awslogs-group: /labbridge/prod/backend   # 서비스마다 이름만 바꿔요
        mode: non-blocking                       # 로그 전송이 느려도 앱이 멈추지 않게
        max-buffer-size: 4m
```

- `docker logs`·`$COMPOSE logs`는 계속 쓸 수 있어요 (Docker 20.10 이후 dual logging) `[UNVERIFIED: 서버 Docker 버전 확인]`.
- **검색**: CloudWatch → Logs Insights에서 로그 그룹을 고르고 예를 들어 이렇게 검색해요. 검색한 양만큼 소액이 나와요 `[UNVERIFIED: 단가]`.

```text
fields @timestamp, @message
| filter @message like /ERROR|Traceback|DmBlocked/
| sort @timestamp desc
| limit 50
```

- **로그에 남기면 안 되는 것**: 토큰, 비밀번호, 쿠키, 이메일 전체. 콘솔 권한이 있는 사람은 누구나 볼 수 있어요. 배포 전에 backend 로그에 이런 값이 찍히는지 한 번 확인해요.

### 5.4 대시보드 만들기 (`LabBridge-Beta`)

CloudWatch → 대시보드 → **대시보드 생성** → 위젯 "선(Line)"을 추가해요. 대시보드는 3개까지 무료로 안내돼요 `[UNVERIFIED]`.

| 줄 | 위젯 | 지표 | 기간 |
|---|---|---|---|
| 1 | EC2 CPU | `AWS/EC2` CPUUtilization | 5분 |
| 1 | **CPU 크레딧 잔액** | `AWS/EC2` CPUCreditBalance | 5분 |
| 2 | 메모리·스왑 | `CWAgent` mem_used_percent, swap_used_percent (한 그래프에) | 1분 |
| 2 | 디스크 | `CWAgent` disk used_percent (`/`) | 5분 |
| 3 | RDS CPU·연결 수 | `AWS/RDS` CPUUtilization, DatabaseConnections | 5분 |
| 3 | RDS 남은 메모리·저장 공간 | `AWS/RDS` FreeableMemory, FreeStorageSpace | 5분 |
| 4 | 최근 오류 로그 | Logs Insights 위젯 (5.3절 검색) | — |

- 시간 범위를 **1일**로 두면 아침 9시 브리핑 때 튀는 모양이 잘 보여요.
- 그래프에 "가로 기준선"(예: 메모리 80%)을 넣으면 small 상향 기준을 넘었는지 바로 보여요.

### 5.5 경보(Alarm) 5개 + 메일 받기

1. SNS → 주제 생성 `labbridge-alerts` → 구독(이메일) 추가 → **받은 메일에서 구독 확인 링크를 눌러야** 경보가 와요.
2. CloudWatch → 경보 → 경보 생성에서 아래를 만들어요. 경보는 10개까지 무료로 안내돼요 `[UNVERIFIED]`.

| 경보 | 조건 | 의미 |
|---|---|---|
| CPU 크레딧 부족 | `CPUCreditBalance` < 30, 15분 | CPU가 곧 느려지거나 추가 요금 |
| 메모리 부족 | `mem_used_percent` > 85, 10분 | small 상향 검토 |
| 서버 상태 이상 | `StatusCheckFailed` ≥ 1, 5분 | 서버 자체 문제 → 4.1절 |
| RDS 저장 공간 | `FreeStorageSpace` < 2GB | 용량 늘리기 |
| RDS CPU | `CPUUtilization` > 80, 15분 | 느린 쿼리 확인 |

- 비용 경보는 CloudWatch가 아니라 **AWS Budgets**($40 예상 / $50 실제)로 따로 만들어요 ([09](09-deployment-roadmap.md) Phase 2).

### 5.6 2주 테스트 기간 기록표

매일 한 번(가능하면 **아침 9시 10분쯤**, 브리핑 직후) 아래를 적어요. 팀 공유 문서에 표로 쌓으면 돼요.

| 날짜 | 회원 수 | 그날 최대 동시 접속(추정) | CPU 최대 % | 크레딧 잔액 | 메모리 최대 % | 스왑 MB | OOM 재시작 | 오류 로그 수 | 메모 |
|---|---|---|---|---|---|---|---|---|---|
| 11-xx | | | | | | | 0 | | |

```bash
# 서버에서 (SSM Session Manager로 접속)
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"
free -m                                   # Swap 줄의 used 확인
docker inspect -f '{{.Name}} {{.RestartCount}} {{.State.OOMKilled}}' $(docker ps -q)
```

- 2주 끝에 이 표로 **micro 유지 / small 상향**을 정해요 ([02](02-recommended-architecture.md) 2-1절).
