import type { Metadata } from "next";
import { Suspense } from "react";
import { InsightBrowser } from "@/components/insight-browser";
import { TREND_TOPICS, featuredInsights, insightsByKind } from "@/lib/insights";

export const metadata: Metadata = {
  title: "AI 트렌드",
};

export default function TrendsPage() {
  const articles = insightsByKind("trend");

  return (
    <Suspense fallback={<p className="px-6 py-16 text-sm text-muted">트렌드 목록을 준비하는 중입니다.</p>}>
      <InsightBrowser
        kind="trend"
        articles={articles}
        // 주목 트렌드는 3개를 7초씩 돌아가며 보여 줍니다.
        featuredItems={featuredInsights("trend", 3)}
        topics={TREND_TOPICS}
        eyebrow="AI · Research Trends"
        title="AI 트렌드"
        kicker="연구실에서 읽는, 지금의 AI 흐름"
        description="AI를 전공하지 않은 연구자도 따라올 수 있게, 연구에 쓸 만한 AI 소식과 원문 근거를 골라 짧게 정리합니다."
        listTitle="최신 트렌드"
        footnote="Co-Scientist·MatterGen·AlphaEvolve 글은 원 논문과 공식 연구기관 발표를 확인해 작성했습니다. 나머지 트렌드 글에는 화면 시안용 예시 콘텐츠가 포함되어 있습니다."
      />
    </Suspense>
  );
}
