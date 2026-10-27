import Image from "next/image";
import Link from "next/link";
import { ArticleToc } from "@/components/article-toc";
import { PageContainer } from "@/components/page-container";
import { CoverArt } from "@/components/cover-art";
import { KeywordTag } from "@/components/keyword-tag";
import { ArticleGlossary, ArticleParagraph } from "@/components/article-editorial";
import { InsightViewBeacon } from "@/components/insight-view-beacon";
import { AnalyticsArticleBeacon, RelatedArticleCard, TrackedArticleLink } from "@/components/analytics-article-links";
import { articlePath, getInsight, kindLabel, relatedInsights, type InsightArticle } from "@/lib/insights";

/** 같은 현미경 사진을 다른 위치로 잘라, 세포 종류마다 다른 연구 그림인 것처럼 보이지 않게 합니다. */
const CHIP_CROPS = ["object-[18%_35%]", "object-[72%_28%]", "object-[40%_78%]", "object-[82%_68%]"];

/** PC 헤더 사진 너비와 간격입니다. 날짜 줄이 사진 아래로 들어가지 않게 같은 값을 씁니다. */
const HEADER_FIGURE_WIDTH = 280;
const HEADER_FIGURE_GAP = 24;

/**
 * Co-Scientist처럼 하이픈이 있는 이름은 하이픈 앞에서 줄이 끊기지 않게 합니다.
 */
function keepCompoundWords(text: string): string {
  return text.replace(/([\p{L}\p{N}])-([\p{L}\p{N}])/gu, "$1\u2011$2");
}

/**
 * 문장이 끝나면 다음 문장을 새 줄에 둡니다.
 * 제목의 콜론은 문장 경계로 보고, 소수점(0.964)은 문장 끝으로 보지 않습니다.
 */
function splitReadableLines(text: string, breakOnColon: boolean): string[] {
  const normalized = keepCompoundWords(text.trim());
  const lines: string[] = [];
  let current = "";

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index] ?? "";
    current += char;
    const next = normalized[index + 1] ?? "";
    // DOI·소수점은 점 뒤에 공백이 없습니다. 문장 끝은 공백이나 글의 끝으로만 봅니다.
    const isSentenceEnd = ".?!…".includes(char) && (next === " " || next === "");
    const isTitleColon = breakOnColon && char === ":" && (next === " " || next === "");

    if (!isSentenceEnd && !isTitleColon) continue;

    while (normalized[index + 1] === " ") index += 1;
    const line = current.trim();
    if (line) lines.push(line);
    current = "";
  }

  const rest = current.trim();
  if (rest) lines.push(rest);
  return lines.length > 0 ? lines : [normalized];
}

/** 긴 DOI는 슬래시·점 뒤에서 줄을 바꿔, 박스 밖으로 나가지 않게 합니다. */
function FactValue({ value }: { value: string }) {
  if (!value.startsWith("10.")) return value;

  return value.split(/([./])/).map((part, index) =>
    part === "." || part === "/" ? (
      <span key={`${part}-${index}`}>
        {part}
        <wbr />
      </span>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}

function ReadableText({ text, breakOnColon = false }: { text: string; breakOnColon?: boolean }) {
  const lines = splitReadableLines(text, breakOnColon);
  if (lines.length === 1) return lines[0];

  return (
    <>
      {lines.map((line, index) => (
        <span key={`${index}-${line}`} className="block">
          {line}
        </span>
      ))}
    </>
  );
}

interface ArticleViewProps {
  article: InsightArticle;
  hideCover?: boolean;
  /** 관리자 미리보기에서는 같은 본문만 재사용하고 주변 탐색 영역은 제외합니다. */
  contentOnly?: boolean;
}

function HighlightIcon({ index }: { index: number }) {
  const paths = [
    "M4 12h16M12 4v16",
    "M5 16l4-5 3 3 6-8",
    "M6 18V10M12 18V6M18 18v-5",
    "M12 4l2.2 4.6L19 9.2l-3.5 3.4.8 4.9L12 15.2 7.7 17.5l.8-4.9L5 9.2l4.8-.6L12 4z",
  ];
  return (
    <span className="grid h-8 w-8 place-items-center rounded-full border border-brand/10 bg-brand-soft text-brand" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={paths[index % paths.length]} />
      </svg>
    </span>
  );
}

export function ArticleView({ article, hideCover = false, contentOnly = false }: ArticleViewProps) {
  const related = relatedInsights(article);
  const companion = article.companionSlug ? getInsight(article.companionSlug) : undefined;
  const sectionName = article.kind === "case" ? "AI 연구 협업 사례" : "AI 트렌드";
  const listHref = article.kind === "case" ? "/cases" : "/trends";
  const expertQuery = encodeURIComponent(article.technologies[0]?.title ?? article.topicLabel);

  return <PageContainer className={contentOnly ? "article-content-preview" : "py-4 md:py-5"}>
      {contentOnly ? null : <InsightViewBeacon slug={article.slug} kind={article.kind} />}
      {contentOnly ? null : <AnalyticsArticleBeacon kind={article.kind} slug={article.slug} />}
      {!contentOnly ? <nav aria-label="경로" className="truncate text-[11px] text-muted">
        <Link href="/" className="hover:text-ink">
          홈
        </Link>
        <span className="mx-1.5">›</span>
        <Link href={listHref} className="hover:text-ink">
          {sectionName}
        </Link>
        <span className="mx-1.5">›</span>
        <span className="text-ink">{article.title}</span>
      </nav> : null}

      <div className={contentOnly ? "" : "article-layout mt-5"}>
        {!contentOnly ? <ArticleToc
          placement="sidebar"
          items={article.sections.map((section) => ({ id: section.id, label: section.toc }))}
        /> : null}

        <article className="-mx-5 min-w-0 bg-card px-5 py-1 sm:mx-0 sm:rounded-card sm:border sm:border-line sm:p-5 sm:shadow-card md:p-6">
          <div className={hideCover ? "" : "xl:grid xl:grid-cols-[minmax(0,1fr)_280px] xl:gap-6"}>
            {!hideCover ? <figure className="xl:col-start-2 xl:row-start-1">
              <CoverArt
                theme={article.cover}
                src={article.coverSrc}
                priority
                sizes={`(min-width: 1280px) ${HEADER_FIGURE_WIDTH}px, (min-width: 768px) calc(100vw - 112px), calc(100vw - 40px)`}
                className="aspect-[4/2.6] w-full rounded-[8px] xl:aspect-auto xl:h-[232px]"
                alt={article.imageAlt}
              />
              <figcaption className="mt-2 text-center text-[11px] leading-5 text-pretty text-faint">
                <ReadableText
                  text={
                    article.imageCaption ??
                    "분야를 보여 주는 사진입니다. 이 글의 원본 연구 그림이 아닙니다."
                  }
                />
              </figcaption>
            </figure> : null}
            <div className="mt-4 xl:col-start-1 xl:row-start-1 xl:mt-0">
              <p className="text-[11px] font-semibold text-brand">
                {kindLabel(article.kind)}
                <span className="mx-2 text-line">|</span>
                <span className="font-medium text-muted">{article.field}</span>
              </p>
              <h1 className="mt-3 text-[26px] leading-[1.35] font-bold tracking-[-0.025em] text-pretty text-ink md:text-[30px]">
                <ReadableText text={article.title} breakOnColon />
              </h1>
              <p className="mt-3 text-[14px] leading-6 text-muted">
                <ReadableText text={article.summary} />
              </p>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {article.tags.slice(0, 3).map((tag) => (
                  <li key={tag}>
                    <KeywordTag label={tag} />
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 설명 길이와 상관없이 키워드와 날짜 사이에 같은 간격을 둡니다. */}
          <ul
            className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-4 text-[11px] text-faint xl:max-w-[calc(100%-var(--header-figure-offset))] xl:border-t-0 xl:pt-0"
            style={{ ["--header-figure-offset" as string]: `${hideCover ? 0 : HEADER_FIGURE_WIDTH + HEADER_FIGURE_GAP}px` }}
          >
            {article.institution ? <li>{article.institution}</li> : null}
            <li>{article.publishedOn}</li>
            <li>읽는 시간 {article.readingMinutes}분</li>
            <li className="font-semibold text-brand">
              {article.sourceUrl ? (
                <a
                  href={article.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="transition hover:text-ink"
                >
                  원문 보기 ↗
                </a>
              ) : (
                "원문 준비 중 ↗"
              )}
            </li>
          </ul>
          {article.sampleNotice ? <p className="mt-2 text-[10px] leading-4 text-faint">{article.sampleNotice}</p> : null}

          {companion ? (
            <nav aria-label="같은 주제, 다른 관점" className="article-companion mt-5 rounded-card border border-line p-4">
              <p className="text-xs font-semibold text-muted">같은 주제, 다른 관점</p>
              <TrackedArticleLink href={articlePath(companion)} eventName="related_article_open" target={`${companion.kind}/${companion.slug}`} className="mt-1 flex min-h-11 items-center justify-between gap-3 text-sm font-semibold text-brand hover:text-ink">
                <span>{article.kind === "case" ? "작동 원리를 쉽게 이해하기" : "실제 연구 적용 과정 살펴보기"}<span className="mt-1 block font-normal text-muted">{companion.title}</span></span>
                <span aria-hidden="true">→</span>
              </TrackedArticleLink>
              <p className="mt-1 text-xs leading-5 text-muted">같은 연구를 서로 다른 관점에서 설명합니다. 별개의 연구 성과가 아닙니다.</p>
            </nav>
          ) : null}

          <section className="mt-5 rounded-card bg-[linear-gradient(135deg,#f7f5ff_0%,#f2f1ff_100%)] p-4" aria-labelledby="summary-heading">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 id="summary-heading" className="text-sm font-bold text-brand">
                핵심 요약
              </h2>
              <span className="h-3 w-px bg-line" aria-hidden="true" />
              <p className="text-xs font-semibold text-ink">이 글을 30초 만에 이해하기</p>
            </div>
            <div className="mt-3 overflow-hidden rounded-[10px] border border-white/90 bg-white md:grid md:grid-cols-2 xl:grid-cols-4">
              {article.highlights.map((item, index) => (
                <div key={item.label} className="border-b border-line/80 p-3 last:border-b-0 md:[&:nth-child(odd)]:border-r xl:border-r xl:border-b-0 xl:last:border-r-0">
                  <HighlightIcon index={index} />
                  <h3 className="mt-2 text-[13px] font-semibold">{item.label}</h3>
                  <p className="mt-1 text-[11px] leading-[1.55] text-muted">{item.text}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="relative mt-6">
            <ArticleToc
              placement="inline"
              items={article.sections.map((section) => ({ id: section.id, label: section.toc }))}
            />
            <div className="mt-8 space-y-11">
            {article.sections.map((section, index) => (
              <section key={section.id} id={section.id} className="article-section">
                <h2 className="text-[20px] font-bold tracking-tight text-ink md:text-[22px]">
                  <span className="text-brand">{String(index + 1).padStart(2, "0")}.</span>{" "}
                  <ReadableText text={section.title} />
                </h2>
                {section.paragraphs.map((paragraph, paragraphIndex) => (
                  <ArticleParagraph key={`${section.id}-${paragraphIndex}`} paragraph={paragraph}>
                    <ReadableText text={typeof paragraph === "string" ? paragraph : paragraph.text} />
                  </ArticleParagraph>
                ))}
                <ArticleGlossary terms={(article.glossary ?? []).filter((term) => section.termIds?.includes(term.id))} />
                {/* 빈 배열도 JavaScript에서는 참입니다. 실제 항목이 있을 때만 그림·캡션을 표시합니다. */}
                {section.chips?.length ? (
                  <figure className="mt-5">
                    <ul className="grid grid-cols-4 gap-2 md:gap-3">
                      {section.chips.map((chip, chipIndex) => (
                        <li key={chip}>
                          <Image
                            src="/photos/histology.jpg"
                            alt=""
                            width={320}
                            height={192}
                            sizes="(min-width: 1280px) 160px, 25vw"
                            className={`h-16 w-full rounded-[6px] object-cover md:h-24 ${CHIP_CROPS[chipIndex % CHIP_CROPS.length]}`}
                          />
                          <p className="mt-1.5 text-center text-[9px] leading-4 text-muted md:text-xs">{chip}</p>
                        </li>
                      ))}
                    </ul>
                    <figcaption className="mt-3 text-center text-[11px] text-muted">이해를 돕는 사진입니다. 논문의 원본 그림이 아닙니다.</figcaption>
                  </figure>
                ) : null}
                {section.steps?.length ? (
                  <ol className="mt-5 grid gap-3 md:grid-cols-4">
                    {section.steps.map((step, stepIndex) => (
                      <li key={step.title} className="relative rounded-card border border-line bg-white p-4 shadow-card">
                        <p className="text-xs font-semibold text-brand">{String(stepIndex + 1).padStart(2, "0")}</p>
                        <p className="mt-2 text-sm font-semibold">{step.title}</p>
                        <p className="mt-1 text-xs leading-5 text-muted">{step.detail}</p>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </section>
            ))}
            </div>
          </div>
        </article>

        {!contentOnly ? <aside className="mt-8 space-y-4 xl:mt-0">
          <section className="rounded-card border border-line bg-card p-5 shadow-card">
            <h2 className="border-b border-line pb-3 text-sm font-semibold">연구 정보</h2>
            <dl className="text-[12px]">
              {article.facts.map((fact) => (
                <div key={fact.label} className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-2 border-b border-line/70 py-2.5 last:border-b-0">
                  <dt className="text-muted">{fact.label}</dt>
                  <dd className="min-w-0 break-words">
                    <FactValue value={fact.value} />
                  </dd>
                </div>
              ))}
            </dl>
            {article.sourceUrl ? (
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 block text-xs font-semibold leading-5 text-brand transition hover:text-ink"
              >
                {article.doi ? "DOI 원문 확인하기 ↗" : "원문 확인하기 ↗"}
              </a>
            ) : (
              <p className="mt-4 text-xs leading-5 text-muted">원문 링크는 출처 확인이 끝난 뒤에 연결합니다.</p>
            )}
          </section>

          {/* PC에서는 목차와 같이 헤더 아래에 붙습니다. 글이 끝나면 함께 풀립니다. */}
          <div className="space-y-4 xl:sticky xl:top-[calc(var(--header-height)+24px)] xl:h-fit">
          <section className="rounded-card border border-line bg-card p-5 shadow-card">
            <h2 className="text-sm font-semibold">관련 AI 기술</h2>
            <ul className="mt-3 space-y-2">
              {article.technologies.map((tech) => (
                <li key={tech.title} className="relative rounded-[8px] border border-line px-3 py-2.5 pl-10">
                  <span className="absolute top-3 left-3 grid h-5 w-5 place-items-center rounded-md bg-brand-soft text-xs text-brand" aria-hidden="true">◇</span>
                  <p className="text-xs font-semibold">{tech.title}</p>
                  <p className="mt-0.5 text-[10px] leading-4 text-muted">{tech.description}</p>
                  <span className="absolute top-1/2 right-2 -translate-y-1/2 text-muted" aria-hidden="true">›</span>
                </li>
              ))}
            </ul>
            <TrackedArticleLink
              href={`/experts?skill=${expertQuery}`}
              eventName="expert_search_click"
              target={`${article.kind}/${article.slug}`}
              className="mt-3 flex min-h-14 items-center justify-between rounded-[8px] bg-brand-soft px-3 text-xs font-semibold text-brand"
            >
              <span>이 기술을 다루는 전문가 찾기</span><span aria-hidden="true">→</span>
            </TrackedArticleLink>
          </section>

          {related.length > 0 ? (
            <section className="rounded-card border border-line bg-card p-5 shadow-card">
              <h2 className="text-sm font-semibold">관련 콘텐츠</h2>
              <ul className="mt-3 space-y-3">
                {related.map((item) => (
                  <li key={item.slug}>
                    <TrackedArticleLink href={articlePath(item)} eventName="related_article_open" target={`${item.kind}/${item.slug}`} className="flex gap-3 rounded-2xl hover:text-brand">
                      <CoverArt theme={item.cover} src={item.coverSrc} className="h-14 w-16 shrink-0 rounded-lg" sizes="64px" />
                      <span>
                        <span className="block text-sm font-semibold">{item.title}</span>
                        <span className="mt-1 block text-xs text-muted">{item.publishedOn}</span>
                      </span>
                    </TrackedArticleLink>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          </div>
        </aside> : null}
      </div>

      {!contentOnly && related.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-lg font-bold">이어서 볼 글</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {related.map((item) => (
              <RelatedArticleCard key={item.slug} article={item} />
            ))}
          </div>
        </section>
      ) : null}
    </PageContainer>;
}
