import type { Metadata } from "next";
import { Suspense } from "react";
import { InsightBrowser } from "@/components/insight-browser";
import { TREND_TOPICS, featuredInsight, insightsByKind } from "@/lib/insights";

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
        featured={featuredInsight("trend")}
        topics={TREND_TOPICS}
        eyebrow="AI · Research Trends"
        title="AI 트렌드"
        kicker="연구실에서 읽는, 지금의 AI 흐름"
        description="AI를 전공하지 않은 연구자도 따라올 수 있게, 연구에 쓸 만한 AI 소식과 원문 근거를 골라 짧게 정리합니다."
        featuredHeadline={"AI가 가설을 만들고 토론하면,\n연구자는 무엇을 검증해야 할까요?"}
        featuredDescription="2026년 Nature에 발표된 Co-Scientist를 통해 멀티에이전트의 작동 방식과 실제 연구에서 지켜야 할 검증 경계를 살펴봅니다."
        listTitle="최신 트렌드"
        footnote="Co-Scientist 글은 Nature 원 논문과 Google DeepMind 공식 발표를 확인해 작성했습니다. 나머지 트렌드 글에는 화면 시안용 예시 콘텐츠가 포함되어 있습니다."
      />
    </Suspense>
  );
}
