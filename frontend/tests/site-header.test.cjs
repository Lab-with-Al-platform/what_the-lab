const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../src/components/site-header.tsx"), "utf8");

test("헤더는 권한 API를 따로 치지 않고 /auth/me 값만 본다", () => {
  assert.match(source, /requestApi<Me>\("\/auth\/me"\)/);
  assert.match(source, /can_manage_insights/);
  assert.match(source, /can_read_operations/);
  assert.doesNotMatch(source, /\/admin\/insights\/access/);
  assert.doesNotMatch(source, /\/admin\/operations\/access/);
});

test("헤더는 가입이 끝난 뒤 페이지를 옮길 때마다 내 정보를 다시 받지 않는다", () => {
  assert.doesNotMatch(source, /\[pathname,\s*meVersion\]/);
  assert.match(source, /\[meVersion\]/);
  assert.match(source, /signup_step !== "done"/);
});

test("헤더는 승인된 글래스 브릿지 마크를 쓴다", () => {
  assert.match(source, /BrandMark/);
  assert.match(source, /from "@\/components\/brand-mark"/);
  assert.doesNotMatch(source, /#243e96/);
  const mark = path.join(__dirname, "../public/brand/labbridge-mark.png");
  assert.equal(fs.existsSync(mark), true);
});

test("헤더 기본 프로필은 next/image로 32px만 받는다", () => {
  assert.match(source, /from "next\/image"/);
  assert.match(source, /width=\{32\}/);
  assert.match(source, /height=\{32\}/);
  assert.match(source, /default-researcher\.png/);
  assert.match(source, /default-expert\.png/);
});

test("헤더 관리자 진입은 한 메뉴이고 권한 API를 따로 치지 않는다", () => {
  assert.match(source, /adminHomeHref/);
  assert.match(source, />\s*관리자\s*</);
  assert.doesNotMatch(source, /운영 현황/);
  assert.doesNotMatch(source, /인사이트 관리자/);
  assert.doesNotMatch(source, /\/admin\/insights\/access/);
  assert.doesNotMatch(source, /\/admin\/operations\/access/);
});
