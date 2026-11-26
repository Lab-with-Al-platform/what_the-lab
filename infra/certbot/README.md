# origin 인증서 (Let's Encrypt, DNS-01)

CloudFront → EC2 구간도 HTTPS예요. EC2의 nginx는 `origin.<도메인>` 인증서를 `/etc/letsencrypt`에서 읽어요 ([03](../../docs/aws-deployment/03-network-security.md) 3절).
Let's Encrypt 인증서는 **90일**짜리라 자동 갱신이 꼭 필요해요. 잊으면 만료일에 API 전체가 멈춰요.

| 파일 | 하는 일 |
|---|---|
| `renew-origin-cert.sh` | certbot(docker)으로 갱신 → 인증서가 **바뀌었을 때만** `nginx -t` 후 `nginx -s reload` |
| `labbridge-cert-renew.service` | 위 스크립트를 root로 한 번 실행 |
| `labbridge-cert-renew.timer` | 하루 두 번 실행 (꺼져 있던 동안 놓친 실행은 켜질 때) |

## 필요한 권한 (EC2 역할)

`route53:ListHostedZones`, `route53:GetChange`, 그리고 `route53:ChangeResourceRecordSets`는 **`_acme-challenge.origin.<도메인>` TXT 레코드만** (인라인 정책 `labbridge-ec2-certbot`).

## 처음 발급 (한 번만, 2026-11-25에 완료)

```bash
docker run --rm -v /etc/letsencrypt:/etc/letsencrypt -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  certbot/dns-route53 certonly --dns-route53 -d origin.<도메인> \
  -m '<팀이 계속 볼 이메일>' --agree-tos --no-eff-email --non-interactive
```

## 자동 갱신 설치 (EC2, 한 번만)

`/opt/labbridge`가 이 저장소를 받은 폴더라서, 배포할 때마다 스크립트도 그 커밋으로 맞춰져요.

```bash
sudo cp /opt/labbridge/infra/certbot/labbridge-cert-renew.service /etc/systemd/system/
sudo cp /opt/labbridge/infra/certbot/labbridge-cert-renew.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now labbridge-cert-renew.timer
```

확인:

```bash
systemctl list-timers labbridge-cert-renew.timer   # 다음 실행 시각
sudo DRY_RUN=1 /opt/labbridge/infra/certbot/renew-origin-cert.sh   # 연습 (Let's Encrypt 연습 서버, nginx 그대로)
sudo systemctl start labbridge-cert-renew.service  # 지금 한 번 실행
journalctl -u labbridge-cert-renew --since today   # 기록 보기
```

- 연습에서 `연습 성공`이 나오면 실제 갱신도 같은 설정으로 돼요.
- 평소에는 `갱신할 필요 없음 (만료 30일 전부터 갱신해요)`이 정상이에요.
- 만료일 확인: `sudo openssl x509 -in /etc/letsencrypt/live/origin.<도메인>/cert.pem -noout -enddate`

## 문제가 생기면

| 기록에 보이는 말 | 확인할 곳 |
|---|---|
| `갱신 실패` + `AccessDenied` | EC2 역할의 `labbridge-ec2-certbot` 정책 (호스팅 영역 ID, 레코드 이름) |
| `nginx 설정 검사 실패` | nginx는 reload하지 않고 예전 인증서로 계속 돌아요. `docker exec labbridge-prod-nginx nginx -t` |
| `... 이 없어요` | 처음 발급이 안 된 상태예요. 위 "처음 발급" |
