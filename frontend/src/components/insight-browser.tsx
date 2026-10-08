"use client";

import Link from "next/link";
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
  listTitle: string;
  voiceTitle: string;
  voiceBody: string;
  voiceWho: string;
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
  listTitle,
  voiceTitle,
  voiceBody,
  voiceWho,
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
  const recent = [...articles].sort((left, right) => right.publishedOn.localeCompare(left.publishedOn)).slice(0, 3);

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
    <PageContainer className="py-8 md:py-10">
      <section className="rounded-card border border-line bg-card px-6 py-8 shadow-card md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold tracking-[0.14em] text-brand uppercase">
          <span>{eyebrow}</span>
          <span className="tracking-normal text-muted normal-case">
            최근 갱신 <b className="text-ink">{articles[0]?.publishedOn}</b>
            <span className="mx-1">|</span>
            총 {articles.length}건
          </span>
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">{title}</h1>
        <p className="mt-3 text-sm font-semibold">{kicker}</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>
      </section>

      <section className="mt-6 overflow-hidden rounded-card border border-line bg-card shadow-card md:grid md:min-h-[360px] md:grid-cols-2">
        <div className="flex flex-col items-start p-6 md:p-10">
          <p className="text-xs font-semibold tracking-[0.14em] text-brand uppercase">
            {kind === "case" ? "이번 주 추천 사례" : "주목 트렌드"}
          </p>
          <p className="mt-3 text-sm text-muted">
            {featured.field} · {featured.topicLabel}
          </p>
          <h2 className="mt-3 text-2xl font-bold leading-snug md:text-3xl">{featured.title}</h2>
          <p className="mt-3 text-sm leading-6 text-muted">{featured.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {featured.tags.map((tag) => (
              <KeywordTag key={tag} label={tag} />
            ))}
          </div>
          <Link href={articlePath(featured)} className="mt-6 inline-flex h-11 items-center rounded-button bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover">
            {kind === "case" ? "사례 보기" : "트렌드 읽기"} →
          </Link>
        </div>
        <CoverArt theme={featured.cover} className="aspect-video w-full md:aspect-auto md:h-full md:min-h-64" />
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end gap-3">
          <h2 className="text-2xl font-bold">{listTitle}</h2>
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
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {topics.map((item) => {
            const selected = topic === item.id || topic === item.label || (item.id === "all" && topic === "all");
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTopic(item.id)}
                className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-sm ${
                  selected ? "border-brand bg-brand text-white" : "border-line bg-white text-ink"
                }`}
                aria-pressed={selected}
              >
                {item.id !== "all" && kind === "case" ? <span className="mr-1 text-xs opacity-70">{item.id}</span> : null}
                {item.label}
                {kind === "case" ? <span className="ml-1 text-xs opacity-80">{topicCount(kind, item.id)}</span> : null}
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
          <div className="mt-5 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((article) => (
              <InsightCard key={article.slug} article={article} />
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

      <section className="mt-10 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-card border border-line bg-brand-soft p-6 text-ink md:p-8">
          <p className="text-xs font-semibold tracking-[0.14em] text-brand uppercase">
            {kind === "case" ? "연구자 한마디" : "이번 주 트렌드 요약"}
          </p>
          <h2 className="mt-3 text-2xl font-bold leading-snug">{voiceTitle}</h2>
          <p className="mt-4 text-sm leading-6 text-muted">{voiceBody}</p>
          <p className="mt-6 text-sm font-semibold">{voiceWho}</p>
        </div>
        <div className="rounded-card border border-line bg-card p-6 shadow-card">
          <h2 className="text-sm font-semibold text-brand">{kind === "case" ? "최근 추가된 사례" : "최근 추가된 트렌드"}</h2>
          <ul className="mt-4 space-y-4">
            {recent.map((article) => (
              <li key={article.slug}>
                <Link href={articlePath(article)} className="block hover:text-brand">
                  <p className="text-xs text-muted">{article.publishedOn}</p>
                  <p className="mt-1 font-semibold">{article.title}</p>
                  <p className="text-xs text-muted">
                    {article.field} · {article.source}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </PageContainer>
  );
}
