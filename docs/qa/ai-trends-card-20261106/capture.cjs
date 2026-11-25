// 같은 화면 폭에서 변경 전후 카드를 비교하고 실제 이미지 로딩을 확인합니다.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function captureCards() {
  const phase = process.argv[2];
  assert.ok(["before", "after"].includes(phase));
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    headless: true,
  });
  const results = [];
  try {
    for (const width of [1440, 768, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 768 ? 1024 : 900 },
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const response = await page.goto(process.env.BASE_URL || "http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
      assert.equal(response.status(), 200);
      await page.evaluate(() => document.fonts.ready);
      const cards = page.locator("#paths .home-entry-card");
      assert.equal(await cards.count(), 3);
      // 모바일에서는 아래 카드가 지연 로딩되므로 검사할 카드까지 먼저 스크롤합니다.
      await cards.nth(1).scrollIntoViewIfNeeded();
      const image = cards.nth(1).locator("img");
      await image.evaluate((element) => element.decode());
      const imageState = await image.evaluate((element) => ({
        src: element.getAttribute("src"),
        currentSrc: element.currentSrc,
        naturalWidth: element.naturalWidth,
        naturalHeight: element.naturalHeight,
      }));
      assert.ok(imageState.naturalWidth > 0);
      assert.ok(imageState.src.includes(phase === "after" ? "ai-trends-card-v2.webp" : "ai-trends-card-v1.jpg"));
      const imageResponse = await context.request.get(imageState.currentSrc);
      assert.equal(imageResponse.status(), 200);
      const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert.equal(overflowing, false);
      assert.equal(await cards.nth(1).locator(".home-entry-card__link").getAttribute("href"), "/trends");
      assert.equal(await cards.nth(1).locator(".home-entry-card__tag").count(), 4);
      const bounds = await cards.evaluateAll((elements) => elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }));
      // 1열에서도 세 카드가 모두 보이도록 섹션 전체를 캡처합니다.
      await page.locator("#paths").screenshot({ path: path.join(__dirname, `${phase}-${width}.png`), animations: "disabled" });
      assert.deepEqual(errors, []);
      results.push({ width, bounds, imageState, imageStatus: imageResponse.status(), overflowing, errors });
      await context.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(__dirname, `${phase}.json`), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify(results));
}

captureCards().catch((error) => { console.error(error); process.exitCode = 1; });
