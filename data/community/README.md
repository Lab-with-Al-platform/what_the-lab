# 게시판의 공개 콘텐츠 링크

`insight-links.json`은 기존 정적 사례·트렌드의 slug·유형·제목·내부 경로만 보관합니다. 사용자 게시글·연구 원자료·비공개 프로필·승인 전 DB 원고가 아닙니다.

갱신: `cd frontend` → `node scripts/export-community-links.cjs`. 원본인 기존 `export-insights.cjs --inventory`를 재사용합니다. 프론트 작성기와 백엔드 입력 검증이 같은 파일을 사용합니다. 제목·주소가 바뀌면 함께 갱신하고 기존 글의 연결이 유지되는지 확인하세요.
