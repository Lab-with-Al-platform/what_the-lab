/**
 * 목록·카드가 쓰는 가벼운 정보입니다.
 * 본문(sections, glossary)은 넣지 않아서, 목록 화면 JS가 원고 전체를 받지 않게 합니다.
 */

export type InsightKind = "case" | "trend";

export type CoverTheme =
  | "cells"
  | "biomass"
  | "dental"
  | "concrete"
  | "coScientist"
  | "mattergen"
  | "alphaEvolve"
  | "turbines"
  | "brain"
  | "protein"
  | "climate"
  | "battery"
  | "flow"
  | "molecule"
  | "script"
  | "solar"
  | "audio"
  | "agent"
  | "food"
  | "medical"
  | "chart";

export interface InsightTopic {
  id: string;
  label: string;
}

/** 홈·목록 카드와 필터에 필요한 칸만 남긴 글 요약입니다. */
export interface InsightListItem {
  slug: string;
  kind: InsightKind;
  title: string;
  summary: string;
  field: string;
  topicId: string;
  topicLabel: string;
  domains: string[];
  tags: string[];
  publishedOn: string;
  readingMinutes: number;
  cover: CoverTheme;
  coverSrc?: string;
  /** 목록 상단 추천 영역에 나오는 순서. 숫자가 작을수록 먼저 나옵니다. */
  featuredRank?: number;
  /** 추천 영역 전용 질문형 제목. 줄바꿈은 줄바꿈 문자로 지정합니다. */
  featuredHeadline?: string;
  featuredSummary?: string;
}

export function articlePath(article: Pick<InsightListItem, "kind" | "slug">): string {
  const section = article.kind === "case" ? "cases" : "trends";
  return `/${section}/${article.slug}`;
}

export function kindLabel(kind: InsightKind): string {
  return kind === "case" ? "AI 연구 협업 사례" : "AI 트렌드";
}

export function matchesTopicFilter(
  article: Pick<InsightListItem, "topicId" | "topicLabel" | "domains" | "field">,
  topic: string,
): boolean {
  if (!topic || topic === "all") {
    return true;
  }
  if (article.topicId === topic || article.topicLabel === topic) {
    return true;
  }
  if (topic === "LLM·생성형 AI") {
    return article.topicId === "llm" || article.topicId === "generative" || article.domains.includes(topic);
  }
  return article.domains.includes(topic) || article.field.includes(topic);
}
