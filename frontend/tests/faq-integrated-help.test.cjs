const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const mod = { exports: {} };
const compiled = ts.transpileModule(read("src/lib/faq.ts"), {
  fileName: "faq.ts", compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(compiled, { module: mod, exports: mod.exports });
const { FAQS, FAQ_CATEGORIES, searchFaqs } = mod.exports;

const originalAnchors = [
  "what-is-labbridge","first-question","researcher-expert","discord-login",
  "login-problem","profile-exposure","request-boundary","lab-trust",
  "review-after-completion","insight-question","calendar-discord","public-post",
  "private-post","change-visibility","research-data","accept-answer",
  "save-notification","report","feedback","posting-limits"
];
const required = [
  "unified-search","researcher-verification","expert-search-filter",
  "designate-research","request-status","urgent-request","period-adjustment",
  "workspace-overview","workspace-schedules","repeat-schedule","google-calendar-sync",
  "workspace-task-vs-request","task-due-negotiation","task-complete-return",
  "workspace-completion","workspace-notices","review-public-private"
];

test("기존 20개 FAQ 해시와 신규 기능 17개 모두 정확히 하나씩 존재", () => {
  assert.equal(FAQS.length, 37);
  assert.equal(new Set(FAQS.map(x => x.id)).size, 37);
  for (const id of [...originalAnchors,...required]) assert.equal(FAQS.filter(x => x.id === id).length, 1, id);
});
test("모든 FAQ에 검증 가능한 메뉴 링크와 분류가 있고 가이드는 최소 2단계", () => {
  for (const f of FAQS) {
    assert.ok(f.category in FAQ_CATEGORIES, f.id);
    assert.ok(f.question && f.answer.length && f.links.length && f.keywords.length, f.id);
    for (const a of f.links) assert.ok(a.href.startsWith("/") && !a.href.startsWith("//"), f.id);
    if (!f.guide) continue;
    assert.ok(f.guide.steps.length >= 2, f.id);
    assert.ok(f.guide.note, f.id);
    for (const s of f.guide.steps) {
      for (const key of ["screen","heading","detail","focus"]) assert.ok(s[key], `${f.id} ${key}`);
      assert.ok(s.href.startsWith("/") && !s.href.startsWith("//"), f.id);
    }
  }
});
test("실제 동선과 이름이 다른 협업 요청과 작업 요청을 명확히 구분", () => {
  const q = FAQS.find(f=>f.id==="workspace-task-vs-request");
  assert.ok(q.answer.join(" ").includes("요청관리"));
  assert.ok(q.answer.join(" ").includes("이미 시작된"));
  assert.deepEqual(Array.from(q.links.map(l=>l.href)), ["/requests","/workspace"]);
  assert.match(read("src/components/workspace-detail-work.tsx"),/기한 얘기하기/);
  assert.match(read("src/components/sent-requests.tsx"),/수락함 · 선택 필요/);
});
test("일정/Google/반복/알림 안내가 조건과 권한을 빠뜨리지 않는다", () => {
  const byId=id=>FAQS.find(x=>x.id===id).answer.join(" ");
  assert.match(byId("workspace-schedules"),/기간 안/);
  assert.match(byId("repeat-schedule"),/하루짜리/);
  assert.match(byId("repeat-schedule"),/미팅/);
  assert.match(byId("google-calendar-sync"),/기능이 활성화된 경우/);
  assert.match(byId("google-calendar-sync"),/수정은 WHAT THE LAB/);
  assert.match(byId("workspace-notices"),/최근 30일/);
  assert.match(read("src/components/workspace-schedule-dialog.tsx"),/canRepeat = !editing && kind === "meeting" && oneDay/);
  assert.match(read("src/components/workspace-detail-head.tsx"),/if \(!detail\.google_enabled\) return null/);
  assert.match(read("src/components/notification-bell.tsx"),/최근 30일 알림만 보여요/);
});
test("평가/지수 숫자 조건과 정책은 서버·화면 및 공개 설명과 일치", () => {
  const review=FAQS.find(x=>x.id==="review-after-completion").answer.join(" ");
  const trust=FAQS.find(x=>x.id==="lab-trust").answer.join(" ");
  assert.match(review,/30일/); assert.match(review,/48시간/); assert.match(review,/7일/);
  assert.match(trust,/최소 3건/); assert.match(trust,/2명/); assert.match(trust,/최대 3건/);
  assert.match(read("src/components/collaboration-review-card.tsx"),/48시간/);
  assert.match(read("src/components/lab-trust-indicator.tsx"),/최소 3건/);
  assert.match(read("src/components/workspace-home.tsx"),/협업 평가하기/);
});
test("검색, 비공개, 신고 정책은 링크·문구와 연결된다", () => {
  const joined=id=>FAQS.find(x=>x.id===id).answer.join(" ");
  assert.ok(searchFaqs("기한 조정").some(x=>x.id==="task-due-negotiation"));
  assert.ok(searchFaqs("비공개").some(x=>x.id==="private-post"));
  assert.ok(searchFaqs("lab trust").some(x=>x.id==="lab-trust"));
  assert.ok(searchFaqs("일정","workspace").every(x=>x.category==="workspace"));
  assert.match(joined("private-post"),/API 키/);
  assert.match(joined("save-notification"),/Discord DM/);
  assert.match(joined("save-notification"),/전송하지/);
  assert.match(joined("change-visibility"),/변경할 수 없습니다/);
  assert.match(joined("review-public-private"),/자동 삭제되지/);
});
test("시각 가이드는 서비스 내부 UI를 설명하며 가짜 화면 캡처를 주장하지 않는다", () => {
  const jsx=read("src/components/community/faq-walkthrough.tsx");
  const css=read("src/components/community/faq-visual.module.css");
  const page=read("src/components/community/faq-page.tsx");
  assert.match(jsx,/실제 캡처 아님/);
  assert.match(jsx,/aria-pressed/);
  assert.match(jsx,/href=\{current\.href\}/);
  assert.match(css,/@media\(max-width:640px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(page,/getHashFaqId/);
  assert.match(page,/router\.replace\(`\/faq#/);
  assert.match(page,/role="status"/);
  assert.ok(FAQS.filter(x=>x.guide).length>=12);
});
