// 방문 통계 화면. API는 가상 응답만 쓰고 수집 스위치는 켜지 않습니다.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("C:/Users/Peter/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const target = "http://127.0.0.1:3000";
const shots = path.join(__dirname, "screens");
fs.mkdirSync(shots, { recursive: true });

const hidden = { status: "not_collected", value: null, note: "수집 전 검증용" };
const emptyReport = {
  generated_at: "2026-10-26T03:00:00Z",
  timezone: "Asia/Seoul",
  collection: { status: "not_collected", enabled: false, started_at: null, note: "수집이 꺼져 있고 기록이 없습니다. 측정 전 방문은 0으로 채우지 않습니다." },
  range: { preset: "7d", grain: "day", start: "2026-10-20", end: "2026-10-27" },
  visits: {
    visitors: { ...hidden, note: "사람 수는 세지 않습니다." },
    sessions: hidden,
    page_views: hidden,
    series: [],
    pages: [],
    referrer: { ...hidden, note: "유입 주소는 수집하지 않았습니다." },
    device: { ...hidden, note: "기기 유형은 수집하지 않았습니다." },
  },
  articles: [],
  registration: { status: "not_collected", note: "수집 전", create: null, resume: null, edit: null, reasons: [], signals: [] },
};

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Users/Peter/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe",
    headless: true,
    args: ["--disable-gpu"],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    const writes = [];
    await context.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const endpoint = url.pathname.replace("/api/v1", "");
      const headers = {
        "Access-Control-Allow-Origin": target,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "content-type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      };
      const reply = (body, status = 200) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(body) });
      if (request.method() === "OPTIONS") return reply({});
      if (request.method() !== "GET") {
        writes.push(endpoint);
        return reply({ detail: "QA prohibits writes" }, 403);
      }
      if (endpoint === "/auth/me") return reply({ user_id: 999, nickname: "가상 운영자", user_role: "researcher", signup_step: "done", user_photo: null });
      if (endpoint === "/admin/operations/access") return reply({ can_read_operations: true });
      if (endpoint === "/admin/insights/access") return reply({ can_manage_insights: true });
      if (endpoint === "/admin/operations/analytics") return reply(emptyReport);
      if (endpoint.startsWith("/admin/operations/researches/summary")) {
        return reply({
          registered: { status: "ready", value: 0, note: "검증용" },
          records: { status: "ready", value: 0, note: "검증용" },
          created: { status: "ready", value: 0, series: [], note: "검증용" },
          fields: { status: "ready", items: [], note: "검증용" },
          abandonment: { status: "not_collected", note: "수집 전" },
        });
      }
      if (endpoint.startsWith("/admin/operations/researches")) return reply({ total: 0, page: 1, page_size: 20, items: [] });
      return reply({});
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    const checks = [];

    await page.goto(target + "/admin?demo=1", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByRole("navigation", { name: "관리자 메뉴" }).waitFor();
    await page.getByRole("link", { name: "방문·인사이트 조회" }).click();
    await page.waitForURL("**/admin/analytics?demo=1");
    await page.getByRole("heading", { name: "방문 통계", exact: true }).waitFor();
    assert.equal(await page.getByRole("navigation", { name: "관리자 메뉴" }).getByRole("link").count(), 4);
    assert.equal(await page.getByRole("link", { name: "운영 요약" }).getAttribute("aria-current"), "page");
    await page.getByText("수집 전").first().waitFor();
    await page.getByText("128세션").waitFor();
    await page.getByRole("button", { name: "주", exact: true }).click();
    await page.waitForURL("**grain=week**");
    assert.ok(page.url().includes("demo=1"));

    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto(target + "/admin/analytics?demo=1", { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.getByRole("heading", { name: "방문 통계", exact: true }).waitFor();
      await page.getByText("128세션").waitFor();
      const size = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      assert.ok(size.scrollWidth <= width + 1, JSON.stringify(size));
      await page.screenshot({ path: path.join(shots, "analytics-" + width + ".png"), fullPage: true });
      checks.push({ name: "demo", width, ...size });
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(target + "/admin/analytics", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByText("측정 전 방문은 0으로 채우지 않습니다.").waitFor();
    assert.equal(await page.getByText("128세션").count(), 0);
    await page.screenshot({ path: path.join(shots, "analytics-not-collected-1440.png"), fullPage: true });

    await page.goto(target + "/admin/projects?tab=abandonment", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByRole("heading", { name: "등록 과정", exact: true }).waitFor();
    await page.getByRole("link", { name: "가상 데이터로 화면 살펴보기" }).click();
    await page.waitForURL("**demo=1**");
    assert.ok(page.url().includes("tab=abandonment"));
    await page.getByRole("heading", { name: "어느 단계까지 작성했을까요?" }).waitFor();

    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    fs.writeFileSync(path.join(__dirname, "verification.json"), JSON.stringify({ checks, writes: writes.length, errors, note: "실데이터 화면은 수집 전 가상 응답. 128은 데모에만 있습니다." }, null, 2));
    console.log(JSON.stringify({ checks: checks.length, writes: writes.length, errors }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
