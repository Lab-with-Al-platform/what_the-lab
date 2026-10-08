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
        eyebrow="Insight · Trend"
        title="AI 트렌드"
        kicker="연구실에서 읽는 · 이번 주 AI 흐름"
        description="AI를 전공하지 않은 연구자도 따라올 수 있게, 연구에 쓸 만한 AI 소식만 골라 짧게 정리합니다. 지금 보이는 글은 모두 화면 시안용 예시입니다."
        listTitle="최신 트렌드"
        voiceTitle="“AI가 연구를 대신하기보다 연구의 병목을 줄이는 쪽으로”"
        voiceBody="이번 주 소식을 한 줄로 묶으면 보조입니다. 문헌 정리, 이미지 라벨링, 실험 조건 탐색처럼 오래 걸리던 단계를 AI가 맡고, 판단과 검증은 연구자가 둡니다."
        voiceWho="LabBridge 에디터 · 예시 코멘트"
        footnote="트렌드 데이터는 아직 수집 전입니다. 이 페이지의 글·출처·날짜는 모두 화면 배치 확인용 예시입니다."
      />
    </Suspense>
  );
}
