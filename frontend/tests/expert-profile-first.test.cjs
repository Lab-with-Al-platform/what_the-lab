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

test("목록 CTA는 프로필 상세 하나만 사용한다", () => {
  const source = read("expert-search.tsx");
  assert.match(source, /프로필 자세히 보기/);
  assert.doesNotMatch(source, /CollabRequestDialog/);
  assert.doesNotMatch(source, /onRequest=|onRequest:|setRequesting/);
  assert.match(source, /href=\{detailUrl\}/);
});
test("B안 다크 히어로는 신뢰 점수나 추천 실적을 꾸며내지 않는다", () => {
  const source = read("expert-search-hero.tsx");
  assert.match(source, /bg-navy/);
  assert.match(source, /<svg/);
  assert.doesNotMatch(source, /Lv\.5|평점 5|검증된 전문가 2/);
});
test("상세 프로필은 기존 요청 대화상자를 유지한다", () => {
  const source = read("expert-profile-view.tsx");
  assert.match(source, /<CollabRequestDialog/);
  assert.match(source, /onClick=\{\(\) => setRequesting\(true\)\}/);
  assert.match(source, /safeExpertBackHref/);
});
test("검색 조건과 더보기 페이지를 돌아가기 링크로 보존한다", () => {
  const href = nav.expertListHref({query:"RAG",works:["UG04"],fields:["F01"],shown:23,focus:42,researchId:9});
  assert.equal(href, "/experts?q=RAG&works=UG04&fields=F01&shown=24&focus=42&research=9");
  assert.equal(nav.safeExpertBackHref(href), href);
  assert.equal(nav.restoredExpertCount("999"), 60);
  assert.equal(nav.restoredExpertCount("-1"), 6);
});
test("외부 이동과 임의 경로는 목록 복귀 주소가 될 수 없다", () => {
  assert.equal(nav.safeExpertBackHref("https://evil.example/experts"), "/experts");
  assert.equal(nav.safeExpertBackHref("//evil.example"), "/experts");
  assert.equal(nav.safeExpertBackHref("/admin"), "/experts");
  assert.equal(nav.safeExpertBackHref("/experts?works=invalid&fields=other"), "/experts");
});
test("모바일 상세 요청 CTA와 검색 결과 복원 계약을 유지한다", () => {
  const source = read("expert-profile-view.tsx");
  assert.match(source, /lg:hidden/);
  assert.match(source, /협업 요청/);
  const list = read("expert-search.tsx");
  assert.match(list, /restoredExpertCount/);
  assert.match(list, /scrollIntoView/);
  assert.match(list, /searchGeneration\.current/);
});
