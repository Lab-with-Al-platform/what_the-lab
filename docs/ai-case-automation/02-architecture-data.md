# 02. 아키텍처 및 데이터 모델

## 1. 구조

```
Scheduled job (or protected queue producer)
  -> Collector (OpenAlex, optional institutional feeds)
  -> BibliographyVerifier (Crossref) -> Deduplicator
  -> Candidate + Source store
  -> Evidence acquisition (authorized metadata/open content only)
  -> AI CaseSheet extractor -> deterministic schema validation
  -> Claim/evidence validator -> Scorer -> Keyword matcher
  -> Korean content draft -> admin review
  -> approved schedule -> idempotent publisher transaction
  -> existing Insight + verified Keyword Master IDs -> existing expert search
```

플랫폼 레포의 언어·ORM·라우터·비동기 큐 확인 전까지 Python/Next.js/FastAPI를 확정하지 않는다. 수집 코드는 기존 백엔드 모듈 경계 안에 둔다. 별도 microservice는 MVP에서 피한다.

## 2. 관계와 Cardinality

- `source_record` 1:N `case_candidate` (하나의 원문이 사례 하나 이상을 뒷받침할 수 있으나 기본적으로 1개의 primary DOI)
- `case_candidate` 1:N `claim_evidence`
- `case_candidate` N:M `keyword_master` via `case_keyword_link` (검증 키워드)
- `case_candidate` 1:N `case_review_event`, 1:N `case_revision`
- `case_candidate` 0..1 `insight` (게시 후)
- `pipeline_run` 1:N `pipeline_run_item`

## 3. 권장 데이터 사전(기존 테이블과 병합 가능)

### `source_record`

| 필드 | 타입(논리) | 조건 |
|---|---|---|
| id | UUID PK | |
| doi_normalized | varchar nullable | 소문자·doi.org prefix 제거·trim, unique where nonnull |
| source_type | enum | paper, journal, official_institution, official_project, other |
| title, authors, year, venue | text/json/int | nullable 명시 |
| canonical_url | text | HTTPS URL 검증 |
| provider, provider_id | varchar | provider/provider_id unique if not null |
| abstract, abstract_license | text/enum | 허가된 정보만 |
| fulltext_access | enum | open_authorized, metadata_only, restricted, unknown |
| source_checked_at | timestamp | UTC |
| raw_metadata | jsonb | 개인정보/과도한 전문 저장 금지, 최소 보존 |

### `case_candidate`

| 필드 | 타입 | 조건 |
|---|---|---|
| id | UUID PK | 내부 식별자 |
| public_case_code | varchar nullable unique | 게시/등록 시 안정적 부여, 기존 CASE-001~021 보존 |
| primary_source_id | FK | NOT NULL |
| classification | enum | applied_research, verified_collaboration, scenario, domestic_reference |
| research_domain, subdomain | varchar | 기존 분류 매핑 확인 |
| case_sheet | jsonb | schema_version 필수, 아래 참조 |
| score_items | jsonb | 7개 0..2/0..1, 합계는 서버 재계산 |
| score_total | integer | 0..12, 자동 계산/검증 |
| evidence_gate | enum | pass, needs_evidence, fail |
| status | enum | 아래 상태 머신 |
| current_revision_id | FK nullable | 콘텐츠 수정 추적 |
| approved_revision_id | FK nullable | 승인 스냅샷 |
| approved_by, approved_at | FK/timestamp nullable | 승인 시만 |
| scheduled_for, published_at | timestamp nullable | UTC 저장 |
| published_insight_id | FK nullable unique | 게시물 중복 방지 |
| created_at, updated_at, version | timestamp/int | optimistic locking |

### `claim_evidence`

`id`, `candidate_id`, `claim_id`, `claim_type`(technical_method/result_metric/researcher_role/ai_role/data/limitation/collaboration), `claim_text`, `source_id`, `locator`(section/page/paragraph), `quote_short`, `access_level`, `extraction_method`, `verification_status`(verified/needs_review/unsupported), `verified_by`, `verified_at`. 인용구는 짧고 목적에 필요한 범위만 보존.

### `case_keyword_link`

`candidate_id`, `keyword_master_id NULL`, `raw_term`, `normalized_term`, `keyword_level`(researcher_use/ai_domain/expert_tech), `evidence_id NULL`, `match_method`(exact/synonym/manual/proposed), `status`(mapped_verified/candidate/rejected), `reviewed_by`, `created_at`; unique(candidate_id, keyword_master_id, keyword_level) when keyword_master_id nonnull. 후보 term 자체는 전문가 필터에 전달 금지.

### `case_revision` / `case_review_event`

`case_revision`: id, candidate_id, revision_no, content_json, content_html_or_md, source_snapshot_hash, created_by (ai/admin), created_at. 승인 시 변경 불가 스냅샷.

`case_review_event`: id, candidate_id, revision_id, action (request_changes/approve/reject/schedule/cancel/reopen), actor_id, reason, created_at, before_status, after_status. 행 삭제·갱신 금지.

### `pipeline_run`, `pipeline_run_item`, `publication_attempt`

`pipeline_run`: run_id, kind, triggered_by, started_at, ended_at, status, counters(json), cursor_before, cursor_after, error_code.
`pipeline_run_item`: run_id, source_id/candidate_id, stage, outcome, attempt_count, reason, duration_ms.
`publication_attempt`: id, candidate_id, revision_id, idempotency_key(unique), started_at, finished_at, status, error_code, insight_id.

## 4. SQL 제약 예시 — 그대로 적용 전 ORM 확인

```sql
CREATE UNIQUE INDEX uq_source_doi ON source_record (doi_normalized)
WHERE doi_normalized IS NOT NULL;
CREATE UNIQUE INDEX uq_candidate_published_insight
ON case_candidate (published_insight_id)
WHERE published_insight_id IS NOT NULL;
CREATE UNIQUE INDEX uq_publication_idempotency
ON publication_attempt (idempotency_key);
```

별도 DOI 없는 경우 `provider + provider_id` 우선, 다음 정규화 제목/연도/첫 저자로 잠재 중복 후보 표시(사람 검토), **유사 제목만으로 자동 합치기 금지**.

## 5. CaseSheet v1 필수 필드

`case_schema_version`, `research_field`, `subfield`, `institution`, `paper_title`, `publication_year`, `doi`, `original_url`, `project_url`, `research_problem`, `existing_method`, `bottleneck`, `ai_role`, `researcher_role`, `input_data`(types, size_if_proven, labels, openness), `technical_methods[]`(raw_name, research_role, evidence_id, verification_status), `validation_method`, `outcomes[]`(claim,evidence_id), `limitations[]`, `collaboration_evidence`, `researcher_use_keywords[]`, `expert_technical_keywords[]`, `source_confidence_notes`, `score_items`, `assessment_status`.

문자열 미확인 값은 `null`과 reason으로 표현; LLM이 값을 지어내어 required를 채우게 하지 않는다. `score_total`은 백엔드에서만 계산.

## 6. 초기 데이터 반입

1. PDF에서 대표 CASE-001~021만 **실제 사례** import fixture로 준비(메타데이터·기존 코드·연구 문제 등). 자동 approved/published 금지.
2. DOI를 메타데이터와 대조하고 원문/Methods 확인 수준을 새롭게 기록. PDF의 ‘조회 확인’은 DOI 존재 확인이므로 모든 주장 검증 완료와 다르다.
3. CASE-017~021은 자료집 A/B에 포함되지만 C~F는 001~016 기준이므로 *구식 키워드 표를 그대로 매핑하지 않는다*.
4. `CASE-LAB-01~05`: 연구실 규모 **시나리오**로 분리. 결과 예시/인프라/데이터 규모를 실제 실험결과로 표시하지 않는다.
5. G절 국내 15건은 별도 단계에서 `domestic_reference`로 import, 원문 기술근거 확인 전 보류.
6. deterministic fixture mapping을 스냅샷 테스트로 보관; 두 번 실행해도 개수 불변, PK/연결 동일.
7. 프로덕션 롤백은 신규 테이블/기능 플래그부터 비활성화; 원본 인사이트 삭제 금지.

## 7. 데이터 이행과 보안

미리 백업 → migration dry run → 적용 → 대상 레코드 수/인덱스 검사 → 앱 smoke test. DB 서비스 계정은 수집·게시·관리 역할 별 최소 권한. 외부 원문 전문 자동 장기 저장은 사용권한 확인 전 금지. timezone UTC 저장, 한국시간 표시.
