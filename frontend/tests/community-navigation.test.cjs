const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const cats = {
  question: "질문·도움", story: "경험 공유", idea: "아이디어·제안",
  support: "오류·문의", chat: "자유 이야기", notice: "공지",
};

function loadModule(relative, stubs = {}) {
  const js = ts.transpileModule(read(relative), {
    fileName: relative,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, {
    module, exports: module.exports, URLSearchParams, AbortController,
    window: undefined, document: undefined,
    require: (name) => {
      if (name in stubs) return stubs[name];
      if (name === "react" || name === "react/jsx-runtime") return require(name);
      throw new Error("Unstubbed import " + name + " in " + relative);
    },
  });
  return module.exports;
}

const navigation = loadModule("src/lib/community-navigation.ts", {
  "@/lib/community": { CATEGORIES: cats },
});

test("게시판 카테고리는 실제 6개 서버 분류와 일치하는 단일 소스", () => {
  assert.equal(navigation.COMMUNITY_CATEGORIES.length, 6);
  assert.deepEqual(
    Array.from(navigation.COMMUNITY_CATEGORIES, (entry) => entry.key),
    Object.keys(cats),
  );
  const backend = fs.readFileSync(path.join(root, "../backend/app/community/service.py"), "utf8");
  for (const [key, label] of Object.entries(cats)) {
    assert.ok(backend.includes('"' + key + '": "' + label + '"'));
  }
});

test("개인 활동 링크 3개는 서버의 기존 scope와 정확히 일치", () => {
  assert.equal(navigation.COMMUNITY_ACTIVITY_LINKS.length, 3);
  assert.deepEqual(
    Array.from(navigation.COMMUNITY_ACTIVITY_LINKS, (entry) => entry.href),
    ["/community?scope=mine", "/community?scope=saved", "/community?scope=notifications"],
  );
  assert.deepEqual(
    Array.from(navigation.COMMUNITY_ACTIVITY_LINKS, (entry) => entry.label),
    ["내가 쓴 글·문의", "저장한 글", "내 글의 새 답변"],
  );
});

test("카테고리 이동은 검색·정렬을 유지하되 private/admin scope와 페이지·이전 태그를 제거", () => {
  const query = "scope=inbox&page=8&tag=old&q=RAG&order=helpful&status=open&unanswered=1";
  assert.equal(
    navigation.communityCategoryHref(query, "question"),
    "/community?q=RAG&order=helpful&status=open&unanswered=1&category=question",
  );
  assert.equal(navigation.communityCategoryLabel("question"), "질문·도움");
  assert.equal(navigation.communityCategoryLabel("bad-category"), "전체 대화");
  assert.equal(navigation.communityCategoryHref("scope=mine&page=3", null), "/community");
});

test("모든 카테고리 링크는 공개 목록만 가리키며 타인의 비공개 목록으로 이동할 수 없음", () => {
  for (const scope of ["mine", "saved", "notifications", "inbox", "moderation"]) {
    for (const item of navigation.COMMUNITY_CATEGORIES) {
      const href = navigation.communityCategoryHref("scope=" + scope + "&page=99", item.key);
      assert.ok(href.startsWith("/community?category="), href);
      assert.ok(!href.includes("scope="), href);
      assert.ok(!href.includes("page="), href);
    }
  }
});

const ui = loadModule("src/components/community/community-ui.tsx", {
  "next/link": (props) => React.createElement("a", props),
  "@/lib/api": { ApiError: class ApiError extends Error {} },
  "@/lib/community": {
    CATEGORIES: cats, communityApi: () => { throw new Error("do not call community API on SSR"); },
    STATUSES: { open: "대화 중", resolved: "해결됨" },
  },
  "@/lib/community-navigation": navigation,
  "./community.module.css": { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) },
});

test("데스크톱 세로 목록과 모바일 접기식 카테고리는 같은 공개 URL을 사용", () => {
  const html = renderToStaticMarkup(React.createElement(ui.CommunitySidebar, {
    active: "public", category: "idea", member: null,
    queryString: "q=LLM&page=7&scope=mine",
  }));
  assert.match(html, /aria-label="글 카테고리"/);
  assert.match(html, /aria-label="글 카테고리 모바일"/);
  assert.match(html, /<details[^>]+mobileCategoryDetails/);
  assert.match(html, /아이디어·제안/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /href="\/community\?q=LLM&amp;category=idea"/);
  assert.doesNotMatch(html, /scope=mine/);
  assert.doesNotMatch(html, /내가 쓴 글·문의|저장한 글|내 글의 새 답변/);
});

test("관리자 메뉴는 관리자에게만 나타나며 개인활동 메뉴와 분리됨", () => {
  const guest = renderToStaticMarkup(React.createElement(ui.CommunitySidebar, {
    active: "public", member: null,
  }));
  const admin = renderToStaticMarkup(React.createElement(ui.CommunitySidebar, {
    active: "inbox", member: { user_id: 7, nickname: "admin", is_admin: true },
  }));
  assert.doesNotMatch(guest, /비공개 문의함|신고·숨김 관리/);
  assert.match(admin, /비공개 문의함/);
  assert.match(admin, /신고·숨김 관리/);
  assert.match(admin, /aria-label="관리자 게시판"/);
  assert.doesNotMatch(admin, /내가 쓴 글·문의|저장한 글|내 글의 새 답변/);
});

test("상단 가로 탭은 사라지고 페이지의 검색·정렬·미답변 기능은 보존됨", () => {
  const src = read("src/components/community/community-board.tsx");
  assert.doesNotMatch(src, /className=\{styles\.tabs\}|aria-label="글 종류"/);
  assert.match(src, /<CommunitySidebar active=\{scope\} category=\{params\.get\("category"\)\}/);
  assert.match(src, /communityCategoryLabel\(params\.get\("category"\)\)/);
  assert.match(src, /게시글 제목·내용 검색/);
  assert.match(src, /답변을 기다리는 질문/);
  assert.match(src, /id="community-order"/);
  assert.match(src, /setReload\(\(x\) => x \+ 1\)/);
});

test("프로필 메뉴 PC와 모바일 양쪽에서 개인활동을 공유하며 가입·운영 권한을 지킴", () => {
  const src = read("src/components/site-header.tsx");
  assert.match(src, /import \{ COMMUNITY_ACTIVITY_LINKS, COMMUNITY_ADMIN_LINKS \}/);
  assert.equal((src.match(/COMMUNITY_ACTIVITY_LINKS\.map/g) || []).length, 2);
  assert.equal((src.match(/COMMUNITY_ADMIN_LINKS\.map/g) || []).length, 2);
  assert.match(src, /me\.signup_step === "done" &&/);
  assert.match(src, /me\.is_admin === true/);
  assert.match(src, /setProfileOpen\(false\)/);
  assert.match(src, /setMenuOpen\(false\)/);
  assert.match(src, /aria-label="계정 메뉴"/);
});

test("카테고리 CSS는 좁은 화면에서 접고 PC에서는 세로로 보여줌", () => {
  const css = read("src/components/community/community.module.css");
  assert.match(css, /\.desktopCategoryLinks/);
  assert.match(css, /\.mobileCategoryDetails/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /\.desktopCategoryLinks\s*\{\s*display: none/);
  assert.match(css, /\.mobileCategoryDetails\s*\{\s*display: block/);
  assert.match(css, /\.sideLink\s*\{\s*display: flex;\s*width: 100%/);
});

test("게시판 네비게이션은 DB·글쓰기·권한·API를 바꾸지 않는다", () => {
  const board = read("src/components/community/community-board.tsx");
  const sidebar = read("src/components/community/community-ui.tsx");
  const header = read("src/components/site-header.tsx");
  assert.match(board, /communityApi<PostList>/);
  assert.match(board, /scope === "notifications"/);
  assert.match(sidebar, /href="\/community\/new\?visibility=private&category=support"/);
  assert.match(header, /RESEARCHER_MENU/);
  assert.match(header, /EXPERT_MENU/);
});
