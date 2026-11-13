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
- 메모리가 한도의 80%를 자주 넘으면 [02](02-recommended-architecture.md) 2절의 업그레이드 기준을 봐요.
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
