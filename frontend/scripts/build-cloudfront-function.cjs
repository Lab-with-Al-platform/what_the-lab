// out/ 화면 목록으로 CloudFront Function을 완성해요. (docs/aws-deployment/09-deployment-roadmap.md B10)
// 틀: infra/cloudfront/url-rewrite.js → 결과: frontend/build/cloudfront-url-rewrite.js
const fs = require("node:fs");
const path = require("node:path");

const FRONTEND = path.join(__dirname, "..");
const OUT_DIR = path.join(FRONTEND, "out");
const TEMPLATE = path.join(FRONTEND, "..", "infra", "cloudfront", "url-rewrite.js");
const RESULT = path.join(FRONTEND, "build", "cloudfront-url-rewrite.js");
const MAX_BYTES = 10 * 1024; // CloudFront Function 코드 크기 제한

/** out/ 안의 .html 파일을 "/cases" 같은 화면 주소 목록으로 바꿔요. (_next 폴더는 빼요) */
function listPages(dir, prefix = "") {
  const pages = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "_next") continue;
    const route = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) pages.push(...listPages(path.join(dir, entry.name), route));
    else if (entry.name.endsWith(".html")) pages.push(route.slice(0, -".html".length));
  }
  return pages.sort();
}

/** 번호 자리에 0을 넣어 만든 화면인지 봐요. 예) /workspace/0, /community/0/edit */
function isPlaceholder(page) {
  return page.split("/").includes("0");
}

/** 틀의 @generated 두 줄을 실제 목록으로 바꾼 코드를 돌려줘요. */
function fillTemplate(template, pages) {
  const known = Object.fromEntries(pages.filter((p) => !isPlaceholder(p)).map((p) => [p, true]));
  const placeholders = pages.filter(isPlaceholder);
  const filled = template
    .replace(/^var KNOWN_PAGES = \{\};.*$/m, `var KNOWN_PAGES = ${JSON.stringify(known)};`)
    .replace(/^var PLACEHOLDER_PAGES = \[\];.*$/m, `var PLACEHOLDER_PAGES = ${JSON.stringify(placeholders)};`);
  if (filled.includes("@generated")) throw new Error("틀에서 목록 자리(@generated)를 찾지 못했어요.");
  return filled;
}

function main() {
  if (!fs.existsSync(OUT_DIR)) throw new Error("out/ 이 없어요. 먼저 next build(STATIC_EXPORT=1)를 실행해 주세요.");
  const code = fillTemplate(fs.readFileSync(TEMPLATE, "utf8"), listPages(OUT_DIR));
  const bytes = Buffer.byteLength(code, "utf8");
  if (bytes > MAX_BYTES) throw new Error(`CloudFront Function이 ${bytes}B 예요. 10KB를 넘으면 올릴 수 없어요.`);
  fs.mkdirSync(path.dirname(RESULT), { recursive: true });
  fs.writeFileSync(RESULT, code);
  console.log(`CloudFront Function: ${path.relative(FRONTEND, RESULT)} (${bytes}B)`);
}

if (require.main === module) main();
module.exports = { listPages, fillTemplate, isPlaceholder };
