import type { Metadata } from "next";
import { Suspense } from "react";
import { InsightBrowser } from "@/components/insight-browser";
import { CASE_TOPICS, featuredInsights, insightsByKind } from "@/lib/insights";

export const metadata: Metadata = {
  title: "AI 연구 협업 사례",
};

export default function CasesPage() {
  const articles = insightsByKind("case");

  return (
    <Suspense fallback={<p className="px-6 py-16 text-sm text-muted">사례 목록을 준비하는 중입니다.</p>}>
      <InsightBrowser
        kind="case"
        articles={articles}
        // 추천 사례는 4개를 7초씩 돌아가며 보여 줍니다.
        featuredItems={featuredInsights("case", 4)}
        topics={CASE_TOPICS}
        eyebrow="Research Stories"
        title="AI 연구 협업 사례"
        kicker="연구의 문제를 AI로 풀어낸 이야기"
        description="비-AI 분야 연구실이 AI 전문가와 함께 실제 연구 문제를 풀어낸 사례를 모았습니다. 내 연구와 닮은 사례를 찾고, 키워드로 맞는 전문가를 떠올려 보세요."
        listTitle="전체 사례"
        footnote="새로 게시한 3개 글은 DOI와 초록에서 확인한 실증 연구를 바탕으로 작성했습니다. 대표 이미지는 원 논문 도판이 아닌 설명용 생성 이미지입니다."
      />
    </Suspense>
  );
}
