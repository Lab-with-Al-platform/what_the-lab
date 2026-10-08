// 긴 페이지 전체와 별개로, 상단 디자인을 실제 크기로 검토할 이미지입니다.
const path = require('node:path');
const sharp = require('C:/Users/Peter/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');

async function main() {
  const screenDir = path.join(__dirname, 'screens');
  for (const type of ['case-detail', 'trend-detail']) {
    await sharp(path.join(screenDir, `${type}-desktop.png`))
      .extract({ left:0, top:0, width:1408, height:1200 })
      .toFile(path.join(__dirname, `${type}-desktop-top.png`));
    await sharp(path.join(screenDir, `${type}-mobile.png`))
      .extract({ left:0, top:0, width:390, height:1600 })
      .toFile(path.join(__dirname, `${type}-mobile-top.png`));
  }
}
main().catch(error => { console.error(error); process.exit(1); });
