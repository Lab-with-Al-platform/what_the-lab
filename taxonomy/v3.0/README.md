# WHAT THE LAB · Taxonomy 3.0.0-rc1

**배포 상태:** Release Candidate / 전문가·법무·제품·접근성 검토 전. `pending_review` 분류는 운영 API에서 제외해야 합니다.

## 무엇을 제공하나요?
- `capabilities.json` — 연구자가 전문가에게 맡길 수 있는 수행 작업
- `research-fields.json` — 학문/연구 맥락, 수행 기술과 별도
- `tools.json` — 프레임워크·언어·도구(전문성 자동 부여 금지)
- `categories.json` — 11개 수행 작업군, 10개 학문 대분류
- `search-aliases.json` — 한국어 표준어+영어/한국어 정확 동의어. 충돌/모호 약어는 `auto_match=no`. **`auto_match=yes`여도 검토 전에는 운영 노출 금지**
- `related-search-terms.json` — 관련어. 전문가 역량 인증/정확 필터에 사용 금지
- `ui-filter-groups.json`, `ui-group-members.json` — UI의 넓은 그룹과 CAP ID 다대다 매핑
- `migration-v2-review.json` — 옛 v2 기술/분야 ID를 새 ID 후보로 안내. 전부 **자동 이관 금지**
- `search-rules.json` — 검색 규칙
- `golden-test-cases.json` — 운영 전 필수 기능 검증 시나리오
- `taxonomy.schema.json` — 기본 JSON 구조(추가로 업무규칙 검증 필요)
- `validate_taxonomy.py` — 표준 라이브러리로 실행 가능한 데이터 검증
- `postgres_schema.sql` — PostgreSQL 초기 설계(실제 권한/마이그레이션 확정 전 초안)

## 첫 구현 순서
1. 서비스 팀에서 작업 분류, 학문 분야, EXACT 검색어를 전수 검토합니다. 특히 다학문 학자 인터뷰로 표현이 자연스러운지 확인합니다.
2. 팀 데이터 관리자가 검수된 항목만 `active`로 승인해 운영 배포 후보를 만듭니다. 원본은 불변 버전으로 보관하세요.
3. DB에 categories → capability/research_field → alias/related → UI 그룹 순으로 적재합니다.
4. 전문가는 실제 확인한 CAP ID 및 FIELD ID를 **직접 선택·수정**하고 프로필에 공개 상태를 설정합니다.
5. 연구자가 UI 그룹을 고르면 연결된 CAP ID의 **OR 검색**을 실행합니다. 기술+분야는 기본 AND입니다.
6. 정확 동의어와 관련어 결과는 서로 구분합니다. `auto_match=no`는 선택형 제안으로 처리합니다.
7. 시연 화면(Mock Data)에 나온 가상 전문가 정보는 실제 운영 데이터와 반드시 격리합니다.
8. 검색 골든셋, 권한, 접근성, 실제 사용성, 성능·보안 테스트를 통과한 뒤 배포합니다.

## 주의 사항
- 이 파일은 표준 분류의 원칙을 참고한 **WHAT THE LAB 자체 분류체계**이며 공식 OECD/UNESCO 분류 인증이 아닙니다.
- Python/React/PyTorch 등은 `tools`에 들어가며, 이를 보유했다는 이유로 자동으로 특정 AI 작업을 수행할 수 있다고 주장하면 안 됩니다.
- `EXACT`는 같은 개념을 가리킬 때만 허용합니다. `RELATED`는 탐색 추천으로만 쓰세요.
- 초기 UI 메뉴는 상위 7개만 기본 노출(`show_default=true`), 나머지 4개는 펼쳐 보기. 이는 테스트 전 가설이며 사용자 연구 후 조정합니다.
- 실제 응답 시간과 서비스 품질은 이 정적 파일만으로 검증되지 않았습니다.

## 실행
```bash
python validate_taxonomy.py
```

## 변경관리
이미 공개된 ID 재사용 금지. 의미가 바뀌면 새 ID를 발행하고 기존 ID는 retired 처리하며 이용 기록은 유지합니다.

## 공식 참조 원칙
- W3C SKOS: https://www.w3.org/TR/skos-reference/
- OECD Frascati Manual: https://www.oecd.org/en/publications/2015/10/frascati-manual-2015_g1g57dcb.html
- UNESCO ISCED-F: https://unesdoc.unesco.org/ark:/48223/pf0000235049
- NNG Progressive Disclosure: https://www.nngroup.com/articles/progressive-disclosure/
- W3C WCAG: https://www.w3.org/TR/WCAG22/
