/** 화면에 사용하는 최종 원고를 그대로 내보냅니다. DB에는 연결하지 않습니다. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const cache = new Map();
function load(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS }, fileName: filename,
  });
  vm.runInNewContext(outputText, { module, exports: module.exports, require: (name) =>
    name.startsWith(".") ? load(path.resolve(path.dirname(filename), `${name}.ts`)) : require(name),
  }, { filename });
  return module.exports;
}
const { INSIGHTS } = load(path.resolve(__dirname, "../src/lib/insights.ts"));
if (process.argv.includes("--inventory")) {
  console.log(JSON.stringify(INSIGHTS.map(({ slug, kind, title, doi, sourceUrl }) =>
    ({ slug, kind, title, doi, sourceUrl })), null, 2));
} else {
  process.stdout.write(JSON.stringify(INSIGHTS));
}
