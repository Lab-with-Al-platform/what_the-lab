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

test("추천 카드 높이가 사진 배경·플라스크로 늘어나지 않고 일반 카드 CTA가 자연스럽게 이어진다", () => {
  const list = read("expert-search.tsx");
  const featured = list.slice(list.indexOf("function FeaturedExpert({"), list.indexOf("function ExpertCard({"));
  const regular = list.slice(list.indexOf("function ExpertCard({"));
  assert.match(featured, /grid-cols-\[92px_minmax\(0,1fr\)\]/, "추천 카드는 높이가 콘텐츠에 맞는 grid");
  assert.match(featured, /lg:grid-cols-\[104px_minmax\(0,1fr\)_228px\]/, "데스크톱은 안정적인 세 칼럼");
  assert.match(list, /featured \? "size-\[92px\].*sm:size-\[104px\]"/, "추천 프로필 사진은 92~104px");
  assert.doesNotMatch(featured, /items-stretch|h-\[400px\]|min-h-\[400px\]/);
  assert.match(featured, /<LabTrustIndicator snapshot=\{reputation\} variant="compact"/);
  assert.match(featured, /id=\{"expert-profile-" \+ expert\.user_id\}/);
  assert.match(regular, /mt-auto border-t border-\[#e9eef7\] pt-3/);
  assert.match(regular, /ml-auto inline-flex min-h-9 items-center gap-2/);
  assert.doesNotMatch(regular, /pt-2 text-\[12px\] font-semibold text-\[#263f79\]/);
  assert.match(regular, /id=\{"expert-profile-" \+ expert\.user_id\}/);
});

test("검색 목록에는 프로필 CTA만 있고 협업 요청은 상세에 있다", () => {
  const list = read("expert-search.tsx");
  const detail = read("expert-profile-view.tsx");
  assert.match(list, /프로필 보기/);
  assert.doesNotMatch(list, /CollabRequestDialog|onRequest=|setRequesting/);
  assert.match(detail, /<CollabRequestDialog/);
  assert.match(detail, /onClick=\{openCollaboration\}/);
  assert.match(detail, /if \(demoReviews\) setDemoRequestInfo\(true\)/);
  assert.match(detail, /else setRequesting\(true\)/);
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

test("수행 기술에도 전체 보기를 제공하고, 전체 선택은 기존 필터 해제로 동작한다", () => {
  const list = read("expert-search.tsx");
  assert.match(list, /수행 기술 필터/);
  assert.match(list, /전체 기술/);
  assert.match(list, /모든 수행 기술 보기 \(필터 해제\)/);
  assert.match(list, /checked=\{works\.length === 0\}/);
  assert.match(list, /setWorks\(\[\]\); setApplied\(null\)/);
  assert.match(list, /전체 분야/);
  assert.match(list, /checked=\{fields\.length === 0\}/);
});

test("전문가 상세는 기준 이미지의 3탭과 실제 협업 데이터 기반 도넛 및 요청 CTA를 갖는다", () => {
  const detail = read("expert-profile-view.tsx");
  assert.match(detail, /type Tab = "work" \| "portfolio" \| "history"/);
  assert.match(detail, /이 서비스에서 한 연구 · 평가/);
  assert.match(detail, /포트폴리오/);
  assert.match(detail, /경력 · 학력 · 자격증/);
  assert.match(detail, /role="tabpanel"/);
  assert.match(detail, /<FieldSummary finished=\{finished\} names=\{names\} \/>/);
  assert.match(detail, /<Conditions profile=\{profile\} \/>/);
  assert.match(detail, /<CollabRequestDialog/);
  assert.match(detail, /lg:sticky/);
  assert.match(detail, /lg:hidden/);
});

test("평점이 없을 때 가상 점수 대신 명확한 미평가 상태를 표시한다", () => {
  const review = read("expert-review-summary.tsx");
  assert.match(review, /아직 공개된 평가가 없어요/);
  assert.match(review, /REVIEW_CRITERIA/);
  assert.match(review, /전문성/);
  assert.match(review, /결과물 품질/);
  assert.doesNotMatch(review, /4\.8|4\.9|5\.0/);
});

test("프로필 공유 시 검색 맥락을 제거하고, 등록되지 않은 신고 경로를 만들지 않는다", () => {
  const detail = read("expert-profile-view.tsx");
  assert.match(detail, /new URL\(`\/experts\/\$\{profile\?\.user_id \?\? expertId\}`, window\.location\.origin\)/);
  assert.match(detail, /href="\/faq#private-post"/);
  assert.doesNotMatch(detail, /\/api\/v1\/experts\/.*\/report/);
});

test("공개 완료 이력은 연구명·상대방 닉네임을 기본적으로 숨긴다", () => {
  const detail = read("expert-profile-view.tsx");
  const backend = fs.readFileSync(path.join(__dirname, "../../backend/app/expert_search_store.py"), "utf8");
  assert.match(detail, /연구 제목과 참여자 정보는 당사자 보호를 위해 공개되지 않습니다/);
  assert.match(backend, /"private": True/);
  assert.match(backend, /c\.status = 'done'/);
  assert.doesNotMatch(backend.split("def load_collaborations(")[1], /u\.nickname AS partner_nickname|r\.title/);
});

test("로컬 시연 데이터는 정확한 4개 데모 계정과 localhost+development에서만 동작한다", () => {
  const fixture = fs.readFileSync(path.join(__dirname, "../src/lib/expert-local-demo.ts"), "utf8");
  for (const name of ["[데모] LLM 전문가", "[데모] 의료 AI 전문가", "[데모] 비전 전문가", "[데모] 데이터 전문가"]) {
    assert.match(fixture, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(fixture, /process\.env\.NODE_ENV !== "development"/);
  assert.match(fixture, /\["localhost", "127\.0\.0\.1"\]/);
  assert.match(fixture, /profile\.affiliation === sample\.affiliation/);
  assert.match(fixture, /collaborations: ExpertCollaboration\[\]/);
  assert.match(fixture, /private: true/);
});

test("데모 평가·연구·이력은 UI에서 명확히 구분하고 실제 요청은 전송하지 않는다", () => {
  const detail = read("expert-profile-view.tsx");
  const reviews = read("expert-review-summary.tsx");
  const fixture = fs.readFileSync(path.join(__dirname, "../src/lib/expert-local-demo.ts"), "utf8");
  assert.match(detail, /LOCAL DEMO/);
  assert.match(detail, /getLocalExpertDemo\(liveProfile\)/);
  assert.match(detail, /setDemoReviews\(sample\?\.reviews \?\? null\)/);
  assert.match(detail, /requesting && !demoReviews/);
  assert.match(detail, /화면 검수용 가상 전문가/);
  assert.match(reviews, /DEMO · 가상 평가/);
  assert.match(reviews, /demo\.scores\.map/);
  assert.match(reviews, /demo\.entries\.map/);
  assert.match(fixture, /portfolioTitles/);
  assert.match(fixture, /educations: Education\[\]/);
  assert.match(fixture, /certificates: Certificate\[\]/);
});
