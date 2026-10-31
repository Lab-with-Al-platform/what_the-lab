const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

// 브라우저·DB 없이 새 안내 화면의 콘텐츠와 링크 경계를 검사합니다.
function loadModule(relativePath) {
  const filename = path.resolve(__dirname, "..", relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
  });
  const module = { exports: {} };
  function localRequire(request) {
    if (request.endsWith(".css")) return {};
    if (request === "next/link") return { default: ({ children, ...props }) => React.createElement("a", props, children) };
    if (request === "next/image") {
      return {
        default: (props) => React.createElement("img", props),
        getImageProps: ({ src }) => ({ props: { srcSet: src, src } }),
      };
    }
    if (request === "@/components/page-container") return { PageContainer: ({ children, className }) => React.createElement("div", { className: `page-container ${className}` }, children) };
    if (request.startsWith("@/")) {
      const base = `src/${request.slice(2)}`;
      const tsx = path.resolve(__dirname, "..", `${base}.tsx`);
      return loadModule(fs.existsSync(tsx) ? `${base}.tsx` : `${base}.ts`);
    }
    return require(request);
  }
  vm.runInNewContext(outputText, { module, exports: module.exports, require: localRequire });
  return module.exports;
}

test("홈은 기존 소개와 두 안내 화면을 같은 프레임에 표시한다", () => {
  const { HomeHero } = loadModule("src/components/home-hero.tsx");
  const html = renderToStaticMarkup(React.createElement(HomeHero, {
    introVisual: React.createElement("div", null, "기존 연구 이미지"),
  }));
  assert.equal((html.match(/data-home-slide=/g) ?? []).length, 3);
  assert.match(html, /기존 연구 이미지/);
  assert.match(html, /labbridge-wordmark-hero/);
  assert.match(html, /플랫폼 이용 안내/);
  assert.match(html, /Discord 이용 안내/);
  assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1);
  assert.match(html, /aria-label="홈 소개 자동 넘김 일시정지"/);
});

test("안내 그래픽은 과정·연결을 설명하지만 미정 링크나 연동 상태를 만들지 않는다", () => {
  const { PlatformGuideVisual, DiscordGuideVisual } = loadModule("src/components/home-guide-visuals.tsx");
  const platform = renderToStaticMarkup(React.createElement(PlatformGuideVisual));
  const discord = renderToStaticMarkup(React.createElement(DiscordGuideVisual));
  for (const label of ["인사이트", "전문가 찾기", "협업 매칭", "협업 요청", "프로젝트 확정"]) assert.match(platform, new RegExp(label));
  for (const label of ["협업 채널", "챗봇", "Google Calendar"]) assert.match(discord, new RegExp(label));
  assert.match(platform, /labbridge-platform-guide-v1/);
  assert.match(discord, /labbridge-discord-guide-v1/);
  assert.doesNotMatch(platform + discord, /href=|<button|연동 완료|실시간|자동 동기화|연결 구조 예시|프로젝트 진행/);
  assert.doesNotMatch(platform + discord, /home-hero__note-index|>01<|>02<|>03</);
});

test("새 안내 슬라이드는 가짜 FAQ 링크나 영상·방문 저장 기능을 추가하지 않는다", () => {
  const { HomeHero } = loadModule("src/components/home-hero.tsx");
  const html = renderToStaticMarkup(React.createElement(HomeHero, { introVisual: null }));
  assert.equal((html.match(/<a /g) ?? []).length, 1);
  assert.match(html, /href="#paths"/);
  assert.match(html, /상세 매뉴얼 준비 중/);
  const source = fs.readFileSync(path.resolve(__dirname, "../src/components/home-hero.tsx"), "utf8");
  assert.doesNotMatch(source, /localStorage|sessionStorage|<video/);
});

test("소개 그림은 고정 높이 대신 안내 화면과 같은 칸을 비율로 채운다", () => {
  const page = fs.readFileSync(path.resolve(__dirname, "../src/components/home-page.tsx"), "utf8");
  const css = fs.readFileSync(path.resolve(__dirname, "../src/components/home-hero.css"), "utf8");
  assert.doesNotMatch(page, /h-\[378px\]/);
  assert.match(page, /home-hero__collage/);
  assert.match(css, /aspect-ratio:\s*760\s*\/\s*378/);
  assert.match(css, /\.home-hero__intro-art\s*\{[^}]*height:\s*100%/);
  assert.match(css, /\.home-hero__note\s*\{/);
  assert.match(css, /home-hero__collage--guide/);
  assert.match(css, /home-hero__collage--intro/);
  assert.match(css, /background:\s*rgb\(255 255 255/);
  assert.doesNotMatch(page, /R0lGODlhAQABAIAAAAAAAP/);
  assert.doesNotMatch(css, /\.home-hero__collage\s*\{\s*display:\s*none/);
  assert.doesNotMatch(css, /home-hero__note-index|home-hero__note--caption/);
});

test("멈춤 스타일은 재생 선언보다 구체적이고 비활성 화면의 조작을 차단한다", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../src/components/home-hero.css"), "utf8");
  assert.match(css, /\.home-hero__choice\[aria-current\] \.home-hero__progress\[data-running="false"\]::after\s*\{ animation-play-state: paused;/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.home-hero__slide\s*\{[\s\S]*z-index: 0;/);
  assert.match(css, /\.home-hero__slide\[data-active="true"\]\s*\{[\s\S]*z-index: 1;/);
  const { HomeHero } = loadModule("src/components/home-hero.tsx");
  const html = renderToStaticMarkup(React.createElement(HomeHero, { introVisual: null }));
  // inert는 겹친 슬라이드에서 아래 탭 클릭까지 삼킬 수 있어 CSS pointer-events만 씁니다.
  assert.doesNotMatch(html, / inert/);
  assert.match(css, /\.home-hero__slide\s*\{[\s\S]*pointer-events: none;/);
});

test("탭과 화살표는 그림보다 위에 있고 자동 넘김은 타이머로 넘어간다", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/components/home-hero.tsx"), "utf8");
  const css = fs.readFileSync(path.resolve(__dirname, "../src/components/home-hero.css"), "utf8");
  // 마우스가 배너 위에 있거나 Windows 동작 줄이기가 켜져도 타이머는 돌아야 합니다.
  assert.match(source, /setTimeout/);
  assert.doesNotMatch(source, /onAnimationEnd/);
  assert.match(source, /isRunning = !showVideo && !userPaused && !tabHidden/);
  assert.doesNotMatch(source, /hovering/);
  assert.doesNotMatch(source, /reduceMotion/);
  assert.match(source, /PlatformGuideVisual/);
  assert.match(css, /\.home-hero__controls\s*\{[^}]*z-index:\s*2/);
  assert.match(css, /\.home-hero__intro-art\s*\{[^}]*pointer-events:\s*none/);
});

test("소개 영상은 한국 날짜의 첫 방문에만 자동재생하고 세 배너 순환에 넣지 않는다", () => {
  const policy = loadModule("src/lib/home-intro-video-policy.ts");
  const beforeMidnight = new Date("2026-10-30T14:59:00.000Z");
  const afterMidnight = new Date("2026-10-30T15:00:00.000Z");
  assert.equal(policy.seoulDateKey(beforeMidnight), "2026-10-30");
  assert.equal(policy.seoulDateKey(afterMidnight), "2026-10-31");

  const today = "2026-10-31";
  const watched = { version: policy.HOME_VIDEO_VERSION, playedOn: today };
  assert.equal(policy.shouldAutoplayHomeVideo({ record: null, today, reduceMotion: false, saveData: false }), true);
  assert.equal(policy.shouldAutoplayHomeVideo({ record: watched, today, reduceMotion: false, saveData: false }), false);
  assert.equal(policy.shouldAutoplayHomeVideo({ record: { version: policy.HOME_VIDEO_VERSION, playedOn: "2026-10-30" }, today, reduceMotion: false, saveData: false }), true);
  assert.equal(policy.shouldAutoplayHomeVideo({ record: null, today, reduceMotion: true, saveData: false }), false);
  assert.equal(policy.shouldAutoplayHomeVideo({ record: null, today, reduceMotion: false, saveData: true }), false);

  const storage = {
    value: "{",
    getItem() { return this.value; },
    setItem(key, value) { this.value = value; this.key = key; },
  };
  assert.equal(policy.readHomeVideoRecord(storage), null);
  policy.writeHomeVideoRecord(storage, today);
  assert.equal(storage.key, policy.HOME_VIDEO_STORAGE_KEY);
  const saved = policy.readHomeVideoRecord(storage);
  assert.equal(saved.version, policy.HOME_VIDEO_VERSION);
  assert.equal(saved.playedOn, today);
  assert.doesNotThrow(() => policy.writeHomeVideoRecord({ setItem() { throw new Error("denied"); } }, today));

  const { HomeHero } = loadModule("src/components/home-hero.tsx");
  const html = renderToStaticMarkup(React.createElement(HomeHero, { introVisual: null }));
  assert.match(html, />영상</);
  assert.doesNotMatch(html, /<video|labbridge-intro-55s\.mp4/);
  assert.equal((html.match(/data-home-slide=/g) ?? []).length, 3);

  const player = loadModule("src/components/home-intro-video.tsx");
  const videoHtml = renderToStaticMarkup(React.createElement(player.HomeIntroVideo, { playedOn: today, autoplay: false, onFinish() {} }));
  assert.match(videoHtml, /muted=/);
  assert.match(videoHtml, /playsInline|playsinline/);
  assert.match(videoHtml, /preload="metadata"/);
  assert.match(videoHtml, /aria-label="건너뛰기"/);
  assert.match(videoHtml, /aria-label="소리 켜기"/);
  assert.doesNotMatch(videoHtml, /자막|<track|labbridge-intro-55s\.vtt/);
  assert.match(videoHtml, /Music: Bensound/);
  assert.match(videoHtml, /Artist: Benjamin Tissot/);
  assert.match(videoHtml, /License code: CXLAPYSMSXVMMJQM/);
  const css = fs.readFileSync(path.resolve(__dirname, "../src/components/home-hero.css"), "utf8");
  assert.match(css, /\.home-hero__video-frame video \{[^}]*object-fit:\s*cover/);
  assert.match(css, /max-width:\s*767px\)[\s\S]*\.home-hero__video-frame video \{[^}]*object-fit:\s*contain/);
});
