const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");

const filename = path.join(__dirname, "../src/lib/expert-local-demo.ts");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  fileName: filename,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
if (compiled.diagnostics?.length) {
  throw new Error(ts.formatDiagnosticsWithColorAndContext(compiled.diagnostics, {
    getCanonicalFileName: (name) => name,
    getCurrentDirectory: () => __dirname,
    getNewLine: () => "\n",
  }));
}

function loadFixture(mode, hostname) {
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputText, {
    exports: module.exports,
    module,
    process: { env: { NODE_ENV: mode } },
    window: { location: { hostname } },
    Number,
    String,
  }, { filename: "expert-local-demo.js" });
  return module.exports.getLocalExpertDemo;
}

function testProfile(nickname, affiliation) {
  return {
    user_id: 1007,
    nickname,
    affiliation,
    user_photo: null,
    introduce: "시연 전문가",
    current_job: "researcher",
    ai_career: "3_5",
    engaged: false,
    engaged_until: null,
    able_work_ids: ["UG04"],
    domain_ids: ["FIELD020"],
    collaboration: { meeting_type: "online", face_to_area: null, available_time: "5_10", rewards: ["undecided"] },
    portfolios: [{
      portfolio_id: 41,
      title: "기존 DB에 저장된 시연용 포트폴리오",
      role: "연구",
      able_work_ids: [],
      skills: [],
      has_pdf: false,
      pdf_size: null,
    }],
    careers: [],
    educations: [],
    certificates: [],
    collaborations: [],
  };
}

const examples = [
  ["[데모] LLM 전문가", "시연용 AI 연구실"],
  ["[데모] 의료 AI 전문가", "시연용 의료 AI 랩"],
  ["[데모] 비전 전문가", "시연용 비전 연구팀"],
  ["[데모] 데이터 전문가", "시연용 데이터 스튜디오"],
];

test("로컬 development의 기존 4명에게만 완성된 3탭과 평가 샘플을 제공한다", () => {
  const fixture = loadFixture("development", "localhost");
  for (const [nickname, affiliation] of examples) {
    const original = testProfile(nickname, affiliation);
    const result = fixture(original);
    assert.ok(result, nickname);
    assert.equal(result.profile.portfolios.length, 3);
    assert.equal(result.profile.portfolios[0].portfolio_id, original.portfolios[0].portfolio_id);
    assert.equal(result.profile.careers.length, 2);
    assert.equal(result.profile.educations.length, 1);
    assert.equal(result.profile.certificates.length, 2);
    assert.equal(result.profile.collaborations.length, 3);
    assert.ok(result.profile.collaborations.every((item) => item.private === true));
    assert.equal(result.reviews.entries.length, 3);
    assert.equal(result.reviews.scores.length, 4);
    assert.ok(result.reviews.average >= 4 && result.reviews.average <= 5);
    assert.equal(original.careers.length, 0, "서버 응답은 mutate되지 않아야 한다");
  }
});

test("실제 사용자·동일 닉네임 사칭·공유 배포 환경에는 가상 데이터가 섞이지 않는다", () => {
  const real = testProfile("실제 전문가", "어느 실제 대학");
  const spoof = testProfile("[데모] LLM 전문가", "실제 대학");
  for (const mode of ["production", "test"]) {
    for (const [nickname, affiliation] of examples) {
      assert.equal(loadFixture(mode, "localhost")(testProfile(nickname, affiliation)), null);
    }
  }
  for (const host of ["what-the-lab.vercel.app", "preview.example.test", "192.168.1.10"]) {
    assert.equal(loadFixture("development", host)(testProfile(...examples[0])), null);
  }
  assert.equal(loadFixture("development", "localhost")(real), null);
  assert.equal(loadFixture("development", "localhost")(spoof), null);
  assert.equal(loadFixture("development", "127.0.0.1")(testProfile(...examples[1])).profile.engaged, true);
});

test("실제 DB 원본 협업 조건/포트폴리오를 서버에 저장하거나 덮어쓰지 않는다", () => {
  const original = testProfile(...examples[0]);
  const before = JSON.stringify(original);
  const fixture = loadFixture("development", "localhost");
  const sample = fixture(original);
  assert.equal(JSON.stringify(original), before);
  assert.equal(sample.profile.collaboration.meeting_type, "offline_ok");
  assert.equal(original.collaboration.meeting_type, "online");
  assert.equal(sample.profile.portfolios[0].title, "기존 DB에 저장된 시연용 포트폴리오");
  assert.ok(sample.profile.portfolios.slice(1).every((p) => p.portfolio_id < 0 && p.has_pdf === false));
});
