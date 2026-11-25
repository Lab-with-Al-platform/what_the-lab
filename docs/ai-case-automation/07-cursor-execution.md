# 07. Cursor 단계별 구현 지시서 (Phase 0~8)

**경로**: `C:\Users\Peter\Desktop\모꼬지\SKN 36기 부트캠프\토이프로젝트\research-platform`

**공통 규칙 (모든 Phase에 적용)**

- 시작 전에 repo status, README, package manifests, 환경변수 예시, DB 마이그레이션, API 라우트, 인사이트 목록/상세, 전문가 검색, 관리자 인증, Keyword Master, 기존 CSS/디자인 시안을 조사한다.
- 존재하는 모듈/DB/API를 재사용한다. frontend/backend가 다른 구조라면 이 명세를 **현재 레포에 맞게 재매핑**하고 사유를 문서화한다.
- MVP 범위 밖 프로젝트/Task Board/계약/정산/평가 기능 추가 금지.
- 변경 파일 전체 경로, 변경 이유, 테스트 명령/결과, 남은 위험, 다음 Phase 조건을 매 Phase 종료 때 보고한다.
- 기존 UX·디자인 시안 유지, 랜딩/사례 상세 스타일 재사용. 리스트는 레이아웃만 참고하며 디테일 없이 반복 생성 금지.
- 작업자의 임의 선택으로 Keyword Master를 확정·수정하지 않는다. 새 기술은 candidate.
- 예상 밖의 DB 구조/동작 발견 시 중단하고 설계충돌을 보고한다.

## Phase 0 — 실제 저장소 인벤토리 (코드 수정 금지)

**Cursor 지시**: 전체 저장소에서 `insight`, `case`, `keyword`, `expert`, `admin`, `auth`, `migration`, `scheduler`, `figma`, `design`, `v0.5` 등을 조사. 실제 엔트리포인트/테이블/컴포넌트/스타일 토큰과 재사용 여부를 문서화. 첨부 문서 2종의 기준과 비교하고, 'Keyword Master 결정안' 파일 존재 여부 확인. `docs/ai-case-automation/09-decisions-and-traceability.md`의 미결정 표 갱신. **어떤 코드도 변경하지 말 것.**

**산출**: file inventory, DB ERD, API catalog, auth/RBAC map, 기존 인사이트 UI flow, keyword master definition, risk register, Phase 1 파일 계획. **Gate**: 확인 사실/제안/미확인 구분 + 승인받을 충돌사항 명시.

## Phase 1 — DB/도메인 계약

**Cursor 지시**: 02·05 문서의 논리 모델을 현재 ORM/DB에 매핑해 재사용 우선 ERD 확정. 후보/출처/claim/키워드 링크/revision/review_event/run/attempt 최소 테이블만 추가. 고유 인덱스 및 optimistic lock. 비공개 후보가 기존 공개 API에 보이지 않는 query restriction 구현. migration up/down 또는 되돌리기 계획 작성.

**테스트**: unique DOI/출판물 중복, 상태 무결성, 기존 인사이트 회귀, migration dry run/rollback. **Gate**: 기존 데이터 보존 + 테스트 통과.

## Phase 2 — 초기 21개 fixture 및 import

**Cursor 지시**: PDF CASE-001~021을 안정적 소스 fixture로 변환, 논문 DOI/출처 보존, imported status pending evidence; 실제 자동 publish 금지. C~F 001~016만 반영 주석 준수. G절 시나리오는 명시적으로 분리. 국내 15건은 별도 queue. import는 dry-run 및 idempotent 옵션 제공. 재실행에 관계없는 공개 코드 재발급 금지.

**테스트**: dry run count 21, 중복 import count unchanged, DOI와 CASE 코드 매칭, schema required 검증. **Gate**: 21개 기존 코드 유지, 신규 공개 게시 0.

## Phase 3 — Collector 및 메타데이터 검증

**Cursor 지시**: OpenAlex/ Crossref provider adapters, source normalizer, persisted watermark/cursor, overlap, batch max, per-domain cap, retry/backoff, rate-limit, logging, dedupe, API fixture tests. 외부 페이지 무차별 크롤러는 구현하지 않는다. 원문 접근 권한과 분석가능 상태 기록.

**테스트**: 동일 DOI 반복 3회=1개, 429/500/timeout, page mid-failure recovery, restricted full text, missing DOI. **Gate**: 누락/중복 없이 재개.

## Phase 4 — AI 분석/증거 확인

**Cursor 지시**: LLM provider를 기존 서비스 인터페이스에 어댑터 방식으로 연결. 분류→추출→claim evidence→평가→요약을 단계화, JSON Schema 검증, 12점 코드 계산, 비용 상한, 비정상 출력 재시도, source unavailable 처리. 원문/웹페이지 프롬프트 인젝션 무시. 중요 수치/기술 claims에 locator 요구. 관리자 수정본 덮어쓰기 금지.

**테스트**: 원문 누락/초록-only/거짓 모델명/허위 수치/HTML injection/invalid JSON/cost exhausted. **Gate**: 근거 없는 기술 verified 0, 미확인 내용 차단.

## Phase 5 — Keyword Master

**Cursor 지시**: 기존 실제 마스터의 ID·명칭·alias와 조인하여 매핑. `researcher_use → ai_domain → expert_tech` 관계, 근거 case 연결. 없거나 유사도만 높은 term은 candidate로. 기존 전문가 스택 선택값 불변. 새로운 확정 마스터 항목은 사람 승인 후만 생성.

**테스트**: 영어/한글/약어 alias, 미확인 키워드 필터 차단, 후보 키워드만 있는 사례 CTA, 기존 전문가 검색 회귀. **Gate**: 확정 검색 키워드 ID 일치.

## Phase 6 — 관리자 검토 UI/RBAC

**Cursor 지시**: 목록/상세/근거/편집/재분석/승인·반려·예약 UI를 06 문서 기준 구현. 기존 디자인 컴포넌트 우선 재사용, 승인 스냅샷/감사 이력, optimistic conflict UI. 관리자 권한은 백엔드 강제.

**테스트**: admin/editor/reviewer/general 권한 매트릭스, 403, 409 stale, 승인 조건, 모바일/키보드, UI screenshot regression. **Gate**: 사용자가 승인 전에 원문 주장 확인 가능.

## Phase 7 — 게시 워커와 공개 화면 연결

**Cursor 지시**: 승인된 revision만 기존 Insight 모델로 기록, 예약 시간에 worker 처리, transaction + idempotency key + unique constraint. 기존 상세 디자인·네비게이션 유지, 검증된 Master ID만 전문가 검색 CTA로 전달. 중복 실행 및 실패 복구. 외부 URL과 이미지 권리 표시.

**테스트**: 미승인 공개 0, 승인중 revision 변경, 동시 발행 2건 race→1건, 워커 crash 후 retry, scheduled timezone, CTA existing expert search. **Gate**: E2E 승인→정확히 한 개 게시.

## Phase 8 — 운영·배포·인수인계

**Cursor 지시**: 현재 배포 환경에 맞는 scheduled job(GitHub Actions는 옵션) + secret management, health metrics, failure alert, runbook, cost cap, backfill, rollback/feature flag 설정. staging에 샘플 실행, 승인·게시·장애복구 리허설. 실제 운영 전 관리자에게 테스트 결과 보여주기.

**테스트**: smoke/integration/security/load-lite/rollback rehearsals, DB backup restore spot check, API quota. **Gate**: 08 론칭 체크리스트 전체 통과, 수동 pause/disable 가능.

## 단계별 Cursor 답변 포맷

```
Phase: N
확인한 기존 파일/테이블/라우트:
신규·수정 파일 목록:
기존 기능 재사용 근거:
변경 내용 요약:
테스트 명령 및 실제 결과:
보안·데이터·키워드 위험:
미결정/질문:
Gate 통과 여부:
다음 Phase 진입 가능 여부:
```

**작업 시작용 한 문장**: '첨부된 `docs/ai-case-automation` 전체 문서를 읽고 **Phase 0만** 수행하라. 코드 변경 금지. 실제 저장소 기준 차이와 충돌을 먼저 정리하고 내 확인을 받아라.'
