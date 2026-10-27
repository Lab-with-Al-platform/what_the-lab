/** 공개 원고의 제목·경로만 갱신합니다. DB·원고 본문에는 쓰지 않습니다. */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const inventory = JSON.parse(
  execFileSync(
    process.execPath,
    [path.join(__dirname, "export-insights.cjs"), "--inventory"],
    { encoding: "utf8" },
  ),
);
const links = inventory.map(({ slug, kind, title }) => ({
  slug,
  kind,
  title,
  href: `${kind === "case" ? "/cases/" : "/trends/"}${slug}`,
}));
const target = path.resolve(
  __dirname,
  "../../data/community/insight-links.json",
);
if (process.argv.includes("--check")) {
  const current = JSON.parse(fs.readFileSync(target, "utf8"));
  if (JSON.stringify(current) !== JSON.stringify(links)) {
    console.error(
      "공개 콘텐츠 연결 목록이 원고와 다릅니다. export-community-links.cjs를 실행하세요.",
    );
    process.exitCode = 1;
  } else
    console.log(
      `공개 원고 ${links.length}개의 제목·종류·URL이 모두 일치합니다.`,
    );
} else {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(links, null, 2)}\n`);
  console.log(`공개 콘텐츠 링크 ${links.length}개를 갱신했습니다.`);
}
