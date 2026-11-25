/** 글의 내용은 주제별 파일에서, 기존 화면에 맞추는 조립만 여기서 담당합니다. */
import type { InsightArticle, InsightParagraph, InsightParagraphKind, InsightSection, InsightTerm } from "./insights";
import { CASE_DETAILS } from "./insight-case-details";
import { TREND_DETAILS } from "./insight-trend-details";

export interface DetailPlan {
  source: string;
  sourceUrl: string;
  sourceTitle: string;
  evidenceScope: string;
  doi?: string;
  scenario?: boolean;
  appendOnly?: boolean;
  title?: string;
  summary?: string;
  // 공통 예문 대신 각 주제의 데이터·방법·검증 조건을 직접 작성합니다.
  context: string;
  problem: string;
  data: string;
  method: string;
  evidence: string;
  roles: string;
  pilot: string;
  limits: string;
  decision: string;
  questions: [string, string, string];
  terms: InsightTerm[];
  resultSummary: string;
  /** 기존 섹션에 주제별 설명을 보탭니다. 원문 설명과 편집자 예시의 유형도 남깁니다. */
  expansion?: Record<string, InsightParagraph[]>;
}

function section(
  id: string, title: string, text: string, kind: InsightParagraphKind = "body",
  termIds?: string[],
): InsightSection {
  return { id, toc: title, title, paragraphs: [{ kind, text }], termIds };
}

export function enrichInsight(article: InsightArticle): InsightArticle {
  const plan = CASE_DETAILS[article.slug] ?? TREND_DETAILS[article.slug];
  if (!plan) return article; // 이미 보강한 치주골·MatterGen 본문은 변경하지 않습니다.

  const isCase = article.kind === "case";
  const sections: InsightSection[] = [
    section("background", isCase ? "연구 질문과 배경" : "왜 이 기술을 알아야 할까?", plan.context),
    section("problem", isCase ? "기존 방법의 병목" : "기존 방법과 무엇이 다를까?", plan.problem),
    section("data", isCase ? "데이터와 정답 준비" : "입력과 준비 조건", plan.data),
    section("method", isCase ? "AI 방법을 쉽게 이해하기" : "쉬운 작동 원리", plan.method, "body", plan.terms.map((term) => term.id)),
    section("validation", isCase ? "검증 결과와 해석 범위" : "확인된 근거와 활용 예", plan.evidence),
    section("roles", "AI와 연구자가 맡는 일", plan.roles, "interpretation"),
    section("pilot", "내 연구의 작은 시험 설계", plan.pilot, "application"),
    section("limits", "한계와 오해하기 쉬운 점", plan.limits, "caution"),
    {
      ...section("decision", "도입 전 확인할 질문", plan.decision, "application"),
      steps: plan.questions.map((detail, index) => ({ title: `확인 ${index + 1}`, detail })),
    },
    {
      id: "sources", toc: "출처와 확인 수준", title: "출처와 확인 수준",
      paragraphs: [
        `${plan.sourceTitle} · ${plan.source}. ${plan.sourceUrl}`,
        plan.evidenceScope,
        "2026.10.19 로컬 본문 보강. 원문의 설명과 LabBridge의 역할 제안·시험 설계·주의 판단을 구분했습니다. 모델 실행이나 실험 재현을 수행한 글이 아니며 읽는 시간은 편집 추정치입니다.",
      ],
    },
  ];

  const baseSections = plan.appendOnly
    ? [...article.sections, ...sections.filter((item) => ["data", "roles", "pilot", "sources"].includes(item.id))
      .map((item) => item.id === "data" ? { ...item, termIds: plan.terms.map((term) => term.id) } : item)]
    : sections;
  // 목차를 불필요하게 늘리지 않고, 설명이 짧았던 문맥 바로 뒤에 문단을 추가합니다.
  const expandedSections = baseSections.map((item) => ({
    ...item,
    paragraphs: [...item.paragraphs, ...(plan.expansion?.[item.id] ?? [])],
  }));

  const updated: InsightArticle = {
    ...article,
    title: plan.title ?? article.title,
    summary: plan.summary ?? article.summary,
    source: plan.source,
    sourceUrl: plan.sourceUrl,
    doi: plan.doi,
    // 기존 등록일은 유지하고 원 연구의 연도와 보강일을 별도로 안내합니다.
    institution: plan.scenario ? undefined : article.institution,
    readingMinutes: 7,
    glossary: plan.terms,
    // 기존에 근거를 검토한 두 트렌드는 원문 설명을 보존하고 부족한 부분만 붙입니다.
    sections: expandedSections,
    sampleNotice: plan.scenario
      ? "설명용 연구 시나리오입니다. 특정 기관의 실제 협업·실험 성과를 보고한 글이 아닙니다. 참고 자료는 방법·검토 기준의 근거이며 이 시나리오의 성공을 입증하지 않습니다. 2026.10.19 보강; 이미지는 설명용입니다."
      : `2026.10.19 본문 보강. ${plan.evidenceScope} 카드 날짜는 편집용 등록일이며 원 연구 발표일과 다릅니다. 최신 성능 순위·LabBridge 수행 실적·실험 재현 보고가 아닙니다. 이미지는 설명용입니다.`,
    facts: [
      { label: "분야", value: article.field },
      { label: "활용 기술", value: article.topicLabel },
      { label: "자료 구분", value: plan.scenario ? "설명용 시나리오 / 성과 미확인" : isCase ? "발표 연구 해설" : "연구자를 위한 기술 해설" },
      { label: "참고 자료", value: plan.source },
      { label: "확인 범위", value: plan.evidenceScope },
      ...(plan.doi ? [{ label: "DOI", value: plan.doi }] : []),
    ],
    highlights: [
      { label: isCase ? "연구 문제" : "핵심 질문", text: plan.summary ?? article.summary },
      { label: "AI의 역할", text: `${plan.method.split(". ")[0].replace(/\.$/, "")}.` },
      { label: isCase ? "검증 범위" : "핵심 구분", text: plan.resultSummary },
      { label: "적용 전 확인", text: plan.questions[0] },
    ],
  };
  return updated;
}
