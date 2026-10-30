const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
  path.join(__dirname, "../src/components/admin/operations-members.tsx"),
  "utf8",
);
const types = fs.readFileSync(
  path.join(__dirname, "../src/lib/operations-admin.ts"),
  "utf8",
);

test("회원 상세는 서버 관리자 API로만 권한을 바꾸고 데모에서는 버튼을 숨긴다", () => {
  assert.match(source, /\/admin\/operations\/members\/\$\{userId\}\/admin/);
  assert.match(source, /expected_is_admin/);
  assert.match(source, /관리자 권한 부여/);
  assert.match(source, /!demo/);
  assert.doesNotMatch(source, /INSIGHT_ADMIN_DISCORD_IDS/);
  assert.match(types, /function auditActionLabel/);
  assert.match(types, /grant_admin/);
});
