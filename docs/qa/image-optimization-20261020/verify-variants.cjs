// 실제 Next 이미지 API가 31개 표지의 크기·형식을 변환하는지 확인합니다.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "../../..");
const frontend = path.join(root, "frontend");
const ts = require(path.join(frontend, "node_modules/typescript"));
const sharp = require(path.join(frontend, "node_modules/sharp"));
const cache = new Map();

function loadModule(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const localRequire = (request) => request.startsWith(".")
    ? loadModule(path.resolve(path.dirname(filename), `${request}.ts`)) : require(request);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  vm.runInNewContext(outputText, { module, exports: module.exports, require: localRequire }, { filename });
  return module.exports;
}

async function main() {
  const { INSIGHTS } = loadModule(path.join(frontend, "src/lib/insights.ts"));
  const coverSource = fs.readFileSync(path.join(frontend, "src/components/cover-art.tsx"), "utf8");
  const defaults = Object.fromEntries([...coverSource.matchAll(/(\w+): "([^"]+)"/g)].map((match) => [match[1], match[2]]));
  const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
  const checks = [];
  for (const article of INSIGHTS) {
    const src = article.coverSrc ?? defaults[article.cover];
    const original = fs.readFileSync(path.join(frontend, "public", src.slice(1)));
    // 모든 표지는 640px, 세부가 있는 대표 표지는 128/1200px도 검사합니다.
    const widths = ["lettuce-biomass-estimation", "periodontal-bone-loss-analysis", "ancient-inscription"].includes(article.slug)
      ? [128, 640, 1200] : [640];
    for (const width of widths) {
      const response = await fetch(`${baseUrl}/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`, {
        headers: { Accept: "image/webp" },
      });
      assert.equal(response.status, 200, article.slug);
      assert.match(response.headers.get("content-type"), /image\/webp/);
      const buffer = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(buffer).metadata();
      assert.ok(metadata.width <= width, article.slug);
      assert.ok(metadata.width > 0 && metadata.height > 0);
      checks.push({ slug: article.slug, src, requestedWidth: width, width: metadata.width, height: metadata.height,
        format: metadata.format, originalBytes: original.length, optimizedBytes: buffer.length,
        cache: response.headers.get("x-nextjs-cache"), cacheControl: response.headers.get("cache-control") });
    }
  }
  assert.equal(new Set(checks.map((item) => item.slug)).size, 31);
  fs.writeFileSync(path.join(__dirname, "variants.json"), JSON.stringify({ date: "2026-10-20", quality: 75, checks }, null, 2));
  console.log(JSON.stringify({ covers: 31, checks: checks.length }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
