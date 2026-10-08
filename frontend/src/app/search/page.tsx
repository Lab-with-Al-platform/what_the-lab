import type { Metadata } from "next";
import Link from "next/link";
import { InsightCard } from "@/components/insight-card";
import { PageContainer } from "@/components/page-container";
import { searchInsights } from "@/lib/insights";

export const metadata: Metadata = { title: "검색" };

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const results = query ? searchInsights(query) : [];

  return (
    <PageContainer className="py-10">
      <h1 className="text-3xl font-bold">검색</h1>
      <form action="/search" className="mt-5 flex gap-2">
        <label className="sr-only" htmlFor="search-q">
          검색어
        </label>
        <input
          id="search-q"
          name="q"
          defaultValue={query}
          className="h-11 flex-1 rounded-full border border-line bg-white px-4 text-sm"
        />
        <button type="submit" className="rounded-full bg-brand px-5 text-sm font-semibold text-white">
          검색
        </button>
      </form>
      {!query ? <p className="mt-6 text-sm text-muted">사례와 트렌드 제목, 분야, 태그를 검색합니다.</p> : null}
      {query && results.length === 0 ? (
        <p className="mt-6 text-sm text-muted">‘{query}’에 해당하는 글이 없습니다.</p>
      ) : null}
      {results.length > 0 ? (
        <>
          <p className="mt-6 text-sm text-muted">{results.length}건</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {results.map((article) => (
              <InsightCard key={article.slug} article={article} />
            ))}
          </div>
        </>
      ) : null}
      <Link href="/" className="mt-8 inline-flex text-sm font-semibold text-brand">
        홈으로 →
      </Link>
    </PageContainer>
  );
}
