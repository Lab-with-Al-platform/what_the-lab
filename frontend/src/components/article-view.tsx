import Link from "next/link";
import { ArticleToc } from "@/components/article-toc";
import { PageContainer } from "@/components/page-container";
import { CoverArt } from "@/components/cover-art";
import { KeywordTag } from "@/components/keyword-tag";
import { InsightCard } from "@/components/insight-card";
import { articlePath, kindLabel, relatedInsights, type InsightArticle } from "@/lib/insights";

/** 같은 현미경 사진을 다른 위치로 잘라, 세포 종류마다 다른 연구 그림인 것처럼 보이지 않게 합니다. */
const CHIP_CROPS = ["object-[18%_35%]", "object-[72%_28%]", "object-[40%_78%]", "object-[82%_68%]"];

interface ArticleViewProps {
  article: InsightArticle;
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

export function ArticleView({ article }: ArticleViewProps) {
  const related = relatedInsights(article);
  const sectionName = article.kind === "case" ? "AI 연구 협업 사례" : "AI 트렌드";
  const listHref = article.kind === "case" ? "/cases" : "/trends";
  const expertQuery = encodeURIComponent(article.technologies[0]?.title ?? article.topicLabel);

  return (
    <PageContainer className="py-4 md:py-5">
      <nav aria-label="경로" className="truncate text-[11px] text-muted">
        <Link href="/" className="hover:text-ink">
          홈
        </Link>
        <span className="mx-1.5">›</span>
        <Link href={listHref} className="hover:text-ink">
          {sectionName}
        </Link>
        <span className="mx-1.5">›</span>
        <span className="text-ink">{article.title}</span>
      </nav>

      <div className="article-layout mt-5">
        <ArticleToc
          placement="sidebar"
          items={article.sections.map((section) => ({ id: section.id, label: section.toc }))}
        />

        <article className="-mx-5 min-w-0 bg-card px-5 py-1 sm:mx-0 sm:rounded-card sm:border sm:border-line sm:p-5 sm:shadow-card md:p-6">
          <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_240px] xl:gap-6">
            <figure className="xl:col-start-2 xl:row-start-1">
              <CoverArt theme={article.cover} className="aspect-[4/2.25] w-full rounded-[8px] xl:aspect-auto xl:h-[190px]" />
              <figcaption className="mt-1.5 text-center text-[10px] leading-4 text-faint">
                분야를 보여 주는 사진입니다. 이 글의 원본 연구 그림이 아닙니다.
              </figcaption>
            </figure>
            <div className="mt-4 xl:col-start-1 xl:row-start-1 xl:mt-0">
              <p className="text-[11px] font-semibold text-brand">
                {kindLabel(article.kind)}
                <span className="mx-2 text-line">|</span>
                <span className="font-medium text-muted">{article.field}</span>
              </p>
              <h1 className="mt-3 text-[26px] leading-[1.3] font-bold tracking-[-0.025em] text-ink md:text-[30px]">{article.title}</h1>
              <p className="mt-3 text-[14px] leading-6 text-muted">{article.summary}</p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {article.tags.slice(0, 3).map((tag) => (
                  <li key={tag}>
                    <KeywordTag label={tag} />
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <ul className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3 text-[11px] text-faint xl:-mt-1 xl:max-w-[calc(100%-264px)] xl:border-t-0 xl:pt-0">
            {article.institution ? <li>{article.institution}</li> : null}
            <li>{article.publishedOn}</li>
            <li>읽는 시간 {article.readingMinutes}분</li>
            <li className="font-semibold text-brand">원문 준비 중 ↗</li>
          </ul>
          {article.sampleNotice ? <p className="mt-2 text-[10px] leading-4 text-faint">{article.sampleNotice}</p> : null}

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
                  <span className="text-brand">{String(index + 1).padStart(2, "0")}.</span> {section.title}
                </h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="mt-3 text-[14px] leading-7 text-muted">
                    {paragraph}
                  </p>
                ))}
                {section.chips ? (
                  <figure className="mt-5">
                    <ul className="grid grid-cols-4 gap-2 md:gap-3">
                      {section.chips.map((chip, chipIndex) => (
                        <li key={chip}>
                          <img
                            src="/photos/histology.jpg"
                            alt=""
                            className={`h-16 w-full rounded-[6px] object-cover md:h-24 ${CHIP_CROPS[chipIndex % CHIP_CROPS.length]}`}
                          />
                          <p className="mt-1.5 text-center text-[9px] leading-4 text-muted md:text-xs">{chip}</p>
                        </li>
                      ))}
                    </ul>
                    <figcaption className="mt-3 text-center text-[11px] text-muted">이해를 돕는 사진입니다. 논문의 원본 그림이 아닙니다.</figcaption>
                  </figure>
                ) : null}
                {section.steps ? (
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

        <aside className="mt-8 space-y-4 xl:mt-0">
          <section className="rounded-card border border-line bg-card p-5 shadow-card">
            <h2 className="border-b border-line pb-3 text-sm font-semibold">연구 정보</h2>
            <dl className="text-[12px]">
              {article.facts.map((fact) => (
                <div key={fact.label} className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 border-b border-line/70 py-2.5 last:border-b-0">
                  <dt className="text-muted">{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs leading-5 text-muted">원문 링크는 출처 확인이 끝난 뒤에 연결합니다.</p>
          </section>

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
            <Link
              href={`/experts?skill=${expertQuery}`}
              className="mt-3 flex min-h-14 items-center justify-between rounded-[8px] bg-brand-soft px-3 text-xs font-semibold text-brand"
            >
              <span>이 기술을 다루는 전문가 찾기</span><span aria-hidden="true">→</span>
            </Link>
          </section>

          {related.length > 0 ? (
            <section className="rounded-card border border-line bg-card p-5 shadow-card">
              <h2 className="text-sm font-semibold">관련 콘텐츠</h2>
              <ul className="mt-3 space-y-3">
                {related.map((item) => (
                  <li key={item.slug}>
                    <Link href={articlePath(item)} className="flex gap-3 rounded-2xl hover:text-brand">
                      <CoverArt theme={item.cover} className="h-14 w-16 shrink-0 rounded-lg" />
                      <span>
                        <span className="block text-sm font-semibold">{item.title}</span>
                        <span className="mt-1 block text-xs text-muted">{item.publishedOn}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      {related.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-lg font-bold">이어서 볼 글</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {related.map((item) => (
              <InsightCard key={item.slug} article={item} />
            ))}
          </div>
        </section>
      ) : null}
    </PageContainer>
  );
}
