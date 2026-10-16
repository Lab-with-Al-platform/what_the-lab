# 문서 폴더 정리 기록

- 정리일: 2026-10-16
- 대상: `what_the_lab/docs/`의 루트에 흩어진 문서 17개
- 목적: 제품 기준·개발 협업·디자인·기획·조사·기능별 명세·QA·이력을 용도별로 탐색
- 처리: 파일명 유지, 원문 내용 보존, 실제 파일 이동 및 참조 경로 갱신, 폴더 안내 추가

아래의 이전 경로는 이동 이력입니다. 현재 작업 시에는 새 경로를 사용합니다.

| 이전 경로 | 새 경로 |
|---|---|
| `docs/01_PRODUCT_STORY.pdf` | [docs/product/01_PRODUCT_STORY.pdf](../product/01_PRODUCT_STORY.pdf) |
| `docs/02_SCREEN_GUIDE.md` | [docs/product/02_SCREEN_GUIDE.md](../product/02_SCREEN_GUIDE.md) |
| `docs/03_DECISION_LOG.md` | [docs/product/03_DECISION_LOG.md](../product/03_DECISION_LOG.md) |
| `docs/MVP_SCOPE.md` | [docs/product/MVP_SCOPE.md](../product/MVP_SCOPE.md) |
| `docs/CODING_STYLE.md` | [docs/development/CODING_STYLE.md](../development/CODING_STYLE.md) |
| `docs/TEAM_WORKFLOW.md` | [docs/development/TEAM_WORKFLOW.md](../development/TEAM_WORKFLOW.md) |
| `docs/STYLE_GUIDE.md` | [docs/design/STYLE_GUIDE.md](../design/STYLE_GUIDE.md) |
| `docs/SCREEN_DESIGN_SPECS.md` | [docs/design/SCREEN_DESIGN_SPECS.md](../design/SCREEN_DESIGN_SPECS.md) |
| `docs/DESIGN_QA_CHECKLIST.md` | [docs/design/DESIGN_QA_CHECKLIST.md](../design/DESIGN_QA_CHECKLIST.md) |
| `docs/CURSOR_UI_REVISION_GUIDE.md` | [docs/design/CURSOR_UI_REVISION_GUIDE.md](../design/CURSOR_UI_REVISION_GUIDE.md) |
| `docs/DOC_AUDIT_REPORT.md` | [docs/design/DOC_AUDIT_REPORT.md](../design/DOC_AUDIT_REPORT.md) |
| `docs/STYLE_GUIDE_ADDENDUM.md` | [docs/archive/design/STYLE_GUIDE_ADDENDUM.md](design/STYLE_GUIDE_ADDENDUM.md) |
| `docs/ADDENDUM_MERGE_MAP.md` | [docs/archive/design/ADDENDUM_MERGE_MAP.md](design/ADDENDUM_MERGE_MAP.md) |
| `docs/research_ai_collaboration_screen_handoff.md` | [docs/planning/research_ai_collaboration_screen_handoff.md](../planning/research_ai_collaboration_screen_handoff.md) |
| `docs/research_ai_collaboration_MVP_roadmap.pdf` | [docs/planning/research_ai_collaboration_MVP_roadmap.pdf](../planning/research_ai_collaboration_MVP_roadmap.pdf) |
| `docs/user_persona_scenarios.md` | [docs/planning/user_persona_scenarios.md](../planning/user_persona_scenarios.md) |
| `docs/research_platform_market_analysis.md` | [docs/research/research_platform_market_analysis.md](../research/research_platform_market_analysis.md) |

## 함께 갱신한 참조

저장소의 `AGENTS.md`, 루트 README, PR 템플릿과 Markdown 문서의 기존 파일 참조를 새 경로로 맞췄습니다. 분류체계 v4 README에서도 제품 범위 문서의 참조 위치만 갱신했습니다.

`ai-case-automation/`, `qa/`의 기존 폴더와 자료는 이동하지 않았습니다. PDF·이미지 내용은 수정하지 않았으며, 이 정리는 제품 기능·기술 스택·정책 승인 상태를 변경하지 않습니다.

다른 도구나 개인 메모가 이전 경로를 직접 사용한다면 이 표를 보고 갱신합니다. 파일 복사본이나 링크용 중복 문서를 이전 위치에 남기지 않았습니다.

## 정리 후 확인

- 기존 `docs/` 자료 94개가 모두 새 위치 또는 기존 위치에 존재합니다.
- PDF·이미지·측정 JSON 등 비-Markdown 자료 59개는 이동 전후 SHA-256 해시가 동일합니다.
- 기존 자료 중 82개는 바이트 단위로 동일합니다. 나머지는 참조 경로 또는 전체 문서 안내를 갱신한 Markdown입니다.
- 저장소 Markdown의 로컬 파일·폴더 링크 124개를 확인했으며, 새로 끊어진 링크는 없습니다. 외부 웹 링크와 과거 `file://` 경로의 접속 여부는 확인 범위에 포함하지 않았습니다.
- 이동표를 제외한 현재 Markdown·작업 지침에서 이동 전 `docs/` 루트 경로가 남아 있지 않은지 검색했습니다.
- `git diff --check`를 통과했습니다. 기능 코드·DB·배포 설정은 변경하지 않았고, 앱 빌드는 수행하지 않았습니다.

[전체 문서 안내](../README.md)
