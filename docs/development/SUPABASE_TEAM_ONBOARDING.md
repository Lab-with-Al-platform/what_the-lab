# Supabase 팀 조직 생성·초대·개발 실행

2026-10-21 기준. 팀 기본 DB는 Supabase이며 Docker는 필요하지 않습니다. 조직 생성·초대·프로젝트 이동은 사용자 본인이 수행하는 절차입니다. 이 작업에서 대신 실행하거나 유료 결제를 하지 않았습니다.

## 1. 무엇이 통합됐나?

- 기존 개발 프로젝트 labbridge-dev를 회원·프로필·연구·인사이트의 공통 DB로 사용합니다.
- 데이터 표는 회원 23개(public), 인사이트 5개(insight_private)이며 변경 이력 표는 public.insight_alembic_version입니다.
- 서버의 DATABASE_URL 한 개를 사용합니다. 기존 DB_PORT=3309는 더 이상 회원 연결에 사용하지 않습니다. 기존 MySQL 컨테이너/볼륨/회원 데이터는 삭제하지 않았습니다.
- 같은 Discord 계정은 같은 Supabase users에서 조회합니다. 기존 MySQL 계정을 자동 복사한 것은 아니므로, 첫 접속 시 새 DB에서 가입 단계가 표시될 수 있습니다. 기존 프로필 보존이 필요하면 수동 재입력 전에 이전 계획부터 확인하세요.
- 구형 로그인 쿠키는 안전을 위해 다시 로그인해야 합니다.

## 2. 세 가지 계정을 구분하기

| 구분 | 용도 | 관리 방법 |
|---|---|---|
| Supabase 대시보드 계정 | 팀원이 DB 구조·내용 확인 | 각자 가입하고 조직에 이메일로 초대 |
| PostgreSQL DB 접속 계정 | 로컬 FastAPI/DBeaver가 서버 DB에 연결 | 서버 전용 자격증명으로 관리, 가능하면 담당자별 제한 역할 |
| LabBridge 사이트 회원 | 연구자/전문가로 서비스 사용 | 각자 Discord 로그인, 공통 public.users에 저장 |

대시보드 Developer 초대는 LabBridge 관리자 지정이 아닙니다. DB 접속 URL도 초대 메일에 자동 포함되지 않습니다. 서비스 관리자 권한은 별도 승인해야 하며, 이번에 실제 회원의 관리자 값을 임의로 만들지 않았습니다.

## 3. 팀 전용 조직 만들기

1. [Supabase Dashboard](https://supabase.com/dashboard)에 본인 계정으로 로그인합니다.
2. 조직 선택 메뉴에서 **New organization**을 선택합니다. 화면 구성이 달라지면 조직 관리 화면의 새 조직 기능을 찾습니다.
3. 이름은 예를 들어 **LabBridge Team**으로 입력하고 요금제는 **Free**인지 확인합니다. 팀으로 사용한다고 유료 Team 요금제를 선택할 필요는 없습니다.
4. 만든 사람이 Owner입니다. 이후 개발 팀원은 Developer로 초대합니다.

기존 Peter Jang 조직이 다른 개인 프로젝트 없이 팀 전용이라면 새 조직을 만들지 않고 그 조직에서 초대할 수도 있습니다. 개인 프로젝트가 있다면 별도의 팀 조직을 권장합니다. 무료의 조직 수준 Developer는 그 조직의 다른 프로젝트 내용에도 접근할 수 있기 때문입니다.

## 4. 기존 labbridge-dev를 팀 조직으로 옮기기(새 조직을 만든 경우)

**프로젝트를 삭제하거나 새 DB를 만들지 않습니다.** 기존 프로젝트를 조직 사이에서 옮기는 기능을 사용합니다.

1. 기존 labbridge-dev 프로젝트를 엽니다.
2. Project Settings → General에서 **Transfer project**를 찾습니다.
3. 대상 조직으로 LabBridge Team을 고릅니다. 원래 조직의 Owner이며 대상 조직에도 속해 있어야 합니다. GitHub 연결 등 추가 조건이 표시되면 먼저 확인합니다.
4. 요금제·이동 대상·프로젝트를 확인한 뒤 사용자 본인이 이동을 확정합니다.
5. 팀 조직에서 labbridge-dev가 보이는지 확인하고 Connect의 접속 정보를 다시 대조합니다. 이동에 따라 서버/네트워크/요금 조건이 바뀐다는 경고가 있으면 확정하기 전에 검토합니다.

이동 전후 실제 서비스가 끊기지 않는다고 단정하지 않습니다. 중요한 발표 직전에는 이동하지 말고 접속 확인 시간을 확보합니다.

## 5. 팀원 초대하기

1. **팀 조직**을 선택합니다. 프로젝트의 사이트 사용자 관리 화면이 아니라 Organization의 팀 설정입니다.
2. **Team → Invite member**에서 팀원이 Supabase에 가입한 이메일을 입력합니다.
3. 일반 개발 팀원은 **Developer**를 선택하고 초대합니다. 특별한 이유 없이 Owner/Administrator를 부여하지 않습니다.
4. 팀원은 자기 계정으로 로그인한 뒤 이메일 초대를 수락합니다. 현재 초대 링크 유효기간은 24시간이므로 만료되면 다시 초대합니다.
5. 팀원 화면에서 LabBridge Team과 labbridge-dev가 보이는지 확인합니다.

Developer는 DB 내용을 수정할 수 있습니다. DB 구조 적용은 담당자 한 명이 하고, 모두가 초기화 SQL을 반복 실행하지 않습니다. 읽기 전용 역할·프로젝트 단위 세밀한 역할은 무료 플랜에서 제공되지 않으므로 조직을 팀 전용으로 구분합니다.

## 6. 팀원이 자기 PC에서 설정하기

### 공통으로 맞출 것

- 최신 통합 코드(현재 작업 브랜치, 향후 PR 병합 후 develop)
- 같은 Supabase 개발 프로젝트를 가리키는 DATABASE_URL
- localhost:3000 프론트와 localhost:8000 백엔드 주소

### 각자 관리할 것

- 자기 Supabase 대시보드 계정
- 로컬 Discord 개발 앱의 Client ID/Secret 및 Redirect URI
- JWT_SECRET: 개발자별 로컬 서버에서는 각자 달라도 됩니다. 같은 배포 서비스를 구성하는 복수 서버는 동일해야 합니다.

저장소 루트 .env에 DATABASE_URL을 넣습니다. Connect → Session pooler에서 복사한 실제 URL을 쓰고 비밀번호의 예약 문자는 percent-encode합니다. 비밀번호는 로컬 앱이나 신뢰하는 비밀 관리 도구에서 처리하고 채팅에 올리지 않습니다.

```env
DATABASE_URL=postgresql://ROLE.PROJECT_REF:ENCODED_PASSWORD@POOLER_HOST:5432/postgres?sslmode=require
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
CORS_ORIGINS=http://localhost:3000
DISCORD_REDIRECT_URI=http://localhost:8000/api/v1/auth/discord/callback
```

이 예시로 기존 .env 전체를 덮어쓰지 마세요. Discord Secret/JWT_SECRET 등 기존 서버 비밀값을 보존하고 필요한 항목만 수정합니다. .env를 Git에 올리거나 팀 채팅에 통째로 붙이지 않습니다. 서버 연결 URL에 NEXT_PUBLIC_을 붙이면 안 됩니다.

DB 담당자는 초기 DB 구조 추가 적용을 이미 수행했습니다. 일반 팀원은 아래 **읽기 전용 점검과 실행만** 하면 됩니다.

```powershell
cd backend
uv sync
uv run python -m app.supabase_setup
uv run uvicorn app.main:app --reload --port 8000
```

다른 터미널에서:

```powershell
cd frontend
npm install
npm run dev
```

둘 다 프로젝트 루트에서 시작한 예시입니다. npm install은 처음 또는 의존성이 바뀐 경우에 필요합니다. Docker Desktop과 MySQL을 켤 필요는 없습니다. 다른 용도로 사용하는 Docker/Qdrant 등을 삭제할 필요도 없습니다.

## 7. 정상 동작 확인

- /api/v1/health → 200: 서버 실행 확인일 뿐 DB 전체 검증은 아님.
- /api/v1/expert/able-works → 200, 11개: 실제 회원용 DB 읽기.
- /api/v1/taxonomy/fields → 대분류 10개, 세부 연구 분야 총 83개.
- 로그인 전 /api/v1/auth/me → 401: 정상적인 비로그인 차단.
- localhost:3000/login에서 본인이 Discord 승인 → 가입 또는 기존 회원으로 이동.
- 로그인 뒤 같은 브라우저의 localhost:8000/api/v1/auth/me에서 현재 회원 확인. code/state/쿠키/토큰은 공유하지 않습니다.
- 인사이트 관리자 API는 별도 권한이 필요합니다. 로그인만 했는데 403이면 정상일 수 있습니다.

서버 전용 표에는 RLS가 켜져 있고 브라우저용 Supabase 역할의 표 권한이 없습니다. 대시보드에 no policies 경고가 보이더라도 문제를 해결하려고 공개 정책을 추가하거나 RLS를 끄지 않습니다. 현재는 Supabase Auth가 아니라 FastAPI의 Discord/JWT 인증을 사용합니다.

## 8. 남아 있는 별도 작업

- 기존 MySQL 회원·프로필·연구를 Supabase로 이전할지 결정. 원본은 보존했습니다. 서로 다른 DB의 user_id나 닉네임만으로 합치지 않고 Discord ID와 연결 관계를 확인해야 합니다.
- 포트폴리오 PDF 등 backend/uploads의 파일은 아직 각 PC에 있습니다. 공용 DB만 사용한다고 파일까지 팀원에게 공유되는 것은 아닙니다. 공유 파일 저장소는 별도 작업입니다.
- 운영 DB·자동 백업·제한된 애플리케이션 DB 역할·배포 인증 설정은 운영 전 따로 검토합니다.
- 무료 프로젝트는 활동 부족으로 일시중지될 수 있으므로 발표 전에 연결 상태를 확인하고, 중요한 변경 전 논리 백업을 준비합니다. 이번 생성 전 스냅샷은 기존 인사이트 자료/이력만 보관한 체크포인트이며 전체 DB dump를 대체하지 않습니다.

## 공식 참고 자료

- [조직 권한·초대](https://supabase.com/docs/guides/platform/access-control)
- [프로젝트 조직 간 이동](https://supabase.com/docs/guides/platform/project-transfer)
- [DB 연결·Session pooler](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [API 권한과 RLS](https://supabase.com/docs/guides/api/securing-your-api)
