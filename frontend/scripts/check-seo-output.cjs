// npm run build:static 뒤 실제로 만들어진 파일을 검사합니다. 네트워크 연결은 필요 없습니다.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const frontend = path.resolve(__dirname, "..");
const out = path.join(frontend, "out");
const origin = new URL(process.argv[2] ?? "https://labbridge.example").origin;
const read = (file) => fs.readFileSync(path.join(out, file), "utf8");

function htmlFiles(dir) {
  return fs.readdirSync(path.join(out, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "_next") return htmlFiles(relative);
    return entry.isFile() && entry.name.endsWith(".html") ? [relative] : [];
  });
}

function htmlTag(html, name, key, value) {
  const tags = html.match(new RegExp(`<${name}\\b[^>]*>`, "g")) ?? [];
  return tags.find((tag) => tag.includes(` ${key}="${value}"`));
}

function attr(tag, key) {
  return tag?.match(new RegExp(` ${key}="([^"]*)"`))?.[1];
}

const sitemap = read("sitemap.xml");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((item) => item[1]);
const routes = new Set(urls.map((url) => {
  const result = new URL(url);
  assert.equal(result.origin, origin);
  assert.equal(result.search, "");
  assert.equal(result.hash, "");
  return result.pathname;
}));
assert.equal(urls.length, routes.size, "사이트맵 URL 중복");
assert.equal(routes.size, 35);
assert.match(read("robots.txt"), new RegExp(`^Sitemap: ${origin.replaceAll(".", "\\.")}/sitemap\\.xml$`, "m"));
assert.doesNotMatch(read("robots.txt"), /^Disallow: \/(?:$|admin|login|workspace)/m);

const staleSlugs = ["cancer-cell-classification", "metastasis-multimodal"];
for (const slug of staleSlugs) {
  assert.ok(!routes.has(`/cases/${slug}`));
  assert.ok(!fs.existsSync(path.join(out, "cases", `${slug}.html`)));
}

let articleCount = 0;
let privateCount = 0;
for (const file of htmlFiles(".")) {
  const route = file === "index.html" ? "/" : `/${file.slice(0, -5)}`;
  const html = read(file);
  const canonical = attr(htmlTag(html, "link", "rel", "canonical"), "href");
  const robots = attr(htmlTag(html, "meta", "name", "robots"), "content");
  const ld = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);

  if (!routes.delete(route)) {
    assert.match(robots ?? "", /(?:^|,\s*)noindex\b/, route);
    assert.equal(canonical, undefined, route);
    assert.equal(ld, null, route);
    privateCount++;
    continue;
  }

  assert.ok(canonical, route);
  // Next.js가 홈 canonical의 끝 슬래시를 생략해도 같은 주소입니다.
  assert.equal(new URL(canonical).href, origin + route, route);
  assert.doesNotMatch(robots ?? "", /noindex/, route);
  assert.ok(attr(htmlTag(html, "meta", "name", "description"), "content"), route);
  if (/^\/(cases|trends)\//.test(route)) {
    assert.ok(ld, route);
    const data = JSON.parse(ld[1]);
    assert.equal(data["@type"], "Article", route);
    assert.equal(data.mainEntityOfPage["@id"], canonical, route);
    assert.equal(new URL(data.citation).protocol, "https:", route);
    assert.match(html, /출처로 확인할 수 있는 범위/, route);
    articleCount++;
  } else {
    assert.equal(ld, null, route);
  }
}

assert.equal(routes.size, 0, `사이트맵 URL이 HTML에 없음: ${[...routes].join(", ")}`);
assert.equal(articleCount, 29);
assert.ok(privateCount > 0);

const rewrite = fs.readFileSync(path.join(frontend, "build/cloudfront-url-rewrite.js"), "utf8");
const toS3Key = new Function(`${rewrite}\nreturn toS3Key;`)();
assert.equal(toS3Key("/robots.txt"), "/robots.txt");
assert.equal(toS3Key("/sitemap.xml"), "/sitemap.xml");
assert.equal(toS3Key("/workspace/123"), "/workspace/0.html");
for (const slug of staleSlugs) assert.equal(toS3Key(`/cases/${slug}`), "/404.html");

console.log(`사이트맵 35개, Article ${articleCount}개, noindex HTML ${privateCount}개, 정적 주소 규칙 확인`);
