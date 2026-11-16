// B10: CloudFront Function이 화면 주소를 S3 파일 이름으로 맞게 바꾸는지 봐요. (빌드 없이 실행)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { fillTemplate, isPlaceholder } = require("../scripts/build-cloudfront-function.cjs");

const ROOT = path.join(__dirname, "..");
const TEMPLATE = fs.readFileSync(path.join(ROOT, "..", "infra", "cloudfront", "url-rewrite.js"), "utf8");

// 실제 out/ 대신 쓰는 작은 화면 목록이에요.
const PAGES = [
  "/index", "/404", "/cases", "/cases/battery-life", "/community", "/community/new",
  "/community/guidelines", "/community/0", "/community/0/edit", "/workspace", "/workspace/0",
  "/admin/members", "/admin/members/0",
];

/** 완성된 함수 코드를 CloudFront처럼 실행할 수 있게 불러와요. */
function loadFunction(pages) {
  const code = fillTemplate(TEMPLATE, pages);
  return new Function(`${code}\nreturn { handler: handler, toS3Key: toS3Key };`)();
}

const { handler, toS3Key } = loadFunction(PAGES);

test("화면 주소는 .html 파일로 바꿔요", () => {
  assert.equal(toS3Key("/"), "/index.html");
  assert.equal(toS3Key("/cases"), "/cases.html");
  assert.equal(toS3Key("/cases/"), "/cases.html");
  assert.equal(toS3Key("/cases/battery-life"), "/cases/battery-life.html");
});

test("번호 화면은 0번 빈 화면으로 보내요", () => {
  assert.equal(toS3Key("/workspace/4"), "/workspace/0.html");
  assert.equal(toS3Key("/workspace/123/"), "/workspace/0.html");
  assert.equal(toS3Key("/community/7/edit"), "/community/0/edit.html");
  assert.equal(toS3Key("/admin/members/3"), "/admin/members/0.html");
});

test("진짜 화면이 번호 화면보다 먼저예요 (/community/new)", () => {
  assert.equal(toS3Key("/community/new"), "/community/new.html");
  assert.equal(toS3Key("/community/guidelines"), "/community/guidelines.html");
});

test("화면 이동 데이터(.txt)도 같은 규칙을 따라요", () => {
  assert.equal(toS3Key("/index.txt"), "/index.txt");
  assert.equal(toS3Key("/cases.txt"), "/cases.txt");
  assert.equal(toS3Key("/workspace/4.txt"), "/workspace/0.txt");
  assert.equal(toS3Key("/community/7/edit.txt"), "/community/0/edit.txt");
});

test("파일 주소는 그대로 둬요", () => {
  assert.equal(toS3Key("/_next/static/chunks/main-abc.js"), "/_next/static/chunks/main-abc.js");
  assert.equal(toS3Key("/photos/climate.jpg"), "/photos/climate.jpg");
  assert.equal(toS3Key("/icon.png"), "/icon.png");
});

test("없는 주소는 404 화면으로 보내요", () => {
  assert.equal(toS3Key("/nope"), "/404.html");
  assert.equal(toS3Key("/cases/unknown-case"), "/404.html");
  assert.equal(toS3Key("/workspace/4/extra"), "/404.html");
  assert.equal(toS3Key("/workspace//"), "/workspace.html");
});

test("handler는 request.uri만 바꿔서 그대로 돌려줘요", () => {
  const request = { uri: "/workspace/4", querystring: { _rsc: { value: "x" } }, headers: {} };
  const result = handler({ request });
  assert.equal(result, request);
  assert.equal(result.uri, "/workspace/0.html");
  assert.deepEqual(result.querystring, { _rsc: { value: "x" } });
});

test("번호 화면 목록이 placeholderParams를 쓰는 페이지와 같아요", () => {
  const appDir = path.join(ROOT, "src", "app");
  const expected = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "page.tsx" && fs.readFileSync(full, "utf8").includes("placeholderParams(")) {
        const route = path.relative(appDir, dir).split(path.sep).map((p) => (p.startsWith("[") ? "0" : p));
        expected.push(`/${route.join("/")}`);
      }
    }
  })(appDir);
  assert.equal(expected.length, 8);
  for (const page of expected) assert.ok(isPlaceholder(page), `${page} 는 0 자리가 있어야 해요`);
});

test("런타임에 없는 문법을 쓰지 않아요 (module·require·화살표 함수)", () => {
  assert.doesNotMatch(TEMPLATE, /\bmodule\.exports|\brequire\(|=>|\bconst |\blet /);
});
