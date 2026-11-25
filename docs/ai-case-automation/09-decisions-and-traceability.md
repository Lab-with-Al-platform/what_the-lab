# 09. 결정 기록·원본 근거 대응표·미확인 항목

> 이 문서의 미제공·저장소 미확인 항목은 최초 작성 시점 기록입니다. 2026-10-16 실제 저장소 확인 결과와 제한된 첫 구현은 [Phase 0 기록](PHASE_0_FINDINGS.md), [실행 안내](FOUNDATION_RUNBOOK.md)를 우선 참고합니다. 아래 과거 근거는 이력으로 보존합니다.

## 근거 레벨

- **[SOURCE]** 사용자 첨부 2종에 직접 포함.
- **[DESIGN]** 구현을 위한 제안. 실제 기술 스택/디자인/DB 확인 전 확정 아님.
- **[VERIFY]** 원문 논문 및 실제 저장소·키워드 결정안 등 추가 확인 필요.

| 주제 | 상태 | 근거 또는 처리 |
|---|---|---|
| 축소 MVP: 실제 사례→기술 발견→전문가 검색 | SOURCE | Keyword Guide §1~2 |
| Task Board 등 대형 협업 관리 기능 제외 | SOURCE | Keyword Guide §1 |
| 출처는 원문/DOI/기관 우선 | SOURCE | Keyword Guide §5 |
| 12점 평가와 기준점 | SOURCE | Keyword Guide §6 |
| Case Sheet 필드 | SOURCE | Keyword Guide §7, §14 |
| 연구자용/전문가용 키워드 분리, bottom-up | SOURCE | Keyword Guide §3, §8~11 |
| 미확인 기술/과장·수치 금지 | SOURCE | Keyword Guide §12, §15 |
| 대표 논문 21건 (001~021) | SOURCE | PDF A/B 및 1쪽 표지 주석 |
| PDF C~F는 001~016 기준 | SOURCE | PDF 1쪽 표지 주석 |
| G절 CASE-LAB-01~05는 시나리오 가정 | SOURCE | PDF G절 설명 |
| G절 국내 연구 15건은 DOI·초록 확인 | SOURCE | PDF G절 '국내 연구 AI 적용 사례' |
| 확정 Keyword Master 목록/ID | VERIFY | 별도 'Keyword Master 결정안' PDF가 첨부되지 않음 |
| Next.js/FastAPI/PostgreSQL 실제 사용 | VERIFY | 레포 미확인, 기존 대화상의 제안과 구분 |
| admin RBAC와 insight API/디자인 토큰 | VERIFY | 저장소 직접 확인 필요 |
| GitHub Actions·OpenAlex·Crossref | DESIGN | 권장 옵션, 공식 API 문서/요금/정책 구현 직전 확인 |
| schedule 03:00 KST, 주 2~3건 게시 | DESIGN | 초기 운영 가정, 운영자 결정 필요 |

## Phase 0에서 채워야 할 결정표

| ID | 결정 질문 | 기본 제안 | 확정값/근거 |
|---|---|---|---|
| D-01 | 저장소 실제 프레임워크와 ORM? | 기존 것 사용 | **확인 2026-10-10.** 공개 화면만 Next.js 15 + React 19 + TypeScript + Tailwind 4 (`frontend/`). FastAPI·PostgreSQL은 README와 `.env.example`의 예정 구조이고, `backend/`·`database/`에는 앱 코드·ORM·마이그레이션이 없다. |
| D-02 | 기존 Insight 구조/발행상태 필드? | 확장 | **확인.** 글은 `frontend/src/lib/insights.ts`의 정적 시안이다. `kind`는 `case` 또는 `trend`. 발행 상태·승인·예약 필드는 없다. 공개 API도 없다. |
| D-03 | 확정 Keyword Master ID/alias/계층? | 기존 재사용 | **미확인.** `Keyword Master 결정안` 파일은 저장소에 없다. `CASE_TOPICS`의 `AM-01`~`AM-08`은 목록 필터 라벨이지 확정 마스터가 아니다. |
| D-04 | 전문가 검색 필터 파라미터? | Master ID | **확인.** `/experts`는 `q`, `skill`, `task`, `domain`, `available=1`을 쓴다. `skill`은 검색어로 취급되며 Master ID가 아니다. 상세 CTA는 `/experts?skill=` + 기술 이름이다. |
| D-05 | 관리자/검토자 역할/권한? | 서버 RBAC | **미확인.** `/login`, `/signup`은 안내 문구만 있다. `/admin`과 서버 권한 검사가 없다. |
| D-06 | 실제 배포/스케줄 환경? | 현행 + scheduler | **미확인.** 스케줄러·GitHub Actions 워크플로·배포 설정이 없다. |
| D-07 | AI 제공사/모델·예산 상한? | 기존 provider 우선 | **미확인.** `ai/`는 실험 경계 문서만 있고 모델 호출 코드가 없다. |
| D-08 | 공개 카테고리 명칭('AI 협업 사례')? | 실증/시나리오 구분 | **확인.** 화면 이름은 `AI 연구 협업 사례`, 경로 `/cases`, 데이터 `kind: "case"`. 실증/시나리오 구분 필드는 없다. |
| D-09 | 승인 뒤 게시 즉시/예약 기본값? | 예약 시각 없으면 즉시 | **미확인.** 승인·예약 상태가 없다. |
| D-10 | 이미지 정책/라이선스 기록? | 허가 이미지 또는 무이미지 | **확인(현재 시안).** 표지는 `CoverArt` 주제 사진이고, 캡션에 원본 연구 그림이 아니라고 적는다. 라이선스 필드는 없다. |
| D-11 | 기존 디자인 시스템·Figma 수정 권한? | 기존 컴포넌트 재사용 | **확인.** 토큰은 `frontend/src/app/globals.css`의 Proposed 값. 공개 상세는 `article-view.tsx`를 재사용한다. Figma 원본 파일은 저장소에 없다. |
| D-12 | 데이터 보존·삭제 요청 및 소스 이용 약관? | 최소 수집·기간 제한 | **미확인.** |

## Phase 0 인벤토리 (2026-10-10)

코드는 변경하지 않았다. 아래는 이 저장소에서 확인한 사실이다.

| 항목 | 확인 결과 | 재사용 |
|---|---|---|
| 공개 라우트 | `/`, `/cases`, `/cases/[slug]`, `/trends`, `/trends/[slug]`, `/experts`, `/experts/[slug]`, `/search`, `/login`, `/signup` | 사례 목록·상세는 유지 |
| 글 데이터 | `frontend/src/lib/insights.ts` 정적 배열. 발행 상태 없음 | 공개 화면의 읽기 모델로만 재사용 |
| 전문가 검색 | `frontend/src/lib/experts.ts`, 쿼리 `q`/`skill`/`task`/`domain`/`available` | CTA 경로는 유지. Master ID는 아직 연결하지 않음 |
| API | `frontend/src/app`에 route handler 없음 | 없음 |
| DB | `database/README.md`만 있음. 마이그레이션 0건 | 없음. Phase 1은 신규 스키마 |
| 인증 | 로그인 페이지는 자리 표시 | 없음 |
| 디자인 | `globals.css` 토큰, `article-view.tsx`, `insight-browser.tsx` | 공개 상세 레이아웃 재사용 |
| Keyword Master | 결정안 파일 없음 | 확정 금지 |
| 원문 fixture | CASE-001~021 PDF는 이 저장소에 없음 | Phase 2 전에 원본 필요 |

### 승인 전에 넘기면 안 되는 충돌

1. `docs/product/MVP_SCOPE.md`와 `docs/product/03_DECISION_LOG.md` D-05는 운영형 인사이트와 AI 블로그 자동 작성을 MVP에서 제외한다. 이 자동화 문서는 그 결정보다 뒤에 왔지만, 범위 문서와 결정 로그를 고치기 전에는 수집·게시 코드를 넣지 않는다.
2. 승인 전 비공개 후보를 막으려면 서버와 데이터베이스가 필요한데, 둘 다 아직 없다. 정적 `insights.ts`에 후보를 넣으면 곧바로 공개 목록에 보인다.
3. Keyword Master 결정안이 없어 기술 ID를 새로 확정할 수 없다.

Phase 1은 위 세 가지를 팀에서 확인한 뒤에만 시작한다.

## 자료집에 관한 중요 해석

PDF 표지에서 A/B는 CASE-017~021 추가되고 C~F는 아직 CASE-001~016에 기반한다고 명시한다. 따라서 PDF의 E절 '초기 가입 스택'을 최신·완결·승인된 Keyword Master로 사용하지 않는다. 실제 마스터 확정본이 없는 경우 연결될 수 없는 신규 기술은 pending 상태로 유지한다.

G절 대학 연구실 규모 예시 CASE-LAB-01~05의 예상 데이터 규모, 장비, 시간, 협업 역할은 **시나리오 가정**이므로 실제 성과라고 쓰지 않는다. 동 절 국내 사례 15건은 DOI와 초록 수준의 확인이므로 원문 Methods 기술 키워드 확인 전 플랫폼에 자동 확정하지 않는다.

## 개발 후 변경 관리

스키마/프롬프트/키워드 맵핑 정책을 바꿀 때 문서 버전, migration 버전, fixture 변경, 승인 게이트, 데이터 보정/롤백 계획, 검증 테스트를 동시에 갱신한다. 저장소에 코드와 문서를 동일 PR 단위로 남긴다.
