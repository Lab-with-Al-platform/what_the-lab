# 선택된 두 번째 B안 전문가 검색 UI 통합 및 QA — 2026-10-31

> **기준 이미지**: 사용자가 2026-10-31 대화에서 다시 첨부한 밝은 흰색 전문가 검색 대시보드. 처음에 만든 다크/플라스크 히어로는 다른 시안이었으므로, 이번 수정에서 제거했습니다.

## 반드시 유지해야 할 사용자 결정
1. **화이트/라이트 전문가 찾기 화면**: 공통 LabBridge 헤더 아래 밝은 페이지 헤더 + 우측 추상 리본 그래픽.
2. 데스크톱 **왼쪽 필터 사이드바**: 수행 기술, 연구 분야 검색·복수 선택, 진행 중인 협업 상태, 내 연구로 찾기.
3. **오른쪽 결과 영역**: 검색창, 적용된 필터 칩, 실제 검색 결과 첫 번째 전문가 강조 카드, 3열 컴팩트 전문가 카드.
4. 목록 카드의 주요 행동은 **프로필 보기 하나**. 협업 요청은 실제 전문가 상세 페이지에서 기존 모달로 진행.
5. 기존 백엔드·인증·협업 요청·알림·공통 내비게이션·요청관리 규칙을 제거하거나 우회하지 않음.

## 이번 수정의 실제 반영 파일
| 경로 | 변경 내용 |
|---|---|
| frontend/src/components/expert-search-hero.tsx | 다크/플라스크를 제거하고 원본 B안처럼 밝은 상단 헤더, breadcrumb, 우측 그래픽으로 교체 |
| frontend/src/components/expert-search.tsx | 왼쪽 사이드바/모바일 필터, 오른쪽 검색창/추천/3열 카드, 프로필 보기 단일 CTA |
| frontend/src/lib/expert-search.ts | 목록용 소속/직업/AI 경력 필드를 선택적 공개 메타로 확장 |
| frontend/src/lib/expert-search-navigation.ts | 검색어/필터/참여 상태/정렬/확장 개수/선택 프로필 복귀 보존 |
| backend/app/routers/experts.py | 검증된 \`engagement\` 및 \`sort\` 쿼리 추가(선택 파라미터; 기존 호출 호환) |
| backend/app/expert_search_store.py | PostgreSQL 필터와 정렬, 실제 소속·직업·AI 경력, 소속 키워드 검색 |
| frontend/tests/expert-profile-first.test.cjs | 원본 B안 레이아웃·상세 CTA·상태필터·복귀 URL 계약 테스트 |
| backend/tests/test_expert_search_facets.py | 실 DB 없이 상태 필터·정렬 SQL 계약 테스트 |
| docs/qa/expert-search-demo-local.sql | 개인 로컬 Docker DB에만 명시적으로 실행하는 가상 전문가 4명 시드 |

## 원본 시안 중 바로 표시할 수 없는 내용과 대체
- 전문가 24명, 각 필터의 12/86명 등 **실제 DB에 없는 결과 수를 화면에 하드코딩하지 않음**. 서버의 \`total\`만 표시.
- 원본 시안의 '인증 마크', '평점', '응답 시간', '상담 가능'은 현재 DB/API의 검증 근거가 없어 **조작된 수치를 표시하지 않음**.
- \`engaged=false\`는 '진행 중인 협업 없음'일 뿐 실제 '협업 가능'이라는 계약은 아니므로 구분.
- 실제 로그인 사용자 맞춤 선호가 있으면 정렬의 우선순위를 활용하고, 첫 번째 검색 결과를 **추천 슬롯**에 표시. 독립적인 AI 추천 엔진이라는 주장 없음.
- 실 사진이 없는 가상 전문가에는 기존 기본 아바타 적용. 실제 공개 프로필 사진은 기존 필드를 사용.
- 전세계 'B안 시연'에만 있던 참여 신청/협업 요청 목록 CTA는 사용자 결정대로 제거.

## 데이터 / 권한 / 안전
- 백엔드 공개 검색 API는 \`user_role='expert'\`와 \`is_public=TRUE\` 및 활성 계정만 조회.
- SQL 파라미터 바인딩을 사용하여 검색어와 필터를 처리.
- 참여 상태 필터와 정렬은 페이지별 클라이언트 필터가 아니라 DB 쿼리에 적용하여 \`total\`과 \`offset\`을 일치시킴.
- 기존 요청 모달, 연구회원 권한 확인, 중복·긴급 요청 정책을 유지.
- 새 DB 스키마·마이그레이션은 없음.
- 로컬 시드 파일은 Docker DB에서만 사용하며 공용 Supabase에는 실행 금지.

## QA: 완료/미완료를 구분
- GitHub 작업 브랜치 코드 반영: 완료.
- 소스 수준 레이아웃·CTA·API 매핑 검토: 확인.
- 프론트엔드/백엔드 단위 테스트 코드: 추가.
- 실제 \`npm.cmd test\`, \`npx.cmd tsc --noEmit\`, \`npm.cmd run build\`, \`uv run pytest\`의 **실행 통과는 아직 확인되지 않음**.
- 1440/768/390px 브라우저 실측 스크린샷, 화면 리더, 실제 회원·연구 데이터 및 협업 요청 E2E는 팀 검증 필요.

### 실행 명령어 (프로젝트 루트 PowerShell)
\`\`\`powershell
cd frontend
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
cd ..
cd backend
uv run pytest -q tests/test_expert_search_facets.py
\`\`\`

### 로컬 Docker 가상 전문가 4명 표시(개발 DB 전용)
\`\`\`powershell
docker cp .\docs\qa\expert-search-demo-local.sql labbridge-postgres:/tmp/expert-search-demo-local.sql
docker compose exec postgres psql -v ON_ERROR_STOP=1 -U admin -d labbridge -f /tmp/expert-search-demo-local.sql
\`\`\`
기존 로컬 DB 볼륨 삭제 금지, Supabase 연결 확인 후 임의 업그레이드 금지.

## 브랜치 / PR
브랜치 \`feature/expert-search-dark-profile-first-20261031\`은 기존 사용자가 이미 클론한 이름이므로 **이름을 바꾸지 않고** 사용합니다. 브랜치명에 'dark'가 남아 있지만 이제 **실제 B안 라이트 대시보드**가 맞습니다. PR #72는 Draft로 유지하고 CI/실브라우저 확인 후 병합합니다.
