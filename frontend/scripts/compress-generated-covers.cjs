/** 생성 표지 PNG를 JPEG로 바꿔 저장소 용량을 줄입니다. 그림 내용과 가로는 유지합니다. */
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const folder = path.resolve(__dirname, "../public/generated");
const files = fs.readdirSync(folder).filter((name) => name.endsWith(".png"));

async function compressOne(name) {
  const input = path.join(folder, name);
  const output = path.join(folder, name.replace(/\.png$/i, ".jpg"));
  await sharp(input).jpeg({ quality: 82, mozjpeg: true }).toFile(output);
  const before = fs.statSync(input).size;
  const after = fs.statSync(output).size;
  fs.unlinkSync(input);
  process.stdout.write(`${name}: ${before} -> ${path.basename(output)} ${after}\n`);
}

(async () => {
  if (files.length === 0) {
    process.stdout.write("바꿀 PNG가 없습니다.\n");
    return;
  }
  for (const name of files) {
    await compressOne(name);
  }
})();
