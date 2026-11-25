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
  const browser = await chromium.launch({
    executablePath: "C:/Users/Peter/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const checks = [];
  const screenshots = new Set(["cancer-cell-classification", "battery-life", "few-shot-vision", "private-data-ai"]);
  // 화면은 복합어 줄바꿈 방지용 하이픈을 사용하므로 표시 차이만 정규화합니다.
  const normalizeTitle = (text) => text.replace(/\u2011/g, "-").replace(/\s+/g, " ").trim();
  try {
    for (const article of INSIGHTS) {
      const response = await page.goto(`http://127.0.0.1:3000${articlePath(article)}`, { waitUntil: "networkidle" });
      assert.equal(response.status(), 200, article.slug);
      assert.equal(normalizeTitle(await page.locator("article h1").innerText()), normalizeTitle(article.title));
      assert.equal(await page.locator(".article-section").count(), article.sections.length);
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

    // 새 원고에도 기존 용어 펼침·키보드·목차 이동이 동작하는지 직접 확인합니다.
    await page.goto("http://127.0.0.1:3000/cases/battery-life", { waitUntil: "networkidle" });
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
      date: "2026-10-19", articles: INSIGHTS.length, checks, errors,
      interaction: "새 글의 용어 click/Enter/Space, 모바일 역할 섹션 이동·목차 접힘 통과",
    }, null, 2));
    console.log(JSON.stringify({ articles: INSIGHTS.length, viewportChecks: checks.length, errors }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
