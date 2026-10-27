const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function load(relative, params = new URLSearchParams()) {
  const filename = path.resolve(__dirname, "..", relative);
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename,
  });
  const localRequire = (name) => {
    if (name === "next/navigation") return { useSearchParams: () => params };
    if (name === "next/link") return ({ children, ...props }) => React.createElement("a", props, children);
    if (name === "@/components/page-container") return { PageContainer: ({ children }) => React.createElement("main", null, children) };
    if (name === "@/components/collab-request-dialog") return { CollabRequestDialog: () => null };
    if (name === "@/components/request-parts") return { Avatar: () => null };
    if (name === "@/lib/api") return { ApiError: class extends Error {}, requestApi: () => Promise.resolve([]) };
    if (name === "@/lib/collab-requests") return { photoOrDefault: () => "" };
    if (name === "@/lib/my-research") return { DATA_STATUS_LABELS: {} };
    if (name === "@/lib/expert-search") return load("src/lib/expert-search.ts", params);
    return require(name);
  };
  vm.runInNewContext(outputText, { module, exports: module.exports, require: localRequire, URLSearchParams, Map, Set });
  return module.exports;
}

test("게시판 태그의 q와 기존 skill 링크가 실제 전문가 검색 입력값으로 이어진다", () => {
  for (const key of ["q", "skill"]) {
    const { ExpertSearch } = load("src/components/expert-search.tsx", new URLSearchParams({ [key]: "세포 이미지 분석" }));
    const html = renderToStaticMarkup(React.createElement(ExpertSearch));
    assert.match(html, /id="expert-query"[^>]*value="세포 이미지 분석"/);
    assert.ok(html.includes("내 연구로 찾기"));
  }
});

test("외부 검색어는 API 길이 한도에 맞추고 q를 우선한다", () => {
  const { ExpertSearch } = load("src/components/expert-search.tsx", new URLSearchParams({ q: "가".repeat(80), skill: "기존 링크" }));
  const html = renderToStaticMarkup(React.createElement(ExpertSearch));
  assert.ok(html.includes(`value="${"가".repeat(50)}"`));
  assert.ok(!html.includes("기존 링크"));
});

test("FAQ는 오늘의 요청관리·설정 화면을 안내하고 비공개 답변의 DM을 약속하지 않는다", () => {
  const { FAQS } = load("src/lib/faq.ts");
  const request = FAQS.find((item) => item.id === "request-boundary");
  assert.ok(request.links.some((link) => link.href === "/requests"));
  assert.ok(!request.answer.join(" ").includes("시안"));
  const profile = FAQS.find((item) => item.id === "profile-exposure");
  assert.ok(profile.links.some((link) => link.href === "/settings/profile"));
  const notifications = FAQS.find((item) => item.id === "save-notification").answer.join(" ");
  assert.ok(notifications.includes("Discord"));
  assert.ok(notifications.includes("전송하지"));
});
