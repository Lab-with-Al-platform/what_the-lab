# PR #10 — develop 충돌 해결 및 검증

확인일: 2026-10-17 (Asia/Seoul). 대상: `feature/insight-foundation` → `develop`의 [PR #10](https://github.com/Lab-with-Al-platform/what_the-lab/pull/10).

## 1. 기준과 작업 범위

- PR 원래 끝: `098b888`.
- 받아온 develop: `53fd8ac` (로그인 헤더·프로필 메뉴·로그아웃 추가, PR #11).
- 기능 브랜치에서 develop을 병합했다. develop에 직접 기능 커밋하지 않으며 PR을 자동 병합하지 않는다.
- 사용자 요청에 따라 PostgreSQL 회원 전환은 대기하고 Git 충돌과 연결 지점 회귀 검사를 처리한다.
- 작업 전부터 남아 있던 `frontend/src/lib/insights.ts`의 글 2편 보강과 `docs/qa/insight-enrichment-20261016/`는 이번 해결 커밋에 포함하지 않는다.

## 2. 충돌별 해결 의도

| 파일 | 해결 |
|---|---|
| `.env.example` | 인사이트 설정과 임시 MySQL 회원 설정을 모두 보존. 중복 APP_ENV 제거. 두 DB가 아직 통합되지 않았다고 주석으로 명시 |
| `backend/app/main.py` | auth·verification·researcher·expert·insights 라우터를 모두 등록 |
| `backend/uv.lock` | 충돌본은 Git 제외 tmp에 백업. 기존 기능 브랜치 잠금 버전을 기준으로, 양쪽 요구사항이 합쳐진 pyproject.toml에 대해 uv lock 재실행 |

잠금 파일은 한쪽 파일을 최종본으로 선택한 것이 아니다. 기존 버전은 유지하고 develop에서 필요한 `cffi 2.1.1`, `cryptography 50.0.2`, `pycparser 3.11`, `pymysql 1.2.3`이 추가됐다. 최종 해석 패키지는 44개다.

## 3. 자동 병합 이후의 테스트 경계

회원 저장소는 메모리 방식에서 MySQL 접근 함수로 바뀌었다. 기존 인사이트 테스트의 가상 로그인이 회원 DB에 연결되지 않도록 테스트 안에서만 회원 조회·생성을 임시 dict 함수로 바꿨다. 실제 회원 연결 함수가 호출되면 테스트가 실패하도록 막았다. 이는 운영 코드의 회원 DB를 메모리 방식으로 되돌린 것이 아니다.

테스트 환경에는 실제 `.env` 대신 가상 회원 DB 이름·계정과 접근 불가능한 로컬 포트를 지정했다. 사용자 실제 `.env`는 수정하지 않았다. 정수 회원 ID → JWT의 문자열 sub → 정수 ID 복원 → Discord ID 관리자 검사 흐름을 확인했다.

추가 회귀 검사:

- 회원·로그아웃·연구자·전문가·인사이트 API 경로가 OpenAPI에 함께 존재한다.
- 가상 회원 로그인 시 /auth/me와 관리자 후보 목록에 접근할 수 있다.
- 로그아웃 후 로그인 쿠키가 사라지고 /auth/me·관리자 API는 401을 반환한다.
- 테스트 쿠키의 호스트·경로를 실제 응답과 맞췄다. 도메인 없는 수동 쿠키로 로그아웃 검사를 대체하지 않았다.

## 4. 실행한 검사

- `uv sync --locked`: 통과.
- 기본 backend 테스트: **30 passed, 1 skipped, 1 warning**. 실제 PostgreSQL 동시성 검사는 실행 설정을 false로 지정해 건너뛰었다. 기존 httpx TestClient 사용 중단 예고 경고 1개는 유지된다.
- Ruff 검사: app/main.py·인사이트 코드·마이그레이션·테스트 통과.
- Ruff 형식 검사: 위 범위의 15개 파일 통과.
- `uv lock --check`, `uv sync --locked --check`: 통과. 추가 설치 변경 없음.
- 프론트 `npx tsc --noEmit`: 통과.
- 변경 공백·충돌 표식 검사: 통과.
- 글 보강 파일 SHA-256은 작업 전후 동일: `2B7D6DAE4C9C5B1B028F394BD15688C581A79C692130EB3ECCA4E0D58AB075DC`.

프로덕션 프론트 빌드·새 헤더의 실제 브라우저 로그인·실제 회원 SQL 검증은 이번 범위에 포함하지 않았다.

## 5. 반드시 남겨 둘 제한

**Git 충돌 해결 ≠ PostgreSQL 통합 완료 ≠ 실제 로그인 전체 흐름 통과.**

현재는 회원 DB가 MySQL, 인사이트가 PostgreSQL인 전환 중 코드다. 공통 DB를 PostgreSQL로 통일한다는 결정은 유지되며 MySQL을 운영 DB로 새로 확정한 것이 아니다. Docker/MySQL이나 Supabase DB를 시작·생성·변경하지 않았고 데이터 마이그레이션도 수행하지 않았다.

현재 app/config.py는 DB_NAME·DB_USER·DB_PASSWORD를 시작할 때 필수로 읽는다. DATABASE_URL만 설정된 환경은 서버 시작 시 설정 오류가 날 수 있다. 임시 회원 DB 설정과 실제 연결이 필요하며, 인사이트만 PostgreSQL에 연결된 상태를 회원 통합 완료로 안내하지 않는다.

다음 단계는 팀원의 PostgreSQL 회원 전환 반영 후 실제 테스트 DB에서 로그인·회원가입·기관 확인·권한·인사이트 전체 흐름을 다시 검사하는 것이다. 이번 가상 회원 테스트는 그 검사를 대신하지 않는다. 게시 자동화·운영 배포는 실행하지 않는다.
