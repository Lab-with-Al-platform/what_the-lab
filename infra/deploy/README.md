# 배포 스크립트 (`deploy.sh`)

EC2의 `/opt/labbridge/deploy.sh`로 복사해서 써요. 런북([10](../../docs/aws-deployment/10-operations-runbook.md) 1절)의 수동 절차를 그대로 묶은 것이라, **사람과 GitHub Actions가 같은 스크립트**를 써요.

```bash
cd /opt/labbridge
./deploy.sh <계정ID>.dkr.ecr.ap-northeast-2.amazonaws.com/labbridge-backend:<커밋 SHA>
```

## 순서와 안전장치

| 단계 | 하는 일 | 멈추는 경우 |
|---|---|---|
| 0 | compose 설정 검사, 지금 이미지 기록 | 필수 환경변수가 빠짐 |
| 1 | 새 이미지 받기 (서버에서 빌드하지 않음) | 이미지가 없음 |
| 2 | DB 버전 ≠ 이미지 버전이면 **스냅샷 표시 확인** 후 `alembic upgrade head` | `MIGRATION_SNAPSHOT_ID`가 없음, 마이그레이션 실패 |
| 3 | `current = heads` 확인 | 버전 불일치 |
| 3-1 | `MIGRATION_DATABASE_URL`이 있으면 앱·조회 전용 계정 권한·RLS 정책 맞추기 ([B11](../../backend/migrations/roles/README.md)) | 권한 맞추기 실패 |
| 4 | backend 교체 → health 확인 | 응답 없음 → **이전 이미지로 자동 되돌림** (DB는 그대로) |
| 5 | discord-bot: `ENABLE_DISCORD_BOT=1`일 때만 켬 | 켜자마자 다시 시작함 |
| 6 | nginx 교체·설정 다시 읽기, healthz와 backend 연결 확인 | 설정 오류 |

- **새 마이그레이션이 있으면** 먼저 RDS 스냅샷을 찍고(관리자 PC나 콘솔) 이름을 넘겨요.
  ```bash
  MIGRATION_SNAPSHOT_ID=pre-migrate-20261120-1400 ./deploy.sh <이미지>
  ```
  첫 배포(빈 DB)는 `MIGRATION_SNAPSHOT_ID=first-deploy`.
- **봇은 전환(Go-Live) 전까지 꺼 둬요.** Render의 봇과 함께 켜지면 알림이 두 번 가요. 전환하는 날 `.env.production`의 `ENABLE_DISCORD_BOT=1`.
- 로그와 이전 이미지 기록은 `/var/tmp/labbridge/`에 남아요.
- 마이그레이션·권한 맞추기는 `MIGRATION_DATABASE_URL`(표의 주인 `labbridge_migrator`)로, backend·봇은 `DATABASE_URL`(`labbridge_app`)로 돌아요. 비워 두면 하나로 다 해요.
- `downgrade`나 `--scale`은 쓰지 않아요.

## 로컬 리허설

운영 compose를 내 PC에서 그대로 띄워 볼 때예요 (awslogs·pull 없이).

```bash
ENV_FILE=.env.rehearsal COMPOSE_FILES="-f docker-compose.prod.yml" SKIP_PULL=1 \
  MIGRATION_SNAPSHOT_ID=first-deploy bash infra/deploy/deploy.sh labbridge-backend:local
```

`.env.rehearsal`은 `infra/env.production.example`을 복사해 로컬 값(빈 PostgreSQL 17, 가짜 인증서 폴더 `ORIGIN_CERT_DIR`)으로 채워요. 저장소에 올리지 마세요.
