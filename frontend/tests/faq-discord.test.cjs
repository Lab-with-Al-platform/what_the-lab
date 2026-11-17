const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
function load(file) {
  const module = { exports: {} };
  const code = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: name => name.endsWith(".css") ? { __esModule: true, default: {} } : require(name),
  });
  return module.exports;
}
const { FAQS, searchFaqs, normalizeFaqCategory } = load("src/lib/faq.ts");
const { DISCORD_GUIDES, FAQ_DISCORD_GUIDE_IDS } = load("src/lib/faq-discord.ts");
const { FaqDiscordGuide } = load("src/components/community/faq-discord-guide.tsx");
const byId = id => FAQS.find(f => f.id === id);

test("all Discord guides are reachable, related FAQ hashes and menu routes exist", () => {
  const ids = new Set(FAQS.map(f => f.id));
  for (const [faqId, guideId] of Object.entries(FAQ_DISCORD_GUIDE_IDS)) {
    assert.ok(ids.has(faqId), faqId);
    assert.ok(DISCORD_GUIDES[guideId], guideId);
  }
  assert.deepEqual(new Set(Object.values(FAQ_DISCORD_GUIDE_IDS)), new Set(Object.keys(DISCORD_GUIDES)));
  for (const faq of FAQS) for (const link of faq.links) {
    if (link.href.startsWith("/faq#")) assert.ok(ids.has(link.href.slice(5)), link.href);
    else {
      const route = link.href.split(/[?#]/)[0];
      assert.ok(fs.existsSync(path.join(root, "src/app", route, "page.tsx")), link.href);
    }
  }
});

test("five registered slash commands are discoverable through FAQ search and guides", () => {
  const source = ["discord_gateway.py", "discord_schedule.py"].map(f => read("../backend/app/" + f)).join("\n");
  const commands = Array.from(source.matchAll(/@tree.command\(name="([^"]+)"/g), m => "/" + m[1]);
  assert.equal(commands.length, 5);
  for (const command of commands) {
    assert.ok(searchFaqs(command).length, command);
    assert.ok(JSON.stringify(DISCORD_GUIDES).includes(command), command);
  }
  for (const query of ["디스코드 연결", "기한 조정", "반복", "DM", "기간 연장", "조기 완료", "버튼 만료", "파일 보관"]) {
    assert.ok(searchFaqs(query).length, query);
  }
  assert.ok(searchFaqs("/요청", "discord").some(f => f.id === "discord-task-create"));
});

test("role buttons, recurring schedule and retention/review policies match server contracts", () => {
  const scenes = DISCORD_GUIDES["discord-task-permissions"].scenes;
  assert.equal(Array.from(scenes[0].actions).join("|"), "완료|기한 얘기하기");
  assert.equal(Array.from(scenes[1].actions).join("|"), "기한 변경|요청 취소");
  const buttons = DISCORD_GUIDES["repeat-schedule"].scenes[1].actions;
  const scheduleSource = read("../backend/app/discord_schedule.py");
  for (const label of buttons) assert.ok(scheduleSource.includes(`("${label}",`), label);
  assert.match(read("../backend/app/collab_waiting.py"), /CHANNEL_KEEP_DAYS = 2/);
  assert.match(byId("discord-ending").answer.join(" "), /2일/);
  assert.match(byId("review-after-completion").answer.join(" "), /중단당한 사람만/);
  assert.match(read("../backend/app/review_store.py"), /not stopped_by_me/);
  assert.match(byId("lab-trust").answer.join(" "), /전문가가 중단한/);
});

test("illustrations cannot send input; rendering identifies provenance and personal/shared contexts", () => {
  for (const [id, guide] of Object.entries(DISCORD_GUIDES)) {
    assert.ok(guide.scenes.length >= 2 && guide.scenes.length <= 4, id);
    const html = renderToStaticMarkup(React.createElement(FaqDiscordGuide, { guide, faqId: id }));
    assert.match(html, /실제 Discord 캡처 아님/);
    assert.match(html, /입력·전송되지 않음/);
    assert.match(html, /aria-live="polite"/);
    assert.equal((html.match(/<button /g) || []).length, guide.scenes.length + 2, id);
    assert.doesNotMatch(html, /<input|<form|<iframe/, id);
  }
  const component = read("src/components/community/faq-discord-guide.tsx");
  assert.doesNotMatch(component, /fetch\(|requestApi|window.open|https:\/\/discord/);
  assert.match(component, /조작한 사람에게만 표시/);
  assert.match(component, /참여자가 함께 보는 메시지/);
});

test("the ten product screenshots remain and guides expose no real channel/account identifiers", () => {
  const screenshots = load("src/lib/faq-screenshots.ts").FAQ_SCREENSHOTS;
  const images = new Set(Object.values(screenshots).flat().map(x => x.src));
  assert.equal(images.size, 10);
  for (const image of images) assert.ok(fs.existsSync(path.join(root, "public", image)), image);
  const content = read("src/lib/faq-discord.ts");
  assert.doesNotMatch(content, /https:\/\/discord.com\/channels\/\d|Bearer |Bot [A-Za-z0-9_.-]{20}/);
  const page = read("src/components/community/faq-page.tsx");
  assert.match(page, /expanded === faq.id && FAQ_DISCORD_GUIDE_IDS/);
});

test("untrusted category URL values cannot render inherited object/function properties", () => {
  for (const value of [null, "", "all", "constructor", "__proto__", "toString", "unknown"]) {
    assert.equal(normalizeFaqCategory(value), "all");
  }
  assert.equal(normalizeFaqCategory("discord"), "discord");
  assert.equal(normalizeFaqCategory("privacy"), "privacy");
});
