# 10. 운영 및 장애 복구 런북 (Operations Runbook) — 개정판

> **상태**: `[PROPOSED]`  
> **핵심 위험 고지**: 단일 EC2 인스턴스 구성은 초기 비용 절감($50 내외)에 최적화되어 있으나, 인스턴스 다운 시 **전체 서비스가 일시 중단되는 단일 장애점(SPOF)**이 존재합니다. 따라서 신속한 복구 절차와 자동 백업이 필수적입니다.

---

## 1. 일상 점검 및 컨테이너 메모리 모니터링 CLI

```bash
# 컨테이너별 메모리 제한 대비 사용량 실시간 확인 (OOM 전조 감지)
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" --no-stream

# 백엔드 API 및 워커 로그 확인
docker compose -f docker-compose.prod.yml logs -f --tail=100 backend

# Discord Gateway 봇 웹소켓 연결 상태 확인
docker compose -f docker-compose.prod.yml logs -f --tail=50 discord-bot

# Nginx 접근 로그 및 4xx/5xx 에러율 점검
docker compose -f docker-compose.prod.yml logs -f --tail=50 nginx
```

---

## 2. 단일 EC2 장애 시 긴급 재해 복구 매뉴얼 (DR)

### 2.1 인스턴스 완전 다운 시 복구 절차 (RTO < 45분)
1. **신규 EC2 생성**: 동일한 `t4g.medium` AMI(Amazon Linux 2023)로 인스턴스 기동.
2. **Elastic IP 재연결**: 기존 탄력적 IP를 신규 인스턴스에 재할당 (CloudFront/DNS 재설정 불필요).
3. **환경변수 복원**: AWS SSM Parameter Store에서 `.env.production` 자동 인출.
4. **코드 배포 및 컨테이너 기동**: 저장소 clone 후 `docker compose up -d`.
5. **DB 데이터 복원** (EC2 내부 DB 사용 시):
   ```bash
   aws s3 cp s3://whatthelab-storage-apne2-prod/backups/database/db_backup_latest.sql.gz /tmp/
   gunzip /tmp/db_backup_latest.sql.gz
   cat /tmp/db_backup_latest.sql | docker exec -i labbridge-postgres psql -U admin -d labbridge
   ```

---

## 3. Discord 봇 및 백그라운드 워커 문제 해결

- **증상 1: 협업 채널에서 슬래시 커맨드 무반응**:
  - 원인: Discord Gateway 웹소켓 세션 끊김.
  - 조치: `docker compose -f docker-compose.prod.yml restart discord-bot`.
- **증상 2: 협업 요청 알림 DM이 발송되지 않음**:
  - 원인: 수신 회원이 DM을 차단했거나 봇 토큰 만료.
  - 조치: 백엔드 로그에서 `DmBlocked` 발생 여부 확인 (`docker logs labbridge-backend | grep DmBlocked`).
