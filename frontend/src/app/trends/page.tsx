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
        description="AI를 전공하지 않은 연구자도 따라올 수 있게, 연구에 쓸 만한 AI 소식만 골라 짧게 정리합니다. 지금 보이는 글은 모두 화면 시안용 예시입니다."
        featuredHeadline={"논문 읽기부터 실험 설계까지,\nAI는 어디까지 도울 수 있을까요?"}
        featuredDescription="문헌 검색과 요약을 넘어 실험 계획의 초안까지. 연구 보조 에이전트의 가능성과 연구자가 직접 확인해야 할 지점을 살펴보세요."
        listTitle="최신 트렌드"
        footnote="트렌드 데이터는 아직 수집 전입니다. 이 페이지의 글·출처·날짜는 모두 화면 배치 확인용 예시입니다."
      />
    </Suspense>
  );
}
