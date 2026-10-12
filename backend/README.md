# Backend

FastAPI 기반 API와 서버의 비즈니스 규칙을 담당합니다.

## 현재 구현 상태

- [x] FastAPI 서버 뼈대 (`/api/v1/health`)
- [x] 디스코드 로그인 (OAuth2, `identify` 권한)
- [x] 처음 로그인한 디스코드 계정은 자동으로 회원 생성 (= 가입 시작)
- [x] 자체 JWT 발급 → httpOnly 쿠키 저장 (7일)
- [x] 로그인 사용자 확인 (`/api/v1/auth/me`)
- [ ] DB 연결 (현재는 서버 메모리에 임시 저장)
- [ ] 가입 정보 저장 (회원 유형, 소속, 프로필)
- [ ] 로그아웃
- [ ] 닉네임 중복 처리

## 로컬 실행

### 1. 환경변수

> 로컬 개발에서는 **각자 디스코드 개발자 포털에서 앱을 만들어** 자기 Client ID·Secret을 사용합니다.
> (https://discord.com/developers/applications → New Application → OAuth2 → 리디렉션 등록)
> `JWT_SECRET`도 각자 생성합니다. 시크릿 값은 채팅·저장소에 공유하지 않습니다.

저장소 맨 위 `.env`에 아래 값을 추가합니다. (`.env.example` 참고)

| 이름 | 값 |
|---|---|
| `DISCORD_CLIENT_ID` | 디스코드 개발자 포털 → OAuth2 → 클라이언트 ID |
| `DISCORD_CLIENT_SECRET` | 디스코드 개발자 포털 → OAuth2 → 클라이언트 시크릿 |
| `DISCORD_REDIRECT_URI` | `http://localhost:8000/api/v1/auth/discord/callback` |
| `JWT_SECRET` | `uv run python -c "import secrets; print(secrets.token_urlsafe(32))"` 로 생성 |

> 디스코드 개발자 포털 OAuth2 → 리디렉션에 `DISCORD_REDIRECT_URI`와 **똑같은 주소**가 저장되어 있어야 합니다.
> 한 글자라도 다르면 "잘못된 OAuth2 redirect_uri" 오류가 납니다.

### 2. 실행

```
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

- `uv sync`: `pyproject.toml`, `uv.lock` 기준으로 라이브러리를 설치합니다. (처음 한 번, 라이브러리가 바뀌었을 때)
- 상태 확인: http://localhost:8000/api/v1/health → `{"status":"ok"}`
- API 문서: http://localhost:8000/docs

로그인까지 확인하려면 프론트도 같이 켭니다. (`frontend` 폴더에서 `npm run dev`)

## 폴더 구조

| 경로 | 역할 |
|---|---|
| `app/main.py` | 앱 생성, CORS 설정, 라우터 등록만 담당 |
| `app/config.py` | 저장소 맨 위 `.env` 값을 읽어 모아 둠 |
| `app/security.py` | JWT 만들기·확인하기 |
| `app/user_store.py` | 회원 저장소. 지금은 메모리, DB 연결 시 이 파일의 함수 안쪽만 교체 |
| `app/routers/auth.py` | 디스코드 로그인·콜백·내 정보 API |

새 기능을 추가할 때는 `app/routers/`에 파일을 만들고, `main.py`에 `app.include_router(...)` 한 줄만 추가합니다.

## 로그인 흐름

```
[디스코드로 로그인] (프론트 /login)
 → GET /api/v1/auth/discord/login       디스코드 승인 화면으로 이동
 → 디스코드에서 [승인]
 → GET /api/v1/auth/discord/callback    디스코드 사용자 정보 조회
      ├ 처음 온 계정: 회원 생성 (가입 시작)
      └ 기존 계정: 그대로
 → JWT를 httpOnly 쿠키(access_token)로 발급
 → 프론트로 이동
      ├ 가입 미완료: /signup (회원 유형 선택)
      └ 가입 완료: /
```

- 승인 취소·오류 시 `/login?error=denied`(또는 `error=discord`)로 이동합니다.
- 로그인 요청 위조를 막기 위해 `state` 값을 쿠키에 저장해 콜백에서 비교합니다.

## 인증 API

| 주소 | 설명 |
|---|---|
| `GET /api/v1/auth/discord/login` | 디스코드 승인 화면으로 이동 |
| `GET /api/v1/auth/discord/callback` | 회원 확인·생성 후 JWT 쿠키 발급, 프론트로 이동 |
| `GET /api/v1/auth/me` | 현재 로그인 사용자 정보. 로그인 안 됐으면 401 |

`/me` 응답 예시:

```json
{
  "user_id": "f3f72618-3318-4d0c-b61e-f26f9fdae832",
  "discord_id": "432511801264046083",
  "nickname": "cayongu",
  "avatar": null,
  "role": null,
  "signup_step": "role"
}
```

| 필드 | 설명 |
|---|---|
| `user_id` | 서비스 고유 ID (uuid). 다른 데이터는 모두 이 값으로 연결 |
| `discord_id` | 디스코드 고유 번호. 로그인 시 기존 회원 확인 기준 |
| `nickname` | 서비스 닉네임. 처음에는 디스코드 사용자명으로 채움 |
| `avatar` | 디스코드 프로필 사진 코드 (없으면 null) |
| `role` | `researcher` / `expert`. 회원 유형 선택 전에는 null |
| `signup_step` | 가입 진행 단계. `role` → … → `done` |

## 현재 한계

- **DB 없음**: 서버를 재시작하면 회원 정보가 모두 사라집니다. 다시 로그인하면 새 회원으로 만들어집니다.
- **가입 정보 미저장**: 가입 화면의 [가입 완료]가 아직 서버에 저장하지 않아, 다시 로그인해도 계속 `/signup`으로 이동합니다.
- 디스코드 토큰(access/refresh)은 저장하지 않습니다. 사용자 확인에 한 번만 사용합니다.

## 중요한 원칙

- 브라우저가 보낸 역할이나 소유권을 그대로 신뢰하지 않고 서버에서 확인합니다.
- 공개 응답 모델에는 개인 연락처를 넣지 않습니다.
- `.env`의 시크릿 값(`DISCORD_CLIENT_SECRET`, `JWT_SECRET`, 서비스 역할 키)은 서버에서만 사용하고 커밋하지 않습니다.
- 모집 정원과 최종 선택처럼 동시에 수정될 수 있는 작업은 데이터베이스 트랜잭션으로 보호합니다.
- API는 `/api/v1`처럼 버전을 포함한 경로를 사용합니다.

## 예정 책임

- 연구자·AI 전문가 프로필 API
- 연구 등록·탐색 API
- 협업 요청과 참여 신청의 상태 흐름
- 협업 확정 이후 일정·기록·종료·평가
- 디스코드 DM 알림과 최소 관리자 기능