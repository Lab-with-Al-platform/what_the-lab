const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");

function read(relative) {
  return fs.readFileSync(path.join(__dirname, "..", relative), "utf8");
}

function loadGlobalSearch() {
  const filename = path.join(__dirname, "../src/lib/global-search.ts");
  const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { module, exports: module.exports, URLSearchParams });
  return module.exports;
}

const helpers = loadGlobalSearch();

test("검색어는 NFKC 정규화, 공백 정리, API 50자 제한을 지킨다", () => {
  assert.equal(helpers.normalizeGlobalQuery("  ＲＡＧ   의료영상  "), "RAG 의료영상");
  assert.equal(helpers.normalizeGlobalQuery("가".repeat(65)).length, 50);
  assert.equal(helpers.normalizeGlobalQuery("\n \t"), "");
});

test("인사이트 제목 우선, 나머지는 날짜순이며 토큰은 순서와 무관하게 매칭한다", () => {
  const items = [
    { slug: "summary", kind: "case", title: "AI 활용", summary: "RAG 연구 데이터", tags: [], domains: [], field: "공학", topicLabel: "AI", publishedOn: "2026.10.30" },
    { slug: "title", kind: "trend", title: "RAG 데이터 처리", summary: "연구", tags: [], domains: [], field: "AI", topicLabel: "AI", publishedOn: "2026.01.01" },
    { slug: "ignore", kind: "case", title: "음성 인식", summary: "의료 영상", tags: [], domains: [], field: "바이오", topicLabel: "기술", publishedOn: "2026.10.31" },
  ];
  const actual = helpers.searchGlobalInsights(items, "  데이터  RAG ").map((item) => item.slug);
  assert.equal(Array.from(actual).join(","), "title,summary");
  assert.equal(helpers.searchGlobalInsights(items, "찾을수없는단어").length, 0);
  assert.equal(helpers.searchGlobalInsights(items, "  ").length, 0);
});

test("FAQ 질문과 답변·키워드를 함께 검색하며 직접 연결할 수 있다", () => {
  const items = [
    { id: "b", category: "account", question: "로그인", answer: ["디스코드 인증"], keywords: ["가입"] },
    { id: "a", category: "collaboration", question: "전문가 협업 요청", answer: ["연구를 등록"], keywords: ["매칭"] },
  ];
  const found = helpers.searchGlobalFaqs(items, "연구 협업");
  assert.equal(found.length, 1);
  assert.equal(found[0].id, "a");
  assert.equal(helpers.searchGlobalFaqs(items, "디스코드")[0].id, "b");
});

test("개별 메뉴로 돌아가는 링크는 q를 안전하게 인코딩하고 길이를 제한한다", () => {
  const url = helpers.globalSearchSourceHref("experts", " AI & RAG ");
  assert.equal(url, "/experts?q=AI+%26+RAG");
  assert.equal(helpers.globalSearchSourceHref("community", "파이썬"), "/community?q=%ED%8C%8C%EC%9D%B4%EC%8D%AC");
  assert.equal(helpers.globalSearchSourceHref("faq", "RAG"), "/faq?q=RAG");
});

test("통합검색은 정확한 메뉴 순서를 가진 네 구역만 보여준다", () => {
  const src = read("src/components/unified-search.tsx");
  const ids = [...src.matchAll(/<section id="(insights|experts|community|faq)"/g)].map((m) => m[1]);
  assert.equal(ids.join(","), "insights,experts,community,faq");
  assert.match(src, /관련 인사이트/);
  assert.match(src, /관련 전문가 찾기/);
  assert.match(src, /관련 자유게시판/);
  assert.match(src, /관련 FAQ/);
});

test("실제 메인 콘텐츠와 공개 프로필, 공개 게시글, FAQ 인덱스를 재사용한다", () => {
  const page = read("src/app/search/page.tsx");
  const ui = read("src/components/unified-search.tsx");
  assert.match(page, /listInsights\("case"\)/);
  assert.match(page, /listInsights\("trend"\)/);
  assert.match(page, /searchGlobalFaqs\(FAQS, query\)/);
  assert.match(ui, /requestApi<ExpertSearchResult>\("\/experts\?"/);
  assert.match(ui, /communityApi<PostList>\("\/posts\?"/);
  assert.match(ui, /scope: "public"/);
  assert.match(ui, /item\.visibility === "public" && !item\.hidden/);
  assert.doesNotMatch(ui, /scope: "mine"|scope: "inbox"|scope: "moderation"/);
});

test("개인 정보는 백엔드 공개 범위 정책에 따라 검색하며 비공개는 노출하지 않는다", () => {
  const backendCommunity = fs.readFileSync(path.join(__dirname, "../../backend/app/routers/community.py"), "utf8");
  const backendExperts = fs.readFileSync(path.join(__dirname, "../../backend/app/expert_search_store.py"), "utf8");
  assert.match(backendCommunity, /Post\.visibility == "public"/);
  assert.match(backendCommunity, /Post\.hidden\.is_\(False\)/);
  assert.match(backendExperts, /e\.is_public = TRUE/);
  assert.match(backendExperts, /u\.status = 'active'/);
});

test("오류·타임아웃은 출처별로 분리하고 빈 검색어에서는 API를 호출하지 않는다", () => {
  const src = read("src/components/unified-search.tsx");
  assert.match(src, /if \(!query\) return;/);
  assert.match(src, /setExperts\(/);
  assert.match(src, /setPosts\(/);
  assert.match(src, /Promise\.allSettled/);
  assert.match(src, /controller\.abort\(\)/);
  assert.match(src, /RemoteError/);
  assert.match(src, /SkeletonCards/);
});

test("헤더 통합검색, URL 재검색, 전문가·게시판·FAQ 원본 화면 연결을 유지한다", () => {
  const header = read("src/components/site-header.tsx");
  const src = read("src/components/unified-search.tsx");
  assert.match(header, /action="\/search"/);
  assert.match(header, /통합검색 열기/);
  assert.match(src, /form action="\/search" role="search"/);
  assert.match(src, /globalSearchSourceHref\("experts", query\)/);
  assert.match(src, /globalSearchSourceHref\("community", query\)/);
  assert.match(src, /globalSearchSourceHref\("faq", query\)/);
  assert.match(src, /href=\{"\/experts\/" \+ person\.user_id\}/);
  assert.match(src, /href=\{"\/community\/" \+ post\.id\}/);
  assert.match(src, /href=\{"\/faq#" \+ encodeURIComponent\(faq\.id\)\}/);
});
