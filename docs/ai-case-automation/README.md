# WHAT THE LAB — AI 연구사례 자동화 구현 문서 패키지

> **편집·운영 기준 추가 (2026-10-16):** [인사이트 편집·정기 게시 운영 기준서](INSIGHT_EDITORIAL_OPERATING_STANDARD.md)를 함께 읽습니다. 연구자에게 주는 도움과 근거를 우선하며, 주 1회는 시범 운영 제안입니다. 아래의 과거 경로·자료 상태는 [통합 실행 지시서](WHAT_THE_LAB_AI_CASE_AND_TREND_AUTOMATION_CODEX_SPEC.md)와 Phase 0 조사 결과로 재확인합니다.

- 문서 버전: 1.0 / 2026-10-09
- 정책: **수집·분석·초안 자동화, 관리자 승인 후 예약/즉시 게시**
- 상태: **구현 지시 가능 설계안**. 실제 저장소 미제공이므로 경로/ORM/프레임워크/테이블명은 조건부이며 코딩 전 Phase 0에서 확인한다.
- 적용 위치: `research-platform/docs/ai-case-automation/`

## 자료 출처 및 사실 구분

1. `WHAT_THE_LAB_AI_RESEARCH_CASE_KEYWORD_GUIDE_v1.md`: 2026-10-06 2차 피드백 이후 축소 MVP; 비-AI 연구사례→활용 이해→키워드→전문가 검색; 12점 척도; Bottom-up 키워드; 후보·검증 분리.
2. `WHAT_THE_LAB_AI연구사례_상세자료집_v2.pdf`: 2026-10-08 기준 대표 CASE-001~021, G절 CASE-LAB-01~05 시나리오 및 국내 사례 15건. **C~F절은 CASE-001~016 기준**이므로 17~21까지 완성된 마스터로 오해 금지.
3. **미제공**: 'Keyword Master 결정안' PDF, 실제 소스 저장소, 최신 ERD/DB 마이그레이션, 최신 화면설계서, Figma 시안. 파일을 요청하거나 저장소에서 찾고, 없으면 설계안을 확정값으로 사용하지 않는다.

## 문서 지도

| 파일 | 내용 |
|---|---|
| 01-product-requirements.md | 범위, 사용자 흐름, 정책, 수용 기준 |
| 02-architecture-data.md | 전체 설계, 관계 모델, 제약, 마이그레이션 |
| 03-collection-ingestion.md | 수집원/동기화/중복/안정성/권리 |
| 04-ai-evidence-keywords.md | 평가, 근거 스키마, AI 프롬프트 계약, Keyword Master |
| 05-api-state-machine.md | 엔드포인트, RBAC, 상태 전이, 게시 트랜잭션 |
| 06-admin-ui-content.md | 상세 UI, 게시 템플릿, 시각적 요구사항 |
| 07-cursor-execution.md | Phase 0~8 각 단계 작업/검증/롤백 지시 |
| 08-test-ops-launch.md | 테스트, 운영, 관측, 비용, 론칭/운영 인수인계 |
| 09-decisions-and-traceability.md | 미결정 사항, 원본 근거 매핑, 소스 데이터 주의 |

## 빠른 진행

1. 자료 2개 및 이 폴더를 로컬 `research-platform/docs/ai-case-automation/`에 배치한다.
2. Cursor에서 `07-cursor-execution.md` **Phase 0 지시문만 먼저 실행**한다. 이 단계에서는 코드를 건드리지 않는다.
3. 기존 Keyword Master 확정본, 실제 라우트, 인증/DB/디자인 토큰을 확인하고 09 문서의 미결정 항목을 채운다.
4. Phase 1~8을 차례로 실행한다. 각 단계 완료 기준과 자동 테스트를 통과하기 전에는 다음 단계로 넘어가지 않는다.
5. 운영 배포 전에 샘플 21건 원 논문 재검증 및 관리자 승인권한 테스트를 완료한다.

**완료 정의:** 신규 논문이 중복 없이 후보로 수집되고, 원문 근거를 가진 검토 초안이 생성되며, 승인 전에는 공개되지 않고, 승인 후 일정에 맞춰 정확히 한 번 게시되며, 검증된 Master ID로 전문가 검색에 연결된다.
