const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const root = path.resolve(__dirname, "..");

function loadModule(relativePath) {
  const filename = path.join(root, relativePath);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
  });
  const module = { exports: {} };
  function localRequire(request) {
    if (request.endsWith(".css") || request.endsWith(".module.css")) {
      return new Proxy({}, { get: (_, key) => (typeof key === "string" ? key : "css") });
    }
    if (request === "next/link") {
      return { default: ({ children, ...props }) => React.createElement("a", props, children) };
    }
    if (request.startsWith("@/")) {
      const base = `src/${request.slice(2)}`;
      const tsx = path.join(root, `${base}.tsx`);
      return loadModule(fs.existsSync(tsx) ? `${base}.tsx` : `${base}.ts`);
    }
    if (request.startsWith(".")) {
      return loadModule(path.relative(root, path.resolve(path.dirname(filename), request)));
    }
    return require(request);
  }
  vm.runInNewContext(outputText, { module, exports: module.exports, require: localRequire });
  return module.exports;
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("공통 헤더는 흰 배경에 제목·설명·장식을 같은 구조로 그린다", () => {
  const { PageLeadHeader } = loadModule("src/components/page-lead-header.tsx");
  const html = renderToStaticMarkup(
    React.createElement(PageLeadHeader, {
      kicker: "FIND EXPERTS",
      title: "AI 전문가 찾기",
      lead: "함께 연구할 AI 전문가를 만나보세요.",
      artSrc: "/headers/experts-lead.jpg",
      artKind: "photo",
    }),
  );
  assert.doesNotMatch(html, /현재 위치|홈 ›|crumb/);
  assert.match(html, /FIND EXPERTS/);
  assert.match(html, /<h1[^>]*>AI 전문가 찾기<\/h1>/);
  assert.match(html, /함께 연구할 AI 전문가를 만나보세요/);
  assert.match(html, /src="\/headers\/experts-lead\.jpg"/);
  assert.match(html, /data-art="photo"/);
});

test("헤더 그림은 같은 위아래 칸을 채우고 왼쪽은 제목 쪽으로 흐린다", () => {
  const css = read("src/components/page-lead-header.module.css");
  const source = read("src/components/page-lead-header.tsx");
  assert.doesNotMatch(source, /aria-label="현재 위치"|crumb=/);
  assert.match(css, /\.header\s*\{[\s\S]*?overflow:\s*visible/);
  assert.match(css, /\.art\s*\{[\s\S]*?inset:\s*0\s+0\s+0\s+auto/);
  assert.doesNotMatch(css, /top:\s*-|bottom:\s*-/);
  assert.match(css, /linear-gradient\(90deg/);
  assert.match(css, /mask-image:\s*linear-gradient\(90deg/);
});

test("전문가 찾기 히어로는 물결 장식 대신 연구 사진을 쓴다", () => {
  const { ExpertSearchHero } = loadModule("src/components/expert-search-hero.tsx");
  const html = renderToStaticMarkup(React.createElement(ExpertSearchHero));
  assert.match(html, /FIND EXPERTS/);
  assert.match(html, /headers\/experts-lead/);
  assert.match(html, /함께 연구할 AI 전문가를 만나보세요/);
  assert.doesNotMatch(html, /expertLightWave|사람과 AI가 만드는|최고의 AI 전문가/);
});

test("자유게시판·FAQ는 공통 헤더와 시안 카피·아트를 쓴다", () => {
  const board = read("src/components/community/community-board.tsx");
  const faq = read("src/components/community/faq-page.tsx");
  const faqCss = read("src/components/community/faq-visual.module.css");
  assert.match(board, /PageLeadHeader/);
  assert.match(board, /COMMUNITY & FEEDBACK/);
  assert.match(board, /title="자유게시판"/);
  assert.match(board, /질문에서 시작하는 연결, 연구의 발견을 함께 나눠요/);
  assert.match(board, /headers\/community-lead/);
  assert.doesNotMatch(board, /<h1>질문에서 시작하는 연결<\/h1>/);
  assert.match(faq, /PageLeadHeader/);
  assert.match(faq, /HELP CENTER/);
  assert.match(faq, /궁금한 순간, 바로 찾는 답/);
  assert.match(faq, /headers\/faq-lead/);
  assert.doesNotMatch(faq, /WHAT THE LAB \/ HELP CENTER/);
  assert.doesNotMatch(faqCss, /#172951/);
  assert.doesNotMatch(faqCss, /\.heroSearch:focus-within\s*\{[^}]*outline:\s*2px/);
  assert.doesNotMatch(faqCss, /\.heroSearch(?:\:focus-within)?\s*\{[^}]*linear-gradient/);
  assert.match(faqCss, /\.heroSearch:focus-within[\s\S]*?0 0 8px/);
  assert.match(faqCss, /\.heroSearch:focus-within[\s\S]*?0 0 32px/);
  assert.match(faqCss, /\.heroSearch input:focus-visible[^}]*outline:\s*none/);
});

test("헤더 이미지 파일이 배포 경로에 있다", () => {
  for (const name of ["experts-lead.jpg", "community-lead.jpg", "faq-lead.jpg"]) {
    const file = path.join(root, "public", "headers", name);
    assert.ok(fs.existsSync(file), name);
    assert.ok(fs.statSync(file).size > 10000, name);
  }
});
