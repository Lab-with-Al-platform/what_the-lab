# WHAT THE LAB 문서 안내

제품·개발·디자인·인사이트 문서를 용도별로 찾는 시작 페이지입니다. 2026-10-16에 흩어진 문서를 분류했으며, 파일명과 자료 본문은 유지하고 참조 경로를 갱신했습니다.

## 폴더별로 찾기

| 폴더 | 들어 있는 내용 | 읽는 상황 |
|---|---|---|
| [product](product/README.md) | 제품 이야기, MVP 범위, 의사결정, 화면·사용자 흐름 | 무엇을 만드는지 확인 |
| [development](development/README.md) | 코딩 규칙, Git·PR·팀 협업 | 코드를 작성하거나 리뷰 |
| [design](design/README.md) | 시각 스타일, 화면별 구현 명세, 디자인 검수, UI 수정 가이드 | 화면 구현·수정 |
| [ai-case-automation](ai-case-automation/README.md) | 인사이트 자동화 개발 명세, 편집·운영 기준, 근거 PDF | 인사이트 기능 개발·운영 |
| [planning](planning/README.md) | 통합 기획, 화면 인계, 로드맵, 페르소나·시나리오 | 기획 배경과 대안 조사 |
| [research](research/README.md) | 시장·사용자·콘텐츠 조사 MD/PDF | 외부 자료와 조사 근거 확인 |
| [qa](qa/README.md) | 날짜별 검증 기록·측정 결과·스크린샷 | 무엇을 실제로 확인했는지 조회 |
| [archive](archive/README.md) | 병합된 디자인 보강안·병합표·문서 이동 기록 | 과거 제안과 변경 이력 추적 |

## 처음 참여한 팀원의 읽기 순서

1. [MVP 범위](product/MVP_SCOPE.md)와 [의사결정 로그](product/03_DECISION_LOG.md): 기존에 기록된 포함·제외 범위와 결정 근거
2. [화면·사용자 흐름](product/02_SCREEN_GUIDE.md): 화면별 목적·상태·용어
3. [팀 협업 방식](development/TEAM_WORKFLOW.md)과 [코딩 규칙](development/CODING_STYLE.md): 브랜치·PR·학습용 설명
4. 담당 기능 폴더의 안내와 필요한 상세 문서

문서 작성 날짜가 다르고 최신 팀 합의가 아직 반영되지 않은 항목도 있습니다. 폴더 정리가 기능 범위나 운영 준비 완료를 뜻하지는 않습니다. 충돌하면 실제로 기록된 최신 팀 합의를 우선하고, 관련 범위·결정 문서를 같은 변경에서 맞춥니다.

## 인사이트 작업 바로가기

- [편집·정기 게시 운영 기준서](ai-case-automation/INSIGHT_EDITORIAL_OPERATING_STANDARD.md): 근거와 연구자 유용성, 후보·편성·승인·보류
- [통합 Codex 실행 지시서](ai-case-automation/WHAT_THE_LAB_AI_CASE_AND_TREND_AUTOMATION_CODEX_SPEC.md): 실제 저장소 확인부터 연구사례 자동화·AI 트렌드 확장까지
- [분할 개발 명세와 근거 자료](ai-case-automation/README.md): 요구사항·데이터·수집·근거·키워드·API·관리자·테스트

## 디자인 자료 적용 순서

랜딩·연구 사례 상세 LabBridge PNG가 최종 시각 기준입니다. v3 목록·전문가 화면과 구형 시안은 구조·정보 항목을 참고합니다. 실제 이미지 자산은 저장소 루트의 `design/`, 설명 문서는 이 폴더의 `docs/design/`에 있습니다.

## 새 문서를 넣을 때

- 제품 범위·결정은 `product/`, 개발 규칙은 `development/`, 시각 설계는 `design/`에 둡니다.
- 기능별 문서는 인사이트의 `ai-case-automation/`처럼 관련 자료와 함께 묶습니다.
- 기획 제안은 `planning/`, 조사·참고 출처는 `research/`, 실행 증거는 `qa/`에 둡니다.
- 병합된 제안·이력은 `archive/`에 보존하며, 단지 오래됐다는 이유로 현재 기준 문서를 옮기지 않습니다.
- 새 문서를 추가하면 해당 폴더 안내에 링크와 문서 상태를 적습니다.
- 자료를 이동하면 들어오는 링크와 `AGENTS.md` 등 작업 지침의 경로도 갱신합니다.
- 기존 자료를 삭제하거나 구현되지 않은 기능을 완료로 표시하지 않습니다.

예전 경로로 문서를 찾고 있다면 [2026-10-16 문서 이동표](archive/DOCUMENT_REORGANIZATION_2026-10-16.md)를 확인하세요.
