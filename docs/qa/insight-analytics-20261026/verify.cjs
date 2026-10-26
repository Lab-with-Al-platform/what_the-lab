// 인사이트 조회수 화면을 가상 API로만 확인합니다. 운영 DB와 수집 엔드포인트에는 쓰지 않습니다.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("C:/Users/Peter/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const target = "http://127.0.0.1:3000";
const shots = path.join(__dirname, "screens");
fs.mkdirSync(shots, { recursive: true });

const published = Array.from({ length: 8 }, (_, index) => ({
  id: `candidate-${index + 1}`,
  publication_id: `pub-${index + 1}`,
  kind: index % 3 === 0 ? "trend" : "case",
  title: index === 1
    ? "가상 게시글 2 · 아주 긴 제목이 목록에서 말줄임되고 전체 제목은 포인터를 올렸을 때 보이는지 확인하는 문장"
    : `가상 게시글 ${index + 1}`,
  summary: "브라우저 검증용 가상 원고",
  research_field: index % 2 ? "연구 도구" : "생명과학",
  keywords: ["이미지 분석", "연구 검토"],
  source_title: "가상 자료",
  doi: null,
  status: "published",
  version: 1,
  current_revision: 1,
  approved_revision: 1,
  scheduled_for: null,
  content_stage: "article_draft",
  is_published: true,
  has_correction: false,
  registered_at: "2026-10-20T03:00:00Z",
  published_at: "2026-10-21T03:00:00Z",
}));
const draft = { ...published[0], id: "candidate-draft", publication_id: null, title: "아직 게시하지 않은 후보", status: "draft", is_published: false, approved_revision: null, published_at: null };
function viewOf(number) {
  if (!number || number === 1) {
    return { period_views: { status: "not_collected", value: null, note: "조회수 수집이 꺼져 있습니다." }, cumulative_views: { status: "not_collected", value: null, note: "조회수 수집이 꺼져 있습니다." } };
  }
  return { period_views: { status: "ready", value: number === 3 ? 0 : number * 11, note: "선택 기간 조회수" }, cumulative_views: { status: "ready", value: number * 20, note: "측정 이후 누적 조회수" } };
}
const settings = { version: 0, saved: false, updated_at: null, execution_available: false, config: { interval_days: 7, preferred_time: "09:00", timezone: "Asia/Seoul", lookback_days: 30, max_items: 3, keywords: ["가상 연구"], sources: [{ name: "가상 출처", url: "https://example.org", selected: true, content_kinds: ["case"] }], discovery_policy: { enabled: true, target_candidates: 1, case_max_days: 90, news_max_days: 60, explanation_max_days: 90, max_source_requests: 10, max_run_seconds: 60, date_basis: "published", historical_discovery: "separate_manual" } } };

function metric(value, note) {
  return { status: "ready", value, note };
}

async function main() {
  const browser = await chromium.launch({ executablePath: "C:/Users/Peter/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe", headless: true, args: ["--disable-gpu"] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const errors = [];
    const calls = [];
    await context.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const endpoint = url.pathname.replace("/api/v1", "");
      calls.push({ method: request.method(), endpoint, search: url.search });
      const headers = { "Access-Control-Allow-Origin": target, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS" };
      const reply = (body, status = 200) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(body) });
      if (request.method() === "OPTIONS") return reply({});
      if (request.method() !== "GET") return reply({ detail: "QA prohibits writes" }, 403);
      if (endpoint === "/auth/me") return reply({ user_id: 999, nickname: "가상 운영자", user_role: "researcher", signup_step: "done", user_photo: null });
      if (endpoint === "/admin/operations/access") return reply({ can_read_operations: true });
      if (endpoint === "/admin/insights/access") return reply({ can_manage_insights: true });
      if (endpoint === "/admin/insights/workspace") {
        assert.notEqual(url.searchParams.get("scope"), "stats");
        const page = Number(url.searchParams.get("page") || "1");
        const scope = url.searchParams.get("scope");
        let items = scope === "published" ? published : [draft, ...published];
        if (url.searchParams.get("order") === "period") {
          items = [...items].sort((left, right) => (viewOf(Number(String(right.publication_id || "").replace("pub-", ""))).period_views.value ?? -1) - (viewOf(Number(String(left.publication_id || "").replace("pub-", ""))).period_views.value ?? -1));
        }
        const slice = items.slice((page - 1) * 6, page * 6);
        return reply({ items: slice, total: items.length, page, counts: { all: 9, collected: 1, published: 8 }, categories: ["생명과학", "연구 도구"], keywords: ["이미지 분석"] });
      }
      if (endpoint === "/admin/insights/statistics/counts") {
        const ids = (url.searchParams.get("ids") || "").split(",").filter(Boolean);
        const items = {};
        for (const id of ids) items[id] = viewOf(Number(id.replace("pub-", "")));
        return reply({ collection: { status: "ready", enabled: false, started_at: null, timezone: "Asia/Seoul", generated_at: "2026-10-26T03:00:00Z", note: "가상 API" }, items });
      }
      if (endpoint === "/admin/insights/statistics") {
        return reply({
          collection: { status: "not_collected", enabled: false, started_at: null, timezone: "Asia/Seoul", generated_at: "2026-10-26T03:00:00Z", note: "조회수 수집이 꺼져 있습니다." },
          range: { preset: "30d", start: "2026-09-27", end: "2026-10-26", includes_today: true, timezone: "Asia/Seoul", note: "오늘이 포함되어 집계가 진행 중입니다." },
          cards: { published: metric(8, "현재 게시글"), period_views: { status: "not_collected", value: null, note: "수집 전" }, cumulative_views: { status: "not_collected", value: null, note: "수집 전" }, viewed_articles: { status: "not_collected", value: null, note: "수집 전" } },
          series: [], kinds: [], top: [], articles: { items: [], total: 0, page: 1, page_size: 6, search_applies_to: "articles" },
        });
      }
      if (endpoint.startsWith("/admin/insights/statistics/")) {
        return reply({ detail: "데모 상세는 브라우저에서 계산합니다." }, 404);
      }
      if (endpoint.includes("collection-settings")) return reply(settings);
      if (endpoint.includes("keywords")) return reply({ items: [] });
      if (endpoint.startsWith("/admin/operations")) return reply({ total: 0, page: 1, page_size: 20, items: [] });
      return reply({});
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    const checks = [];
    async function shot(name, width) {
      await page.waitForTimeout(500);
      const size = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      assert.ok(size.scrollWidth <= width + 1, `${name} overflow ${JSON.stringify(size)}`);
      await page.screenshot({ path: path.join(shots, `${name}-${width}.png`), fullPage: true });
      checks.push({ name, width, ...size });
    }
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: width === 768 ? 1024 : width === 390 ? 844 : 900 });
      await page.goto(`${target}/admin/insights?tab=published&viewPreset=30d`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.getByRole("table", { name: "인사이트 통합 목록" }).waitFor();
      await page.getByRole("columnheader", { name: "기간 조회수" }).waitFor();
      await shot("published", width);
      await page.goto(`${target}/admin/insights?tab=stats&statsDemo=1&viewPreset=30d`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.getByText("디자인 데모 · 가상 데이터 · 서버에 저장하지 않음").waitFor();
      await page.getByRole("heading", { name: "조회 추이" }).waitFor();
      await shot("stats", width);
      await page.goto(`${target}/admin/insights/statistics/demo-2?statsDemo=1&preset=30d`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.getByRole("heading", { level: 1 }).waitFor();
      await page.locator("section").filter({ hasText: "선택 기간 조회수" }).first().waitFor();
      await shot("detail", width);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${target}/admin/insights?tab=published&viewPreset=30d`);
    await page.getByRole("table", { name: "인사이트 통합 목록" }).waitFor();
    const menu = page.getByRole("navigation", { name: "관리자 메뉴" });
    assert.equal(await menu.getByRole("link").count(), 4);
    const tabs = page.getByRole("navigation", { name: "인사이트 관리 탭" });
    assert.equal(await tabs.getByRole("button").count(), 5);
    assert.equal((await tabs.getByRole("button", { name: "통계", exact: true }).innerText()).trim(), "통계");
    await page.getByRole("button", { name: "오늘", exact: true }).click();
    await page.waitForURL("**viewPreset=today**");
    await page.getByText("상세 필터").click();
    await page.getByLabel("등록·수집일 정렬").selectOption("period");
    await page.waitForTimeout(400);
    assert.ok(calls.some((call) => call.endpoint === "/admin/insights/workspace" && call.search.includes("order=period")));
    await page.getByRole("button", { name: "2페이지" }).click();
    await page.getByRole("cell", { name: "0", exact: true }).waitFor();
    await page.getByRole("cell", { name: "—", exact: true }).first().waitFor();
    await page.getByRole("link", { name: "통계 보기" }).first().click();
    await page.waitForURL("**/admin/insights/statistics/**");
    await page.getByRole("link", { name: "목록으로" }).click();
    await page.waitForURL("**tab=published**");

    await tabs.getByRole("button", { name: "통계", exact: true }).click();
    await page.getByRole("button", { name: "디자인 데모", exact: true }).click();
    await page.getByText("디자인 데모 · 가상 데이터 · 서버에 저장하지 않음").waitFor();
    const card = page.locator("section").filter({ hasText: "선택 기간 조회수" }).first();
    const before = await card.innerText();
    await page.getByLabel("성과 목록 제목 검색").fill("가상 사례 2");
    await page.getByRole("button", { name: "검색", exact: true }).click();
    await page.waitForTimeout(300);
    assert.equal(await card.innerText(), before);
    await page.getByRole("link", { name: "통계 보기" }).first().click();
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.getByRole("link", { name: "목록으로" }).click();
    await page.waitForURL("**tab=stats**");
    await page.getByRole("heading", { name: "조회 추이" }).waitFor();

    await page.goto(`${target}/admin/insights`);
    await tabs.getByRole("button", { name: "자동수집 설정", exact: true }).click();
    await page.getByText("검색 키워드", { exact: false }).waitFor();
    await page.locator("textarea").first().fill("가상 변경");
    page.once("dialog", (dialog) => dialog.dismiss());
    await tabs.getByRole("button", { name: "통계", exact: true }).click();
    assert.equal(await tabs.getByRole("button", { name: "자동수집 설정", exact: true }).getAttribute("aria-current"), "page");

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "전체 목록", exact: false }).click();
    await page.getByRole("button", { name: "아직 게시하지 않은 후보" }).click();
    await page.getByRole("dialog").waitFor();
    assert.equal(await page.getByRole("dialog").getByRole("link", { name: "통계 보기" }).count(), 0);
    await page.getByRole("button", { name: "닫기", exact: true }).click();

    assert.deepEqual(errors, []);
    assert.equal(calls.filter((call) => !["GET", "OPTIONS"].includes(call.method)).length, 0);
    assert.equal(calls.some((call) => call.search.includes("scope=stats")), false);
    fs.writeFileSync(path.join(__dirname, "verification.json"), JSON.stringify({ checks, writes: 0, errors, note: "가상 API. 실제 Discord·운영 DB 쓰기는 하지 않음." }, null, 2));
    console.log(JSON.stringify({ checks: checks.length, writes: 0, errors }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
