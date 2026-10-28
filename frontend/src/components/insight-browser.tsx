import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { CoverArt } from "@/components/cover-art";
import { KeywordTag } from "@/components/keyword-tag";
import { PageContainer } from "@/components/page-container";
import { InsightList } from "@/components/insight-list";
import { articlePath, type InsightKind, type InsightListItem, type InsightTopic } from "@/lib/insight-meta";

interface InsightBrowserProps {
  kind: InsightKind;
  articles: InsightListItem[];
  featured: InsightListItem;
  topics: InsightTopic[];
  topicCounts: Record<string, number>;
  eyebrow: string;
  title: string;
  kicker: string;
  description: string;
  featuredHeadline: string;
  featuredDescription: string;
  listTitle: string;
  // 인용 콘텐츠가 있는 페이지만 이 묶음을 전달합니다.
  perspective?: {
    title: string;
    body: string;
    who: string;
  };
  footnote?: string;
}

export function InsightBrowser({
  kind,
  articles,
  featured,
  topics,
  topicCounts,
  eyebrow,
  title,
  kicker,
  description,
  featuredHeadline,
  featuredDescription,
  listTitle,
  perspective,
  footnote,
}: InsightBrowserProps) {
  return (
    <div className="insight-editorial">
      {/* 페이지 제목은 추천 사진 영역 밖에 두어 페이지의 역할을 먼저 알립니다. */}
      <header className="insight-page-heading">
        <PageContainer>
          <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">{eyebrow}</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="insight-page-heading__title">{title}</h1>
              <p className="mt-3 text-sm text-muted md:text-base">{kicker}</p>
            </div>
            <p className="text-xs text-muted">
              총 {articles.length}건 · {kind === "case" ? "실증 사례·시안 콘텐츠" : "검증 글·시안 콘텐츠"}
            </p>
          </div>
          <p className="sr-only">{description}</p>
        </PageContainer>
      </header>

      <section aria-labelledby={`${kind}-feature-heading`}>
        {/* 배경 사진의 기준점을 화면 전체가 아닌 공통 본문 프레임으로 제한합니다. */}
        <PageContainer className="insight-feature">
          {/* 사진 위에 배경색 그라데이션을 겹쳐 글과 이미지의 경계를 없앱니다. */}
          <div className="insight-feature__art" aria-hidden="true">
            <CoverArt
              theme={featured.cover} src={featured.coverSrc} className="h-full w-full" priority
              sizes="(min-width: 1440px) 960px, (min-width: 1024px) 68vw, (min-width: 768px) 80vw, 100vw"
            />
          </div>
          <div className="relative z-10">
            <div className="insight-feature__copy">
              <p className="text-xs font-semibold tracking-[0.08em] text-brand">
                {kind === "case" ? "이번 주 추천 사례" : "이번 주 주목 트렌드"}
              </p>
              <h2 id={`${kind}-feature-heading`} className="insight-feature__title">{featuredHeadline}</h2>
              <p className="mt-4 max-w-lg text-sm leading-7 text-muted md:text-base">{featuredDescription}</p>
              <p className="mt-3 text-xs text-muted">
                {featured.field}
                {featured.field !== featured.topicLabel ? ` · ${featured.topicLabel}` : ""}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {featured.tags.map((tag) => <KeywordTag key={tag} label={tag} />)}
              </div>
              <Link href={articlePath(featured)} className="mt-6 inline-flex min-h-11 items-center gap-3 rounded-button bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-hover">
                {kind === "case" ? "연구 과정 살펴보기" : "트렌드 살펴보기"}
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* 공통 푸터에 이미 바깥 여백이 있으므로 목록 끝의 여백을 중복하지 않습니다. */}
      <PageContainer>
        <Suspense fallback={<p className="pt-8 text-sm text-muted">목록을 준비하는 중입니다.</p>}>
          <InsightList
            kind={kind}
            articles={articles}
            topics={topics}
            topicCounts={topicCounts}
            listTitle={listTitle}
            footnote={footnote}
          />
        </Suspense>

        {perspective ? (
          <section className="insight-perspective" aria-labelledby={`${kind}-perspective-heading`}>
            <div className="insight-perspective__art" aria-hidden="true">
              <Image src="/photos/lab.jpg" alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover object-[center_36%]" />
            </div>
            <div className="insight-perspective__copy">
              <h2 id={`${kind}-perspective-heading`} className="text-xs font-semibold tracking-[0.12em] text-brand">연구자의 시선</h2>
              <figure className="mt-3">
                <div className="flex items-start gap-3 md:gap-4">
                  <span aria-hidden="true" className="insight-perspective__mark">“</span>
                  <blockquote className="insight-perspective__quote">{perspective.title}</blockquote>
                </div>
                <figcaption className="mt-3 text-sm font-semibold text-muted">{perspective.who}</figcaption>
              </figure>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{perspective.body}</p>
              <p className="mt-2 text-xs text-faint">디자인 검토용 예시 · 사진은 인터뷰 인물과 무관한 연구 현장 이미지입니다.</p>
            </div>
          </section>
        ) : null}
      </PageContainer>
    </div>
  );
}
