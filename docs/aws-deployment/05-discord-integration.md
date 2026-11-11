# 05. Discord 연동 (Discord Integration) — v4

> **상태**: 기능 구현은 `[CONFIRMED]` (`backend/app/discord_bot.py`, `discord_gateway.py`, `collab_channel.py`, `notification_sender.py`), AWS 운영은 `[PROPOSED]`
> **v3 핵심**: 1) REST와 Gateway 분리, 2) **운영 봇·백엔드는 언제나 1개**, 3) 개발용 디스코드 앱 분리, 4) Render → AWS 전환 순서

---

## 1. 이번 통합의 이유

지금 구성(Vercel + Render)에서는 디스코드 봇과 알림이 다루기 어려웠어요.
- 슬래시 명령·버튼은 **24시간 연결을 유지하는 프로그램**이 필요해요. Vercel은 이런 프로그램을 돌리지 않아요.
- 알림 발송·아침 브리핑·요청 만료는 backend 안에서 **계속 돌아가는 작업**이에요.
- backend와 봇이 다른 곳에 있으면 코드 버전·환경변수·DB 버전이 서로 어긋나기 쉬워요.

AWS EC2 한 대에 backend와 봇을 함께 두면 **같은 이미지, 같은 `.env.production`, 같은 운영 DB**로 움직여요.

---

## 2. 기능별 통신 방식

| 기능 | 방식 | 어디서 실행 | 코드 |
|---|---|---|---|
| 디스코드 로그인(OAuth2) | HTTPS REST | backend | `routers/auth.py` |
| 서버 자동 참여(`guilds.join`) | HTTPS REST | backend | `discord_bot.py` |
| 협업 비공개 채널 생성 | HTTPS REST | backend | `collab_channel.py` |
| 1:1 DM 알림 | HTTPS REST v10, 재시도·`DmBlocked` 처리 | backend (`notification_sender`) | `notification_sender.py` |
| 아침 브리핑 | HTTPS REST (채널 메시지) | backend (`daily_forever`) | `task_daily.py` |
| `/요청`, `/일정`, `/일정목록`, 버튼 | **WebSocket Gateway** | **discord-bot 컨테이너** | `discord_gateway.py` |

- 봇 컨테이너는 같은 backend 이미지를 `python -m app.discord_gateway`로 실행하고, **DB에 직접 연결**해요.
- 봇은 디스코드에 **나가는 연결**만 쓰므로 EC2에 포트를 더 열 필요가 없어요.

---

## 3. 운영 규칙

### 3.1 운영 봇·백엔드는 1개만
- 같은 봇 토큰으로 Gateway에 두 군데서 접속하면 같은 명령을 두 곳이 처리할 수 있어요 `[UNVERIFIED: discord.py 동작 상세]`.
- 아침 브리핑은 프로세스 메모리로 "오늘 보냈는지"를 판단하므로 backend가 두 개면 두 번 나갈 수 있어요.
- DM 알림과 채널 생성은 `FOR UPDATE SKIP LOCKED`로 중복을 막지만, **기본 원칙은 1개만**이에요.

### 3.2 개발용 디스코드 앱을 따로
- 운영 토큰은 운영 EC2에만 있어요. 팀원 로컬·테스트는 **별도 디스코드 애플리케이션(개발용 봇)과 테스트 서버**를 써요.
- 운영 토큰이 로컬 `.env`에 들어가 있으면 바로 재발급(Reset Token)해요.

### 3.3 이메일 자동 병합
- 현재 로그인은 디스코드 OAuth 전용이고, 이메일·비밀번호 로그인 경로는 없어요 `[CONFIRMED: routers/auth.py]`. 그래서 "같은 이메일로 다른 계정에 자동 로그인"되는 위험은 지금 구조에서는 생기지 않아요. 이메일 로그인을 추가할 때 자동 병합 금지 원칙을 지켜요.

---

## 4. Render → AWS 전환 순서 (전환하는 날)

1. 운영 RDS에 `alembic upgrade head` 완료, `alembic current` 확인 ([04](04-database-storage.md) 3절)
2. EC2에서 backend·nginx를 켜고 **discord-bot은 아직 끔**, 프론트를 S3에 올린 뒤 CloudFront 주소로 화면·API 확인
3. 디스코드 개발자 포털에 새 Redirect URI 추가: `https://<도메인>/api/v1/auth/discord/callback`
4. **Render의 backend와 봇 서비스를 정지** (이 시점부터 잠깐 알림·명령이 멈춰요)
5. EC2 discord-bot 시작 → 로그에서 Gateway 연결 확인 → 테스트 채널에서 `/일정목록` 실행
6. Route 53 DNS를 CloudFront로 전환, Vercel·Render 쪽 옛 주소는 새 도메인으로 안내
7. 하루 지켜본 뒤 옛 Redirect URI 삭제, Render 서비스 삭제

- 4~5단계 사이는 짧게 해요. 두 봇이 동시에 켜지는 시간이 없게 하는 게 목표예요.

---

## 5. 운영 환경변수 (SSM `/labbridge/prod/*`)

| 키 | 비밀? | 설명 |
|---|---|---|
| `DATABASE_URL` | 비밀 | 운영 RDS 주소 (`sslmode=require`) |
| `JWT_SECRET` | 비밀 | 로그인 토큰 서명 키 (32자 이상 무작위) |
| `DISCORD_CLIENT_ID` | 일반 | 디스코드 앱 ID |
| `DISCORD_CLIENT_SECRET` | 비밀 | OAuth 비밀값 |
| `DISCORD_REDIRECT_URI` | 일반 | `https://<도메인>/api/v1/auth/discord/callback` (HTTPS면 쿠키 `Secure` 자동) |
| `DISCORD_BOT_TOKEN` | 비밀 | 봇 토큰 (REST·Gateway 공용) |
| `DISCORD_GUILD_ID` | 일반 | LabBridge 디스코드 서버 ID |
| `DISCORD_COLLAB_CATEGORY_ID` | 일반 | 협업 채널 카테고리 ID |
| `CORS_ORIGINS` | 일반 | `https://<도메인>` |
| `NEXT_PUBLIC_APP_URL` | 일반 | `https://<도메인>` — **backend가 `FRONTEND_URL` 대신 이 이름을 읽어요** (`config.py`). compose의 `FRONTEND_URL`은 지금 무시돼요 |
| `NEXT_PUBLIC_API_BASE_URL` | 일반 | `/api/v1` — **GitHub Actions 프론트 빌드 때** 넣어야 해요 (SSM 값이 아니라 빌드 설정) |
| `GOOGLE_SERVICE_ACCOUNT_FILE` 등 `GOOGLE_*` | 비밀 | 구글 캘린더 동기화를 켤 때. 키 파일은 EC2에 `chmod 600`으로 두고 마운트 |
| `ORIGIN_VERIFY_SECRET` | 비밀 | CloudFront 비밀 헤더 값 (nginx용) |
