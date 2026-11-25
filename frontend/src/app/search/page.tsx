import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchFromUrl } from "@/components/search-from-url";
import { listInsights } from "@/lib/insights";

export const metadata: Metadata = {
  title: "통합검색",
  description: "WHAT THE LAB 인사이트, AI 전문가, 자유게시판, FAQ를 한 번에 검색합니다.",
};

export default function SearchPage() {
  // Use precisely the same source articles shown by the public cases/trends pages.
  const insights = [...listInsights("case"), ...listInsights("trend")];
  return (
    <Suspense>
      <SearchFromUrl insights={insights} />
    </Suspense>
  );
}
