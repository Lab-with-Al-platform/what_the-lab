const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const layout = fs.readFileSync(path.join(__dirname, "../src/app/layout.tsx"), "utf8");
const fonts = fs.readFileSync(path.join(__dirname, "../src/app/fonts.ts"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../src/app/globals.css"), "utf8");
const pkg = fs.readFileSync(path.join(__dirname, "../package.json"), "utf8");

test("루트 레이아웃은 바깥 CDN CSS를 쓰지 않고 next/font를 붙인다", () => {
  assert.match(layout, /from "\.\/fonts"/);
  assert.match(layout, /pretendard\.variable/);
  assert.doesNotMatch(layout, /jsdelivr/);
  assert.doesNotMatch(layout, /<link/);
});

test("Pretendard는 쓰는 굵기만 공식 패키지에서 읽는다", () => {
  assert.match(pkg, /"pretendard": "\^?1\.3\.9"/);
  assert.match(fonts, /next\/font\/local/);
  assert.match(fonts, /woff2-subset\/Pretendard-Regular\.subset\.woff2/);
  assert.match(fonts, /Pretendard-Medium\.subset\.woff2/);
  assert.match(fonts, /Pretendard-SemiBold\.subset\.woff2/);
  assert.match(fonts, /Pretendard-Bold\.subset\.woff2/);
  assert.doesNotMatch(fonts, /jsdelivr/);
});

test("본문 글꼴 토큰은 next/font 변수를 쓴다", () => {
  assert.match(css, /--font-sans: var\(--font-pretendard\)/);
});
