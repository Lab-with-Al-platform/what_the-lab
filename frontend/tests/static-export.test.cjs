// B2 정적 빌드(S3) 규칙을 지키는지 확인해요. 실제 빌드는 `npm run build:static`.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

function listPages(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return listPages(relative);
    return entry.name === "page.tsx" ? [relative] : [];
  });
}

const pages = listPages("src/app");
// DB에서 번호로 찾는 화면 (cases·trends는 글 목록을 빌드 때 알아서 제외)
const idPages = pages.filter((file) => /\[[^\]]+\]/.test(file) && !/\/(cases|trends)\//.test(file));

test("정적 빌드는 STATIC_EXPORT=1 일 때만 켜지고, 그때는 rewrites를 쓰지 않는다", () => {
  const config = read("next.config.ts");
  assert.match(config, /process\.env\.STATIC_EXPORT === "1"/);
  assert.match(config, /output: "export"/);
  assert.match(config, /isStaticExport\s*\?[\s\S]*:\s*\{ rewrites: apiProxyRewrites \}/);
  assert.match(read("package.json"), /"build:static": "node scripts\/build-static.cjs"/);
  assert.match(read("scripts/build-static.cjs"), /NEXT_PUBLIC_API_BASE_URL \|\| "\/api\/v1"/);
});

test("번호 주소 화면 8개는 빈 화면 0번만 만들고 번호는 브라우저 주소에서 읽는다", () => {
  assert.equal(idPages.length, 8, idPages.join(", "));
  for (const file of idPages) {
    const src = read(file);
    assert.match(src, /generateStaticParams\(\) \{\s*return placeholderParams\("/, file);
    assert.doesNotMatch(src, /await params/, `${file}: 정적 빌드에서는 params가 항상 "0"이에요`);
    assert.match(src, /from "@\/components\/routes\//, file);
  }
  assert.match(read("src/lib/static-route.ts"), /STATIC_ROUTE_PLACEHOLDER = "0"/);
  assert.match(read("src/lib/route-segment.ts"), /window\.location\.pathname/);
});

test("서버에서만 되는 기능(searchParams·force-dynamic)을 페이지에 쓰지 않는다", () => {
  for (const file of pages) {
    const src = read(file);
    assert.doesNotMatch(src, /force-dynamic/, file);
    assert.doesNotMatch(src, /searchParams: Promise/, `${file}: 주소 뒤 값은 useSearchParams로 읽어요`);
  }
});

test("정적 빌드 결과의 큰 기본 이미지는 화면 크기에 맞게 줄인다", () => {
  const script = read("scripts/optimize-static-images.cjs");
  assert.match(script, /"profile-images\/default-expert\.png": 128/);
  assert.match(script, /"profile-images\/default-researcher\.png": 128/);
  assert.match(read("scripts/build-static.cjs"), /optimize-static-images\.cjs/);
});

test("정적 빌드에서도 워드마크 로고가 원본 크기(624×180)로 커지지 않는다", () => {
  // 정적 빌드는 이미지 최적화를 꺼서 원본 PNG가 그대로 나가요. 높이를 CSS로 고정해야 해요.
  const src = read("src/components/brand-wordmark.tsx");
  assert.match(src, /style=\{sizeStyle\}/, "className이 없을 때 높이를 style로 고정해요");
  assert.match(src, /height: `\$\{height\}px`/);

  // className을 직접 넘기는 곳은 높이 클래스(h-…)도 함께 넘겨야 해요.
  const callers = ["src/components/site-header.tsx", "src/components/site-footer.tsx", "src/components/home-hero.tsx"];
  for (const file of callers) {
    for (const [tag] of read(file).matchAll(/<BrandWordmark[^>]*\/>/g)) {
      const className = tag.match(/className="([^"]*)"/);
      if (className) assert.match(className[1], /(^|\s)h-\d/, `${file}: ${tag}`);
    }
  }
});
