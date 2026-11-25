# 03. 수집·동기화·중복·원문 이용 정책

## 1. 소스 우선순위

- **탐색 1차** OpenAlex: 논문 탐색, 검색어 조합, 출판일/갱신일 필터, DOI·제목 메타데이터.
- **서지 확인** Crossref: DOI, 제목, 연도, 저널·저자 비교. Crossref 일치만으로 내용 정확성 보증 안 됨.
- **선택적 보완** Europe PMC(의학/생명과학), 공식 연구기관 RSS·프로젝트 페이지, DOI가 지시하는 논문/오픈 원문.
- **원문 최종 판단** 원 논문(접근 허가 범위) + 공식 기관/연구팀; 뉴스·블로그는 발굴 보조만.

API 버전·현재 rate limit·인증 요건·라이선스는 구현 시 해당 제공자의 **최신 공식 문서**로 확인하여 설정값으로 기록한다.

## 2. 검색

질의는 `(도메인 문제 용어) AND (AI 기술 용어)`의 분야별 설정으로 운영. 예: microscopy + deep learning, crop yield + machine learning, materials discovery + graph neural network, climate + forecasting model, defect detection + manufacturing. 질의어는 **마스터 키워드가 아님**.

`config`: `source_enabled`, `domain_queries`, `max_candidates_per_run`, `max_per_domain`, `lookback_days`, `request_timeout`, `rate_limit_per_min`, `max_retries`, `cost_budget`, `min_source_fields`.

처음에는 메타데이터를 넓게 수집하고, 저비용 규칙 필터 → DOI/중복 검사 → 최소 근거 확보 → AI 호출 순서. AI 입력에 HTML 악성 명령(프롬프트 인젝션)이 있을 수 있으므로 외부 콘텐츠는 **분석 대상 데이터**로 취급한다.

## 3. 동기화 알고리즘

```
lock_run()
last_success_watermark = read_last_success()
window_start = last_success_watermark - overlap_days
page_cursor = None
while has_next and under_budget:
    batch = provider.search(window_start, now, page_cursor)
    for record in batch:
        normalize identifiers and bibliographic metadata
        upsert source by normalized DOI/provider ID
        if duplicate candidate: link occurrence and skip new candidate
        else: insert candidate(status='collected')
        record pipeline item outcome
    page_cursor = batch.next_cursor
commit checkpoint after durable page
mark run_success only if complete; on partial record cursor, error
release lock()
```

**중요:** 최초 수집 시에는 backfill 기간을 수동 지정. 정기 검색 날짜 필드는 일부 API에서 출판일과 색인 갱신일이 다르므로 overlap을 둔다. 실패 run의 실패 구간을 다음 실행에서 보완한다.

## 4. ID 및 중복

DOI 정규화: URL prefix 제거, lowercase, trim, 유니코드/URL decoding 주의. DOI 없음 → provider native id. 제목·연도 유사도는 `possible_duplicate` 플래그만 부여. 같은 논문의 프리프린트/정식 출판 버전은 provenance를 유지하며 사람 검토 없이 병합하지 않는다.

## 5. 비정상 처리

| 상황 | 처리 | 다음 작업 |
|---|---|---|
| 429 / 5xx | Retry-After 준수 + exponential backoff + jitter | 상한 초과시 실패 기록 |
| 401 / 403 | 자격증명/권한 문제 | 즉시 경고, 반복 호출 중단 |
| 잘못된 DOI | 무리한 자동 보정 금지 | `needs_bibliography_review` |
| 타임아웃 | 유한 재시도 | run_item 오류 코드 보존 |
| 원문 비공개 | 메타데이터만 저장 | `metadata_only`, Methods 검증 보류 |
| 중복 제목·다른 DOI | 자동 병합 금지 | 관리자 검토 후보 |
| AI 호출 예산 초과 | 남은 후보 queued | 다음 배치로 이월 |

## 6. 원문 권리·보안

- robots.txt 및 각 사이트 약관/라이선스 준수; 접근 우회, CAPTCHA 우회, 쿠키/유료 로그인 수집 금지.
- 공개 API metadata, 허가된 open-access 원문만 자동 처리. 재배포 가능한지와 **분석 가능 여부는 별개**.
- 공개 콘텐츠는 **자체 작성 한국어 요약** + 출처 링크 + 최소 인용. 출판사 그림·도표 자동 스크랩 게시 금지.
- PDF/HTML은 다운로드 크기·MIME·안티바이러스/매크로·HTML sanitize 검증. 링크 호출 시 SSRF 차단(allowlist 또는 public host checks), redirect 검증.
- 보존기간/삭제 요청 정책 및 source TOS 준수; raw content 전체 저장을 기본값으로 두지 않는다.

## 7. 작업 완료 검증

- 동일 OpenAlex DOI 반복 수집 3회→후보 1개.
- API 페이지 2에서 실패→앞 페이지 재수집해도 중복 없고 누락 0.
- 메타데이터만 확보→Methods validated 불가.
- 테스트 환경에서 API 키 없이 fixture 기반으로 정상 수집 단위 테스트 가능.
