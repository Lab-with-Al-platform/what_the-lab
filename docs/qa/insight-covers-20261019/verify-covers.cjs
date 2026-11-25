// 개인 브라우저·실제 로그인과 분리된 로컬 콘텐츠 전용 검사입니다.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../..");
const frontend = path.join(root, "frontend");
const ts = require(path.join(frontend, "node_modules/typescript"));
const { chromium } = require("C:/Users/Peter/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const cache = new Map();

function loadModule(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const localRequire = (request) => request.startsWith(".")
    ? loadModule(path.resolve(path.dirname(filename), `${request}.ts`)) : require(request);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: localRequire }, { filename });
  return module.exports;
}

async function main() {
  const { INSIGHTS, articlePath } = loadModule(path.join(frontend, "src/lib/insights.ts"));
  // 분량은 글의 품질 점수가 아닙니다. 짧아 보이는 이유를 비교하는 보조 기록입니다.
  const audit = INSIGHTS.map((article) => {
    const paragraphs = article.sections.flatMap((section) => section.paragraphs.map((paragraph) =>
      typeof paragraph === "string" ? paragraph : paragraph.text));
    return {
      slug: article.slug, title: article.title,
      paragraphChars: paragraphs.join("").length,
      paragraphs: paragraphs.length, sections: article.sections.length,
      glossaryTerms: article.glossary?.length ?? 0,
      evidenceScope: article.facts.find((fact) => fact.label === "확인 범위")?.value ?? article.sampleNotice,
      sourceUrl: article.sourceUrl,
    };
  }).sort((left, right) => left.paragraphChars - right.paragraphChars);
  fs.writeFileSync(path.join(__dirname, "content-audit.json"), JSON.stringify({
    date: "2026-10-19", countingRule: "본문 문단만 집계. 출처·편집자 문단은 포함, 제목·용어 펼침·질문 steps·요약은 제외. 원문 전체 분량과 비교한 값이 아님.",
    articles: audit,
  }, null, 2));
  const browser = await chromium.launch({
    executablePath: "C:/Users/Peter/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const checks = [];
  const screenshots = new Set(["mattergen-material-design", "battery-life", "ancient-inscription", "food-image-quality", "private-data-ai", "fluid-simulation"]);
  // 화면은 복합어 줄바꿈 방지용 하이픈을 사용하므로 표시 차이만 정규화합니다.
  const normalizeTitle = (text) => text.replace(/\u2011/g, "-").replace(/\s+/g, " ").trim();
  try {
    for (const article of INSIGHTS) {
      const response = await page.goto(`http://localhost:3000${articlePath(article)}`, { waitUntil: "networkidle" });
      assert.equal(response.status(), 200, article.slug);
      assert.equal(normalizeTitle(await page.locator("article h1").innerText()), normalizeTitle(article.title));
      assert.equal(await page.locator(".article-section").count(), article.sections.length);
      if (article.coverSrc) {
        assert.equal(await page.locator("article figure img").first().getAttribute("src"), article.coverSrc);
        assert.match(await page.locator("article figure").first().innerText(), /AI로 생성/);
      }
      for (const width of [1440, 768, 390]) {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : width === 768 ? 1024 : 844 });
        await page.evaluate(async () => { await document.fonts.ready; });
        const metrics = await page.evaluate(() => ({
          width: window.innerWidth,
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          brokenImages: [...document.images].filter((img) => !img.complete || !img.naturalWidth).length,
          glossary: document.querySelectorAll(".article-glossary details").length,
          notes: document.querySelectorAll(".article-note").length,
        }));
        assert.equal(metrics.overflow, false, `${article.slug}/${width}: 가로 넘침`);
        assert.equal(metrics.brokenImages, 0, `${article.slug}/${width}: 이미지 실패`);
        checks.push({ slug: article.slug, ...metrics });
        if (screenshots.has(article.slug)) {
          await page.screenshot({ path: path.join(__dirname, `${article.slug}-${width}.png`) });
        }
      }
    }

    // 목록 카드·대표 카드·홈에서도 전용 표지 경로가 전달되는지 확인합니다.
    const listingChecks = [];
    const seenGeneratedCovers = new Set();
    const expectedCovers = new Map(INSIGHTS.map((article) => [article.slug, article.coverSrc]));
    for (const route of ["/", "/cases", "/cases#page2", "/cases#page3", "/trends", "/trends#page2", "/trends#page3"]) {
      const [pathname, pageMarker] = route.split("#");
      await page.setViewportSize({ width: 1440, height: 900 });
      const response = await page.goto(`http://localhost:3000${pathname}`, { waitUntil: "networkidle" });
      assert.equal(response.status(), 200, route);
      if (pageMarker) {
        // 이 목록은 URL page 변수가 아니라 버튼 상태로 페이지를 바꿉니다.
        const pageNumber = pageMarker.replace("page", "");
        const paginationButton = page.getByRole("navigation", { name: "페이지", exact: true })
          .getByRole("button", { name: pageNumber, exact: true });
        await paginationButton.click();
        assert.equal(await paginationButton.getAttribute("aria-current"), "page");
        await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0));
        // 클릭 때문에 아래로 이동한 화면을 되돌려 fullPage 캡처의 고정 헤더가 중간에 찍히지 않게 합니다.
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.waitForFunction(() => window.scrollY === 0);
        await page.screenshot({ path: path.join(__dirname, `${pathname.slice(1)}-${pageMarker}-1440.png`), fullPage: true });
      }
      const links = await page.locator("a[href] img").evaluateAll((images) => images.map((img) => ({ href: img.closest("a").getAttribute("href"), src: img.getAttribute("src"), loaded: img.complete && img.naturalWidth > 0 })));
      let changedCovers = 0;
      for (const link of links) {
        const slug = link.href.split("/").pop();
        const expected = expectedCovers.get(slug);
        if (!expected) continue;
        assert.equal(link.src, expected, `${route}: ${slug}`);
        assert.ok(link.loaded, `${route}: ${slug} 이미지 로딩`);
        seenGeneratedCovers.add(slug);
        changedCovers++;
      }
      listingChecks.push({ route, changedCovers });
      if (route === "/cases" || route === "/trends") {
        for (const width of [1440, 768, 390]) {
          await page.setViewportSize({ width, height: width === 1440 ? 900 : width === 768 ? 1024 : 844 });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, route);
          await page.screenshot({ path: path.join(__dirname, `${route.slice(1)}-list-${width}.png`), fullPage: true });
        }
      }
    }
    assert.equal(seenGeneratedCovers.size, 18, "홈·목록 3페이지에서 전용 표지 18개를 모두 확인해야 합니다.");
    // 표지 교체 후에도 기존 용어 펼침·키보드·목차 이동을 확인합니다.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://localhost:3000/cases/battery-life", { waitUntil: "networkidle" });
    const trigger = page.locator(".article-glossary summary").first();
    await trigger.click();
    assert.equal(await trigger.locator("..").getAttribute("open"), "");
    await trigger.press("Enter");
    assert.equal(await trigger.locator("..").getAttribute("open"), null);
    await trigger.press("Space");
    assert.equal(await trigger.locator("..").getAttribute("open"), "");
    await page.screenshot({ path: path.join(__dirname, "battery-life-glossary-390.png") });
    const toc = page.getByRole("button", { name: /목차/ });
    await toc.click();
    await page.locator("#mobile-toc a[href='#roles']").click();
    await page.waitForFunction(() => {
      const top = document.getElementById("roles").getBoundingClientRect().top;
      return location.hash === "#roles" && top > 80 && top < 210;
    });
    assert.equal(await toc.getAttribute("aria-expanded"), "false");
    await page.screenshot({ path: path.join(__dirname, "battery-life-roles-390.png") });
    assert.equal(errors.length, 0, errors.join("\n"));
    fs.writeFileSync(path.join(__dirname, "measurements.json"), JSON.stringify({
      date: "2026-10-19", articles: INSIGHTS.length, checks, listingChecks, errors,
      interaction: "새 글의 용어 click/Enter/Space, 모바일 역할 섹션 이동·목차 접힘 통과",
    }, null, 2));
    console.log(JSON.stringify({ articles: INSIGHTS.length, viewportChecks: checks.length, errors }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
