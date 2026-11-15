// 정적 빌드 결과(out/)의 이미지만 줄여요. public/ 원본은 그대로 둬요.
// 이유: S3에는 Vercel 같은 이미지 변환 서버가 없어서, 32px로 보이는 1.4MB 사진도 원본 그대로 내려가요.
// sharp는 Next.js가 함께 설치하는 이미지 도구예요.
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

sharp.cache(false); // Windows에서 파일을 계속 열어 두어 덮어쓰기가 실패하는 것을 막아요

// 화면에 작게만 보이는 파일은 정해진 크기로 줄여요. 값 = 가장 크게 보이는 크기의 2배(레티나 화면).
const SMALL_IMAGES = {
  "profile-images/default-expert.png": 128, // 최대 64px (my-career-profile h-16)
  "profile-images/default-researcher.png": 128, // 헤더 32px
  "brand/labbridge-mark.png": 360, // 휴대폰 홈 화면 아이콘 180px
  "brand/labbridge-favicon.png": 256, // 브라우저 탭 아이콘
};
const MAX_SIDE = 1600; // 나머지 사진의 가장 긴 변 (화면 절반 폭 사진도 선명한 크기)
const IMAGE_FILE = /\.(png|jpe?g|webp)$/i;

function listImages(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listImages(full);
    return IMAGE_FILE.test(entry.name) ? [full] : [];
  });
}

/** 파일 하나를 줄인 결과(Buffer)를 만들어요. 크기·형식은 그대로 두고 화질만 조금 낮춰요. */
async function shrink(file, original, maxSide) {
  const image = sharp(original).resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true });
  if (/\.png$/i.test(file)) return image.png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
  if (/\.webp$/i.test(file)) return image.webp({ quality: 80 }).toBuffer();
  return image.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
}

async function main(outDir) {
  let before = 0;
  let after = 0;
  for (const file of listImages(outDir)) {
    const relative = path.relative(outDir, file).split(path.sep).join("/");
    const original = fs.readFileSync(file);
    const smaller = await shrink(file, original, SMALL_IMAGES[relative] ?? MAX_SIDE);
    before += original.length;
    // 더 작아질 때만 바꿔요. 이미 잘 압축된 파일은 원본이 나아요.
    const result = smaller.length < original.length ? smaller : original;
    if (result !== original) fs.writeFileSync(file, result);
    after += result.length;
  }
  const kb = (bytes) => `${Math.round(bytes / 1024)}KB`;
  console.log(`이미지 최적화: ${kb(before)} → ${kb(after)}`);
}

main(process.argv[2] ?? path.join(__dirname, "..", "out")).catch((error) => {
  console.error(error);
  process.exit(1);
});
