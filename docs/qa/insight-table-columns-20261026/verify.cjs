// 인사이트 목록 칸 비율. API는 가상 응답만 사용합니다.
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("C:/Users/Peter/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const target = "http://127.0.0.1:3000";
const item = {
  id: "qa-1", kind: "trend", status: "published", version: 1, current_revision: 1, approved_revision: 1,
  scheduled_for: null, publication_id: "pub-1", title: "딥러닝 기반 의료 영상에서 경계를 나누는 긴 제목입니다",
  summary: "검증", content_stage: "legacy_public", research_field: "비전",
  keywords: ["의료 영상 분석", "딥러닝 세그멘테이션", "추가 키워드"], is_published: true, has_correction: false,
  registered_at: "2026-10-22T03:00:00Z", published_at: "2026-10-22T03:00:00Z", source_title: "검증", doi: null,
};
const list = { items: [item], total: 1, page: 1, counts: { all: 1, collected: 1, published: 1 }, categories: ["비전"], keywords: item.keywords };

async function widths(page) {
  return page.locator("table[aria-label='인사이트 통합 목록'] th").evaluateAll((cells) => cells.map((cell) => ({ label: cell.textContent.trim(), width: Math.round(cell.getBoundingClientRect().width) })));
}

async function main() {
  const browser = await chromium.launch({ executablePath: "C:/Users/Peter/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe", headless: true, args: ["--disable-gpu"] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const endpoint = new URL(request.url()).pathname.replace("/api/v1", "");
      const headers = { "Access-Control-Allow-Origin": target, "Access-Control-Allow-Credentials": "true" };
      const reply = (body, status = 200) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(body) });
      if (request.method() === "OPTIONS") return reply({});
      if (endpoint === "/auth/me") return reply({ user_id: 999, nickname: "가상 운영자", user_role: "researcher", signup_step: "done", user_photo: null });
      if (endpoint === "/admin/operations/access") return reply({ can_read_operations: true });
      if (endpoint === "/admin/insights/access") return reply({ can_manage_insights: true });
      if (endpoint.startsWith("/admin/insights/workspace")) return reply(list);
      if (endpoint.startsWith("/admin/insights/statistics/counts")) return reply({ items: { "pub-1": { period_views: { status: "ready", value: 12, note: "선택 기간" }, cumulative_views: { status: "ready", value: 48, note: "측정 이후 누적" } } } });
      return reply({});
    });
    const page = await context.newPage();
    const seen = {};
    for (const [name, url] of [["all", "/admin/insights"], ["collected", "/admin/insights?tab=collected"], ["published", "/admin/insights?tab=published"]]) {
      await page.goto(target + url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.getByRole("table", { name: "인사이트 통합 목록" }).waitFor();
      await page.getByRole("link", { name: "통계 보기" }).waitFor();
      const columns = await widths(page);
      seen[name] = columns;
      const byLabel = Object.fromEntries(columns.map((column) => [column.label, column.width]));
      assert.ok(byLabel["제목"] > byLabel["연구 분야"], name + " title");
      assert.ok(byLabel["연구 분야"] > byLabel["상태"], name + " field");
      assert.ok(byLabel["키워드"] > byLabel["유형"], name + " keywords");
      assert.ok(byLabel["통계"] < byLabel["기간/누적"], name + " stat");
      await page.getByRole("cell", { name: "12 / 48" }).waitFor();
      assert.equal(await page.getByRole("link", { name: "통계 보기" }).locator("svg").count(), 1);
      if (name === "published") await page.screenshot({ path: path.join(__dirname, "published-1440.png"), fullPage: false });
    }
    assert.deepEqual(seen.all.map((column) => column.label), seen.collected.map((column) => column.label));
    assert.deepEqual(seen.all.map((column) => column.width), seen.published.map((column) => column.width));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(target + "/admin/insights?tab=published", { waitUntil: "domcontentloaded" });
    await page.getByRole("table", { name: "인사이트 통합 목록" }).waitFor();
    await page.screenshot({ path: path.join(__dirname, "published-390.png"), fullPage: false });
    console.log(JSON.stringify(seen.published));
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
