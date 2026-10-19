"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CoverArt } from "@/components/cover-art";
import { KeywordTag } from "@/components/keyword-tag";
import { PageContainer } from "@/components/page-container";
import { InsightCard } from "@/components/insight-card";
import {
  articlePath,
  kindLabel,
  matchesTopicFilter,
  topicCount,
  type InsightArticle,
  type InsightKind,
  type InsightTopic,
} from "@/lib/insights";

const PAGE_SIZE = 6;

interface InsightBrowserProps {
  kind: InsightKind;
  articles: InsightArticle[];
  featured: InsightArticle;
  topics: InsightTopic[];
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const topic = searchParams.get("topic") ?? "all";
  const [sort, setSort] = useState<"latest" | "title">("latest");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const matched = articles.filter((article) => matchesTopicFilter(article, topic));
    return [...matched].sort((left, right) => {
      if (sort === "title") {
        return left.title.localeCompare(right.title, "ko");
      }
      return right.publishedOn.localeCompare(left.publishedOn);
    });
  }, [articles, sort, topic]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function selectTopic(nextTopic: string) {
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    if (nextTopic === "all") {
      params.delete("topic");
    } else {
      params.set("topic", nextTopic);
    }
    const query = params.toString();
    router.replace(query ? `?${query}` : "?", { scroll: false });
  }

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
            <CoverArt theme={featured.cover} src={featured.coverSrc} className="h-full w-full" />
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
        <section className="pt-8 md:pt-10" aria-labelledby={`${kind}-list-heading`}>
          <div className="flex flex-wrap items-end gap-3">
            <h2 id={`${kind}-list-heading`} className="text-2xl font-bold">{listTitle}</h2>
            <p className="text-sm text-muted">{kind === "case" ? "AI 기술 분야로 골라 보기" : "주제로 골라 보기"}</p>
            <label className="ml-auto text-sm text-muted">
              정렬{" "}
              <select
                className="bg-transparent font-semibold text-ink"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as "latest" | "title");
                  setPage(1);
                }}
              >
                <option value="latest">{kind === "case" ? "최신 등록순" : "최신순"}</option>
                <option value="title">제목순</option>
              </select>
            </label>
          </div>
          {/* 공간이 부족하면 다음 줄로 내려가 모든 분야를 가로 스크롤 없이 보여 줍니다. */}
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="주제 필터">
            {topics.map((item) => {
              const selected = topic === item.id || topic === item.label || (item.id === "all" && topic === "all");
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectTopic(item.id)}
                  className={`inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-3 py-2 text-left text-sm ${
                    selected ? "border-brand bg-brand text-white" : "border-line bg-white text-ink"
                  }`}
                  aria-pressed={selected}
                >
                  {/* 분류 코드는 선택·검색에만 사용하고, 사용자는 분야 이름으로 구분합니다. */}
                  <span className="min-w-0 [overflow-wrap:anywhere]">{item.label}</span>
                  {kind === "case" ? <span className="shrink-0 text-xs opacity-80">{topicCount(kind, item.id)}</span> : null}
                </button>
              );
            })}
          </div>
          {topic !== "all" && !topics.some((item) => item.id === topic || item.label === topic) ? (
            <p className="mt-3 text-sm text-muted">
              ‘{topic}’ 분야만 보는 중입니다.{" "}
              <button type="button" className="font-semibold text-brand" onClick={() => selectTopic("all")}>
                전체 보기
              </button>
            </p>
          ) : null}

          {visible.length === 0 ? (
            <p className="mt-6 rounded-2xl bg-white px-5 py-10 text-sm text-muted">이 조건에 해당하는 글이 없습니다. 다른 분야를 선택해 보세요.</p>
          ) : (
            <div className="mt-6 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="콘텐츠 목록">
              {visible.map((article) => (
                <InsightCard key={article.slug} article={article} variant="editorial" />
              ))}
            </div>
          )}
          {footnote ? <p className="mt-4 text-xs leading-5 text-muted">{footnote}</p> : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              className="inline-flex h-11 items-center rounded-button border border-ink px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              disabled={safePage >= pageCount}
              onClick={() => setPage(safePage + 1)}
            >
              {kindLabel(kind)} 더 보기 ↓
            </button>
            <nav aria-label="페이지" className="flex gap-2 text-sm">
              {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  aria-current={pageNumber === safePage ? "page" : undefined}
                  className={`grid h-11 w-11 place-items-center rounded-button ${
                    pageNumber === safePage ? "bg-ink text-white" : "bg-white text-ink"
                  }`}
                >
                  {pageNumber}
                </button>
              ))}
            </nav>
          </div>
        </section>

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
