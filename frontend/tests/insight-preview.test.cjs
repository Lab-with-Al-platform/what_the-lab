const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

// Next 서버·DB 없이 같은 본문 컴포넌트의 일반/본문 전용 출력을 비교합니다.
function loadArticleView() {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/components/article-view.tsx"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    fileName: "article-view.tsx",
  });
  const module = { exports: {} };
  const localRequire = (request) => {
    const element = (tag) => ({ children, ...props }) => React.createElement(tag, props, children);
    if (request === "next/image") return { default: element("img") };
    if (request === "next/link") return { default: element("a") };
    const components = {
      "@/components/article-toc": { ArticleToc: () => React.createElement("nav", { "aria-label": "목차" }) },
      "@/components/page-container": { PageContainer: element("div") },
      "@/components/cover-art": { CoverArt: ({ alt }) => React.createElement("img", { alt }) },
      "@/components/keyword-tag": { KeywordTag: ({ label }) => React.createElement("span", null, label) },
      "@/components/insight-card": { InsightCard: () => null },
      "@/components/article-editorial": { ArticleParagraph: ({ children }) => React.createElement("p", null, children), ArticleGlossary: () => null },
      "@/lib/insight-meta": { articlePath: (item) => `/${item.kind}/${item.slug}`, kindLabel: () => "AI 트렌드" },
      "@/lib/insights": {},
    };
    return components[request] ?? require(request);
  };
  vm.runInNewContext(outputText, { module, exports: module.exports, require: localRequire });
  return module.exports.ArticleView;
}

const ArticleView = loadArticleView();
const article = {
  kind: "trend", title: "미리보기 검증 제목", summary: "원문과 해석을 구분하는 글입니다.",
  slug: "preview-test", tags: ["용어"], field: "과학 AI", technologies: [],
  cover: "science", imageAlt: "설명용 이미지", imageCaption: "실제 연구 도판이 아닙니다.",
  publishedOn: "2026.10.22", readingMinutes: 3, institution: "검증용 출처",
  highlights: [{ label: "핵심 질문", text: "어디까지 활용할 수 있을까요?" }],
  facts: [{ label: "분야", value: "과학 AI" }],
  sections: [{ id: "test-section", toc: "확인할 내용", title: "확인할 내용", paragraphs: ["본문의 내용은 그대로 유지합니다."] }],
};

test("일반 글은 기본값으로 경로·목차·연구정보 패널을 유지한다", () => {
  const html = renderToStaticMarkup(React.createElement(ArticleView, { article }));
  assert.match(html, /aria-label="경로"/);
  assert.match(html, /연구 정보/);
  assert.match(html, /관련 AI 기술/);
  assert.doesNotMatch(html, /article-content-preview/);
});

test("본문 전용 미리보기는 주변 패널만 제외하고 원고·캡션을 보존한다", () => {
  const before = JSON.stringify(article);
  const html = renderToStaticMarkup(React.createElement(ArticleView, { article, contentOnly: true }));
  assert.match(html, /article-content-preview/);
  assert.match(html, /미리보기 검증 제목/);
  assert.match(html, /id="test-section"/);
  assert.match(html, /본문의 내용은 그대로 유지합니다/);
  assert.match(html, /실제 연구 도판이 아닙니다/);
  assert.doesNotMatch(html, /aria-label="경로"|연구 정보|관련 AI 기술/);
  assert.equal(JSON.stringify(article), before);
});

test("관련 글은 공개 상세가 넘긴 목록만 그리고 카탈로그를 찾지 않는다", () => {
  const related = [{ slug: "related-one", kind: "trend", title: "이어서 볼 검증 글", publishedOn: "2026.10.22", cover: "science" }];
  const withRelated = renderToStaticMarkup(React.createElement(ArticleView, { article, related }));
  const preview = renderToStaticMarkup(React.createElement(ArticleView, { article, contentOnly: true }));
  assert.match(withRelated, /이어서 볼 글/);
  assert.match(withRelated, /이어서 볼 검증 글/);
  assert.doesNotMatch(preview, /이어서 볼 글|이어서 볼 검증 글/);
});

test("미리보기와 ArticleView는 원고 카탈로그를 값으로 가져오지 않는다", () => {
  const view = fs.readFileSync(path.resolve(__dirname, "../src/components/article-view.tsx"), "utf8");
  const preview = fs.readFileSync(path.resolve(__dirname, "../src/app/admin/insights/preview/page.tsx"), "utf8");
  assert.doesNotMatch(view, /relatedInsights|getInsight/);
  assert.match(view, /import type \{ InsightArticle \} from "@\/lib\/insights"/);
  assert.doesNotMatch(view, /^import \{[^}]*\} from "@\/lib\/insights"/m);
  assert.match(preview, /import type \{ InsightArticle \} from "@\/lib\/insights"/);
  assert.doesNotMatch(preview, /^import \{[^}]*\} from "@\/lib\/insights"/m);
});

test("이미지 없는 원고의 빈 칩·단계 배열은 빈 사진 캡션을 만들지 않는다", () => {
  const withoutImages = { ...article, sections: article.sections.map((section) => ({ ...section, chips: [], steps: [] })) };
  const html = renderToStaticMarkup(React.createElement(ArticleView, { article: withoutImages, contentOnly: true, hideCover: true }));
  assert.doesNotMatch(html, /<figure|<figcaption|<img/);
  assert.match(html, /본문의 내용은 그대로 유지합니다/);
});
