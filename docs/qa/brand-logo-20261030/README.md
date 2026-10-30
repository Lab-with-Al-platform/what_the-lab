# 글래스 브릿지 로고 적용 확인

확인일: 2026-10-30. 원본: `shorts_assets/logo_proposals/crop_logo_v2_01_glass_bridge.png` (Concept 01). 앱에 쓰는 파일은 `frontend/public/brand/labbridge-mark.png`.

## 화면

기존 개발 서버 `npm run dev`로 확인했다. `next build`는 실행하지 않았다.

| 폭 | 확인 |
|---|---|
| 1440 | 헤더 심볼+LabBridge 워드마크, 메뉴와 수직 정렬 |
| 768 | 심볼 유지, 햄버거 메뉴와 겹치지 않음 |
| 390 | 심볼 유지, 검색/메뉴 버튼과 간격 유지 |
| `/cases` | 공통 헤더라 같은 심볼 |
| 홈 링크 | 심볼+이름 클릭 시 홈으로 이동 |

푸터에도 같은 마크를 28px로 넣었다. 헤더·푸터 글자는 단일 아치 워드마크, 홈 제목의 LabBridge는 이중 아치 워드마크다. 원본은 `shorts_assets/logo_proposals/wordmark_refinement_v5/`. 브라우저 탭 아이콘은 모서리 흰 여백을 투명 처리한 `/brand/labbridge-favicon.png`와 `frontend/src/app/icon.png`를 쓴다. 헤더·애플 아이콘은 기존 마크를 유지한다.

## 하지 않은 것

시안 PNG에서 로고를 잘라 확대하지 않았다. 나머지 4개 제안 심볼은 넣지 않았다. `.env`·수집 스위치·기존 서버는 바꾸지 않았다.
