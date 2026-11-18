import { publicPageMetadata } from "@/lib/site-seo";
import { InsightBrowser } from "@/components/insight-browser";
import { TREND_TOPICS, featuredInsights, listInsights, topicCounts } from "@/lib/insights";

export const metadata = publicPageMetadata("/trends");

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
      listTitle="AI 기술과 연구 방법"
      footnote="논문, 공식 지침, 연구 자료에 근거한 해설입니다. 출처가 뒷받침하는 범위와 연구실에서 따로 확인할 점을 글마다 안내합니다."
    />
  );
}
