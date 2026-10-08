import type { Metadata } from "next";
import { Suspense } from "react";
import { InsightBrowser } from "@/components/insight-browser";
import { CASE_TOPICS, featuredInsight, insightsByKind } from "@/lib/insights";

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
        featured={featuredInsight("case")}
        topics={CASE_TOPICS}
        eyebrow="Insight · Case Study"
        title="AI 연구 협업 사례"
        kicker="실제 연구 · 검증된 결과 · 함께 푼 문제"
        description="비-AI 분야 연구실이 AI 전문가와 함께 실제 연구 문제를 풀어낸 사례를 모았습니다. 내 연구와 닮은 사례를 찾고, 키워드로 맞는 전문가를 떠올려 보세요."
        listTitle="전체 사례"
        voiceTitle="“라벨링에 쓰던 시간을 실험에 돌려받았어요”"
        voiceBody="세포 사진의 경계를 하나하나 그리는 일이 연구실 일과였다는 예시 인터뷰입니다. 실제 인물이 아니며, 상세 페이지는 아직 없습니다."
        voiceWho="세포생물학 연구실 연구원 · 예시"
        footnote="오디오 사례의 AI 기술 분야는 시안에서 컴퓨터 비전(AM-03)으로 임시 표기했습니다. 글 내용은 화면 배치용 예시입니다."
      />
    </Suspense>
  );
}
