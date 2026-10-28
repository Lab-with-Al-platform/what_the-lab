import type { Metadata } from "next";
import { InsightBrowser } from "@/components/insight-browser";
import { CASE_TOPICS, featuredInsight, listInsights, toListItem, topicCounts } from "@/lib/insights";

export const metadata: Metadata = {
  title: "AI 연구 협업 사례",
};

export default function CasesPage() {
  return (
    <InsightBrowser
      kind="case"
      articles={listInsights("case")}
      featured={toListItem(featuredInsight("case"))}
      topics={CASE_TOPICS}
      topicCounts={topicCounts("case")}
      eyebrow="Research Stories"
      title="AI 연구 협업 사례"
      kicker="연구의 문제를 AI로 풀어낸 이야기"
      description="비-AI 분야 연구실이 AI 전문가와 함께 실제 연구 문제를 풀어낸 사례를 모았습니다. 내 연구와 닮은 사례를 찾고, 키워드로 맞는 전문가를 떠올려 보세요."
      featuredHeadline={"사진만으로 작물의 무게를\n예측할 수 있을까요?"}
      featuredDescription="상추와 케일 사진에서 잎 면적·폭·높이를 측정하고 회귀 모델로 생체중을 추정한 국내 연구 사례입니다."
      listTitle="전체 사례"
      footnote="새로 게시한 3개 글은 DOI와 초록에서 확인한 실증 연구를 바탕으로 작성했습니다. 대표 이미지는 원 논문 도판이 아닌 설명용 생성 이미지입니다."
    />
  );
}
