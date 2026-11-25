const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = p => fs.readFileSync(path.join(__dirname,"../",p),"utf8");

test("통합 협업 홈은 develop의 Google Calendar CTA와 feature의 평가 진입을 모두 유지", () => {
  const home = read("src/components/workspace-home.tsx");
  assert.match(home,/GOOGLE_CALENDAR_HOME/);
  assert.match(home,/google_enabled/);
  assert.match(home,/API_BASE_URL/);
  assert.match(home,/협업 평가하기/);
  assert.match(home,/#review/);
});

test("종료 협업에서만 평가 진입 및 서버 리뷰 라우터가 노출", () => {
  const home = read("src/components/workspace-home.tsx");
  assert.match(home,/collab\.status === "done" \|\| collab\.status === "ended_early"/);
  const detail = read("src/components/workspace-detail-page.tsx");
  assert.match(detail,/CollaborationReviewCard/);
});

test("통합검색과 FAQ는 기존 화면에 계속 연결", () => {
  const header = read("src/components/site-header.tsx");
  const search = read("src/components/unified-search.tsx");
  assert.match(header,/action="\/search" method="get"/);
  assert.match(search,/관련 인사이트/);
  assert.match(search,/관련 전문가 찾기/);
  assert.match(search,/관련 FAQ/);
});
