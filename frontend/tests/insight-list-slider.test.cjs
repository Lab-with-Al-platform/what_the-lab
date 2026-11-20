// 사례·트렌드 목록: 제목 영역을 낮추고, 카드는 한 줄 슬라이드로 보여 줘요.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("제목 영역은 이전의 절반 정도로 낮고 글자도 작다", () => {
  const css = read("src/app/globals.css");
  // 제목 글자: 32~48px → 22~30px
  assert.match(css, /--insight-page-title: clamp\(22px, 2\.2vw, 30px\);/);
  // 위아래 여백: 40px 32px → 20px 16px
  assert.match(css, /\.insight-page-heading \{\s*padding-block: 20px 16px;/);

  const browser = read("src/components/insight-browser.tsx");
  // 소제목(kicker)을 제목 옆 같은 줄에 두어 한 줄을 줄여요.
  assert.match(browser, /insight-page-heading__row/);
  assert.doesNotMatch(browser, /<p className="mt-3 text-sm text-muted md:text-base">\{kicker\}<\/p>/);
});

test("카드는 한 줄만 보이고 양옆 < > 버튼으로 넘긴다", () => {
  const list = read("src/components/insight-list.tsx");
  assert.match(list, /useCardsPerView\(\)/, "화면 폭에 따라 한 줄에 1·2·3장");
  assert.match(list, /aria-label=\{isPrev \? "이전 글" : "다음 글"\}/);
  assert.match(list, /<SlideButton direction="prev"/);
  assert.match(list, /<SlideButton direction="next"/);
  assert.doesNotMatch(list, /md:grid-cols-2 xl:grid-cols-3/, "여러 줄 격자는 쓰지 않아요");
});

test("페이지 번호는 가운데 아래에 있고 더 보기 버튼은 없다", () => {
  const list = read("src/components/insight-list.tsx");
  assert.match(list, /<nav aria-label="페이지" className="[^"]*justify-center/);
  assert.doesNotMatch(list, /더 보기 ↓/);
});

test("목록 카드는 사진 높이를 줄여 카드가 작아진다", () => {
  const card = read("src/components/insight-card.tsx");
  assert.match(card, /INSIGHT_LIST_COVER_CLASS/);
  assert.match(read("src/components/cover-art.tsx"), /INSIGHT_LIST_COVER_CLASS = "aspect-\[2\/1\] w-full shrink-0"/);
});

test("PC에서는 위(제목+배너)·아래(목록)·맨 끝(꼬리말) 세 지점에 확실히 맞춰 멈춘다", () => {
  const css = read("src/app/globals.css");
  // 1024px 이상에서만, 경계 사이에 어중간하게 멈추지 않도록 mandatory로 맞춰요.
  assert.match(css, /@media \(min-width: 1024px\) \{\s*html:has\(\.insight-editorial\) \{\s*scroll-snap-type: y mandatory;/);
  // 고정 헤더(60px)에 가리지 않게 위 여백을 둬요.
  assert.match(css, /scroll-padding-top: 60px;/);
  assert.match(css, /\.insight-page-heading,\s*\.insight-snap-lower \{\s*scroll-snap-align: start;/);
  // 꼬리말 끝도 멈추는 지점이라 맨 아래까지 내려갈 수 있어요.
  assert.match(css, /html:has\(\.insight-editorial\) \.site-footer \{\s*scroll-snap-align: end;/);
  assert.match(read("src/components/site-footer.tsx"), /<footer className="site-footer /);

  const browser = read("src/components/insight-browser.tsx");
  assert.match(browser, /className="insight-snap-lower"/);
});

test("키워드 안내 문장은 없다 (카드마다 이유가 표시돼요)", () => {
  const list = read("src/components/insight-list.tsx");
  assert.doesNotMatch(list, /위에 두었어요/);
  assert.doesNotMatch(list, /rankedCount/);
});

test("홈 최신 인사이트 카드는 남는 높이를 사진이 채워 흰 글자 영역이 커지지 않는다", () => {
  const card = read("src/components/insight-card.tsx");
  // 카드 높이는 옆 인터뷰 칸에 맞춰 늘어나요. 늘어난 만큼 사진이 커지고, 글자 영역은 내용만큼만 차지해요.
  assert.match(card, /isLanding \? "relative flex min-h-\[132px\] flex-1 flex-col"/);
  assert.match(card, /isLanding \? "min-h-\[132px\] w-full flex-1"/);
  assert.match(card, /isLanding \? "shrink-0 pt-3" : "flex-1 pt-4"/);
});
