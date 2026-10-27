// 협업 요청 탭. API는 가상 응답만 쓰고 요청 상태를 바꾸지 않습니다.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("C:/Users/Peter/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const target = "http://127.0.0.1:3000";
const shots = path.join(__dirname, "screens");
fs.mkdirSync(shots, { recursive: true });

const report = {
  table_ready: true,
  note: "상태 칸은 지금 남아 있는 요청입니다. 기간에 생긴 요청을 시작 수로 나누지 않습니다.",
  counts: [
    { status: "pending", label: "답변 대기", value: 2, state: "ready", note: "대기" },
    { status: "accepted", label: "전문가 수락", value: 1, state: "ready", note: "수락" },
    { status: "started", label: "협업 시작", value: 1, state: "ready", note: "시작은 완료가 아닙니다." },
    { status: "rejected", label: "거절", value: 0, state: "ready", note: "거절" },
    { status: "expired", label: "기한 만료", value: 0, state: "ready", note: "만료" },
    { status: "canceled", label: "취소", value: 0, state: "ready", note: "취소" },
  ],
  created_in_period: { status: "ready", value: 1, note: "이 기간에 생긴 협업 요청입니다. 수락·시작 비율이 아닙니다." },
  missing: [
    { id: "applications", label: "참여 신청", status: "not_linked", value: null, note: "표가 없습니다." },
    { id: "milestones", label: "마일스톤", status: "not_linked", value: null, note: "표가 없습니다." },
    { id: "completion", label: "완료", status: "not_linked", value: null, note: "표가 없습니다." },
    { id: "evaluation", label: "평가", status: "not_linked", value: null, note: "표가 없습니다." },
  ],
  total: 1,
  page: 1,
  page_size: 20,
  items: [{
    request_id: 9,
    research_id: 7,
    title: "검증용 연구",
    owner_nickname: "검증 연구자",
    expert_id: 12,
    expert_nickname: "검증 전문가",
    status: "started",
    status_label: "협업 시작",
    created_at: "2026-10-20T03:00:00Z",
    responded_at: "2026-10-21T03:00:00Z",
    started_at: "2026-10-22T03:00:00Z",
    expires_at: "2026-10-27T03:00:00Z",
  }],
};

async function main() {
  const anonymous = await fetch("http://127.0.0.1:8000/api/v1/admin/operations/collaboration");
  assert.equal(anonymous.status, 401);
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
      const headers = { "Access-Control-Allow-Origin": target, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "GET,OPTIONS" };
      const reply = (body, status = 200) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(body) });
      if (request.method() === "OPTIONS") return reply({});
      if (request.method() !== "GET") {
        writes.push(endpoint);
        return reply({ detail: "QA prohibits writes" }, 403);
      }
      if (endpoint === "/auth/me") return reply({ user_id: 999, nickname: "가상 운영자", user_role: "researcher", signup_step: "done", user_photo: null });
      if (endpoint === "/admin/operations/access") return reply({ can_read_operations: true });
      if (endpoint === "/admin/insights/access") return reply({ can_manage_insights: true });
      if (endpoint === "/admin/operations/collaboration") return reply(report);
      if (endpoint.startsWith("/admin/operations/researches/summary")) {
        return reply({
          registered: { status: "ready", value: 1, note: "검증용" },
          records: { status: "ready", value: 1, note: "검증용" },
          created: { status: "ready", value: 0, series: [], note: "검증용" },
          fields: { status: "ready", items: [], note: "검증용" },
          abandonment: { status: "not_collected", note: "수집 전" },
        });
      }
      if (endpoint.startsWith("/admin/operations/researches")) return reply({ total: 0, page: 1, page_size: 20, items: [] });
      if (endpoint === "/admin/operations/summary") {
        return reply({
          members: { roles: { note: "", counts: { researcher: 0, expert: 0, unset: 0 } } },
          unavailable: [{ id: "collaboration", status: "not_linked", label: "협업 프로젝트", note: "협업 요청 탭에서 봅니다." }],
          generated_at: "2026-10-26T03:00:00Z",
        });
      }
      return reply({});
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    const checks = [];
    await page.goto(target + "/admin?demo=1", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByRole("link", { name: "협업 프로젝트" }).click();
    await page.waitForURL("**tab=requests**");
    assert.ok(page.url().includes("demo=1"));
    await page.getByRole("heading", { name: "지금 요청은 어느 상태인가요?" }).waitFor();
    await page.getByText("협업 시작", { exact: true }).first().waitFor();
    await page.getByText("시작 건수를 성공률로 나누지 않습니다.").waitFor();
    assert.equal(await page.getByRole("heading", { name: "매칭 성공률" }).count(), 0);
    await page.getByRole("button", { name: "답변 대기", exact: true }).click();
    await page.waitForURL("**request_status=pending**");
    assert.ok(page.url().includes("demo=1"));

    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto(target + "/admin/projects?tab=requests&demo=1", { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.getByRole("table", { name: "협업 요청 목록" }).waitFor();
      const size = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      assert.ok(size.scrollWidth <= width + 1, JSON.stringify(size));
      await page.screenshot({ path: path.join(shots, "requests-" + width + ".png"), fullPage: true });
      checks.push({ width, ...size });
    }

    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    fs.writeFileSync(path.join(__dirname, "verification.json"), JSON.stringify({ checks, writes: 0, errors, anonymous: 401 }, null, 2));
    console.log(JSON.stringify({ checks: checks.length, writes: 0, errors }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
