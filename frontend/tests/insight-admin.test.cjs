const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function loadModule(file, globals = {}) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.resolve(__dirname, "../src/lib", file), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  vm.runInNewContext(outputText, { module, exports: module.exports, require, URL, Date, ...globals });
  return module.exports;
}
const helpers = loadModule("admin-insights.ts");

test("기간 확장 미리보기는 유형별 상한까지 표시하고 고정 모드에서는 늘리지 않는다", () => {
  const profiles = helpers.DISCOVERY_PROFILES;
  assert.equal(helpers.discoveryWindowLabels(profiles[0].stages, 365, true, 30), "30일 → 60일 → 90일 → 180일 → 365일");
  assert.equal(helpers.discoveryWindowLabels(profiles[1].stages, 90, true, 30), "30일 → 60일 → 90일");
  assert.equal(helpers.discoveryWindowLabels(profiles[2].stages, 365, true, 30), "30일 → 90일 → 365일");
  assert.equal(helpers.discoveryWindowLabels(profiles[0].stages, 90, true, 30), "30일 → 60일 → 90일");
  assert.equal(helpers.discoveryWindowLabels(profiles[0].stages, 365, false, 120), "120일");
});

test("페이지 번호는 처음·가운데·끝에서 최대 다섯 개의 유효한 범위만 표시한다", () => {
  assert.equal(helpers.visiblePageNumbers(1, 7).join(","), "1,2,3,4,5");
  assert.equal(helpers.visiblePageNumbers(4, 7).join(","), "2,3,4,5,6");
  assert.equal(helpers.visiblePageNumbers(7, 7).join(","), "3,4,5,6,7");
  assert.equal(helpers.visiblePageNumbers(1, 3).join(","), "1,2,3");
  assert.equal(helpers.visiblePageNumbers(1, 0).join(","), "1");
  assert.equal(helpers.visiblePageNumbers(10, 7).join(","), "3,4,5,6,7");
});

test("모든 페이지에서 현재 번호를 포함하고 범위를 벗어나거나 중복된 번호를 만들지 않는다", () => {
  for (let total = 1; total <= 30; total += 1) {
    for (let current = 1; current <= total; current += 1) {
      const pages = Array.from(helpers.visiblePageNumbers(current, total));
      assert.equal(pages.length, Math.min(5, total));
      assert.ok(pages.includes(current));
      assert.ok(pages.every((number) => number >= 1 && number <= total));
      assert.equal(new Set(pages).size, pages.length);
    }
  }
});

test("표의 날짜는 연·월·일 전체를 한국 시간으로 표시한다", () => {
  assert.equal(helpers.formatAdminDate("2026-10-21T16:30:00Z"), "2026.10.22");
  assert.equal(helpers.formatAdminDate("2026-01-01T00:00:00Z"), "2026.01.01");
});

test("새 후보에는 승인·검증 완료의 기본값을 넣지 않는다", () => {
  const draft = helpers.emptyDraft();
  assert.equal(draft.source.bibliography_checked, false);
  assert.equal(draft.source.access_level, "unknown");
  assert.equal(draft.claims.length, 0);
  assert.equal(draft.scores.length, 0);
});

test("미리보기 변환은 원본 초안·검증·승인 상태를 바꾸지 않는다", () => {
  const draft = helpers.emptyDraft();
  draft.kind = "trend"; draft.title = "검증용 해설";
  draft.classification_tags = ["RAG"];
  draft.claims = [{ field: "ai_role", text: "검증용 설명", locator: "", verification: "needs_review", evidence_level: "unavailable" }];
  draft.glossary = [{ label: "RAG", definition: "검증용 용어" }];
  const before = JSON.stringify(draft);
  const article = helpers.draftArticle(draft);
  assert.equal(article.kind, "trend");
  assert.equal(article.publishedOn, "미게시");
  assert.equal(article.sections[0].title, "작동 원리 · 쉬운 설명");
  assert.equal(article.glossary[0].definition, "검증용 용어");
  assert.equal(JSON.stringify(draft), before);
});

test("분류 키워드는 저장 전에 정리하되 운영 승인 ID와 혼합하지 않는다", () => {
  const draft = helpers.emptyDraft();
  draft.classification_tags = [" RAG ", " ", "표 데이터"];
  draft.keyword_ids = [];
  const saved = helpers.draftForSave(draft);
  assert.equal(saved.classification_tags.join(","), "RAG,표 데이터");
  assert.equal(saved.keyword_ids.length, 0);
});

test("빈 주장·평가·키워드를 정리하되 관리자가 입력한 원본을 바꾸지 않는다", () => {
  const draft = helpers.emptyDraft();
  draft.claims = [{ field: "research_problem", text: "연구 문제" }, { field: "ai_role", text: "  " }];
  draft.scores = [{ criterion: "input_data", value: 1, rationale: "확인 근거" }, { criterion: "limitations", value: 0, rationale: " " }];
  draft.keyword_ids = [" CAP-01 ", "", " "];
  const saved = helpers.draftForSave(draft);
  assert.equal(saved.claims.length, 1);
  assert.equal(saved.scores.length, 1);
  assert.equal(saved.keyword_ids.join(","), "CAP-01");
  assert.equal(draft.claims.length, 2);
});

test("출처 링크는 자격증명 없는 HTTPS만 허용한다", () => {
  assert.equal(helpers.safeSourceUrl("javascript:alert(1)"), undefined);
  assert.equal(helpers.safeSourceUrl("http://example.org"), undefined);
  assert.equal(helpers.safeSourceUrl("https://user:password@example.org"), undefined);
  assert.equal(helpers.safeSourceUrl("https://example.org/paper"), "https://example.org/paper");
});

test("게시 재시도 번호는 후보·승인 판본 기준으로 유지되고 미승인 판본은 거절한다", () => {
  const candidate = { id: "candidate-1", version: 3, current_revision: 1, approved_revision: 1 };
  assert.equal(helpers.publicationKey(candidate), helpers.publicationKey({ ...candidate, version: 4 }));
  assert.notEqual(helpers.publicationKey(candidate), helpers.publicationKey({ ...candidate, id: "other" }));
  assert.throws(() => helpers.publicationKey({ ...candidate, approved_revision: null }));
  assert.throws(() => helpers.publicationKey({ ...candidate, current_revision: 2 }));
});

test("예약 입력은 PC 시간대와 무관하게 한국 시간으로 변환한다", () => {
  assert.equal(helpers.scheduleToIso("2099-01-01T09:00"), "2099-01-01T00:00:00.000Z");
  assert.equal(helpers.scheduleToIso(""), null);
  assert.throws(() => helpers.scheduleToIso("2000-01-01T09:00"));
  assert.throws(() => helpers.scheduleToIso("invalid"));
});

test("API 오류는 상태 코드와 읽을 수 있는 입력 오류를 보존한다", async () => {
  const api = loadModule("api.ts", {
    process: { env: { NEXT_PUBLIC_API_BASE_URL: "http://test.invalid/api/v1" } },
    fetch: async (_url, options) => {
      assert.equal(options.credentials, "include");
      return { ok: false, status: 422, json: async () => ({ detail: [{ loc: ["body", "claims"], msg: "필수 항목" }] }) };
    },
  });
  await assert.rejects(api.requestApi("/fake"), (error) => error instanceof api.ApiError && error.status === 422 && error.message.includes("claims"));
});

test("후보 묶음은 drafts 객체와 배열을 모두 받고, 파일의 dry_run 값은 쓰지 않는다", () => {
  const draft = { kind: "case", title: "예시" };
  const fromObject = helpers.parseImportBatch(JSON.stringify({ dry_run: false, drafts: [draft] }));
  assert.equal(fromObject.drafts.length, 1);
  assert.equal("dry_run" in fromObject, false);
  assert.equal(helpers.parseImportBatch(JSON.stringify([draft, draft])).drafts.length, 2);
});

test("후보 묶음의 형식 오류는 서버로 보내기 전에 이유와 함께 막는다", () => {
  assert.match(helpers.parseImportBatch("{drafts:").error, /JSON 형식/);
  assert.match(helpers.parseImportBatch(JSON.stringify({ items: [] })).error, /drafts 배열/);
  assert.match(helpers.parseImportBatch(JSON.stringify({ drafts: [] })).error, /후보가 없습니다/);
  assert.match(helpers.parseImportBatch(JSON.stringify({ drafts: [1, "a"] })).error, /객체/);
  const tooMany = Array.from({ length: helpers.MAX_IMPORT_ITEMS + 1 }, () => ({}));
  assert.match(helpers.parseImportBatch(JSON.stringify(tooMany)).error, /최대 50건/);
});

test("승인된 기술 목록은 대분류별로 묶되 서버가 준 순서를 바꾸지 않는다", () => {
  const groups = helpers.groupKeywords([
    { id: "CAP001", label: "데이터 수집", category_id: "C01", category_label: "데이터 준비·품질" },
    { id: "CAP010", label: "가설 검정", category_id: "C02", category_label: "통계·연구설계" },
    { id: "CAP002", label: "데이터 정제", category_id: "C01", category_label: "데이터 준비·품질" },
  ]);
  assert.equal(groups.map((group) => group.id).join(","), "C01,C02");
  assert.equal(groups[0].items.map((item) => item.id).join(","), "CAP001,CAP002");
  assert.equal(helpers.groupKeywords([]).length, 0);
});
