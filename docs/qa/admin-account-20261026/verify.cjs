const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("C:/Users/Peter/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const target = "http://127.0.0.1:3000";
const shots = path.join(__dirname, "screens");
fs.mkdirSync(shots, { recursive: true });
const detail = {
  user_id: 50, nickname: "가상회원", role: "researcher", role_label: "연구자", affiliation: null,
  signup_step: "done", signup_step_label: "완료", status: "active", status_label: "정상",
  created_at: "2026-10-01T03:00:00Z", is_admin: false, researches: [],
  actions: { status: "ready", next_status: "suspended", note: "정지는 로그인만 막습니다." },
  audit: { status: "ready", note: "성공한 정지·해제만 보여 줍니다.", items: [] },
};

async function main() {
  const browser = await chromium.launch({ executablePath: "C:/Users/Peter/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe", headless: true, args: ["--disable-gpu"] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const calls = [];
    await context.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      calls.push({ method: request.method(), path: url.pathname });
      const reply = (body, status = 200) => route.fulfill({ status, headers: { "Access-Control-Allow-Origin": target, "Access-Control-Allow-Credentials": "true" }, contentType: "application/json", body: JSON.stringify(body) });
      if (request.method() === "OPTIONS") return reply({});
      if (url.pathname.endsWith("/auth/me")) return reply({ user_id: 9, nickname: "가상 운영자", user_role: "researcher", signup_step: "done", user_photo: null });
      if (url.pathname.endsWith("/operations/access")) return reply({ can_read_operations: true });
      if (url.pathname.endsWith("/insights/access")) return reply({ can_manage_insights: true });
      if (request.method() === "POST" && url.pathname.endsWith("/members/50/status")) {
        const body = request.postDataJSON();
        assert.equal(body.expected_status, "active");
        assert.equal(body.next_status, "suspended");
        assert.ok(body.reason && body.idempotency_key);
        return reply({ user_id: 50, status: "suspended", previous_status: "active", replayed: false, action: "suspend" });
      }
      if (url.pathname.endsWith("/members/50")) {
        return reply({ ...detail, status: calls.some((call) => call.method === "POST") ? "suspended" : "active", status_label: calls.some((call) => call.method === "POST") ? "정지" : "정상", actions: { status: "ready", next_status: calls.some((call) => call.method === "POST") ? "active" : "suspended", note: "갱신됨" }, audit: { status: "ready", note: "성공한 기록", items: calls.some((call) => call.method === "POST") ? [{ actor_user_id: 9, action: "suspend", before_status: "active", after_status: "suspended", reason: "가상 사유", notice: "", created_at: "2026-10-26T07:00:00Z" }] : [] } });
      }
      return reply({});
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(target + "/admin/members/50", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByRole("button", { name: "계정 정지" }).click();
    await page.getByRole("dialog").getByText("연구 등록과 협업 기록은 지우거나 취소하지 않고").waitFor();
    await page.screenshot({ path: path.join(shots, "confirm-1440.png") });
    await page.getByLabel("내부 사유").fill("가상 사유");
    await page.getByRole("button", { name: "확인" }).click();
    await page.getByRole("cell", { name: "정지" }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(shots, "detail-390.png"), fullPage: true });
    assert.deepEqual(errors, []);
    assert.equal(calls.filter((call) => call.method === "POST").length, 1);
    assert.equal(calls.some((call) => call.path.includes("research")), false);
    console.log(JSON.stringify({ posts: 1, errors: 0 }));
  } finally {
    await browser.close();
  }
}
main().catch((error) => { console.error(error); process.exit(1); });
