# 08. 테스트·운영·배포·인수인계

## 테스트 전략

| 계층 | 시나리오 | 통과 기준 |
|---|---|---|
| unit | DOI normalize, keyword aliases, schema, score bounds | 결정적 결과 |
| component | provider 429/500, LLM malformed, schema mismatch | 유한 재시도/안전 보류 |
| integration | provider→DB, candidate→claims→keywords | FK/unique 유지 |
| security | RBAC, CSRF/session, stored XSS, SSRF, prompt injection | 무권한/임의 실행 금지 |
| workflow | 편집 revision, 검토→승인→예약→게시 | 승인 스냅샷 일치 |
| concurrency | 2 worker race, approve double click | insight exactly once |
| migration | 21건 fixture import 2회 | 후보 수/코드 변동 없음 |
| E2E | 사례 페이지의 검색 키워드 CTA | 기존 expert search 필터 정확 |
| visual | 랜딩/인사이트 카드·상세 회귀 | 기존 확정 디자인 유지 |
| ops | 장애 후 재시작/원문 접근 불가/예산 소진 | 로그·대기·재시도 정상 |

## 검증용 fixture 묶음

1. 확실한 논문/메서드 근거 사례(CASE-001 등, 실제 원문 확인 별도)
2. 초록만 접근 가능한 후보 (Methods 'verified' 절대 금지)
3. DOI 없음/제목 유사/프리프린트+정식 판본
4. AI 기술을 사용하지 않은 순수 도메인 연구
5. AI 방법론만 평가한 벤치마크 논문
6. 프롬프트 인젝션 형태의 본문 텍스트
7. `scenario` CASE-LAB-01 (실제 연구로 게시 금지)
8. Crossref 정보 불일치 / 저작권 미상
9. 기존 Keyword Master 불일치(후보만 남음)

## 로깅/메트릭

`collection_run_total`, `source_fetch_errors_by_provider`, `candidate_discovered`, `candidate_deduped`, `analysis_success/failure`, `avg_llm_tokens`, `estimated_cost`, `evidence_gate_fail`, `keywords_unmapped`, `review_pending_age`, `approval_count`, `publish_success/failure`, `publish_retry`, `public_unapproved_attempts`.

로그 필드: run_id, candidate_id, source_id, job_stage, model_version, prompt_version, schema_version, status, duration, error_code, request_id. API key/full text/민감정보/비공개 초안 전체 로그 금지. 경보는 수집 연속 실패, 관리자 승인 대기 급증, 게시 실패/중복 제약 충돌, 비용 상한 도달, API 인증 실패.

## 보안·신뢰성

- secret은 GitHub Actions/배포 플랫폼 secret vault; repository commit 금지. 환경별 키 분리/교체.
- 스케줄 워커에 관리자 세션 대신 제한된 machine credential 사용; 이 credential은 **승인된 후보 게시만** 허용.
- 외부 URL fetch는 SSRF, redirects, file://, 로컬/사설 IP 범위 차단.
- 확정 전 미검증 텍스트에는 보이지 않는 prompt injection도 포함될 수 있어 code/SQL/browser action 허용 금지.
- 비공개 논문 원문은 저장/재배포 여부·사용권한 확인하고 저장 최소화.
- DB 마이그레이션 전 백업, 복원 훈련, 롤백 가이드 유지.
- LLM 모델 업데이트 시 prompt+model version 기록, 샘플 회귀평가 후 적용.

## 비용 및 스케줄

- 운영 시작 권장값(**설계 가정**) 매일 03:00 KST 후보 수집; 예산 상한 내 분석 10~20건/일, 관리자 검토 주 1~2회, 게시 2~3건/주. 실제 공급량/비용 관측 후 조정.
- AI 호출 전 DOI/dedupe/metadata eligibility 검사를 수행해 비용 절약.
- API/LLM 월간 비용의 경계값은 운영자가 `.env`/관리자 설정으로 관리; 하드코딩 금지.
- reserve budget, retries, run overlap lock, maintenance switch `RESEARCH_COLLECTION_ENABLED=false` / `RESEARCH_PUBLISH_ENABLED=false`.

## Staging 론칭 체크리스트

- [ ] 실제 Master 결정안과 기존 DB/라우트/디자인 매핑 완료
- [ ] 기존 대표 CASE-001~021 import dry run 및 원문 검증 상태 확인
- [ ] 시나리오/국내 참고 사례 분리 검증
- [ ] 수집 실패/중복/재개 테스트 통과
- [ ] 근거 없는 Methods와 수치 검증 통과 표시 없음
- [ ] AI 출력/수정/승인 revision 감사 기록
- [ ] 비관리자 승인 API 403
- [ ] 미승인 사례 공개 조회 불가
- [ ] 승인 후 동일 사례 발행 1회 보장
- [ ] 공개 상세 디자인/접근성/전문가 CTA 회귀 통과
- [ ] 외부 원문 링크·저작권/출처 표시
- [ ] 스케줄 시간대/수동 중지/알림 동작 확인
- [ ] 실패 복구, 키 교체, DB backup/rollback 연습
- [ ] 운영자 인수인계 문서·담당자·알림 채널 지정

## 운영 플레이북

**수집 실패**: run_id 확인→provider error 401/429/5xx 확인→키/쿼터/네트워크 문제 해결→watermark 유지한 채 재시도.

**AI 품질 문제**: 후보 pending으로 되돌림, model/prompt/schema 버전 확인, 해당 후보 claim locator 교차 확인, 일괄 게시 중단 여부 결정.

**잘못된 게시**: feature flag로 후속 게시 중지→인사이트 비공개/정정→승인 revision/source 검사→원인별 테스트 추가. DB 행 무조건 삭제 지양.

**중복 게시 의심**: unique constraint/attempt key/worker lock 점검, 공개 1건 보장 후 중복 레코드 정리 계획 수립.

**권리 침해 신고**: 해당 콘텐츠/이미지 즉시 비공개 검토, 라이선스/인용 기록 확보, 관리 책임자 처리, 재게시 전 검토.
