const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const root = path.resolve(__dirname, "..");
const file = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

function renderIndicator(props) {
  const source = file("src/components/lab-trust-indicator.tsx");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: "lab-trust-indicator.tsx",
  });
  const module = { exports: {} };
  const localRequire = (name) => require(name);
  vm.runInNewContext(compiled.outputText, {
    exports: module.exports, module, require: localRequire,
  });
  return renderToStaticMarkup(React.createElement(module.exports.LabTrustIndicator, props));
}

const snapshot = (score, overrides = {}) => ({
  state: score === null ? "gathering" : "established",
  score, level: score === null ? "평가 축적 중" : "높은 협업 신뢰",
  review_count: score === null ? 2 : 5, reviewer_count: 2,
  minimum_reviews: 3, minimum_reviewers: 2, max_per_reviewer: 3,
  ...overrides,
});

test("flask SVG is actually filled for a rated expert and has transparent evidence label", () => {
  const html = renderIndicator({ snapshot: snapshot(86), variant: "profile" });
  assert.match(html, /LAB TRUST/);
  assert.match(html, /협업 신뢰 지수/);
  assert.match(html, /86/);
  assert.match(html, /\/100/);
  assert.match(html, /완료 협업 평가 5건/);
  assert.match(html, /점수 계산 원칙/);
  assert.match(html, /전문성 30%/);
  assert.match(html, /동일 연구자/);
  assert.match(html, /<clipPath/);
  assert.match(html, /<linearGradient/);
  assert.match(html, /<path[^>]+fill="url\(#lab-flask-liquid/);
});

test("empty flask never displays an invented 0 score for an unreviewed expert", () => {
  const html = renderIndicator({ snapshot: snapshot(null, { review_count: 0, reviewer_count: 0 }) });
  assert.match(html, /평가 축적 중/);
  assert.match(html, /반영 평가 0건/);
  assert.doesNotMatch(html, /0\s*\/100/);
  assert.doesNotMatch(html, /LAB TRUST · 가상 미리보기/);
});

test("single reviewer cannot unlock a number, even with repeated reviews", () => {
  const html = renderIndicator({
    snapshot: snapshot(null, { review_count: 3, reviewer_count: 1 }),
    variant: "profile",
  });
  assert.match(html, /평가 축적 중/);
  assert.match(html, /연구자 1\/2명/);
  assert.doesNotMatch(html, /\d+\s*\/100/);
});

test("loading, unavailable and no score are all distinct states", () => {
  assert.match(renderIndicator({}), /신뢰 지수 확인 중/);
  assert.match(renderIndicator({ snapshot: null }), /신뢰 지수 조회 불가/);
  assert.match(renderIndicator({ snapshot: snapshot(null) }), /평가 축적 중/);
});

test("local demo preview is visibly marked, never a verified achievement", () => {
  const html = renderIndicator({ demoPreview: 95, snapshot: null, variant: "featured" });
  assert.match(html, /LAB TRUST · 가상 미리보기/);
  assert.match(html, /LOCAL DEMO · 실제 지수가 아닙니다/);
});

test("search uses one batch query per visible result instead of one per card", () => {
  const src = file("src/components/expert-search.tsx");
  const api = file("src/lib/reviews.ts");
  assert.match(src, /getExpertReputations\(reputationIds\.split/);
  assert.match(src, /<FeaturedExpert[^>]+reputation=\{/);
  assert.match(src, /<ExpertCard[^>]+reputation=\{/);
  assert.match(src, /<LabTrustIndicator snapshot=\{reputation\}/);
  assert.match(api, /getExpertReputations\(ids: number\[\]\)/);
  assert.match(api, /slice\(0, 60\)/);
});

test("profile uses same server-authoritative index and keeps local demo isolated", () => {
  const src = file("src/components/expert-profile-view.tsx");
  assert.match(src, /verifiedReviews\?\.reputation/);
  assert.match(src, /getPublicExpertReviews\(liveProfile\.user_id\)/);
  assert.match(src, /demoPreview=\{demoReviews/);
  assert.match(src, /variant="profile"/);
});

test("local demo lookup is gated by development, localhost and exact nickname+affiliation", () => {
  const src = file("src/lib/expert-local-demo.ts");
  assert.match(src, /NODE_ENV !== "development"/);
  assert.match(src, /\["localhost", "127\.0\.0\.1"\]/);
  assert.match(src, /profile\.affiliation === sample\.affiliation/);
  assert.match(src, /getLocalDemoFlaskPreview/);
});

test("reputation neither purchases ranking nor exposes review author identifiers in UI", () => {
  const src = file("src/components/expert-search.tsx");
  const ratings = file("src/components/expert-review-summary.tsx");
  assert.doesNotMatch(src, /setSort\("lab_trust"\)|sort: "reputation"/);
  assert.match(ratings, /협업 연구회원|item\.author/);
});
