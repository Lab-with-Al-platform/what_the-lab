const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function load(relative, extraRequire) {
  const filename = path.resolve(__dirname, "..", relative);
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  const localRequire = (name) => {
    if (name === "@/lib/api")
      return {
        requestApi: (route, init) => Promise.resolve({ route, init }),
        ApiError: class ApiError extends Error {},
      };
    if (name === "@/lib/community") return load("src/lib/community.ts");
    if (name === "@/lib/community-navigation") return load("src/lib/community-navigation.ts");
    if (name.endsWith(".module.css"))
      return new Proxy({}, { get: (_, key) => key });
    if (name.startsWith("."))
      return require(path.resolve(path.dirname(filename), name));
    return extraRequire ? extraRequire(name) : require(name);
  };
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    require: localRequire,
    Intl,
    Date,
    URL,
    Set,
    Map,
    AbortController,
    setTimeout,
    clearTimeout,
    crypto: {
      getRandomValues: (array) =>
        require("node:crypto").webcrypto.getRandomValues(array),
    },
  });
  return module.exports;
}
const faq = load("src/lib/faq.ts");
const community = load("src/lib/community.ts");
const ui = load("src/components/community/community-ui.tsx");

test("FAQ는 최신 요청관리·공개 전문가 기능과 연결하고 공개 범위를 구분한다", () => {
  assert.ok(faq.FAQS.length >= 18, "기존 FAQ가 제거되면 안 됩니다");
  assert.equal(new Set(faq.FAQS.map((f) => f.id)).size, faq.FAQS.length);
  assert.ok(faq.FAQS.some((f) => f.id === "lab-trust"));
  assert.ok(faq.FAQS.some((f) => f.id === "review-after-completion"));
  assert.ok(
    faq.FAQS.find((f) => f.id === "request-boundary")
      .answer.join(" ")
      .includes("요청관리"),
  );
  for (const item of faq.FAQS) {
    assert.ok(item.links.every((link) => link.href.startsWith("/")));
    assert.ok(item.category in faq.FAQ_CATEGORIES);
  }
});
test("FAQ 검색은 한글·영문 대소문자와 키워드·분류·0건을 처리한다", () => {
  assert.ok(faq.searchFaqs("비공개").some((f) => f.id === "private-post"));
  assert.ok(faq.searchFaqs("api 키").some((f) => f.id === "private-post"));
  assert.ok(
    faq.searchFaqs("", "account").every((f) => f.category === "account"),
  );
  assert.equal(faq.searchFaqs("해당질문은존재하지않습니다").length, 0);
});
test("게시판 API 호출은 기존 인증 쿠키 도우미와 no-store 정책을 사용한다", async () => {
  const response = await community.communityApi("/posts");
  assert.equal(response.route, "/community/posts");
  assert.equal(response.init.cache, "no-store");
});
test("날짜는 실행 환경과 무관하게 한국 시간을 표시한다", () => {
  assert.ok(community.communityDate("2026-10-23T16:00:00Z").includes("24"));
  assert.equal(
    community.communityDate("2026-10-23T16:00:00"),
    community.communityDate("2026-10-23T16:00:00Z"),
  );
});
test("게시글 HTML·스크립트·코드가 실행 가능한 마크업으로 변환되지 않는다", () => {
  const text =
    "<script>alert(1)</script>\n```python\n<img src=x onerror=alert(1)>\n```";
  const markup = renderToStaticMarkup(
    React.createElement(ui.CommunityBody, { text }),
  );
  assert.ok(!markup.includes("<script>"));
  assert.ok(!markup.includes("<img"));
  assert.ok(markup.includes("&lt;script&gt;"));
  assert.ok(markup.includes("<pre><code>"));
});
test("게시판의 사례 링크는 기존 공개 원고의 URL과 일치한다", () => {
  const registry = community.INSIGHT_LINKS;
  const { execFileSync } = require("node:child_process");
  const inventory = JSON.parse(
    execFileSync(
      process.execPath,
      [
        path.resolve(__dirname, "../scripts/export-insights.cjs"),
        "--inventory",
      ],
      { encoding: "utf8" },
    ),
  );
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        registry.map(({ slug, kind, title }) => ({ slug, kind, title })),
      ),
    ),
    inventory.map(({ slug, kind, title }) => ({ slug, kind, title })),
  );
  for (const item of registry) {
    assert.equal(
      item.href,
      `${item.kind === "case" ? "/cases/" : "/trends/"}${item.slug}`,
    );
    assert.ok(!item.href.includes(".."));
  }
});

test("페이지 입력은 소수·무한대·과도한 번호를 배제한다", () => {
  for (const value of ["1.5", "Infinity", "-1", "0", "9999999999"])
    assert.equal(community.communityPage(value), 1);
  assert.equal(community.communityPage("12"), 12);
});
test("호출자가 캐시 허용을 넘겨도 비공개 응답은 저장하지 않는다", async () => {
  const value = await community.communityApi("/posts", {
    cache: "force-cache",
  });
  assert.equal(value.init.cache, "no-store");
});

test("언어 이름이 없는 코드의 첫 줄을 제거하지 않는다", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ui.CommunityBody, { text: "```\nhello\nworld\n```" }),
  );
  assert.ok(markup.includes("hello"));
  assert.ok(markup.includes("world"));
});

test("HTTP에서도 randomUUID 없이 안전한 v4 재시도 토큰을 만든다", () => {
  const tokens = new Set(
    Array.from({ length: 100 }, () => community.newCommunityToken()),
  );
  assert.equal(tokens.size, 100);
  for (const token of tokens)
    assert.match(
      token,
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
    );
});
