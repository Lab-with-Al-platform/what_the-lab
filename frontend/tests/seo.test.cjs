const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const origin = "https://labbridge.example";
const root = path.resolve(__dirname, "../src");

/** 환경 변수 조합별로 코드를 읽어, 운영 주소나 실제 DB에 연결하지 않고 검증합니다. */
function loadSeo(env) {
  const cache = new Map();

  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const source = fs.readFileSync(file, "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    });
    const module = { exports: {} };
    cache.set(file, module.exports);
    const localRequire = (name) => {
      if (name.startsWith("@/")) return load(path.join(root, `${name.slice(2)}.ts`));
      if (name.startsWith(".")) return load(path.resolve(path.dirname(file), `${name}.ts`));
      return require(name);
    };
    vm.runInNewContext(outputText, { exports: module.exports, require: localRequire, URL, process: { env } }, { filename: file });
    return module.exports;
  }

  const fromRoot = (file) => load(path.join(root, file));
  return {
    ...fromRoot("lib/site-seo.ts"),
    ...fromRoot("lib/insight-seo.ts"),
    ...fromRoot("lib/insights.ts"),
    robots: fromRoot("app/robots.ts").default,
    sitemap: fromRoot("app/sitemap.ts").default,
  };
}

const configured = loadSeo({ LABBRIDGE_SITE_URL: origin });
const caseArticle = configured.getInsight("microscope-cell-drawing");
const excluded = [
  "/cases/cancer-cell-classification",
  "/cases/metastasis-multimodal",
  "/experts/0",
  "/community",
  "/community/0",
  "/login",
  "/signup",
  "/admin/insights/preview",
  "/requests",
  "/search",
  "/workspace/0",
  "/my-research/0",
  "/settings/profile",
];

test("사이트맵과 공개 페이지 메타데이터는 같은 대표 URL을 쓰고 비공개·삭제 주소는 싣지 않는다", () => {
  const urls = new Set(configured.sitemap().map((item) => item.url));
  assert.equal(urls.size, 35);
  for (const route of ["/", "/cases", "/trends", "/experts", "/community/guidelines", "/faq"]) {
    const page = configured.publicPageMetadata(route);
    assert.equal(page.alternates.canonical, origin + route);
    assert.ok(page.title && page.description);
    assert.ok(urls.has(page.alternates.canonical));
  }
  for (const route of excluded) assert.ok(!urls.has(origin + route), route);
  assert.equal(configured.robots().sitemap, origin + "/sitemap.xml");
  assert.equal(configured.robots().rules.disallow, "/api/");
});

test("미설정 또는 Vercel 미리보기는 대표 주소·사이트맵·구조화 데이터를 공개하지 않는다", () => {
  for (const env of [{}, { LABBRIDGE_SITE_URL: origin, VERCEL_ENV: "preview" }]) {
    const seo = loadSeo(env);
    assert.equal(seo.publicPageMetadata("/cases").robots.index, false);
    assert.equal(seo.insightMetadata(caseArticle).robots.index, false);
    assert.equal(seo.insightArticleJsonLd(caseArticle), undefined);
    assert.equal(seo.sitemap().length, 0);
    assert.equal(seo.robots().sitemap, undefined);
  }
  for (const invalid of [
    "not-a-url", "http://labbridge.example", "https://localhost:3000",
    "https://127.0.0.1", "https://qa.local", origin + "/cases",
    origin + "?q=test", origin + "#fragment", "https://user:pass@labbridge.example",
  ]) {
    assert.equal(configured.getSiteOrigin(invalid), undefined, invalid);
  }
});

test("정식 글의 출처와 대표 주소가 Article에 일치하고, 확인 없는 작성자·날짜는 생략한다", () => {
  const urls = new Set(configured.sitemap().map((item) => item.url));
  assert.equal(configured.INSIGHTS.length, 29);
  for (const article of configured.INSIGHTS) {
    const data = JSON.parse(configured.insightArticleJsonLd(article));
    assert.equal(data["@type"], "Article");
    assert.equal(data.headline, article.title);
    assert.equal(data.description, article.summary);
    assert.equal(data.citation, article.sourceUrl);
    assert.equal(data.mainEntityOfPage["@id"], configured.insightMetadata(article).alternates.canonical);
    assert.ok(urls.has(data.mainEntityOfPage["@id"]));
    assert.ok(article.evidence.takeaway.length > 40);
    assert.ok(!("author" in data) && !("datePublished" in data) && !("dateModified" in data));
  }
});

test("근거가 없거나 안전한 HTTPS 원문이 없으면 색인과 Article에서 제외한다", () => {
  for (const article of [
    { ...caseArticle, evidence: undefined },
    { ...caseArticle, sourceUrl: "javascript:alert(1)" },
    { ...caseArticle, sourceUrl: "https://user:password@example.com/" },
  ]) {
    assert.equal(configured.insightCanonical(article), undefined);
    assert.equal(configured.insightMetadata(article).robots.index, false);
    assert.equal(configured.insightArticleJsonLd(article), undefined);
  }
});

test("선언된 기사 작성자·발행일만 쓰고 제목이 script 태그를 닫지 못한다", () => {
  const article = {
    ...caseArticle,
    title: "테스트 </script>",
    editorial: { author: { type: "Person", name: "예시 작성자" }, publishedOn: "2026-11-10", reviewedOn: "2026-11-18" },
  };
  const json = configured.insightArticleJsonLd(article);
  assert.ok(!json.includes("</script>"));
  const data = JSON.parse(json);
  assert.equal(data.headline, article.title);
  assert.deepEqual(data.author, { "@type": "Person", name: "예시 작성자" });
  assert.equal(data.datePublished, "2026-11-10");
  assert.equal(data.dateModified, undefined);
});
