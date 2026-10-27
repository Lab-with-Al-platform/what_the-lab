# Backend

FastAPI 기반 API와 서버의 비즈니스 규칙을 담당합니다.

> 2026-10-21: 팀 기본 DB는 **Supabase**입니다. 회원·인사이트·migration이 공통 `DATABASE_URL`을 사용하며, 기존 개발용 labbridge-dev에 회원 23개 표와 보호 설정을 추가했습니다. 로그인 검사·계정 상태·공통 관리자 필드도 연결했습니다. **코드·구조 통합과 기존 데이터 이전은 다릅니다.** 기존 MySQL 데이터는 삭제·자동 이전하지 않았습니다. [조직 생성·초대·실행 따라 하기](../docs/development/SUPABASE_TEAM_ONBOARDING.md), [공통 DB 안내](../docs/development/SHARED_DATABASE_GUIDE.md)를 참고하세요.

## 현재 구현 상태

- [x] FastAPI 서버 뼈대 (`/api/v1/health`)
- [x] 디스코드 로그인 (OAuth2, `identify` 권한)
- [x] 처음 로그인한 디스코드 계정은 자동으로 회원 생성 (= 가입 시작)
- [x] 자체 JWT 발급 → httpOnly 쿠키 저장 (7일)
- [x] 로그인 사용자 확인 (`/api/v1/auth/me`)
- [x] 회원·인사이트 공통 Supabase 구조 적용·실제 DB 검증 (본인 브라우저의 Discord 승인은 별도 확인)
- [x] 인사이트 전용 PostgreSQL 연결 코드·마이그레이션·승인/공개 API (개발용 Supabase 적용·검증 완료, 기본 비활성, 운영 적용 아님)
- [x] 가입 정보 저장 코드 (회원 유형, 소속, 프로필. 실제 회원 DB 동작은 별도 검증 필요)
- [x] 로그아웃 API와 프론트 연결 코드
- [ ] 닉네임 중복 처리

## 로컬 실행

먼저 [팀 시작 안내](../docs/development/SUPABASE_TEAM_ONBOARDING.md)에 따라 같은 Supabase 개발 프로젝트의 접속 정보를 설정합니다. Docker는 필요하지 않습니다. 기존 `.env`의 `3309`는 MySQL 포트이므로 PostgreSQL 접속에 쓰지 않습니다.

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
  "user_id": 1,
  "discord_id": "100000000000000001",
  "nickname": "example-researcher",
  "user_photo": null,
  "user_role": null,
  "signup_step": "role",
  "status": "active",
  "is_admin": false
}
```

| 필드 | 설명 |
|---|---|
| `user_id` | 서비스 내부 정수 ID. 다른 데이터는 이 값으로 연결하되, DB 간 이전 시 번호가 같다는 이유로 같은 회원으로 보지 않음 |
| `discord_id` | 디스코드 고유 번호. 로그인 시 기존 회원 확인 기준 |
| `nickname` | 서비스 닉네임. 처음에는 디스코드 사용자명으로 채움 |
| `user_photo` | 프로필 사진 정보 (없으면 null) |
| `user_role` | `researcher` / `expert`. 회원 유형 선택 전에는 null |
| `signup_step` | 가입 진행 단계. `role` → … → `done` |
| `status` / `is_admin` | 계정 사용 가능 상태와 공통 관리자 여부. 연구자/전문가 역할과 별개 |

## 현재 한계

- **데이터 이전은 별도**: PostgreSQL 코드 전환만으로 기존 MySQL 계정·프로필이 복사되지는 않습니다. 원본 DB를 보존하고 Discord 사용자 ID로 대조해야 합니다.
- **설정 우선순위**: 공통 `DATABASE_URL` → 비어 있을 때만 `DB_*`. 연결 대상 변경 후 백엔드를 재시작해야 합니다. 같은 DB 안에서 회원은 `public.users`, 인사이트는 `insight_private`를 사용합니다.
- **로그인 갱신**: JWT에 내부 user_id와 Discord ID를 함께 검증합니다. 이전 형식의 쿠키는 한 번 다시 로그인해야 합니다. 정지·탈퇴·존재하지 않는 회원은 쿠키가 남아 있어도 접근하지 못합니다.
- 회귀 검사 외에 실제 Supabase 회원 구조·보호 설정을 적용하고 가상 Discord 응답으로 회원 생성·전문가 가입·프로필·관리자·로그아웃을 검증했습니다. 테스트 행은 모두 rollback했습니다. 본인 브라우저의 실제 Discord 승인과 기존 MySQL 데이터 이전은 별도입니다. 실파일 `.env`의 기존 Supabase URL을 사용했으며 비밀값은 변경하지 않았습니다.
- 디스코드 토큰(access/refresh)은 저장하지 않습니다. 사용자 확인에 한 번만 사용합니다.

## 인사이트 첫 백엔드

자세한 순서와 제한은 [실행 안내](../docs/ai-case-automation/FOUNDATION_RUNBOOK.md)를 읽습니다. `INSIGHTS_ENABLED=false`가 기본이며 기존 정적 사례·트렌드 화면은 바꾸지 않았습니다.

2026-10-16 `labbridge-dev`에 최초 migration을 적용했고 실제 PostgreSQL 동시성 검사를 포함한 테스트 29개가 통과했습니다. 이후 사용자가 제공한 본인 ID를 로컬 관리자 목록에 등록하고 개발 API를 활성화했습니다. [DB·관리자 설정 검증 기록](../docs/qa/INSIGHT_SUPABASE_MIGRATION_2026-10-16.md)을 참고하세요. 백엔드 재시작 후 실제 Discord 로그인 확인, 실제 사례·화면 연결은 아직입니다.

- `app/insights/`: DB 모델·입력 검증·권한·검토/승인/공개 규칙
- `app/routers/insights.py`: 관리자 후보 API와 공개 전용 API
- `migrations/`: 인사이트 schema 변경 이력 (2026-10-16 지정 개발용 Supabase 적용, 운영 적용 아님)
- `tests/`: 가상 자료·임시 DB 기반 테스트 및 명시적으로 선택하는 PostgreSQL 검사

인사이트 감사 이력은 서버가 확인한 `discord_id`를 사용합니다. 최신 회원 저장소의 정수형 `user_id`로 로그인한 뒤에도 같은 Discord 계정의 관리자 여부를 확인하도록 회귀 검사했습니다. 실제 회원 DB와 연결한 전체 로그인 검사는 별도로 필요합니다.

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


## 자유게시판·FAQ 통합 (2026-10-26)

공개·비공개 게시판 API와 FAQ를 오늘 전문가 검색·협업 요청·알림·프로필 설정 코드에 통합했습니다. 공통 `DATABASE_URL`·Discord JWT·`users.is_admin`을 재사용합니다. 인사이트 관리자 허용목록은 게시판 권한을 주지 않습니다.

기존 알림 revision `20261025_06`과 운영 조회 `20261026_07`~`09`를 유지하고, 게시판 `20261026_10` → `20261026_11`을 그 뒤에 연결했습니다. 공용 Supabase 변경은 기존 [알림 설정 안내](../docs/development/SETUP_NOTIFICATION_PROFILE.md)에 따라 DB 담당자만 수행합니다. 일반 팀원은 `alembic current`로 확인하며 임의 upgrade/stamp를 실행하지 않습니다.

[현재 설치·DB 적용](../docs/community/INSTALL_AND_QA.md), [호환성](../docs/community/SOURCE_COMPATIBILITY.md), [API 계약](../docs/community/API.md), [통합 검증](../docs/community/INTEGRATION_VERIFICATION_20261026.md)을 확인하세요. 이전 게시판 V2의 05·06 적용 안내를 이 통합본에 사용하지 않습니다.
