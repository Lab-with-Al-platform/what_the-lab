const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/admin-demo.ts"), "utf8");
const moduleResult = { exports: {} };
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
vm.runInNewContext(compiled.outputText, { module: moduleResult, exports: moduleResult.exports, Date, URLSearchParams });
const demo = moduleResult.exports;
const progressSource = fs.readFileSync(path.join(__dirname, "../src/lib/operations-admin.ts"), "utf8");
const progressModule = { exports: {} };
const progressCompiled = ts.transpileModule(progressSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
vm.runInNewContext(progressCompiled.outputText, { module: progressModule, exports: progressModule.exports, Date, Intl });
const progress = progressModule.exports;

test("데모 기간의 계정 생성 카드와 추이 합계가 일치한다", () => {
  for (const preset of ["today", "7d", "30d", "month"]) {
    const result = demo.demoSummary(preset);
    assert.equal(result.members.accounts_created.value, result.members.accounts_created.series.reduce((sum, point) => sum + point.count, 0));
    assert.equal(result.researches.created.value, result.researches.created.series.reduce((sum, point) => sum + point.count, 0));
  }
});
test("데모의 가입 완료·진행 계정과 연구 상태 합계가 일치한다", () => {
  const summary = demo.demoSummary();
  assert.equal(summary.members.completed.value + summary.members.in_progress.value, demo.DEMO_MEMBERS.length);
  assert.equal(summary.members.completed.active + summary.members.completed.suspended, summary.members.completed.value);
  assert.equal(summary.researches.registered.value, demo.DEMO_RESEARCHES.filter(item => item.status === "registered").length);
});
test("가상 회원의 검색·역할·페이지 필터가 동작한다", () => {
  const first = demo.DEMO_MEMBERS[0];
  const result = demo.demoMembers(new URLSearchParams({ q:String(first.user_id) }));
  assert.equal(result.total, 1);
  const experts = demo.demoMembers(new URLSearchParams({ role:"expert", page:"2" }));
  assert.ok(experts.items.every(item => item.role === "expert"));
  assert.equal(experts.page, 2);
  assert.ok(experts.items.length <= experts.page_size);
});
test("연구 상태와 기간 필터를 함께 적용한다", () => {
  const result = demo.demoResearches(new URLSearchParams({ status:"draft", created_start:"2026-10-20", created_end:"2026-10-27" }));
  assert.ok(result.total > 0);
  assert.ok(result.items.every(item => item.status === "draft" && item.created_at >= "2026-10-20" && item.created_at < "2026-10-27"));
});
test("가상 상세에 원문·연락처가 없으며 서버 전송 코드를 포함하지 않는다", () => {
  const detail = demo.demoResearchDetail(String(demo.DEMO_RESEARCHES[0].research_id));
  assert.equal(detail.body_access.status, "hidden");
  assert.equal(detail.description, undefined);
  assert.equal(detail.email, undefined);
  assert.doesNotMatch(source, /fetch\(|requestApi|localStorage|sessionStorage/);
});

test("등록 여부만으로 진행 상태를 만들지 않고 구형 API도 처리한다", () => {
  assert.equal(progress.researchProgress({ status: "registered" }).code, "not_linked");
  assert.equal(progress.researchProgress({ status: "draft" }).code, "not_applicable");
  assert.equal(progress.researchProgress({ status: "draft", progress: { code: "in_progress", note: "잘못된 예시" } }).code, "not_applicable");
  assert.equal(progress.researchProgress({ status: "registered", progress: { code: "unknown", note: "" } }).label, "연동 전");
});

test("가상 연구는 각 진행 상태로 검색되며 작성 상태·기간 필터와 조합된다", () => {
  const workflowStates = progress.RESEARCH_PROGRESS_STATES.filter(state => !["not_applicable", "not_linked"].includes(state.code));
  assert.equal(workflowStates.length, 9);
  for (const state of workflowStates) {
    const result = demo.demoResearches(new URLSearchParams({ progress_status: state.code, status: "registered", created_start: "2026-10-20", created_end: "2026-10-27" }));
    assert.ok(result.total > 0, state.code);
    assert.equal(progress.researchProgress(result.items[0]).label, state.label);
    assert.ok(result.items.every(item => item.progress.code === state.code && item.status === "registered" && item.created_at >= "2026-10-20" && item.created_at < "2026-10-27"));
  }
  const drafts = demo.demoResearches(new URLSearchParams({ progress_status: "not_applicable" }));
  assert.ok(drafts.items.every(item => item.status === "draft"));
  assert.equal(demo.demoResearches(new URLSearchParams({ status: "draft", progress_status: "in_progress" })).total, 0);
  const detail = demo.demoResearchDetail("20001");
  assert.equal(detail.progress.code, demo.DEMO_RESEARCHES[1].progress.code);
});
