# WHAT THE LAB · 전문가 검색 & 상세 프로필 — 50개 꼬리 검토 질문

기준: 2026-10-31 사용자 제공 전문가 상세 시안 + 채택된 B안 검색 리스트. 프로젝트 전체 기능과 데이터 흐름을 한 번에 확인하기 위한 **구체적인 추적성 매트릭스**입니다. 답변의 구현 내용은 코드 검토 기준이며 **실제 E2E 테스트를 통과했다는 주장이 아닙니다**.

| No. | 질문 | 현재 결정/대응 | 근거 |
|---|---|---|---|
| 01 | 기술 전체 선택은 모든 코드 전송인가? | 아니요. 비선택(필터 없음)으로 처리해 미래 신규 기술도 자동 포함 | `expert-search.tsx` |
| 02 | 일부 기술 선택 후 전체를 누르면? | 선택 기술을 해제하고 전체 공개 전문가를 검색 | `expert-search.tsx` |
| 03 | 기본 화면에서 숨긴 기술을 선택한 후 접으면? | 선택 기술은 visibleWorks에서 계속 노출 | `expert-search.tsx` |
| 04 | 연구 분야 전체와 기술 전체의 의미가 같은가? | 둘 다 각 필터의 제한 없음으로 통일 | `expert-search.tsx` |
| 05 | 여러 기술을 선택하면 AND인가 OR인가? | 기존 서버 정책대로 기술 간 OR, 분야 간 OR 유지 | `expert_search_store.py` |
| 06 | 기술과 분야를 함께 선택하면? | 서로 다른 축은 AND 조건으로 결합 | `expert_search_store.py` |
| 07 | 분야명 검색에 일치값이 없으면? | 필터 사이드바에서 안내 문구 표시 | `expert-search.tsx` |
| 08 | 검색된 전문가가 없으면? | 0명 빈 상태와 조건 초기화 제공 | `expert-search.tsx` |
| 09 | 참여 중 필터는 실제 DB 전체 건수에 적용되나? | 서버 SQL WHERE에서 total·pagination 모두 일치 | `expert_search_store.py` |
| 10 | 진행 중 상태의 출처는? | 요청이 아닌 collaboration.status='ongoing'으로 통일 | `expert_search_store.py` |
| 11 | 종료된 협업을 진행 중으로 잘못 판단하나? | 종료일과 현재 KST 날짜를 비교 | `expert_search_store.py` |
| 12 | 추천 정렬은 외부 AI 추천 점수인가? | 아님. 현재 검색 결과 우선순위만 설명하고 허위 평점 불표시 | `expert-search.tsx` |
| 13 | 최신순은 관심사 우선순위를 무시하나? | 서버 sort=newest가 e.created_at만 사용하도록 분리 | `expert_search_store.py` |
| 14 | 검색 결과가 한 명이면? | 추천 영역에 1명, 하단에 추가 목록 없음 안내 | `expert-search.tsx` |
| 15 | 결과 추가 로딩 시 카드가 중복되지 않나? | 기존 offset API와 검색 세대 토큰 유지 | `expert-search.tsx` |
| 16 | 검색에서 상세로 이동 후 복귀하면? | 쿼리·기술·분야·참여·정렬·결과 개수·포커스 복원 | `expert-search-navigation.ts` |
| 17 | 악의적인 복귀 URL이면? | /experts 내부 경로만 재구성하고 외부 경로 차단 | `expert-search-navigation.ts` |
| 18 | 연구 ID가 URL로 공유될 위험은? | 링크 복사는 from을 제외한 전문가 정규 주소만 사용 | `expert-profile-view.tsx` |
| 19 | 비로그인 사용자가 공개 프로필을 볼 수 있나? | 예. 공개 프로필 읽기는 로그인 불필요 | `routers/experts.py` |
| 20 | 전문가가 프로필을 비공개로 전환하면? | API 404, 화면에 비공개/없음 안내와 목록 복귀 | `routers/experts.py` |
| 21 | 정지한 전문가도 공개되는가? | users.status='active' 조건 필수 | `routers/experts.py` |
| 22 | 잘못된 expertId를 입력하면? | 숫자가 아니면 클라이언트에서 없는 프로필로 처리 | `expert-profile-view.tsx` |
| 23 | 프로필 API가 실패하면? | 오류와 목록 복귀 제공, 요청 CTA 노출하지 않음 | `expert-profile-view.tsx` |
| 24 | 소속·경력·직무에 없는 값은? | 빈 항목은 필터링하고 경력 코드는 기존 라벨 사전 사용 | `my-career.ts` |
| 25 | 연구 분야/수행 기술 이름을 임의 생성하나? | 기존 taxonomy API ID→이름으로만 렌더링 | `expert-search.tsx` |
| 26 | 진행 중 프로젝트 수와 완료 협업 수를 섞나? | 현재 상태와 완료 기록을 서로 다른 DB 근거로 분리 | `expert_search_store.py` |
| 27 | 완료 협업의 단일 출처는? | collaboration.status='done' | `expert_search_store.py` |
| 28 | 요청 상태 started만으로 완료를 주장하나? | 아니요. 요청 완료 판정에 사용하지 않음 | `expert_search_store.py` |
| 29 | 중도 종료를 완료로 계산하나? | 아니요. ended_early/canceled는 미포함 | `expert_search_store.py` |
| 30 | 공개 이력이 내부 연구명/파트너를 유출하나? | 백엔드에서 익명화, 프론트에서도 항상 익명 표시 | `expert-profile-view.tsx` |
| 31 | 실제 연구 분야는 어떻게 확인하나? | 협업 확정 시 저장한 스냅샷의 field_ids를 대분류로 집계 | `expert_search_store.py` |
| 32 | 수행 기술도 현재 연구 변경에 따라 바뀌나? | 협업 시점 스냅샷 able_work_ids 사용 | `expert_search_store.py` |
| 33 | 하나의 연구가 여러 분야일 때? | 분야별 각각 1회 집계, 분야 카운트 합계가 협업 건수보다 클 수 있음 | `countByCategory` |
| 34 | 완료 협업이 50건 초과되면? | 최근 50건만 공개 표시하고 집계 범위를 명시 | `expert-profile-view.tsx` |
| 35 | 협업 이력이 없을 때 화면은? | 그림 대신 공백/안내 상태, 포트폴리오 탭 연결 | `expert-profile-view.tsx` |
| 36 | 평점 4.8을 시안 그대로 보여줘도 되나? | 안 됨. 실제 검증된 평가 저장소가 없어 미평가 상태로 표시 | `expert-review-summary.tsx` |
| 37 | 항목별 전문성/소통/일정 준수/품질의 점수는? | 평가 기능이 생기기 전 모두 대시(—), 실제 별점 미생성 | `expert-review-summary.tsx` |
| 38 | 평가가 없는데 0점으로 오해할 위험은? | '평가 점수 미제공' 문구와 중립색 막대 사용 | `expert-review-summary.tsx` |
| 39 | 평가 기능을 향후 구현하려면? | 완료 협업 FK, 상호 제출, 표본 수, 신고, 공개 기준 합의 필요 | `D-07` |
| 40 | 포트폴리오가 검증된 완료 협업처럼 보이나? | 별도 탭으로 분리하고 직접 등록 정보라고 명시 | `expert-profile-view.tsx` |
| 41 | PDF 보기 버튼을 외부에 제공하나? | 본인만 읽을 수 있는 API이므로 외부에는 보유·비공개만 표시 | `expert_portfolio.py` |
| 42 | 경력·학력·자격증 항목이 없으면? | 기존 UI에서 해당 탭 숨김 | `expert-profile-view.tsx` |
| 43 | 목록에서 협업 요청 버튼이 다시 생길 수 있나? | 계약 테스트로 목록 CTA와 상세 CTA 분리 유지 | `expert-profile-first.test.cjs` |
| 44 | 연구회원이 상세에서 협업 요청하면? | 기존 CollabRequestDialog가 등록 연구·일정·메시지를 입력 | `collab-request-dialog.tsx` |
| 45 | 비로그인/전문가 회원이 요청하면? | 기존 모달의 로그인/역할 안내 후 실제 전송 차단 | `collab-request-dialog.tsx` |
| 46 | 같은 연구로 중복 요청은? | 기존 서버 second_try_block 규칙 유지 | `collab_requests.py` |
| 47 | 긴급 요청은 일반 요청과 같은가? | 아님. 기존 기간·수락 즉시 시작 규칙 유지 | `request_rules.py` |
| 48 | 모바일에서 프로필 협업 CTA 접근이 가능한가? | 모바일 고정 CTA 유지, 콘텐츠 하단 여백 확보 | `expert-profile-view.tsx` |
| 49 | 키보드만으로 탭을 탐색할 수 있나? | Tab+화살표·Home·End 처리, aria tabpanel 관계 추가 | `expert-profile-view.tsx` |
| 50 | 프로젝트 전체 출시를 지금 승인할 수 있나? | 아니요. 타입 검사/백엔드 테스트/실 DB/모바일/보안 E2E/PR 리뷰 필요 | `QA release gate` |

## 배포 판단 및 미구현 범위

- **진행 중 협업**: `collaboration.status='ongoing'`, KST 종료일 기준. 이미 시작한 요청 상태와 구분.
- **완료 협업**: `collaboration.status='done'`만 최근 50건 공개, 합의 스냅샷의 분야·기술 대분류만 노출. 연구 제목·상대 연구자 닉네임은 공개 동의 기능이 없으므로 서버 및 UI 양쪽에서 차단.
- **평가**: 현재 양방향 평가 DB와 권한·공개정책이 없으므로 별점·리뷰를 위조하지 않음. 미평가 상태를 디자인적으로 제공.
- **PDF**: 기존 전문가 본인 전용 PDF API에 외부 접근 권한을 허용하지 않음.
- **협업 요청**: 기존 백엔드·모달 재사용, 프론트/백엔드 양쪽의 권한·중복 제한 유지.

### 로컬 검증 명령(Windows PowerShell)

```powershell
cd frontend
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
cd ..\backend
uv run pytest -q tests/test_expert_public_profile.py tests/test_expert_search_facets.py
```

주의: GitHub PR CI 성공만으로 실제 Docker DB, 로컬 인증·Discord·모바일 UX 검증을 대체할 수 없습니다.
