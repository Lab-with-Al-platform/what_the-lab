const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const vm = require("node:vm");

function load() {
  const filename = path.resolve(__dirname, "../src/lib/related-rank.ts");
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    fileName: filename,
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, { module, exports: module.exports, require, Map, Set });
  return module.exports;
}

const names = {
  works: new Map([["UG04", "이미지·영상 분석"], ["UG11", "모델 개발·검증·운영"]]),
  fields: new Map([["FIELD002", "분자·세포생물학"], ["FIELD070", "경영학"]]),
  categoryOf: new Map([["FIELD002", "F01"], ["FIELD070", "F08"]]),
  categories: new Map([["F01", "생명과학"], ["F08", "경영·금융·법"]]),
};

test("지정한 연구의 맡길 일·분야를 관심 키워드로 쓴다", () => {
  const { interestFromResearch } = load();
  const interest = interestFromResearch(
    [
      { status: "registered", is_primary: false, able_work_ids: ["UG11"], field_ids: ["FIELD070"] },
      { status: "registered", is_primary: true, able_work_ids: ["UG04"], field_ids: ["FIELD002"] },
      { status: "draft", is_primary: false, able_work_ids: ["UG04"], field_ids: ["FIELD002"] },
    ],
    names,
  );
  assert.equal(interest.workIds.join(","), "UG04");
  assert.equal(interest.categoryIds.join(","), "F01");
});

test("관련 글은 앞에 두고 안 맞는 글은 빼지 않는다", () => {
  const { articleReason, rankRelated } = load();
  const interest = {
    workIds: ["UG04"],
    categoryIds: ["F01"],
    workLabels: new Map([["UG04", "이미지·영상 분석"]]),
    categoryLabels: new Map([["F01", "생명과학"]]),
    fieldLabels: ["분자·세포생물학"],
  };
  const articles = [
    { slug: "old", field: "경영·금융", topicLabel: "경영", domains: [], tags: [], ableWorkIds: [] },
    { slug: "cancer", field: "생명과학 · 이미지 분석", topicLabel: "비전", domains: [], tags: [], ableWorkIds: [] },
    { slug: "new", field: "생성형 AI", topicLabel: "LLM", domains: [], tags: [], ableWorkIds: ["UG04"] },
  ];
  const ranked = rankRelated(articles, (article) => Boolean(articleReason(article, interest)));
  assert.equal(ranked.map((item) => item.slug).join(","), "cancer,new,old");
  assert.equal(articleReason(articles[1], interest), "「생명과학」 분야와 같아요");
  assert.equal(articleReason(articles[2], interest), "「이미지·영상 분석」 키워드와 같아요");
  assert.equal(articleReason(articles[0], interest), null);
});

test("전문가는 맡길 일이 같으면 이유를 붙인다", () => {
  const { expertReason, interestFromExpert } = load();
  const interest = interestFromExpert({ able_work_ids: ["UG04"], domain_ids: ["FIELD002"] }, names);
  const reason = expertReason({ able_work_ids: ["UG04", "UG01"], domain_ids: ["FIELD070"] }, interest, names);
  assert.equal(reason, "「이미지·영상 분석」 키워드와 같아요");
  assert.equal(expertReason({ able_work_ids: ["UG11"], domain_ids: ["FIELD070"] }, interest, names), null);
});
