import { publicPageMetadata } from "@/lib/site-seo";
import { InsightBrowser } from "@/components/insight-browser";
import { CASE_TOPICS, featuredInsights, listInsights, topicCounts } from "@/lib/insights";

export const metadata = publicPageMetadata("/cases");

export default function CasesPage() {
  return (
    <InsightBrowser
      kind="case"
      articles={listInsights("case")}
      featuredItems={featuredInsights("case", 4)}
      topics={CASE_TOPICS}
      topicCounts={topicCounts("case")}
      eyebrow="Research Stories"
      title="AI 연구 협업 사례"
      kicker="연구의 문제를 AI로 풀어낸 이야기"
      description="연구팀이 AI를 실제 연구 문제에 어떻게 적용했는지 논문을 바탕으로 살펴봅니다. 내 연구와 닮은 문제를 찾고, 결과가 적용되는 범위와 한계도 확인해 보세요."
      listTitle="전체 사례"
      footnote="공개된 연구를 소개합니다. LabBridge에서 직접 수행한 협업 실적이 아니며, 근거와 검증 범위는 글마다 표시합니다."
    />
  );
}
