import type { Metadata } from "next";
import { UnifiedSearch } from "@/components/unified-search";
import { FAQS } from "@/lib/faq";
import { normalizeGlobalQuery, searchGlobalFaqs, searchGlobalInsights } from "@/lib/global-search";
import { listInsights } from "@/lib/insights";

export const metadata: Metadata = {
  title: "통합검색",
  description: "WHAT THE LAB 인사이트, AI 전문가, 자유게시판, FAQ를 한 번에 검색합니다.",
};

interface PageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = normalizeGlobalQuery(typeof q === "string" ? q : Array.isArray(q) ? q[0] ?? "" : "");
  // Use precisely the same source articles shown by the public cases/trends pages.
  const insights = [...listInsights("case"), ...listInsights("trend")];
  return (
    <UnifiedSearch
      key={query}
      query={query}
      insights={searchGlobalInsights(insights, query)}
      faqs={searchGlobalFaqs(FAQS, query)}
    />
  );
}
