// node:test는 Node.js 기본 도구입니다. 테스트를 위해 새 패키지를 설치하지 않습니다.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const crypto = require("node:crypto");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const moduleCache = new Map();

/** 로컬 원고 모듈도 읽되, Next 서버나 실제 DB에는 연결하지 않습니다. */
function loadTypeScript(relativePath) {
  const filename = path.resolve(__dirname, "..", relativePath);
  if (moduleCache.has(filename)) return moduleCache.get(filename).exports;
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
  });
  const module = { exports: {} };
  moduleCache.set(filename, module);
  const localRequire = (request) => {
    if (request.startsWith(".")) {
      const child = `${path.resolve(path.dirname(filename), request)}.ts`;
      if (fs.existsSync(child)) return loadTypeScript(path.relative(path.resolve(__dirname, ".."), child));
    }
    return require(request);
  };
  vm.runInNewContext(outputText, { exports: module.exports, module, require: localRequire }, { filename });
  return module.exports;
}

const { INSIGHTS, getInsight, articlePath, insightsByKind } = loadTypeScript("src/lib/insights.ts");
const { ArticleParagraph, ArticleGlossary } = loadTypeScript("src/components/article-editorial.tsx");
const { CoverArt } = loadTypeScript("src/components/cover-art.tsx");
const { GENERATED_INSIGHT_COVERS } = loadTypeScript("src/lib/insight-covers.ts");
const { CASE_DETAILS } = loadTypeScript("src/lib/insight-case-details.ts");
const { TREND_DETAILS } = loadTypeScript("src/lib/insight-trend-details.ts");
const trend = getInsight("mattergen-material-design");
const researchCase = getInsight("mattergen-experimental-validation");
const textOf = (paragraph) => typeof paragraph === "string" ? paragraph : paragraph.text;
const hashOf = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("31개 글의 최종 표지 경로와 실제 파일이 중복되지 않는다", () => {
  const coverSource = fs.readFileSync(path.resolve(__dirname, "../src/components/cover-art.tsx"), "utf8");
  const defaults = Object.fromEntries([...coverSource.matchAll(/(\w+): "([^"]+)"/g)].map((match) => [match[1], match[2]]));
  const sources = new Set();
  const fileHashes = new Set();
  for (const article of INSIGHTS) {
    const src = article.coverSrc ?? defaults[article.cover];
    assert.ok(src.startsWith("/"), article.slug);
    assert.ok(!sources.has(src), `${article.slug}: 같은 표지 경로`);
    const file = fs.readFileSync(path.resolve(__dirname, "../public", src.slice(1)));
    const fileHash = crypto.createHash("sha256").update(file).digest("hex");
    assert.ok(!fileHashes.has(fileHash), `${article.slug}: 이름만 다른 동일 이미지`);
    sources.add(src);
    fileHashes.add(fileHash);
  }
  assert.equal(sources.size, 31);
  assert.equal(Object.keys(GENERATED_INSIGHT_COVERS).length, 18);
});

test("전용 표지 우선·공통 사진 폴백과 생성 이미지 설명을 유지한다", () => {
  const custom = renderToStaticMarkup(React.createElement(CoverArt, { theme: "battery", src: "/generated/custom.png", className: "aspect-video", alt: "설명" }));
  const fallback = renderToStaticMarkup(React.createElement(CoverArt, { theme: "battery", className: "aspect-video" }));
  assert.ok(custom.includes('src="/generated/custom.png"'));
  assert.ok(fallback.includes('src="/photos/chart.jpg"'));
  for (const slug of Object.keys(GENERATED_INSIGHT_COVERS)) {
    const article = getInsight(slug);
    assert.ok(article, slug);
    assert.match(article.imageAlt, /AI 생성/);
    assert.match(article.imageCaption, /실제 논문 도판.*아닙니다/);
  }
});

test("목록·홈·추천·상세·관련 글에서 전용 표지를 전달한다", () => {
  const files = ["insight-card.tsx", "insight-browser.tsx", "article-view.tsx"];
  for (const file of files) {
    const source = fs.readFileSync(path.resolve(__dirname, "../src/components", file), "utf8");
    const covers = [...source.matchAll(/<CoverArt\b[^>]*\/>/g)].map((match) => match[0]);
    assert.ok(covers.length > 0, file);
    for (const cover of covers) assert.match(cover, /src=\{(?:article|item|featured)\.coverSrc\}/, file);
  }
});

test("기존 치주골·MatterGen 내용은 보존하고 허용된 트렌드 표지만 변경한다", () => {
  const expected = {
    "periodontal-bone-loss-analysis": "26061899e0187740090f5210ca4abdc2685cb36249d85bc6d49807b7e6982301",
    "mattergen-material-design": "4137cfbc6ec5a816778cba86e13cd89784ffa064387649a09b0694ce04df2ad8",
    "mattergen-experimental-validation": "c9d4f3ce70434330bfdfea586edfd7ab567fa31f835b0dd55f5990dcabd55d57",
  };
  for (const [slug, hash] of Object.entries(expected)) {
    const article = { ...getInsight(slug) };
    // 표지 교체 요청은 허용하되 본문·분류·URL 등의 회귀 검사는 유지합니다.
    if (slug === "mattergen-material-design") {
      delete article.coverSrc;
      delete article.imageAlt;
      delete article.imageCaption;
    }
    assert.equal(hashOf(article), hash);
  }
});

test("나머지 28개 글은 주제별 본문·용어·판단·출처를 갖고 URL을 유지한다", () => {
  const preserved = new Set(["periodontal-bone-loss-analysis", "mattergen-material-design", "mattergen-experimental-validation"]);
  const expanded = INSIGHTS.filter((article) => !preserved.has(article.slug));
  assert.equal(INSIGHTS.length, 31);
  assert.equal(expanded.length, 28);
  const bodies = new Set();
  for (const article of expanded) {
    const body = article.sections.flatMap((section) => section.paragraphs.map(textOf)).join("\n");
    assert.ok(body.length >= 1500, `${article.slug}: 설명 부족 (${body.length})`);
    assert.ok(article.sections.length >= 10, article.slug);
    assert.ok(article.glossary.length >= 3, article.slug);
    assert.ok(article.sourceUrl.startsWith("https://"));
    assert.ok(article.sections.some((section) => section.id === "sources"));
    assert.ok(article.sections.some((section) => section.paragraphs.some((p) => typeof p !== "string" && p.kind === "application")));
    assert.ok(!body.includes("이 글의 수치와 기관명은 확정된 연구 기록이 아닙니다."));
    assert.ok(!article.source.includes("예시 출처"));
    assert.ok(!bodies.has(body), `${article.slug}: 공통 예문 반복`);
    assert.ok(articlePath(article).endsWith(`/${article.slug}`));
    for (const slug of article.relatedSlugs) assert.ok(getInsight(slug), `${slug} 관련 글 없음`);
    bodies.add(body);
  }
});

test("예시 기관·DOI·성과는 최종 글에 노출하지 않고 두 시나리오를 명시한다", () => {
  const serialized = JSON.stringify(INSIGHTS);
  for (const value of ["10.1234/example", "서울대학교 생명과학연구원", "정확도 92% · 분석 시간 70% 단축"]) {
    assert.ok(!serialized.includes(value), value);
  }
  for (const slug of ["cancer-cell-classification", "metastasis-multimodal"]) {
    const article = getInsight(slug);
    assert.ok(article.sampleNotice.includes("설명용 연구 시나리오"));
    assert.equal(article.doi, undefined);
    assert.equal(article.institution, undefined);
  }
});

test("28개 보강 원고는 실제 섹션에 여섯 문단 이상을 추가한다", () => {
  const plans = { ...CASE_DETAILS, ...TREND_DETAILS };
  assert.equal(Object.keys(plans).length, 28);
  for (const [slug, plan] of Object.entries(plans)) {
    const article = getInsight(slug);
    const sectionIds = new Set(article.sections.map((section) => section.id));
    const added = Object.values(plan.expansion ?? {}).flat();
    assert.ok(added.length >= 6, `${slug}: 추가 설명 부족`);
    for (const [id, paragraphs] of Object.entries(plan.expansion ?? {})) {
      assert.ok(sectionIds.has(id), `${slug}: 표시되지 않는 섹션 ${id}`);
      const section = article.sections.find((item) => item.id === id);
      for (const paragraph of paragraphs) {
        assert.ok(section.paragraphs.some((item) => textOf(item) === textOf(paragraph)), `${slug}/${id}`);
      }
    }
    // 단순 분량뿐 아니라 원리·적용 등 적어도 두 문맥의 설명 깊이를 확인합니다.
    assert.ok(article.sections.filter((section) => section.paragraphs.length >= 3).length >= 2, slug);
    assert.ok(added.some((paragraph) => paragraph.kind === "application"), slug);
    assert.ok(added.some((paragraph) => paragraph.kind === "caution"), slug);
  }
});

test("보강 전과 비교해 URL·목차를 유지하고 짧은 28개 글의 설명을 늘린다", () => {
  const before = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../docs/qa/insight-depth-20261019/before.json"), "utf8"));
  assert.equal(before.articles.length, INSIGHTS.length);
  for (const previous of before.articles) {
    const article = getInsight(previous.slug);
    const chars = article.sections.flatMap((section) => section.paragraphs.map(textOf)).join("").length;
    assert.equal(article.sections.length, previous.sections, `${article.slug}: 목차 개수 변경`);
    assert.equal(article.glossary?.length ?? 0, previous.glossaryTerms, article.slug);
    if (CASE_DETAILS[article.slug] || TREND_DETAILS[article.slug]) {
      // 품질 점수가 아닌, 추가 설명이 사라지는 회귀를 찾기 위한 최소 검사입니다.
      assert.ok(chars >= previous.paragraphChars + 700, `${article.slug}: ${previous.paragraphChars} → ${chars}`);
    } else {
      assert.equal(chars, previous.paragraphChars, article.slug);
    }
  }
});

test("상추 최종 모형과 콘크리트 원문 내부의 지표 차이를 분명히 설명한다", () => {
  const lettuce = getInsight("lettuce-biomass-estimation");
  const lettuceText = JSON.stringify(lettuce);
  assert.match(lettuceText, /Table 7/);
  assert.match(lettuceText, /0\.932/);
  assert.match(lettuceText, /21\.836/);
  const concrete = INSIGHTS.find((article) => CASE_DETAILS[article.slug]?.sourceUrl.includes("43459"));
  assert.ok(concrete);
  const concreteText = JSON.stringify(concrete);
  assert.match(concreteText, /92\.3/);
  assert.match(concreteText, /89\.2/);
  assert.ok(concrete.sections.some((section) => section.paragraphs.some((paragraph) =>
    typeof paragraph !== "string" && paragraph.kind === "caution" && /92\.3/.test(paragraph.text) && /89\.2/.test(paragraph.text))));
  assert.match(concrete.highlights.find((item) => item.label === "검증 범위").text, /보류/);
});

test("기존 Co-Scientist·AlphaEvolve의 검토된 여섯 섹션을 그대로 보존한다", () => {
  assert.equal(hashOf(getInsight("research-agent").sections.slice(0, 6)), "7ce7921d288224859f0684e9badb7231fc0f6984cf951d817869e54707a0b72b");
  assert.equal(hashOf(getInsight("alphaevolve-algorithm-discovery").sections.slice(0, 6)), "5b5d6767fc96552030142f80d8e1706afe063439ff43a2862148d76e63a18950");
});

test("같은 주제의 두 글은 기존 URL과 서로 다른 유형·경로를 가진다", () => {
  assert.equal(trend.kind, "trend");
  assert.equal(researchCase.kind, "case");
  assert.equal(articlePath(trend), "/trends/mattergen-material-design");
  assert.equal(articlePath(researchCase), "/cases/mattergen-experimental-validation");
  assert.equal(researchCase.topicId, "AM-04");
  assert.equal(trend.companionSlug, researchCase.slug);
  assert.equal(researchCase.companionSlug, trend.slug);
  assert.equal(trend.doi, researchCase.doi);
  assert.equal(new Set(INSIGHTS.map((article) => article.slug)).size, INSIGHTS.length);
  assert.equal(insightsByKind("case").some((article) => article.slug === researchCase.slug), true);
});

test("연구 수치·한계·협업 출처를 사례에 보존하고 해설과 역할을 나눈다", () => {
  const body = researchCase.sections.flatMap((section) => section.paragraphs.map(textOf)).join("\n");
  for (const expected of ["607,683", "8,192", "75개", "158 ± 11", "169 GPa", "TaCr₂O₆", "Wenjie Li", "SIAT"]) {
    assert.ok(body.includes(expected), `${expected} 누락`);
  }
  assert.ok(body.includes("2026.10.16"));
  assert.ok(researchCase.sampleNotice.includes("LabBridge에서 수행한 협업"));
  assert.ok(trend.sampleNotice.includes("최신 속보"));
  assert.ok(trend.sections.length >= 6);
  assert.ok(!trend.sections.some((section) => section.id === "experiment"));
});

test("기존 치주골 소실 사례의 상세 보강과 한계 설명을 유지한다", () => {
  const dental = getInsight("periodontal-bone-loss-analysis");
  const body = dental.sections.flatMap((section) => section.paragraphs.map(textOf)).join("\n");
  assert.equal(dental.sections.length, 10);
  assert.ok(body.includes("340장"));
  assert.ok(body.includes("영상 10장"));
  assert.ok(body.includes("일반화"));
});

test("용어와 섹션 참조, 문단 유형에 잘못된 값이 없다", () => {
  const kinds = new Set(["body", "interpretation", "application", "caution"]);
  for (const article of INSIGHTS) {
    const termIds = new Set((article.glossary ?? []).map((term) => term.id));
    assert.equal(termIds.size, (article.glossary ?? []).length);
    assert.equal(new Set(article.sections.map((section) => section.id)).size, article.sections.length);
    for (const section of article.sections) {
      for (const id of section.termIds ?? []) assert.ok(termIds.has(id), `${article.slug}: ${id} 미정의`);
      for (const paragraph of section.paragraphs) {
        assert.ok(!textOf(paragraph).includes("[LabBridge"), "의견 라벨은 본문 문자열 대신 유형으로 저장");
        if (typeof paragraph !== "string") assert.ok(kinds.has(paragraph.kind));
      }
    }
  }
});

test("편집자 노트는 색 없이도 의미를 알 수 있고 일반 문단은 본문으로 표시한다", () => {
  for (const [kind, label] of [["interpretation", "연구자에게 주는 의미"], ["application", "내 연구에 적용한다면"], ["caution", "주의할 점"]]) {
    const html = renderToStaticMarkup(React.createElement(ArticleParagraph, { paragraph: { kind, text: "예시" } }, "예시"));
    assert.ok(html.includes("<aside"));
    assert.ok(html.includes(label));
    assert.ok(html.includes("원문의 직접 결론과 구분"));
  }
  const body = renderToStaticMarkup(React.createElement(ArticleParagraph, { paragraph: "일반 문장" }, "일반 문장"));
  assert.ok(body.startsWith("<p"));
  assert.ok(!body.includes("<aside"));
});

test("용어 설명은 기본 접힘이고 HTML details/summary로 조작할 수 있다", () => {
  const html = renderToStaticMarkup(React.createElement(ArticleGlossary, { terms: trend.glossary.slice(0, 1) }));
  assert.ok(html.includes("<details"));
  assert.ok(html.includes("<summary"));
  assert.ok(!html.includes(" open="));
  assert.ok(html.includes("역설계"));
  assert.ok(html.includes("주의"));
  assert.equal(renderToStaticMarkup(React.createElement(ArticleGlossary, { terms: [] })), "");
});

test("세 종류 노트 제목은 배경과 4.5:1 이상의 명암 대비를 유지한다", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../src/app/globals.css"), "utf8");
  function luminance(token) {
    const match = css.match(new RegExp(`--color-${token}:\\s*#([0-9a-f]{6})`, "i"));
    assert.ok(match, `${token} 색상 토큰 누락`);
    const channels = match[1].match(/../g).map((channel) => parseInt(channel, 16) / 255);
    const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  }
  for (const [foreground, background] of [
    ["brand", "brand-soft"],
    ["editorial-application", "expert-soft"],
    ["editorial-warning", "editorial-warning-soft"],
  ]) {
    const ratio = (luminance(background) + 0.05) / (luminance(foreground) + 0.05);
    assert.ok(ratio >= 4.5, `${foreground}: ${ratio.toFixed(2)}:1`);
  }
});
