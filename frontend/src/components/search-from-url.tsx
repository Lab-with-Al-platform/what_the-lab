"use client";

import { useSearchParams } from "next/navigation";
import { UnifiedSearch } from "@/components/unified-search";
import { FAQS } from "@/lib/faq";
import { normalizeGlobalQuery, searchGlobalFaqs, searchGlobalInsights } from "@/lib/global-search";
import type { InsightListItem } from "@/lib/insight-meta";

/** 주소의 ?q= 검색어를 브라우저에서 읽어 통합검색 결과를 만들어요 (정적 빌드라 서버가 없어요). */
export function SearchFromUrl({ insights }: { insights: InsightListItem[] }) {
  const query = normalizeGlobalQuery(useSearchParams().get("q") ?? "");
  return (
    <UnifiedSearch
      key={query}
      query={query}
      insights={searchGlobalInsights(insights, query)}
      faqs={searchGlobalFaqs(FAQS, query)}
    />
  );
}
