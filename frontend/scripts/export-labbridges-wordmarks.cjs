// 승인된 단일 워드마크에서 웹용 PNG를 만듭니다. 새 글자를 다시 생성하지 않습니다.
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

const BRAND_DIR = path.resolve(__dirname, "../public/brand");
const HEADER_S_POSITION = { x: 620.3154, y: 67, height: 69 };
const ORIGINAL_S_HEIGHT = 228;

async function exportWordmarks() {
  const master = await fs.readFile(path.join(BRAND_DIR, "labbridges-wordmark-master.svg"), "utf8");
  // 로고의 빈 테두리만 정리합니다. 영상에서 승인된 글자 간격은 그대로입니다.
  const hero = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="360" viewBox="66 95 2235 628.59375">${master}</svg>`;
  await sharp(Buffer.from(hero)).png().toFile(path.join(BRAND_DIR, "labbridges-wordmark-hero-v2.png"));

  // 헤더는 기존 단일 아치 모양을 보존하고, 같은 s를 같은 글자 높이·윤곽 간격으로 배치합니다.
  const glyph = master.match(/<svg x="2098"[\s\S]*?<\/svg>/)?.[0];
  if (!glyph) throw new Error("승인된 워드마크에서 s 자산을 찾지 못했습니다.");
  const originalHeader = (await fs.readFile(path.join(BRAND_DIR, "labbridge-wordmark-header.png"))).toString("base64");
  const scale = HEADER_S_POSITION.height / ORIGINAL_S_HEIGHT;
  const header = `<svg xmlns="http://www.w3.org/2000/svg" width="686" height="180" viewBox="0 0 686 180">
    <image width="624" height="180" href="data:image/png;base64,${originalHeader}"/>
    <g transform="translate(${HEADER_S_POSITION.x} ${HEADER_S_POSITION.y}) scale(${scale}) translate(-2098 -333)">${glyph}</g>
  </svg>`;
  await sharp(Buffer.from(header)).png().toFile(path.join(BRAND_DIR, "labbridges-wordmark-header-v2.png"));
}

exportWordmarks().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
