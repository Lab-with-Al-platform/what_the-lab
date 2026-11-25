const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const vm = require("node:vm");

const filename = path.join(__dirname, "../src/lib/admin-nav.ts");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const mod = { exports: {} };
vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports });
const { adminHomeHref, permittedAdminMenu, adminFallbackPath } = mod.exports;
const shell = fs.readFileSync(path.join(__dirname, "../src/components/admin/admin-shell.tsx"), "utf8");

test("헤더 입구는 운영이 있으면 홈, 인사이트만 있으면 그 화면이다", () => {
  assert.equal(adminHomeHref(true, true), "/admin");
  assert.equal(adminHomeHref(true, false), "/admin");
  assert.equal(adminHomeHref(false, true), "/admin/insights");
  assert.equal(adminHomeHref(false, false), null);
});

test("사이드 메뉴는 권한을 알기 전에는 비우고, 있는 칸만 남긴다", () => {
  assert.equal(permittedAdminMenu(null).length, 0);
  assert.equal(
    permittedAdminMenu({ operations: true, insights: false })
      .map((item) => item.href)
      .join(","),
    "/admin,/admin/members,/admin/projects",
  );
  assert.equal(
    permittedAdminMenu({ operations: false, insights: true })
      .map((item) => item.href)
      .join(","),
    "/admin/insights",
  );
  assert.equal(permittedAdminMenu({ operations: true, insights: true }).length, 4);
});

test("없는 권한 주소는 있는 관리 화면으로 돌린다", () => {
  assert.equal(adminFallbackPath({ operations: false, insights: true }, "/admin"), "/admin/insights");
  assert.equal(adminFallbackPath({ operations: false, insights: true }, "/admin/members"), "/admin/insights");
  assert.equal(adminFallbackPath({ operations: true, insights: false }, "/admin/insights"), "/admin");
  assert.equal(adminFallbackPath({ operations: true, insights: true }, "/admin"), null);
});

test("관리자 뼈대는 권한 확인 전에 전체 메뉴를 그리지 않는다", () => {
  assert.match(shell, /permittedAdminMenu\(access\)/);
  assert.match(shell, /adminFallbackPath\(access, pathname\)/);
  assert.doesNotMatch(shell, /!access \|\| access\[item\.area\]/);
});
