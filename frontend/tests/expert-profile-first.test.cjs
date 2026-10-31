const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");

function loadNav() {
  const filename = path.join(__dirname, "../src/lib/expert-search-navigation.ts");
  const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { module, exports: module.exports, URL, URLSearchParams, Number, Math });
  return module.exports;
}

const nav = loadNav();
const read = (name) => fs.readFileSync(path.join(__dirname, "../src/components", name), "utf8");

test("사용자가 선택한 2번 시안: 밝은 헤더, 왼쪽 필터, 추천, 3열 전문가 카드", () => {
  const list = read("expert-search.tsx");
  const hero = read("expert-search-hero.tsx");
  assert.match(hero, /AI 전문가 찾기/);
  assert.match(hero, /현재 위치/);
  assert.match(hero, /bg-white/);
  assert.doesNotMatch(hero, /bg-navy|Expert discovery/);
  assert.match(list, /aria-label="전문가 검색 필터"/);
  assert.match(list, /무엇을 맡길까요/);
  assert.match(list, /연구 분야/);
  assert.match(list, /참여 상태/);
  assert.match(list, /내 연구로 찾기/);
  assert.match(list, /추천 전문가/);
  assert.match(list, /sm:grid-cols-2 xl:grid-cols-3/);
  assert.match(list, /expert-filter-sidebar/);
});

test("검색 목록에는 프로필 CTA만 있고 협업 요청은 상세에 있다", () => {
  const list = read("expert-search.tsx");
  const detail = read("expert-profile-view.tsx");
  assert.match(list, /프로필 보기/);
  assert.doesNotMatch(list, /CollabRequestDialog|onRequest=|setRequesting/);
  assert.match(detail, /<CollabRequestDialog/);
  assert.match(detail, /onClick=\{\(\) => setRequesting\(true\)\}/);
  assert.match(detail, /safeExpertBackHref/);
});

test("참여 상태 필터와 정렬은 실제 백엔드 요청과 연결된다", () => {
  const list = read("expert-search.tsx");
  const api = fs.readFileSync(path.join(__dirname, "../../backend/app/routers/experts.py"), "utf8");
  const store = fs.readFileSync(path.join(__dirname, "../../backend/app/expert_search_store.py"), "utf8");
  assert.match(list, /params = new URLSearchParams\(\{ q: query, works: works\.join\(","\), fields: fields\.join\(","\), engagement, sort/);
  assert.match(api, /Literal\["all", "idle", "engaged"\]/);
  assert.match(api, /Literal\["relevance", "newest"\]/);
  assert.match(store, /g\.expert_id IS NULL/);
  assert.match(store, /g\.expert_id IS NOT NULL/);
  assert.match(store, /e\.affiliation, e\.current_job, e\.ai_career/);
});

test("검색 조건·상태·정렬·페이지를 상세에서 돌아온 뒤 복원한다", () => {
  const href = nav.expertListHref({
    query: "RAG", works: ["UG04"], fields: ["F01"],
    shown: 23, focus: 42, researchId: 9, engagement: "idle", sort: "newest",
  });
  assert.equal(href, "/experts?q=RAG&works=UG04&fields=F01&engagement=idle&sort=newest&shown=24&focus=42&research=9");
  assert.equal(nav.safeExpertBackHref(href), href);
  assert.equal(nav.restoredExpertCount("999"), 60);
  assert.equal(nav.restoredExpertCount("-1"), 6);
  assert.equal(nav.restoredExpertCount("foo"), 6);
});

test("조작된 URL·외부 URL·임의 경로는 복귀 링크가 될 수 없다", () => {
  assert.equal(nav.safeExpertBackHref("https://evil.example/experts"), "/experts");
  assert.equal(nav.safeExpertBackHref("//evil.example"), "/experts");
  assert.equal(nav.safeExpertBackHref("/admin"), "/experts");
  assert.equal(nav.safeExpertBackHref("/experts?works=invalid&fields=other"), "/experts");
  assert.equal(nav.safeExpertBackHref("/experts?engagement=unknown&sort=invalid"), "/experts");
});

test("모바일 필터와 기존 상세 협업 CTA 유지", () => {
  const list = read("expert-search.tsx");
  const detail = read("expert-profile-view.tsx");
  assert.match(list, /mobileFiltersOpen/);
  assert.match(list, /aria-expanded=\{mobileFiltersOpen\}/);
  assert.match(list, /scrollIntoView/);
  assert.match(detail, /lg:hidden/);
  assert.match(detail, /협업 요청/);
});

test("근거 없는 인증 배지와 허위 수치를 표시하지 않는다", () => {
  const list = read("expert-search.tsx");
  const hero = read("expert-search-hero.tsx");
  assert.doesNotMatch(list + hero, /Lv\.5|verified expert|인증된 전문가 246명|2,500\+/);
  assert.match(list, /실제 등록 프로필 기준/);
  assert.match(list, /즉시 협업 가능을 보장하지 않습니다/);
});

test("선택식 시연 데이터는 별도 로컬 전용 파일로 둔다", () => {
  const sql = fs.readFileSync(path.join(__dirname, "../../docs/qa/expert-search-demo-local.sql"), "utf8");
  assert.match(sql, /whatlab-ui-demo-01/);
  assert.match(sql, /ON CONFLICT/);
  assert.match(sql, /BEGIN;/);
  assert.match(sql, /COMMIT;/);
});
