# 메인 탐색 카드 개선 및 분류체계 연결 상태 확인

확인일: 2026-10-16. 현재 로컬 브랜치: `feature/insight-foundation`.

## 1. 요청과 변경 범위

로그인·관리자 개발은 사용자가 팀원과 논의하기로 하여 중단했다. 이번 변경은 메인 화면의 세 탐색 카드만 대상으로 한다.

- 원형 화살표 버튼 제거.
- 카드 본문·배경 이미지·빈 여백을 눌러 사례/트렌드/전문가 목록으로 이동.
- 기존 키워드 칩은 해당 목록의 필터 링크로 유지.
- 마우스 호버: 카드 4px 상승, 배경 이미지 1.025배 확대, 약한 그림자 강조, 250ms 전환.
- 커서 이탈 시 원위치 복원.
- 키보드 포커스 테두리·Enter 이동 지원.
- 터치 중심 입력과 동작 줄이기 설정에서는 이동·확대가 적용되지 않도록 CSS 조건 설정.

수정한 실행 파일은 `frontend/src/components/home-page.tsx`, `frontend/src/app/globals.css` 두 개다. 회원·인증·관리자 코드와 taxonomy 데이터는 수정하지 않았다. 새 패키지도 추가하지 않았다.

## 2. 핵심 코드와 선택 이유

기존에는 화살표와 키워드 칩만 링크였다. 카드 전체를 하나의 링크로 감싸면 내부 키워드 링크와 중첩되므로 그렇게 하지 않았다.

1. 카드 안에 `absolute inset-0` 링크를 따로 두어 전체 면적을 덮는다. 스크린리더용 이동 설명도 넣는다.
2. 키워드 링크는 그보다 높은 층에 놓아 클릭이 가려지지 않게 한다.
3. 제목의 최소 높이를 유지해 화살표 제거 후에도 설명·키워드의 정렬이 흔들리지 않게 한다.
4. `transform`으로 카드와 이미지를 움직여 주변 카드의 배치 공간은 바꾸지 않는다.
5. 이동량·배율·시간·그림자는 중앙 CSS 변수로 관리한다. 전체 사이트 카드가 아니라 메인 탐색 카드에만 적용한다.

P0 기준 이미지는 `design/AI 연구 플랫폼 랩브리지 랜딩페이지.png`다. 기존 이미지·문구·분류 색·컨테이너 폭은 유지했고, 원형 화살표와 호버만 최신 사용자 요청으로 변경했다. 원본 이미지와 픽셀 단위로 완전히 일치한다는 검증은 아니다.

## 3. 브라우저에서 실제 수행한 검사

| 검사 | 결과 |
|---|---|
| 세 카드 클릭 후 목적지 | `/cases`, `/trends`, `/experts` 모두 통과 |
| 카드별 이미지·본문·위/아래 여백의 클릭 대상 | 3개 카드 × 4지점 = 12지점이 각 카드의 목록 링크 |
| 키워드 칩 클릭 대상 | 12개 모두 개별 링크로 접근 가능 |
| 대표 키워드의 실제 이동 | 생명과학 → cases의 topic, LLM·생성형 AI → trends의 topic, 데이터 분석 → experts의 skill 유지 |
| 링크 중첩 | 0개 |
| 마우스 호버 | 실제 CSS transform에서 Y=-4px, 이미지 scale=1.025 확인 |
| 마우스 이탈 | 세 카드 transform 모두 none으로 복원 |
| 키보드 | Shift+Tab으로 카드 링크 진입, focus-visible·2px 테두리 확인, Enter로 사례 목록 이동 |
| 모바일 폭의 카드 클릭 | 390px에서 전문가 카드 클릭 → `/experts` 통과 |

Next.js 페이지 이동은 비동기이므로 클릭 직후 주소를 즉시 읽지 않고 목적지 URL에 도달한 뒤 검사했다.

### 반응형 캡처와 경계 검사

| viewport | 배치·측정 | 가로 넘침 |
|---|---|---|
| 1440×900 | 3열, 동일 높이 약 238px, 전체 링크가 카드 안쪽을 덮음 | 없음 |
| 768×1024 | 1열, 동일 높이 약 238px | 없음 |
| 390×844 | 1열, 칩 줄바꿈, 동일 높이 약 278px | 없음 |
| 2880×1200 | 공통 최대 폭 안에 3열, 동일 높이 약 238px | 없음 |

스크롤바를 제외한 document 폭과 scrollWidth가 일치하는지 확인했다. 768/390px 검사는 화면 폭 변경 검사이며 실제 터치 기기 검사를 대신하지 않는다. `prefers-reduced-motion`·hover/pointer 조건은 코드에서 확인했지만 OS의 동작 줄이기 설정을 실제 변경하는 검사는 수행하지 않았다.

- [PC 전체 화면](home-1440.jpg)
- [PC 카드 영역](cards-desktop.jpg)
- [호버 상태](home-hover-1440.jpg)
- [키보드 포커스](home-focus-1440.jpg)
- [태블릿](home-768.jpg)
- [모바일](home-390.jpg)
- [넓은 화면](home-2880.jpg)

## 4. 정적 검사

- `npx tsc --noEmit`: 통과.
- `npx eslint src/components/home-page.tsx`: 통과.
- `git diff --check`: 통과.
- 프로덕션 빌드: 통과(52/52 페이지 생성). 실행 중인 개발 서버의 `.next`를 덮어쓰지 않도록 비밀 파일을 제외한 임시 복사본에서 검사했다. 기존 `article-view.tsx:235`, `cover-art.tsx:50`의 `<img>` 최적화 권고 2건만 남았으며 이번 변경의 오류는 없다.

## 5. taxonomy가 실제 서비스에 반영됐는가?

**현재 로컬 코드 기준: 분류표와 실습 패키지는 존재하지만, 실제 전문가 화면·검색에는 아직 연결되지 않았다.** 다른 팀원의 미병합 브랜치나 PR까지 확인한 결과는 아니다.

| 부분 | 확인 결과 |
|---|---|
| `taxonomy/v4.0/` | CAP 80개, FIELD 83개, 검색어 632개, UG 11개. 구조 검사 통과 |
| v4 운영 승인 | Release Candidate, CAP/FIELD는 pending_review. 구조 통과를 운영 승인으로 해석하면 안 됨 |
| `taxonomy/WHAT_THE_LAB_C_Stage4_6_Mock_Expert_Search/` | 별도 frontend 예제와 가상 전문가 20명의 검색 실습 패키지가 있음 |
| 가상 자료 검사 | 20명 ID/slug 중복 없음, CAP 40종·FIELD 36종 참조 유효, 가상 표시·요청 비활성 검사 통과 |
| 실제 `frontend/src/` | taxonomy 또는 CAP/FIELD JSON을 불러오는 코드 없음. 기존 `experts.ts`의 가상 프로필과 문자열 검색 사용 |
| 메인 카드 키워드 | `home-page.tsx`에 직접 정의한 표시명과 query string. taxonomy ID 기반으로 생성한 목록이 아님 |
| 실제 전문가 검색 | `expert-browser.tsx`에서 skill을 문자열 검색어로 받고, `matchesExpertQuery()`가 프로필 문자열에서 부분 일치 검색 |
| 실제 검색 데모 라우트 | 실행 중인 frontend에는 `src/app/expert-search-demo/page.tsx`가 없음. 파일은 taxonomy 내부 예제 경로에만 있음 |
| 인사이트 백엔드 | 이번에 만든 service.py에서 v4 capabilities.json의 기술 ID·승인 상태를 검사하는 부분만 연결됨. 이것은 전체 전문가 검색 연동이 아님 |
| DB 마스터 반영 | 이번 조사에서 원격 taxonomy 테이블·적재 상태를 별도로 조회하지 않음 |

실행한 자료 검사:

```powershell
backend/.venv/Scripts/python.exe taxonomy/v4.0/validate_release.py
backend/.venv/Scripts/python.exe taxonomy/WHAT_THE_LAB_C_Stage4_6_Mock_Expert_Search/taxonomy/mock-experts-v1/tests/test_mock_data.py
```

실습 패키지 README도 기존 `/experts`를 변경하지 않는다고 명시하고, 실제 frontend·taxonomy 경로로 복사·통합하는 절차를 별도로 안내한다. 따라서 팀원 작업이 없다는 뜻이 아니라 **자료/검색 실습 단계와 실제 서비스 통합 단계를 구분**해야 한다.

다음 팀 협의 시 확인할 것: 실제 연동 브랜치/PR 유무, 운영 승인할 카탈로그 버전, CAP/FIELD/UG 입력·검색 계약, 정적 전문가 샘플을 ID와 연결할 담당. 이번 카드 수정에서 분류표를 임의로 승인하거나 통합하지 않았다.

[전체 QA 안내](../README.md)
