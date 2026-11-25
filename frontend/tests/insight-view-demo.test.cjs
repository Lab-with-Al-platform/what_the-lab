const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src/lib/insight-view-demo.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const mod = { exports: {} };
vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, Date, URLSearchParams });
const demo = mod.exports;

const report = demo.demoStatistics({ preset: "30d", grain: "day" });
assert.ok(report.articles.total >= 20, "가상 글은 20개 이상이어야 합니다.");
const seriesSum = report.series.reduce((sum, point) => sum + point.count, 0);
assert.equal(seriesSum, report.cards.period_views.value);
let articleSum = 0;
const pages = Math.ceil(report.articles.total / 6);
for (let page = 1; page <= pages; page += 1) {
  const slice = demo.demoStatistics({ preset: "30d", page });
  articleSum += slice.articles.items.reduce((sum, item) => sum + item.period_views.value, 0);
  assert.ok(slice.articles.items.length <= 6);
}
assert.equal(articleSum, report.cards.period_views.value);
assert.equal(report.kinds.reduce((sum, item) => sum + item.value, 0), report.cards.period_views.value);

const searched = demo.demoStatistics({ preset: "30d", q: "가상 사례 2" });
assert.equal(searched.cards.period_views.value, report.cards.period_views.value);
assert.ok(searched.articles.total < report.articles.total);

const week = demo.demoStatistics({ preset: "30d", grain: "week" });
assert.equal(week.series.reduce((sum, point) => sum + point.count, 0), report.cards.period_views.value);
const month = demo.demoStatistics({ preset: "month", grain: "month" });
assert.equal(month.series.reduce((sum, point) => sum + point.count, 0), month.cards.period_views.value);

const detail = demo.demoDetail("demo-2", "30d", "day");
assert.equal(detail.series.reduce((sum, point) => sum + point.count, 0), detail.period_views.value);
assert.equal(demo.demoDetail("missing"), null);

const workspace = fs.readFileSync(path.join(root, "src/components/admin/insight-workspace.tsx"), "utf8");
assert.equal(workspace.includes("scope=stats"), false);
assert.equal(workspace.includes('"stats"'), true);
assert.match(workspace, /order === "period" \|\| order === "cumulative"/);

console.log("insight view demo checks passed");
