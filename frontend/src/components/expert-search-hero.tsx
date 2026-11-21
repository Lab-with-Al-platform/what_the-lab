import { PageLeadHeader } from "@/components/page-lead-header";

/** 전문가 찾기 상단은 공통 흰 헤더와 연구 사진을 씁니다. */
export function ExpertSearchHero() {
  return (
    <PageLeadHeader
      kicker="FIND EXPERTS"
      title="AI 전문가 찾기"
      lead="함께 연구할 AI 전문가를 만나보세요."
      artSrc="/headers/experts-lead.jpg"
      artKind="photo"
    />
  );
}
