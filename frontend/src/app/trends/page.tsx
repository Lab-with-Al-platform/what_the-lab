import type { Metadata } from "next";
import { InsightBrowser } from "@/components/insight-browser";
import { TREND_TOPICS, featuredInsights, listInsights, topicCounts } from "@/lib/insights";

export const metadata: Metadata = {
  title: "AI 트렌드",
};

export default function TrendsPage() {
  return (
    <InsightBrowser
      kind="trend"
      articles={listInsights("trend")}
      featuredItems={featuredInsights("trend", 3)}
      topics={TREND_TOPICS}
      topicCounts={topicCounts("trend")}
      eyebrow="AI · Research Trends"
      title="AI 트렌드"
      kicker="연구실에서 읽는, 지금의 AI 흐름"
      description="AI를 전공하지 않은 연구자도 따라올 수 있게, 연구에 쓸 만한 AI 소식과 원문 근거를 골라 짧게 정리합니다."
      listTitle="최신 트렌드"
      footnote="Co-Scientist·MatterGen·AlphaEvolve 글은 원 논문과 공식 연구기관 발표를 확인해 작성했습니다. 나머지 트렌드 글에는 화면 시안용 예시 콘텐츠가 포함되어 있습니다."
    />
  );
}
