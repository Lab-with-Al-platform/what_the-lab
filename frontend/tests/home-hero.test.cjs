const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

// 브라우저·DB 없이 새 안내 화면의 콘텐츠와 링크 경계를 검사합니다.
function loadModule(relativePath) {
  const filename = path.resolve(__dirname, "..", relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
  });
  const module = { exports: {} };
  function localRequire(request) {
    if (request.endsWith(".css")) return {};
    if (request === "next/link") return { default: ({ children, ...props }) => React.createElement("a", props, children) };
    if (request === "@/components/page-container") return { PageContainer: ({ children, className }) => React.createElement("div", { className: `page-container ${className}` }, children) };
    if (request.startsWith("@/")) return loadModule(`src/${request.slice(2)}.tsx`);
    return require(request);
  }
  vm.runInNewContext(outputText, { module, exports: module.exports, require: localRequire });
  return module.exports;
}

test("홈은 기존 소개와 두 안내 화면을 같은 프레임에 표시한다", () => {
  const { HomeHero } = loadModule("src/components/home-hero.tsx");
  const html = renderToStaticMarkup(React.createElement(HomeHero, { introVisual: React.createElement("div", null, "기존 연구 이미지") }));
  assert.equal((html.match(/data-home-slide=/g) ?? []).length, 3);
  assert.match(html, /기존 연구 이미지/);
  assert.match(html, /플랫폼 이용 안내/);
  assert.match(html, /Discord 이용 안내/);
  assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1);
  assert.match(html, /aria-label="홈 소개 자동 넘김 일시정지"/);
});

test("안내 그래픽은 과정·연결을 설명하지만 미정 링크나 연동 상태를 만들지 않는다", () => {
  const { PlatformGuideVisual, DiscordGuideVisual } = loadModule("src/components/home-guide-visuals.tsx");
  const platform = renderToStaticMarkup(React.createElement(PlatformGuideVisual));
  const discord = renderToStaticMarkup(React.createElement(DiscordGuideVisual));
  for (const label of ["인사이트", "전문가 찾기", "협업 매칭", "프로젝트 진행", "협업 요청", "프로젝트 확정"]) assert.match(platform, new RegExp(label));
  for (const label of ["Discord", "프로젝트 채널", "챗봇", "Google Calendar", "연결 구조 예시"]) assert.match(discord, new RegExp(label));
  assert.doesNotMatch(platform + discord, /href=|<button|연동 완료|실시간 동기화/);
  // CSS가 늦어도 아이콘이 화면을 덮지 않도록 SVG 기본 크기를 둡니다.
  assert.match(platform, /width="28"/);
  assert.match(discord, /width="22"/);
});

test("새 안내 슬라이드는 가짜 FAQ 링크나 영상·방문 저장 기능을 추가하지 않는다", () => {
  const { HomeHero } = loadModule("src/components/home-hero.tsx");
  const html = renderToStaticMarkup(React.createElement(HomeHero, { introVisual: null }));
  assert.equal((html.match(/<a /g) ?? []).length, 1);
  assert.match(html, /href="#paths"/);
  assert.match(html, /상세 매뉴얼 준비 중/);
  const source = fs.readFileSync(path.resolve(__dirname, "../src/components/home-hero.tsx"), "utf8");
  assert.doesNotMatch(source, /localStorage|sessionStorage|<video/);
});

test("멈춤 스타일은 재생 선언보다 구체적이고 비활성 화면의 조작을 차단한다", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../src/components/home-hero.css"), "utf8");
  assert.match(css, /\.home-hero__choice\[aria-current\] \.home-hero__progress\[data-running="false"\]::after\s*\{ animation-play-state: paused;/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.home-hero__slide\s*\{[\s\S]*z-index: 0;/);
  assert.match(css, /\.home-hero__slide\[data-active="true"\]\s*\{[\s\S]*z-index: 1;/);
  const { HomeHero } = loadModule("src/components/home-hero.tsx");
  const html = renderToStaticMarkup(React.createElement(HomeHero, { introVisual: null }));
  assert.equal((html.match(/ inert=""/g) ?? []).length, 2);
});
