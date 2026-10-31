# B안 전문가 찾기 — 통합 작업 및 QA 인계 (2026-10-31)

## 목적
WHAT THE LAB의 채택 시안 **B. Dark Premium Match**를 실제 `/experts` 검색 화면에 적용한다. 검색 목록에서는 **프로필 자세히 보기**만 제공하고, 협업 요청은 `/experts/[slug]` 상세 화면에서 기존 모달을 통해 진행한다.

## 무엇이 바뀌는가
- 딥 네이비·인디고 히어로와 과하지 않은 삼각 플라스크 SVG를 새로 추가.
- 검색 결과를 3열 작은 카드 대신 시각적 비교가 쉬운 가로형 리스트로 배치.
- 목록 카드의 직접 협업 요청 동작을 없애고 프로필 CTA 하나로 단순화.
- 상세의 기존 협업 요청 모달, 일반/긴급 요청 정책, 연구 등록 흐름은 그대로 유지.
- 상세 프로필에서 검색으로 돌아갈 때 검색어, 기술, 분야, 보이는 결과 수(최대 60), 선택 전문가 위치, 해당 연구를 안전한 내부 링크에 복원.
- Next 15 클라이언트 search params 사용을 위한 상세 페이지 Suspense 경계 추가.
- 테스트 계약을 `frontend/tests/expert-profile-first.test.cjs`에 추가.

## 변경 파일
- `frontend/src/components/expert-search.tsx`
- `frontend/src/components/expert-search-hero.tsx` (신규)
- `frontend/src/components/expert-profile-view.tsx`
- `frontend/src/app/experts/[slug]/page.tsx`
- `frontend/src/lib/expert-search-navigation.ts` (신규)
- `frontend/tests/expert-profile-first.test.cjs` (신규)

## 변경하지 않은 것
- 모든 기존 백엔드 API, 데이터베이스 스키마, 인증/JWT, Discord DM, 연구 등록, 요청 상태 변경 로직.
- 플라스크 신뢰도 Lv.1~5는 **아직 실제 평판 시스템이 없으므로 도입하지 않음**. 상단 플라스크는 순수 장식 SVG.

## 점검한 조건
- 비로그인: 프로필 열람 가능, 요청 클릭 시 로그인 안내.
- 전문가 회원: 요청 불가 안내.
- 연구회원·미등록 연구: 연구 등록 안내.
- 같은 전문가·연구의 반복 요청: 기존 서버/모달 정책 유지.
- 응답 대기/수락/거절/만료/취소: 기존 `/requests` 유지.
- 모바일: 목록 1열, 상세 하단 협업 버튼 유지.
- 검색 결과 0명, API 오류, 더 보기, 프로필 비공개 전환 시 기존 안내 유지.

## 검증 세 차례 — 정확한 범위
1. 정적 UI 계약: 히어로 사용·목록 요청 제거·상세 요청 유지·Suspense·가상 신뢰 지표 배제 **5/5 확인**.
2. API/보안 소스 계약: 기존 API·연구회원 권한·복귀 URL 제한·페이지 복원 상한·연구 ID 숫자 검증 **6/6 확인**.
3. 반응형/연결 소스 계약: 반응형 마크업·모바일 상세 CTA·복원 포커스·테스트 파일·대상 파일 조회 **6/6 확인**.

> 주의: 세 차례 모두 **정적 코드 점검**이며, 실제 `npm test`, TypeScript, ESLint, Next build, 브라우저 E2E, DB/Discord 통합 테스트를 실행했다는 뜻이 아닙니다. 현재 환경에서 GitHub 원격을 로컬 clone할 네트워크 접근이 없어 실 실행 검증이 불가능했습니다. 운영 배포 승인 상태가 아닙니다.

## 팀이 PR에서 실행할 것
```bash
cd frontend
npm ci
npm test
npx tsc --noEmit
npm run lint
npm run build
```

## 수동 QA
- 데스크톱 1440px, 태블릿 768px, 모바일 390px 검수.
- 검색어/기술/분야/내 연구 필터 → 더 보기 → 7번째 이후 전문가 상세 → 검색으로 복귀 확인.
- 로그인 전·연구자·전문가 역할별 상세 요청 확인.
- 일반 요청, 긴급 요청, 기간·중복·거절·만료·완료 화면 확인.
- 다양한 연구 데이터 보유 상태, 닉네임 길이, 빈 태그, 없는 프로필 상태 확인.
- 키보드 탭·ESC 모달·스크린리더·모바일 키보드 동작 점검.
- CI에서 빌드 통과 후 팀원의 실 UI 시각 검수 및 디자인 최종 승인.

## 출시·병합 정책
이 브랜치는 기존 `develop`을 기반으로 필요한 화면 파일만 수정했다. **직접 develop에 쓰지 않으며 팀의 PR 검토·CI·승인 후 병합한다.**


## B안 원본 시안 대비 시각적 충실도 보정 (2026-10-31 추가)
실제 로컬 화면에서 사용자가 시안과 다르다고 확인해, 기존 '해석한 디자인'을 다음과 같이 교정했습니다.
- 메인 제목: `AI 전문가 매칭`으로 원본 시안과 통일
- 검색창: 히어로 하단의 별도 흰색 카드를 폐기하고 다크 히어로 내부의 글래스 검색 바 배치
- 검색 보조: 원본의 기능 안내 3개를 간결한 카드로 표현, 구현하지 않은 추천/평판 기능은 표시하지 않음
- 화이트 결과 패널: 히어로와 연속되는 구조로 변경
- 필터: 실 API에 존재하는 AI 기술·연구 분야·내 연구로 찾기만 표시
- 목록: 컴팩트 가로 행과 유일한 `프로필 자세히 보기` CTA 유지
- 플라스크: 기존 장식 SVG의 입체감과 빛, 웨이브를 개선. 실제 레벨/평점으로 오해할 수 있는 UI는 배제
- 글로벌 `SiteHeader`는 다른 페이지의 브랜드·내비게이션 계약을 위해 변경하지 않음

### '전문가 0명'에서 시연 데이터 넣기 (로컬 Docker 전용)
추가 파일 `docs/qa/expert-search-demo-local.sql`은 선택적으로만 실행하는 가상 전문가 4명 데이터입니다.
공용 Supabase, 실제 사용자 DB, 배포 서버에는 절대 적용하지 않습니다.
프로젝트 루트 PowerShell에서:
```powershell
docker cp .\docs\qa\expert-search-demo-local.sql labbridge-postgres:/tmp/expert-search-demo-local.sql
docker compose exec postgres psql -v ON_ERROR_STOP=1 -U admin -d labbridge -f /tmp/expert-search-demo-local.sql
```
모든 데모 계정은 닉네임에 `[데모]`가 포함됩니다. 실제 전문가가 아니라 UI 테스트용입니다.
전문가 카드, 필터, 상세·복귀 동작은 데모 DB로 확인하고 실제 협업 요청 송신 테스트는 하지 않습니다.
