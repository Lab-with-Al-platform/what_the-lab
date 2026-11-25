# Phase 0 - 인사이트 첫 구현 사전 확인

확인일: 2026-10-16. 기준 코드: `90aa4ab` (기능 코드의 develop 기준 `d4c4293`).

> 아래는 최초 구현 전 확인 기록입니다. 같은 날 후속 승인으로 개발용 Supabase 연결·최초 migration·구조/권한/동시성 검사를 완료했습니다. 현재 결과는 [개발용 DB 검증 기록](../qa/INSIGHT_SUPABASE_MIGRATION_2026-10-16.md)을 참고합니다. 운영 적용·화면·자동 수집까지 완료한 것은 아닙니다.

## 1. 확인 결과와 이번 개발 범위

사용자가 인사이트 자동화를 맡기로 했고, 사례 한 편의 저장·검토·승인·공개부터 진행하도록 요청했다. 추가 질문에서 **팀 공통 DB는 Supabase(PostgreSQL)로 확정**되었다.

이번 구현은 비활성 기본값의 **첫 백엔드 기능**이다. 실제 Supabase 연결·스키마 적용·외부 게시, 논문 대량 수집, LLM 호출, 관리자 UI, 운영 스케줄러는 이번 단계에서 실행하지 않는다. 후속 단계가 필요하다는 사실을 완료로 표시하지 않는다.

기능 브랜치는 `feature/insight-foundation`이다. 원격 develop을 읽기 전용으로 확인했으며 `d4c4293`이었다. 현재 문서 경로를 유지하기 위해 develop의 자손인 문서 정리 커밋 `90aa4ab`에서 분기했다. 문서 정리 브랜치와의 의존성을 PR에서 명시하고, 병합 시 최신 develop과 다시 통합해야 한다. 기존 `output/` 자료는 보존한다.

## 2. 실제 인벤토리

| 위치 | 확인 사실 | 재사용·조치 |
|---|---|---|
| `backend/app/main.py` | health와 auth 라우터 | 인사이트 라우터 추가, 기능은 기본 비활성 |
| `backend/app/routers/auth.py` | Discord identify, JWT 쿠키, /me | 기존 세션 확인 흐름 재사용 |
| `backend/app/user_store.py` | 회원 메모리 저장, 재시작 시 UUID 변경 | 회원 저장소 전체를 임의 이행하지 않음. 인사이트 감사 주체는 세션으로 확인한 안정적인 discord_id를 사용 |
| `backend/app/security.py` | HS256 서명·만료 검증 | 클라이언트의 역할·ID 입력을 승인 권한으로 신뢰하지 않음 |
| `backend/app/config.py` | .env import 시 필수 인증값 읽음 | 테스트에는 더미 값만 사용, 실제 .env 값을 출력하지 않음 |
| `.env.example` | DATABASE_URL/Supabase 예시 | 서버 직접 PostgreSQL 연결 방식을 채택, 브라우저에 DB·서비스 키 전달 금지 |
| `database/` | README만 존재 | Alembic 최초 마이그레이션 준비, 실제 원격 적용은 별도 |
| `frontend/src/lib/insights.ts` | 정적 seeds와 공개 타입, 발행 상태 없음 | 기존 글을 보존. 미승인 후보를 이 배열에 추가하지 않음 |
| `frontend/src/app/cases`, `trends` | 공통 ArticleView와 정적 상세 경로 | 첫 단계는 공개 API만 검증. 화면 전환은 후속 단계 |
| `frontend/src/components/expert-browser.tsx` | q/skill/task/domain/available 문자열 필터 | CAP ID 검색 구현으로 간주하지 않음 |
| `taxonomy/v4.0/` | Release Candidate, CAP·FIELD·alias pending_review | 운영 키워드 자동 승격 금지 |
| `ai/`, `infra/`, `tests/` | 경계·예정 책임 문서 | LLM·스케줄·배포가 구현됐다고 간주하지 않음 |

현재 API: GET /api/v1/health, GET /api/v1/auth/discord/login, GET /api/v1/auth/discord/callback, GET /api/v1/auth/me. 관리자 API와 공개 인사이트 API는 이번 작업 전에는 없었다.

## 3. 근거 자료와 분류체계 차이

- 통합 실행 지시서와 편집 기준서를 현재 입력으로 삼는다. 기존 분할 문서의 2026-10-10 인벤토리는 FastAPI·PDF가 없던 당시 기록이며 현재 사실이 아니다.
- 현재 자료 패키지에는 연구사례 자료집과 Keyword Master 결정안 PDF가 존재한다. 최신 결정은 연구 21건 + 실용 17건, AM-01~08·AM-10, 가정 시나리오 제외다. 자료집 설명은 원 논문 재검증을 대신하지 않는다.
- 화면 CASE_TOPICS에는 AM-10이 없고, taxonomy v4는 CAP/FIELD/UG/TOOL 체계다. AM과 UG는 동일 체계가 아니다.
- v4 구조 검사 결과: CAP 80, FIELD 83, alias 632, UG 11. 의미·실제 검색·권한·DB 연동은 해당 검사로 검증되지 않는다.
- 전체 매핑과 38건 import는 후속 단계다. 첫 기능은 키워드가 없으면 일반 `/experts` 탐색으로 연결하고, 승인되지 않은 링크는 공개하지 않는 경계를 검증한다.

## 4. 첫 구현의 데이터·권한 계약

서버 전용 `insight_private` PostgreSQL schema에 출처, 후보, 불변 본문 버전, 주장 근거, 키워드 링크, 검토 이력, 공개 스냅샷을 저장한다. Supabase 자동 Data API에 후보 테이블을 노출하지 않는다. 일반 사용자는 FastAPI의 공개 전용 API만 읽는다.

이번 물리 테이블은 `sources`, `candidates`, `revisions`, `review_events`, `publications`의 5개다. 주장·평가·키워드·출처 정보는 revision의 JSON에 함께 고정해 승인 대상이 어긋나지 않도록 한다. 상세 설계의 claim·mapping 독립 테이블과 수집 작업 테이블은 후속 단계에서 필요에 맞춰 분리한다. 불변성은 현재 서비스 API에서 보장하며 DB 소유자의 직접 SQL 수정까지 막는 감사 저장소는 아니다.

흐름: `draft → pending_review → approved → published`. 수정·근거 변경은 새 revision을 만들고 승인을 무효화한다. 전체 수집·분석 상태는 후속 파이프라인에서 확장한다.

첫 역할은 서버 설정 `INSIGHT_ADMIN_DISCORD_IDS`에 등록된 Discord 계정의 인사이트 관리자다. 기본값은 빈 목록이다. 연구자/전문가 역할을 관리자 역할로 해석하지 않는다. 관리자 목록의 실제 값·변경 권한은 운영자가 관리하며 테스트에서만 가상 ID를 쓴다. 세분화 RBAC는 후속 관리자 UI 단계에서 추가한다.

본문 승인 시 확인: 출처·서지 상태, 핵심 claim 근거와 위치, 필수 섹션, 점수, 편집자 검토 확인, 이미지 권리, 키워드 상태. AI 결과만으로 확인 체크를 만들지 않는다. 본문·근거·권리·키워드는 승인 revision 안에 고정한다.

서버는 version 충돌, 미승인 공개, 예약 전 실행, 중복 게시, 잘못된 Origin의 쓰기 요청을 차단한다. 공개 후 수정은 첫 기능에서 차단하고 후속 정정 절차에서 별도로 구현한다.

## 5. 최신 공식 문서 확인

| 항목 | 확인 내용 | 구현 영향 |
|---|---|---|
| [Supabase DB 연결](https://supabase.com/docs/guides/database/connecting-to-postgres) | 서버 환경·네트워크·pooling에 따라 연결 방식 선택 | FastAPI 서버 직접 연결, 실제 호스트는 로컬 .env에서 지정. 원격 스키마 변경 미실행 |
| [SQLAlchemy](https://docs.sqlalchemy.org/en/20/orm/quickstart.html), [Alembic](https://alembic.sqlalchemy.org/en/latest/tutorial.html) | ORM 세션·트랜잭션과 버전별 마이그레이션 | 동기 방식으로 기존 sync 라우터 스타일 유지 |
| [OpenAlex 인증](https://help.openalex.org/api/authentication/) | 최신 문서는 키 없는 기본 질의와 키 기반 예산·cursor를 구분 | 정기 수집은 키와 예산 설정 전 활성화하지 않음 |
| [OpenAlex API](https://help.openalex.org/api/) | HTTP API와 비용 정보 | 이전 docs.openalex.org 경로·오래된 무료 호출 가정 사용 금지 |
| [Crossref 접근 정책](https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/) | mailto/polite, rate·concurrency 응답 헤더 | 수집 단계에서 응답 헤더·429를 기준으로 제한 |
| [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence) | 메모리 checkpointer는 재시작 후 유지되지 않음 | 첫 단계에서 추가하지 않음. 이후 영속 DB 설정과 함께 도입 |

위 확인은 문서 검토다. 유료 서비스 가입·키 발급·실제 API 호출·원문 이용 허가를 완료한 것은 아니다. LLM 제공사·모델·요금·보존정책, 논문별 이용권·보존기간·알림 채널·게시 시각은 해당 기능 실행 전에 결정한다.

## 6. 검증 계획과 환경 한계

- 현재 Docker 실행기는 있으나 daemon이 실행되지 않아 로컬 PostgreSQL 테스트를 바로 수행할 수 없었다.
- Python 3.13 backend 가상환경과 frontend 의존성은 존재한다. 이번 구현에서 SQLAlchemy·Alembic·psycopg 및 pytest·Ruff를 추가하고 잠금 파일을 갱신했다.
- fixture 기반 테스트는 일시 SQLite DB에서 정상·권한·충돌·승인·중복 게시 경계를 확인한다. 이는 PostgreSQL 동시성·Supabase 권한 검증을 대체하지 않는다.
- 실제 PostgreSQL 테스트는 별도 테스트 DB URL을 명시한 경우에만 실행하며, 운영 DATABASE_URL을 테스트 대상으로 자동 사용하지 않는다.
- 실제 로그인·원격 DB·LLM·프론트 공개 화면·예약 worker는 통합 E2E 미검증으로 남긴다.

첫 구현 검증 결과와 재실행 방법은 [실행 안내](FOUNDATION_RUNBOOK.md)에 기록한다. 마이그레이션은 오프라인 SQL 생성까지만 확인했으며 원격 DB에는 적용하지 않았다.

## 7. 다음 단계 조건

현재 사용자의 진행 요청과 Supabase 확정 답변으로, 비활성 기본값의 로컬 첫 백엔드 구현을 진행한다. 제품 문서에는 이 범위만 추가 결정으로 기록한다. 무인 자동 게시·분류체계 일괄 승인·실제 운영 배포까지 승인된 것으로 확대하지 않는다.

실제 Supabase 적용 전 필요한 것: 개발/운영 프로젝트 구분, 서버 전용 연결 URL과 권한, DB 백업·schema 충돌 확인, 관리자 계정 지정, PostgreSQL 마이그레이션·동시성 테스트 통과. 비밀값은 대화에 붙이지 않고 로컬 환경 또는 secret 저장소로 관리한다.
