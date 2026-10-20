// 실행 전후를 같은 화면·브라우저 조건으로 비교합니다. 로그인이나 DB에는 접근하지 않습니다.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const root = path.resolve(__dirname, "../../..");
const publicDirectory = path.join(root, "frontend/public");
const phase = process.argv[2];
assert.ok(["before", "after"].includes(phase), "before 또는 after를 지정하세요.");
const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const captureDirectory = `${phase}-${Date.now()}`;
const capturePath = path.join(__dirname, captureDirectory);
fs.mkdirSync(capturePath);

function hashFile(filename) {
  return crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex");
}

function inventory(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return inventory(filename);
    if (!/\.(png|jpe?g|webp|avif)$/i.test(entry.name)) return [];
    return [{ path: path.relative(publicDirectory, filename).replaceAll("\\", "/"),
      bytes: fs.statSync(filename).size, sha256: hashFile(filename) }];
  }).sort((a, b) => a.path.localeCompare(b.path));
}

const routes = [
  { name: "home", route: "/" },
  { name: "cases", route: "/cases" },
  { name: "trends", route: "/trends" },
  { name: "article", route: "/cases/lettuce-biomass-estimation" },
];
const conditions = [
  { width: 1440, height: 900, dpr: 1 },
  { width: 768, height: 1024, dpr: 1 },
  { width: 390, height: 844, dpr: 1 },
  { width: 390, height: 844, dpr: 2 },
];

async function measure(browser, route, condition) {
  // 매번 별도 컨텍스트: 브라우저 캐시는 공유하지 않습니다. 서버 이미지 캐시는 남을 수 있습니다.
  const context = await browser.newContext({ viewport: { width: condition.width, height: condition.height }, deviceScaleFactor: condition.dpr });
  const page = await context.newPage();
  const errors = [];
  const responses = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.request().resourceType() !== "image") return;
    responses.push((async () => ({ url: response.url().replace(baseUrl, ""), status: response.status(),
      bytes: (await response.body()).length, type: response.headers()["content-type"],
      cache: response.headers()["x-nextjs-cache"] ?? null }))());
  });
  try {
    const response = await page.goto(baseUrl + route.route, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.waitForFunction(() => [...document.images].every((image) => {
      const rect = image.getBoundingClientRect();
      const visible = rect.width && rect.height && rect.top < innerHeight && rect.bottom > 0;
      return !visible || (image.complete && image.naturalWidth > 0);
    }));
    const initialImages = await page.evaluate(() => [...document.images].map((image) => {
      const rect = image.getBoundingClientRect();
      return { src: image.getAttribute("src"), currentSrc: image.currentSrc.replace(location.origin, ""),
        sizes: image.sizes, loading: image.loading, width: rect.width, height: rect.height,
        naturalWidth: image.naturalWidth, visible: !!(rect.width && rect.height && rect.top < innerHeight && rect.bottom > 0) };
    }));
    const initialResponses = await Promise.all(responses.slice());
    const layout = await page.evaluate(() => [...document.querySelectorAll("h1, #paths, .article-layout, .insight-editorial-card")].map((element) => {
      const rect = element.getBoundingClientRect();
      return { tag: element.tagName, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    assert.ok(initialResponses.every((item) => item.status === 200));
    if (condition.dpr === 1) await page.screenshot({ path: path.join(capturePath, `${route.name}-${condition.width}.png`) });

    // 지연 로딩된 아래쪽 이미지도 실제 스크롤로 불러온 뒤 확인합니다.
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) {
        window.scrollTo(0, y);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
    });
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => [...document.images].every((image) => {
      const rect = image.getBoundingClientRect();
      return !rect.width || !rect.height || (image.complete && image.naturalWidth > 0);
    }));
    const allResponses = await Promise.all(responses);
    assert.ok(allResponses.every((item) => item.status === 200));
    assert.deepEqual(errors, []);
    return { ...route, ...condition, initialBytes: initialResponses.reduce((sum, item) => sum + item.bytes, 0),
      scrolledBytes: allResponses.reduce((sum, item) => sum + item.bytes, 0), initialResponses, initialImages, layout, errors };
  } finally { await context.close(); }
}

async function interactions(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(baseUrl + "/cases", { waitUntil: "networkidle" });
    const pagination = page.getByRole("navigation", { name: "페이지", exact: true });
    await pagination.getByRole("button", { name: "2", exact: true }).click();
    assert.equal(await pagination.getByRole("button", { name: "2", exact: true }).getAttribute("aria-current"), "page");
    // 분야명이 아니라 실제 렌더링된 기술 분류의 첫 비전체 필터를 선택합니다.
    const filter = page.getByRole("group", { name: "주제 필터" }).getByRole("button").nth(1);
    await filter.click();
    await page.waitForFunction(() => location.search.includes("topic="));
    assert.equal(await filter.getAttribute("aria-pressed"), "true");
    assert.equal(await pagination.getByRole("button", { name: "1", exact: true }).getAttribute("aria-current"), "page");
    await page.locator(".insight-editorial-card img").first().scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll(".insight-editorial-card img")].every((img) => img.complete && img.naturalWidth > 0));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl + "/cases/lettuce-biomass-estimation", { waitUntil: "networkidle" });
    const glossary = page.locator(".article-glossary summary").first();
    await glossary.click();
    assert.equal(await glossary.locator("..").getAttribute("open"), "");
    await glossary.press("Enter");
    assert.equal(await glossary.locator("..").getAttribute("open"), null);
    await page.getByRole("button", { name: /목차/ }).click();
    await page.locator("#mobile-toc a[href='#pilot']").click();
    await page.waitForFunction(() => location.hash === "#pilot" && document.getElementById("pilot").getBoundingClientRect().top > 130);
    assert.equal(await page.getByRole("button", { name: /목차/ }).getAttribute("aria-expanded"), "false");
    await page.screenshot({ path: path.join(capturePath, "article-toc-390.png") });
    return "목록 페이지·필터·이미지 로딩, 용어 click/Enter, 모바일 목차 이동·접힘 통과";
  } finally { await page.close(); }
}

async function main() {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  try {
    const checks = [];
    for (const route of routes) for (const condition of conditions) {
      checks.push(await measure(browser, route, condition));
      console.log(`${phase}: ${route.name}/${condition.width}/DPR${condition.dpr}`);
    }
    for (const route of routes.slice(0, 2)) checks.push(await measure(browser, route, { width: 2880, height: 1080, dpr: 1 }));
    const result = { phase, date: "2026-10-20", baseUrl, captureDirectory, checks,
      images: inventory(publicDirectory), metric: "로컬 HTTP 이미지 응답 본문 바이트 합계. JS·HTML·헤더·실제 모바일 회선 속도는 제외. 매 조건 브라우저 캐시 분리, 서버 최적화 캐시는 남을 수 있음." };
    if (phase === "after") {
      const before = JSON.parse(fs.readFileSync(path.join(__dirname, "before.json"), "utf8"));
      assert.deepEqual(result.images, before.images, "원본 이미지 파일 변경 금지");
      result.comparison = checks.map((check, index) => {
        const previous = before.checks[index];
        assert.equal(check.route, previous.route);
        assert.equal(check.width, previous.width);
        assert.equal(check.dpr, previous.dpr);
        assert.equal(check.layout.length, previous.layout.length);
        check.layout.forEach((box, boxIndex) => {
          for (const key of ["x", "y", "width", "height"]) assert.ok(Math.abs(box[key] - previous.layout[boxIndex][key]) <= 1, `${check.name}/${check.width}: ${key} 배치 변화`);
        });
        assert.ok(check.initialBytes < previous.initialBytes, `${check.name}/${check.width}: 초기 이미지 용량 개선`);
        if (check.name === "home" && check.width < 1024) assert.ok(!check.initialResponses.some((item) => item.url.includes("labbridge-hero")), "숨겨진 모바일 hero 요청 금지");
        assert.ok(!check.initialResponses.some((item) => item.url.startsWith("/generated/")), "원본 PNG 직접 요청 금지");
        return { name: check.name, width: check.width, dpr: check.dpr,
          beforeBytes: previous.initialBytes, afterBytes: check.initialBytes,
          savedPercent: +((1 - check.initialBytes / previous.initialBytes) * 100).toFixed(1) };
      });
      result.interaction = await interactions(browser);
    }
    fs.writeFileSync(path.join(__dirname, `${phase}.json`), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ phase, checks: checks.length, imageFiles: result.images.length, captureDirectory, comparison: result.comparison }));
  } finally { await browser.close(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
