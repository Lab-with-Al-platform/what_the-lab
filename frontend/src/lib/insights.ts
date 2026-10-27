/**
 * 로컬 인사이트의 목록 정보와 기존 보강 원고입니다.
 * 추가 본문은 insight-enrichment.ts에서 주제별 자료와 조립합니다.
 * 실제 연구 해설과 설명용 시나리오를 구분하며 운영 DB 게시물은 아닙니다.
 */
import { enrichInsight } from "./insight-enrichment";
import { applyInsightCover } from "./insight-covers";

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

export interface InsightStep {
  title: string;
  detail: string;
}

export type InsightParagraphKind = "body" | "interpretation" | "application" | "caution";

/** 원문 설명과 편집자 의견을 데이터 단계에서 나눕니다. 기존 일반 문장도 허용합니다. */
export interface InsightParagraph {
  kind: InsightParagraphKind;
  text: string;
}

export interface InsightTerm {
  id: string;
  label: string;
  definition: string;
  example?: string;
  caution?: string;
}

export interface InsightSection {
  id: string;
  toc: string;
  title: string;
  paragraphs: Array<string | InsightParagraph>;
  termIds?: string[];
  steps?: InsightStep[];
  chips?: string[];
}

export interface InsightFact {
  label: string;
  value: string;
}

export interface InsightHighlight {
  label: string;
  text: string;
}

export interface InsightTechnology {
  title: string;
  description: string;
}

export interface InsightArticle {
  slug: string;
  kind: InsightKind;
  title: string;
  summary: string;
  field: string;
  topicId: string;
  topicLabel: string;
  domains: string[];
  tags: string[];
  source: string;
  publishedOn: string;
  readingMinutes: number;
  cover: CoverTheme;
  /** 글별 표지가 있으면 공통 분야 사진보다 우선합니다. */
  coverSrc?: string;
  institution?: string;
  doi?: string;
  sourceUrl?: string;
  imageAlt?: string;
  imageCaption?: string;
  sampleNotice?: string;
  /** 목록 상단 추천 영역에 나오는 순서. 숫자가 작을수록 먼저 나옵니다. */
  featuredRank?: number;
  /** 추천 영역 전용 질문형 제목. 줄바꿈은 
으로 지정합니다. */
  featuredHeadline?: string;
  featuredSummary?: string;
  companionSlug?: string;
  glossary?: InsightTerm[];
  highlights: InsightHighlight[];
  sections: InsightSection[];
  facts: InsightFact[];
  technologies: InsightTechnology[];
  relatedSlugs: string[];
}

export interface InsightTopic {
  id: string;
  label: string;
}

export const CASE_TOPICS: InsightTopic[] = [
  { id: "all", label: "전체" },
  { id: "AM-01", label: "그래프·기하학적 딥러닝" },
  { id: "AM-02", label: "시계열·시공간 딥러닝" },
  { id: "AM-03", label: "컴퓨터 비전" },
  { id: "AM-04", label: "생성형 AI·확산 모델" },
  { id: "AM-05", label: "물리 기반 AI·신경 연산자" },
  { id: "AM-06", label: "탐색·최적화" },
  { id: "AM-07", label: "자연어 처리·LLM" },
  { id: "AM-08", label: "전통 머신러닝·회귀" },
];

export const TREND_TOPICS: InsightTopic[] = [
  { id: "all", label: "전체" },
  { id: "llm", label: "LLM·에이전트" },
  { id: "vision", label: "비전" },
  { id: "science", label: "과학 AI" },
  { id: "generative", label: "생성형 AI" },
  { id: "forecast", label: "시계열·예측" },
  { id: "oss", label: "오픈소스·도구" },
  { id: "ethics", label: "정책·연구윤리" },
];

const CASE_OUTLINE: Array<[string, string, string]> = [
  ["background", "연구 배경과 문제", "어떤 연구 문제였을까?"],
  ["limits", "기존 방식의 한계", "기존 방식은 어디서 막힐까?"],
  ["method", "AI 활용 방법", "AI를 어떻게 활용했을까?"],
  ["results", "주요 결과", "무엇이 달라졌나?"],
  ["meaning", "연구 의미와 활용성", "다른 연구에 어떻게 이어질까?"],
  ["caveats", "고려할 점과 한계", "적용 전에 볼 점은?"],
  ["sources", "관련 연구 및 자료", "어디에 근거했나?"],
];

const TREND_OUTLINE: Array<[string, string, string]> = [
  ["intro", "기술 소개", "무슨 기술인가?"],
  ["difference", "기존과의 차이", "예전 방식과 무엇이 다른가?"],
  ["how", "쉬운 작동 개념", "어떻게 동작한다고 이해하면 될까?"],
  ["fields", "연구 활용 분야", "어떤 연구에 써 볼 수 있나?"],
  ["caveats", "한계·주의점", "어디부터는 사람이 봐야 할까?"],
  ["related", "관련 기술", "함께 볼 기술"],
];

const SAMPLE_BODY = [
  "연구실에서 같은 일을 사람이 직접 하면 시간이 오래 걸리고, 사람마다 기준이 달라질 수 있습니다.",
  "AI는 반복되는 판별이나 계산을 돕고, 연구자는 결과를 확인하고 다음 실험을 정합니다.",
  "이 글의 수치와 기관명은 확정된 연구 기록이 아닙니다. 카드에 적힌 출처 이름만 참고해 주세요.",
  "비슷한 데이터와 질문을 가진 연구라면, 어디를 전문가에게 맡길지 가늠하는 출발점으로 읽을 수 있습니다.",
  "데이터 양, 라벨 품질, 연구실 밖 데이터에서의 성능은 따로 확인해야 합니다.",
];

const MATTERGEN_GLOSSARY: InsightTerm[] = [
  {
    id: "inverse-design", label: "역설계",
    definition: "원하는 결과나 성질을 먼저 정한 뒤, 그것을 낼 수 있는 구조·조합을 거꾸로 찾는 접근입니다.",
    example: "재료를 고르고 단단함을 재는 대신, 원하는 단단함을 정하고 재료 구조 후보를 제안받습니다.",
    caution: "목표를 입력했다고 실제 제조법이나 성공이 보장되지는 않습니다.",
  },
  {
    id: "screening", label: "스크리닝",
    definition: "이미 준비된 여러 후보를 같은 기준으로 살펴보고 조건에 맞는 것을 추리는 일입니다.",
    example: "도서 목록에서 조건에 맞는 책을 고르는 일에 비유할 수 있습니다. 새 책을 쓰는 일과는 다릅니다.",
  },
  {
    id: "diffusion", label: "확산 모델",
    definition: "학습 자료를 흐트러뜨리고 복원하는 과정을 배운 뒤, 생성할 때는 잡음에서 출발해 구조를 점차 만들어 가는 AI 모델의 한 종류입니다.",
    caution: "지워진 정답 하나를 찾아내는 과정은 아닙니다. 서로 다른 후보가 나올 수 있고 별도 검증이 필요합니다.",
  },
  {
    id: "fine-tuning", label: "추가 학습(파인튜닝)",
    definition: "이미 학습한 모델을 특정 목적에 더 잘 맞도록 관련 자료로 다시 학습시키는 과정입니다.",
    example: "여러 재료의 구조를 배운 모델에, 구조와 특정 물성 값이 함께 있는 자료를 더 학습시킵니다.",
    caution: "조건을 문장으로 입력하는 것과 추가 학습은 서로 다른 일입니다.",
  },
  {
    id: "dft", label: "DFT(밀도범함수 이론)",
    definition: "전자 밀도를 바탕으로 물질의 에너지와 성질을 계산하는 방법입니다. 이 연구에서는 생성한 구조를 계산으로 평가하는 데 사용했습니다.",
    caution: "계산 결과는 사용한 가정·설정의 영향을 받으며 실제 합성이나 측정을 대신하지 않습니다.",
  },
  {
    id: "sun", label: "SUN 지표",
    definition: "안정적(Stable)이고, 서로 중복되지 않으며(Unique), 기준 자료에 없는(New) 구조인지를 함께 살펴보는 지표입니다.",
    caution: "논문의 계산·중복 판정 기준에 따른 값입니다. 실제 합성 성공률과 같지 않습니다.",
  },
  {
    id: "bulk-modulus", label: "체적 탄성률 · GPa",
    definition: "체적 탄성률은 모든 방향에서 압력을 받을 때 부피가 줄어드는 데 얼마나 저항하는지 나타냅니다. GPa(기가파스칼)는 그 값을 표현하는 압력 단위입니다.",
    caution: "긁힘에 대한 저항인 경도나 모든 종류의 강도를 뜻하지는 않습니다.",
  },
];

interface ArticleSeed {
  slug: string;
  kind: InsightKind;
  title: string;
  summary: string;
  field: string;
  topicId: string;
  topicLabel: string;
  domains: string[];
  tags: string[];
  source: string;
  publishedOn: string;
  readingMinutes: number;
  cover: CoverTheme;
  institution?: string;
  doi?: string;
  sourceUrl?: string;
  imageAlt?: string;
  imageCaption?: string;
  sampleNotice?: string;
  /** 목록 상단 추천 영역에 나오는 순서. 숫자가 작을수록 먼저 나옵니다. */
  featuredRank?: number;
  /** 추천 영역 전용 질문형 제목. 줄바꿈은 
으로 지정합니다. */
  featuredHeadline?: string;
  featuredSummary?: string;
  companionSlug?: string;
  glossary?: InsightTerm[];
  highlights: InsightHighlight[];
  sections?: InsightSection[];
  facts?: InsightFact[];
  technologies: InsightTechnology[];
  relatedSlugs: string[];
}

function defaultFacts(seed: ArticleSeed): InsightFact[] {
  return [
    { label: "분야", value: seed.field },
    { label: "활용 기술", value: seed.topicLabel },
    { label: "발표일", value: seed.publishedOn },
    { label: "출처", value: seed.source },
  ];
}

function defaultSections(seed: ArticleSeed): InsightSection[] {
  const outline = seed.kind === "case" ? CASE_OUTLINE : TREND_OUTLINE;
  const paragraphs = [seed.summary, ...SAMPLE_BODY];

  return outline.map(([id, toc, title], index) => ({
    id,
    toc,
    title,
    paragraphs: [
      paragraphs[index] ??
        `${seed.source}를 바탕으로 한 화면 시안용 요약입니다. 논문 전문을 대신하지 않습니다.`,
    ],
  }));
}

function toArticle(seed: ArticleSeed): InsightArticle {
  return {
    ...seed,
    facts: seed.facts ?? defaultFacts(seed),
    sections: seed.sections ?? defaultSections(seed),
  };
}

const cancerSections: InsightSection[] = [
  {
    id: "background",
    toc: "연구 배경과 문제",
    title: "어떤 연구 문제였을까?",
    paragraphs: [
      "현미경으로 촬영한 세포 이미지는 암의 진단과 치료 연구에 중요한 자료입니다. 하지만 세포의 종류와 상태를 구분하는 작업은 전문 지식이 필요하고, 수천~수만 장의 이미지를 사람이 직접 분석해야 하기 때문에 시간이 오래 걸리고 분석자 간 결과의 차이가 발생할 수 있습니다.",
    ],
    chips: ["정상 세포", "양성 종양 세포", "악성 종양 세포", "전이성 세포"],
  },
  {
    id: "limits",
    toc: "기존 방식의 한계",
    title: "사람이 직접 볼 때는 어디가 어려울까?",
    paragraphs: [
      "숙련된 연구자도 세포 경계를 하나씩 표시하다 보면 피로로 기준이 흔들릴 수 있습니다. 새 염색 배치나 다른 현미경으로 찍은 사진이 들어오면, 예전에 맞춰 둔 기준을 다시 설명해야 하는 일도 생깁니다.",
      "그래서 이 사례는 ‘AI가 진단을 대신한다’가 아니라, 분류에 쓰이던 시간을 줄이고 연구자가 검토에 집중하게 만드는 협업으로 적었습니다.",
    ],
  },
  {
    id: "method",
    toc: "AI 활용 방법",
    title: "AI를 어떻게 활용했을까?",
    paragraphs: [
      "연구팀은 딥러닝 기반의 이미지 분류 모델을 사용해 세포 이미지를 자동으로 분석했습니다. 다양한 현미경 이미지 데이터를 학습시켜 세포의 형태와 패턴을 인식하고, 정상 세포와 암세포를 구분할 수 있도록 모델을 설계했습니다.",
    ],
    steps: [
      { title: "데이터 수집", detail: "현미경 이미지 수천 장 확보" },
      { title: "전처리", detail: "이미지 정규화 및 일부 라벨링" },
      { title: "AI 모델 학습", detail: "딥러닝 모델 기반 세포 분류 학습" },
      { title: "결과 검증", detail: "정확도 및 일반화 성능 평가" },
    ],
  },
  {
    id: "results",
    toc: "주요 결과",
    title: "무엇이 달라졌나?",
    paragraphs: [
      "시안에 적은 예시 결과는 딥러닝 모델 정확도 92%, 분석 시간 70% 단축입니다. 이 숫자는 화면 구성을 보여 주기 위한 값이며, 다른 연구실의 데이터에서 그대로 재현된다고 읽으면 안 됩니다.",
      "실제 글을 올릴 때는 논문에 적힌 조건(데이터 수, 비교한 기존 방법, 검증 방식)을 결과 옆에 같이 적습니다.",
    ],
  },
  {
    id: "meaning",
    toc: "연구 의미와 활용성",
    title: "다른 연구에 어떻게 이어질까?",
    paragraphs: [
      "세포나 조직 사진을 반복해서 나누는 연구라면, 같은 흐름으로 ‘무엇을 나누고 싶은지’와 ‘라벨을 얼마나 가지고 있는지’부터 전문가와 맞출 수 있습니다.",
      "의료 영상처럼 민감한 데이터가 아니라도, 현미경·재료·식물 사진 분석에 컴퓨터 비전과 딥러닝 경험이 있는 전문가를 찾는 출발점이 됩니다.",
    ],
  },
  {
    id: "caveats",
    toc: "고려할 점과 한계",
    title: "적용 전에 볼 점은?",
    paragraphs: [
      "학습에 쓴 염색 방식과 다른 이미지가 들어오면 성능이 떨어질 수 있습니다. 라벨이 틀린 데이터가 섞이면 모델도 그 실수를 따라갑니다.",
      "진단이나 치료 결정에 쓰려면 규제와 추가 검증이 따로 필요합니다. 이 페이지는 그 절차를 끝낸 제품 소개가 아닙니다.",
    ],
  },
  {
    id: "sources",
    toc: "관련 연구 및 자료",
    title: "어디에 근거했나?",
    paragraphs: [
      "원문 링크와 DOI는 레이아웃 확인용 예시입니다. 실제 서비스에서는 논문, 기술 블로그, 공식 자료 중 무엇인지와 저자·발행일을 구분해 적습니다.",
      "LabBridge 작성자의 해석은 논문이 보고한 수치와 문장을 나눠 보여 줄 예정입니다.",
    ],
  },
];

const coScientistSections: InsightSection[] = [
  {
    id: "intro",
    toc: "기술 소개",
    title: "Co-Scientist는 무엇을 하는 AI일까?",
    paragraphs: [
      "2026년 5월 Nature에 발표된 Co-Scientist는 연구자가 자연어로 연구 목표와 조건을 주면, 관련 문헌을 바탕으로 가설과 연구 계획을 만들고 반복해서 다듬는 멀티에이전트 시스템입니다.",
      "여기서 멀티에이전트란 하나의 AI가 곧바로 답을 내는 대신, 서로 다른 역할을 맡은 여러 AI가 아이디어를 만들고 비판하고 비교하는 구조를 뜻합니다.",
    ],
  },
  {
    id: "difference",
    toc: "기존과의 차이",
    title: "문헌 요약 도구와 무엇이 다를까?",
    paragraphs: [
      "일반적인 문헌 검색 도구는 이미 나온 연구를 찾고 요약하는 데 집중합니다. Co-Scientist는 그 근거를 연결해 아직 검증되지 않은 가설을 제안하고, 여러 후보 중 더 타당하고 시험 가능한 방향을 고르려 합니다.",
      "중요한 차이는 AI가 만든 결과가 결론이 아니라 ‘실험으로 확인할 후보’라는 점입니다. 연구자는 목표와 제약을 주고, 중간 아이디어를 수정하며, 최종적으로 실제 실험과 동료 검토를 통해 판단합니다.",
    ],
  },
  {
    id: "how",
    toc: "쉬운 작동 개념",
    title: "가설을 만들고 토론하고 진화시킨다",
    paragraphs: [
      "Supervisor가 연구 목표를 작은 작업으로 나누면 Generation과 Proximity가 다양한 가설을 만들고 서로 비슷한 아이디어를 정리합니다. Reflection은 약점을 비판하고, Ranking은 후보를 서로 비교해 우선순위를 매깁니다.",
      "Evolution은 살아남은 아이디어를 결합하거나 수정하고, Meta-review는 토론 결과를 연구 제안으로 정리합니다. 이 과정을 반복하므로 한 번 생성한 문장을 그대로 쓰는 방식보다 검토 단계가 분명합니다.",
    ],
    steps: [
      { title: "가설 생성", detail: "문헌과 연구 목표에서 여러 후보를 만듭니다" },
      { title: "비판·토론", detail: "약점과 근거를 서로 다른 에이전트가 검토합니다" },
      { title: "순위·진화", detail: "후보를 비교하고 좋은 아이디어를 다시 다듬습니다" },
      { title: "연구자 검증", detail: "전문가가 실험 가능성과 안전성을 최종 판단합니다" },
    ],
  },
  {
    id: "fields",
    toc: "연구 활용 분야",
    title: "실제 연구에서는 어디까지 검증됐을까?",
    paragraphs: [
      "Nature 논문은 약물 재창출, 새로운 치료 표적 발견, 항생제 내성 기전 설명이라는 세 가지 생의학 문제에서 종단 간 검증을 보고했습니다. 일부 가설은 세포 기반 실험 같은 실제 검증 단계까지 이어졌습니다.",
      { kind: "interpretation", text: "당장은 문헌이 많고 후보 조합이 넓은 분야에서 ‘무엇부터 실험할지’ 좁히는 용도가 현실적입니다. 다른 분야에 적용하려면 해당 분야의 데이터베이스, 평가 기준, 안전 규칙을 별도로 연결해야 합니다." },
    ],
  },
  {
    id: "caveats",
    toc: "한계·주의점",
    title: "AI가 가설을 만들면 검증 병목은 사라질까?",
    paragraphs: [
      "논문은 더 넓은 학문 분야에서의 일반화, 객관적인 평가 지표, 더 많은 도메인 전문가의 스트레스 테스트가 필요하다고 밝힙니다. 여러 에이전트가 토론해도 같은 기반 모델의 오류나 편향을 공유할 수 있습니다.",
      "가설을 빠르게 많이 만들수록 실험 비용, 데이터 품질, 연구윤리 검토가 새로운 병목이 될 수 있습니다. 따라서 출처 확인, 도메인 전문가 검토, 실제 실험 재현을 건너뛰면 안 됩니다.",
    ],
  },
  {
    id: "related",
    toc: "관련 기술",
    title: "연구실에서 먼저 준비할 것은?",
    paragraphs: [
      "좋은 출발점은 ‘AI에게 무엇이든 물어보기’가 아니라 연구 목표, 반드시 지켜야 할 제약, 가설을 탈락시킬 기준, 사용할 수 있는 공개 자료를 문서로 정리하는 일입니다.",
      "Google Labs는 Co-Scientist 기반 Hypothesis Generation을 실험 도구로 소개하고 있습니다. 실제 연구 데이터나 미공개 아이디어를 입력하기 전에는 제공 조건, 데이터 보관 정책, 기관 보안 규정을 먼저 확인해야 합니다.",
    ],
  },
];

const seeds: ArticleSeed[] = [
  {
    slug: "lettuce-biomass-estimation",
    kind: "case",
    title: "사진만으로 상추와 케일의 생체중을 예측할 수 있을까?",
    summary:
      "상면·측면 사진에서 잎 면적과 폭·높이를 측정하고 회귀 모델로 생체중을 추정한 국내 연구 사례입니다. 작물을 훼손하지 않고 성장 변화를 관찰할 가능성을 보여 줍니다.",
    field: "농업·원예 · 생육 측정",
    topicId: "AM-08",
    topicLabel: "전통 머신러닝·회귀",
    domains: ["농업·원예", "컴퓨터 비전"],
    tags: ["#작물 생체중 비파괴 측정", "#회귀 모델", "#영상 특징 추출"],
    source: "생물환경조절학회지 · 2025",
    publishedOn: "2026.10.10",
    readingMinutes: 5,
    cover: "biomass",
    doi: "10.12791/ksbec.2025.34.4.485",
    sourceUrl: "https://doi.org/10.12791/ksbec.2025.34.4.485",
    imageAlt:
      "연구실에서 상추와 케일을 카메라로 촬영하고 잎 면적 측정선을 겹쳐 표현한 설명용 이미지",
    imageCaption:
      "사진에서 작물의 형태를 측정하는 과정을 재구성한 설명용 이미지입니다. 원 논문의 실험 사진이 아닙니다.",
    sampleNotice:
      "결과 수치는 논문 초록에서 확인한 값입니다. 대표 이미지는 주제를 설명하기 위해 생성했으며 원 논문의 도판이 아닙니다.",
    featuredRank: 1,
    featuredHeadline: "사진만으로 작물의 무게를\n예측할 수 있을까요?",
    featuredSummary:
      "상추와 케일 사진에서 잎 면적·폭·높이를 측정하고 회귀 모델로 생체중을 추정한 국내 연구 사례입니다.",
    highlights: [
      {
        label: "연구 문제",
        text: "작물을 베어 무게를 재지 않고 성장 중인 생체중을 반복해서 추정하고 싶었습니다.",
      },
      {
        label: "AI의 역할",
        text: "사진에서 추출한 잎 면적·폭·높이와 실제 측정값의 관계를 회귀 모델로 학습했습니다.",
      },
      {
        label: "주요 결과",
        text: "상추 엽면적 R² 0.964, 생체중 R² 0.870~0.953이 초록에 보고됐습니다.",
      },
      {
        label: "적용 가능성",
        text: "소규모 연구실도 사진과 기본 측정값부터 비파괴 생육 분석을 시작할 수 있습니다.",
      },
    ],
    sections: [
      {
        id: "background",
        toc: "연구 배경과 문제",
        title: "왜 작물의 무게를 사진으로 재려고 했을까?",
        paragraphs: [
          "작물의 생체중과 건물중은 생육 상태를 판단하는 중요한 값입니다. 하지만 정확한 무게를 재려면 작물을 수확해야 하므로, 같은 개체가 자라는 과정을 여러 번 관찰하기 어렵습니다.",
          "이 연구는 케일과 상추를 훼손하지 않은 채 사진에서 얻은 형태 정보로 생체중을 추정할 수 있는지 확인했습니다.",
        ],
      },
      {
        id: "limits",
        toc: "기존 방식의 한계",
        title: "직접 재는 방법은 어디서 막힐까?",
        paragraphs: [
          "수확 후 무게 측정은 정확하지만 측정한 개체를 다시 키우며 관찰할 수 없습니다. 사진을 사람이 직접 재는 방식도 잎이 겹치거나 촬영 각도가 달라지면 반복 작업이 많아집니다.",
          "따라서 핵심은 복잡한 딥러닝 모델을 먼저 도입하는 것이 아니라, 반복 촬영 조건과 식물의 형태를 일관되게 수치로 만드는 일이었습니다.",
        ],
      },
      {
        id: "method",
        toc: "AI 활용 방법",
        title: "사진과 회귀 모델을 어떻게 연결했을까?",
        paragraphs: [
          "연구팀은 상면과 측면에서 작물을 촬영한 뒤 ImageJ로 잎 면적, 폭, 높이 같은 특징을 추출했습니다. 이 특징과 실제 측정값의 관계를 회귀 모델에 학습시켜 생체중과 건물중을 추정했습니다.",
          "여기서 회귀는 여러 측정값을 보고 연속적인 숫자를 예측하는 방법입니다. 예를 들어 잎 면적이 커질수록 생체중이 어떻게 달라지는지를 식으로 찾는 과정과 비슷합니다.",
        ],
        steps: [
          { title: "사진 촬영", detail: "상면·측면 사진을 같은 조건에서 확보" },
          { title: "특징 측정", detail: "ImageJ로 잎 면적·폭·높이 추출" },
          { title: "회귀 학습", detail: "형태 특징과 실제 무게의 관계 학습" },
          { title: "결과 비교", detail: "예측값과 실제 측정값의 적합도 확인" },
        ],
      },
      {
        id: "results",
        toc: "주요 결과",
        title: "어느 정도까지 설명할 수 있었을까?",
        paragraphs: [
          "[원문에서 확인] 논문 초록에는 상추 엽면적 추정의 결정계수 R²가 0.964로 보고됐습니다. 생체중 모델의 R²는 조건에 따라 0.870~0.953이었습니다.",
          "R²는 1에 가까울수록 모델이 관측된 값의 변화를 잘 설명했다는 뜻입니다. 그러나 새로운 품종이나 다른 촬영 환경에서도 같은 값이 나온다는 의미는 아닙니다.",
        ],
      },
      {
        id: "meaning",
        toc: "연구 의미와 활용성",
        title: "왜 작은 연구실에 의미가 있을까?",
        paragraphs: [
          { kind: "interpretation", text: "이 사례는 거대한 모델이 없어도 연구 질문과 측정 기준이 명확하면 AI 협업을 시작할 수 있음을 보여 줍니다. 연구자는 촬영 조건과 생육 지표를 정하고, 데이터 전문가는 특징 정리와 회귀 모델 검증을 맡을 수 있습니다." },
          "같은 접근은 반복 촬영이 가능한 채소·묘목·조직 배양체의 성장 관찰에도 응용 후보가 될 수 있습니다. 실제 적용 전에는 대상 작물별로 별도 검증해야 합니다.",
        ],
      },
      {
        id: "caveats",
        toc: "고려할 점과 한계",
        title: "그대로 따라 하기 전에 무엇을 확인해야 할까?",
        paragraphs: [
          "촬영 거리, 카메라 각도, 조명, 잎이 겹치는 정도가 달라지면 ImageJ로 얻는 특징도 달라질 수 있습니다. 품종과 생육 단계가 바뀌면 모델을 다시 검증해야 합니다.",
          "자료집은 DOI와 초록을 기준으로 결과를 확인했습니다. 데이터 규모, 하드웨어, 전체 실험 기간과 세부 오차는 논문 본문을 추가로 확인해야 합니다.",
        ],
      },
      {
        id: "sources",
        toc: "관련 연구 및 자료",
        title: "어디에 근거했나?",
        paragraphs: [
          "근거 논문은 생물환경조절학회지(2025)에 실린 케일·상추 생체중 및 건물중 비파괴 추정 연구입니다. DOI는 10.12791/ksbec.2025.34.4.485입니다.",
          "이 글은 논문의 핵심 방법과 초록에 공개된 수치를 연구 협업 관점에서 다시 설명한 요약이며, 논문 전문을 대신하지 않습니다.",
        ],
      },
    ],
    facts: [
      { label: "분야", value: "농업·원예 / 생육 측정" },
      { label: "활용 기술", value: "회귀 모델, 영상 특징 추출" },
      { label: "데이터 유형", value: "케일·상추 상면·측면 사진" },
      { label: "발표", value: "생물환경조절학회지 (2025)" },
      { label: "DOI", value: "10.12791/ksbec.2025.34.4.485" },
    ],
    technologies: [
      { title: "전통 머신러닝·회귀", description: "측정 특징으로 생체중 같은 연속값을 예측하는 방법" },
      { title: "영상 특징 추출", description: "사진에서 잎 면적·폭·높이를 수치로 바꾸는 작업" },
    ],
    relatedSlugs: ["periodontal-bone-loss-analysis", "concrete-crack-segmentation", "few-shot-vision"],
  },
  {
    slug: "periodontal-bone-loss-analysis",
    kind: "case",
    title: "치과 파노라마 X-ray에서 치주골 손실을 분석한 AI 협업",
    summary:
      "치과·융합과학 연구진이 AI의 영상 검출과 기존 측정 규칙을 결합한 공동 연구입니다. 데이터 340장의 구성과 별도 평가 10장, 전문의 비교 결과를 살펴보고 우리 연구에 필요한 준비 조건을 짚습니다.",
    field: "치과 · 의료 영상 분석",
    topicId: "AM-03",
    topicLabel: "컴퓨터 비전",
    domains: ["의료·헬스케어"],
    tags: ["#치과 영상 치아·골 분석", "#파노라마 X-ray", "#컴퓨터 비전"],
    source: "Scientific Reports · 2020",
    publishedOn: "2026.10.10",
    readingMinutes: 9,
    cover: "dental",
    featuredRank: 3,
    featuredHeadline: "파노라마 X-ray 한 장으로\n치주골 손실을 잴 수 있을까요?",
    featuredSummary:
      "AI의 영상 검출과 기존 측정 규칙을 결합해 전문의 판독과 비교한 치과·융합과학 공동 연구입니다.",
    institution: "서울대학교치과병원·융합과학 공동연구",
    doi: "10.1038/s41598-020-64509-z",
    sourceUrl: "https://doi.org/10.1038/s41598-020-64509-z",
    imageAlt:
      "치과 연구자와 AI 연구자가 파노라마 치과 X-ray의 치조골 경계 분석 결과를 함께 검토하는 설명용 이미지",
    imageCaption:
      "치과 영상과 AI 분석의 협업 과정을 재구성한 설명용 이미지입니다. 실제 환자나 원 논문의 도판이 아닙니다.",
    sampleNotice:
      "2026.10.16 본문 보강: 원 논문의 Methods·Results·Discussion과 저자 정보를 확인했습니다. 적용 제안은 LabBridge 해석이며, 대표 이미지는 실제 환자·논문 도판이 아닙니다. 읽는 시간은 편집 추정치입니다.",
    highlights: [
      { label: "연구 문제", text: "파노라마 X-ray에서 치주골 손실을 일관되게 정량화하고자 했습니다." },
      { label: "AI의 역할", text: "치조골 수준과 CEJ를 검출하고 기존 계산 방식과 연결했습니다." },
      { label: "주요 결과", text: "전문의 진단과 상관계수 0.73, 급내상관계수 0.91이 보고됐습니다." },
      { label: "적용 가능성", text: "의료 도메인 지식과 영상 AI 역량의 역할 분담을 보여 주는 사례입니다." },
    ],
    sections: [
      {
        id: "background",
        toc: "연구 배경과 문제",
        title: "치주골 손실을 왜 자동으로 측정하려 했을까?",
        paragraphs: [
          "한 장의 파노라마 X-ray에는 여러 치아와 주변 뼈가 함께 나타납니다. 골 손실 정도를 비교하려면 단순히 병변이 있는지 보는 데서 그치지 않고, 치아와 뼈의 기준점을 반복해서 찾아 수치로 바꿔야 합니다. 연구 자료가 늘어날수록 이 측정 과정 자체가 병목이 됩니다.",
          "이 연구가 던진 질문은 ‘AI가 치과의사를 대신할 수 있는가’보다 구체적입니다. 영상에서 필요한 구조는 딥러닝으로 찾고, 그 구조로부터 손실 비율과 단계를 계산하는 일은 기존 규칙에 맡길 수 있는지를 살폈습니다. 새로운 모델 하나보다 연구 문제를 어떻게 나누었는지에 주목할 만합니다.",
        ],
      },
      {
        id: "limits",
        toc: "기존 방식의 한계",
        title: "영상 전체를 바로 분류하면 무엇을 놓칠까?",
        paragraphs: [
          "‘이 영상에 골 손실이 있다’는 분류만으로는 어느 치아에서 얼마나 손실됐는지 설명하기 어렵습니다. 반대로 모든 경계를 사람이 직접 그리면 측정 시간이 길어집니다. 연구진은 뼈의 수준, 치아의 기준선, 치아 영역을 먼저 찾고 그다음 수치로 계산하는 중간 단계를 두었습니다.",
          { kind: "interpretation", text: "비슷한 연구에서도 최종 결과만 예측하는 모델이 유일한 답은 아닙니다. 연구자가 이미 신뢰하는 계산식이 있다면, AI는 그 식에 넣을 측정값을 추출하는 데 집중할 수 있습니다. 무엇을 AI에 맡기고 무엇을 규칙으로 남길지 먼저 정하는 접근입니다." },
        ],
      },
      {
        id: "data",
        toc: "데이터와 정답 준비",
        title: "340장이라는 숫자 안에는 어떤 데이터가 들어 있을까?",
        paragraphs: [
          "[원문 Methods] 연구진은 2018년 서울대학교치과병원에서 촬영한 파노라마 영상 340장을 준비했습니다. 개인 식별 정보를 제거해 후향적으로 수집했으며, 기관생명윤리위원회 승인을 받았다고 명시했습니다. 일반적인 인터넷 이미지 수집과는 출발 조건이 다릅니다.",
          "검출 과업별 사용량은 골 수준 330장, CEJ 수준 115장, 치아 73장입니다. CEJ는 치아의 법랑질과 백악질이 만나는 경계로, 손실 비율 계산의 기준이 됩니다. 세 숫자는 과업별 자료 수이므로 더해서 서로 다른 환자 수라고 해석하면 안 됩니다.",
          "검출용 자료는 증강 전에 학습 90%·테스트 10%로 나누었습니다. 뒤집기·회전 등으로 늘린 이미지는 새로운 환자 자료가 아닙니다. 최종 단계 분류 평가는 검출에 사용하지 않은 영상 10장으로 수행했습니다. 따라서 ‘340장 모두에서 최종 성능을 검증했다’고 요약하는 것도 부정확합니다.",
        ],
      },
      {
        id: "method",
        toc: "AI 활용 방법",
        title: "딥러닝과 기존 계산 방식을 어떻게 결합했을까?",
        paragraphs: [
          "[원문 Methods·그림 1] 영상의학 연구자가 직접 표시한 골 수준·CEJ·치아 영역을 정답으로 사용했습니다. 검출 모델은 Mask R-CNN을 수정한 구조이며 FPN과 ResNet101을 사용했습니다. 모델의 출력은 곧바로 진단명이 아니라, 계산에 필요한 영상 속 구조입니다.",
          "이후 기존 컴퓨터 보조 분석(CAD)이 치아의 긴 축과 두 기준선의 교점을 이용해 골 손실 비율을 계산하고 단계로 분류합니다. 즉 ‘영상 → 구조 검출 → 비율 계산 → 단계 비교’로 이어집니다. 모든 과정을 하나의 정답 없는 자동화로 묶지 않았다는 점이 중요합니다.",
          { kind: "interpretation", text: "이 구조에서는 실패 위치를 나누어 볼 수 있습니다. 기준선을 잘못 찾았는지, 치아 축 계산이 틀렸는지, 단계 경계에서 판단이 달랐는지를 따로 검토할 수 있기 때문입니다. 연구자가 오류를 설명하고 수정 방향을 정하기에도 유용한 분해 방식입니다." },
        ],
        steps: [
          { title: "정답 준비", detail: "전문가가 골 수준·CEJ·치아 영역 표시" },
          { title: "구조 검출", detail: "수정한 Mask R-CNN으로 영역 추출" },
          { title: "비율 계산", detail: "치아 축과 기준선으로 손실률 계산" },
          { title: "단계 평가", detail: "별도 영상 10장에서 전문의 판단과 비교" },
        ],
      },
      {
        id: "results",
        toc: "주요 결과",
        title: "전문의 판단과 얼마나 비슷했을까?",
        paragraphs: [
          "[원문 Results·표 2~4] 전체 턱 기준으로 자동 분류와 영상의학 전문의 판단 사이의 피어슨 상관계수는 0.73, 전체 ICC는 0.91이었습니다. 단계 차이의 평균 절댓값은 0.25로 보고됐습니다. 이 숫자들은 각각 다른 비교 지표이므로 하나의 ‘정확도’로 합쳐 표현할 수 없습니다.",
          "상관계수는 두 결과가 함께 변하는 정도를, ICC는 평가에 사용한 설정에서 측정값이 얼마나 일관되는지를 봅니다. ICC 0.91을 ‘환자 100명 중 91명을 정확히 진단했다’고 바꾸어 읽어서는 안 됩니다. 검출 성능과 최종 단계 분류 성능도 구분해야 합니다.",
          { kind: "interpretation", text: "연구 적용을 판단할 때는 좋은 숫자 하나보다 ‘누가 만든 정답과, 어떤 자료에서, 무엇을 비교했는가’를 같이 보는 편이 낫습니다. 특히 최종 단계 평가는 영상 10장이라는 범위를 함께 적어야 새로운 병원 자료로의 일반화를 과장하지 않게 됩니다." },
        ],
      },
      {
        id: "collaboration",
        toc: "실제 협업과 역할",
        title: "공동 연구에서 확인되는 것과 우리가 제안하는 것은?",
        paragraphs: [
          "[원문 저자 정보·기여문] 서울대학교 치의학의 영상치의학·치주과, 융합과학기술대학원, 치과병원 소속 연구자가 함께 참여했습니다. 기여문에는 연구 설계, 자료 확보, 분석과 해석의 공동 수행이 기록되어 있습니다. Methods에서는 영상의학 연구자의 수작업 정답 표시도 확인됩니다.",
          "다만 소속만 보고 ‘치과팀은 라벨링만, AI팀은 코딩만 했다’고 단정할 수는 없습니다. 역할이 겹치는 공동 연구이며, 실제 계약·회의 주기·개발 기간·비용은 이번 확인 범위에서 알 수 없습니다. 아래의 역할 분담은 이 연구의 수행 내역을 복원한 것이 아니라 후속 협업을 위한 제안입니다.",
        ],
      },
      {
        id: "meaning",
        toc: "연구 의미와 활용성",
        title: "이 사례가 AI 협업을 잘 보여 주는 이유는?",
        paragraphs: [
          { kind: "application", text: "도메인 연구자는 측정 대상, 애매한 경계의 처리 기준, 허용할 오차를 정하고 대표적인 실패 영상을 검토합니다. AI 전문가는 그 기준에 맞춰 자료 분리, 모델 학습, 오류 분석을 설계합니다. 정답 규칙과 평가 기준은 두 사람이 함께 합의하는 산출물입니다." },
          "이때 첫 결과물은 완성된 진단 서비스가 아니라 ‘정답 작성 지침·작은 검증 자료·기존 측정과의 비교 보고서’일 수 있습니다. 연구 질문과 검증 단위를 작게 정하면 모델 이름만 정한 채 개발을 시작하는 일을 줄일 수 있습니다. 다른 영상 분야로의 적용은 별도 가설이며 이 논문이 입증한 결과가 아닙니다.",
        ],
      },
      {
        id: "preparation",
        toc: "내 연구의 준비 조건",
        title: "전문가를 만나기 전에 무엇을 정리하면 좋을까?",
        paragraphs: [
          { kind: "application", text: "먼저 연구 질문을 ‘사진에서 무엇을 찾아 어떤 수치로 바꿀 것인가’로 적어 보세요. 정상적으로 잘 보이는 자료뿐 아니라 겹침·흐림·기준점 누락처럼 어려운 예시도 정리하면, 필요한 정답의 종류와 적용 범위를 설명하기 쉽습니다." },
          "다음으로 사용 가능한 자료 수, 장비·촬영 조건, 정답을 표시할 전문가, 보안·윤리 검토 상태를 확인합니다. 환자 영상 원본은 플랫폼에 올리지 않고 허용된 환경에서 다루어야 합니다. 협업 상담에는 비식별 자료 설명과 접근 조건부터 공유하는 편이 안전합니다.",
          "검토 질문은 세 가지입니다. 새 환자나 다른 장비 자료를 어떻게 평가할지, 모델을 쓰지 않은 기존 측정보다 무엇이 나아져야 하는지, 실패 결과는 누가 어떤 기준으로 재검토할지입니다. 원문에 없는 최소 필요 자료 수·개발비·기간을 이 사례만으로 확정할 수는 없습니다.",
        ],
      },
      {
        id: "caveats",
        toc: "고려할 점과 한계",
        title: "연구 결과를 어디까지 해석해야 할까?",
        paragraphs: [
          "[원문 Discussion] 파노라마 영상의 확대율과 왜곡이 일정하지 않아 이 방법으로 골 손실의 절대량을 제공할 수 없다고 밝혔습니다. 앞니의 겹침과 어금니 뿌리 주변 구조도 오류를 검토할 부분으로 설명합니다. 논문은 다른 기관과의 협업을 통한 후속 평가도 필요하다고 적었습니다.",
          { kind: "interpretation", text: "증강 이미지가 많거나 같은 기관의 평가 점수가 높다고 새로운 기관의 성능까지 보장되지는 않습니다. 또한 이 논문을 근거로 분석 시간 절감률이나 임상 도입 효과를 새로 만들어 제시할 수 없습니다. 실제 진료에서의 안전성과 효용은 별도의 문제입니다." },
          "이 글은 2020년 연구의 방법과 협업 구조를 설명하는 해설입니다. 최신 임상 지침, 의료 조언, 승인된 자동 진단 제품의 안내가 아니며 실제 진단과 치료 결정은 의료 전문가의 판단이 필요합니다.",
        ],
      },
      {
        id: "sources",
        toc: "관련 연구 및 자료",
        title: "어디에 근거했나?",
        paragraphs: [
          "Chang, H.-J., Lee, S.-J., Yong, T.-H. 외, ‘Deep Learning Hybrid Method to Automatically Diagnose Periodontal Bone Loss and Stage Periodontitis’, Scientific Reports 10, 7531 (2020). DOI: 10.1038/s41598-020-64509-z. 위의 ‘원문 보기’에서 논문으로 이동할 수 있습니다.",
          "2026.10.16에 Methods의 데이터 준비·모델 설명, Results의 표 2~4, Discussion의 한계, 저자 소속·기여문을 확인해 한국어로 요약·재구성했습니다. 원 논문은 CC BY 4.0으로 공개되어 있습니다. 라이선스: https://creativecommons.org/licenses/by/4.0/ . 원문 도판은 복제하지 않았습니다.",
          "원문에 적힌 수행 사실에는 확인 위치를, 적용·준비 제안에는 LabBridge 해석임을 표시했습니다. 독립적인 재현 실험이나 이 방법의 최신성·임상 유효성을 인증한 것은 아닙니다.",
        ],
      },
    ],
    facts: [
      { label: "분야", value: "치과 / 의료 영상" },
      { label: "활용 기술", value: "딥러닝 검출, 컴퓨터 보조 분석" },
      { label: "데이터 유형", value: "파노라마 치과 X-ray" },
      { label: "자료 구성", value: "준비 영상 340장 / 단계 평가 10장" },
      { label: "연구 형태", value: "치과병원·융합과학 공동연구" },
      { label: "발표", value: "Scientific Reports (2020)" },
      { label: "DOI", value: "10.1038/s41598-020-64509-z" },
    ],
    technologies: [
      { title: "컴퓨터 비전", description: "영상에서 치아와 골 기준점을 찾는 기술" },
      { title: "의료 영상 분석", description: "전문가 기준과 영상 측정값을 연결하는 과정" },
      { title: "딥러닝 검출", description: "영상 안에서 필요한 해부학적 지점을 찾는 모델" },
    ],
    relatedSlugs: ["lettuce-biomass-estimation", "concrete-crack-segmentation", "medical-imaging-limits"],
  },
  {
    slug: "concrete-crack-segmentation",
    kind: "case",
    title: "콘크리트 균열을 25 FPS로 분할한 경량 AI 모델",
    summary:
      "AI-Hub 균열 데이터에서 PIDNet을 U-Net 계열·Mask R-CNN과 비교하고, 균열 영역을 실시간에 가깝게 분할할 가능성을 검증한 국내 연구 사례입니다.",
    field: "토목 · 구조물 점검",
    topicId: "AM-03",
    topicLabel: "컴퓨터 비전",
    domains: ["토목·안전"],
    tags: ["#콘크리트 균열 자동 탐지", "#실시간 이미지 분할", "#경량 모델"],
    source: "한국정보기술학회논문지 · 2024",
    publishedOn: "2026.10.10",
    readingMinutes: 5,
    cover: "concrete",
    featuredRank: 2,
    featuredHeadline: "현장 영상 속 콘크리트 균열,\n실시간으로 찾아낼 수 있을까요?",
    featuredSummary:
      "AI-Hub 균열 데이터로 경량 분할 모델 PIDNet을 U-Net 계열·Mask R-CNN과 비교해 25 FPS 수준의 현장 점검 가능성을 확인한 국내 연구입니다.",
    doi: "10.14801/jkiit.2024.22.12.155",
    sourceUrl: "https://doi.org/10.14801/jkiit.2024.22.12.155",
    imageAlt:
      "교량 콘크리트 표면의 균열을 점검하며 보라색 선으로 균열 영역을 표시한 설명용 이미지",
    imageCaption:
      "콘크리트 점검과 AI 균열 분할을 재구성한 설명용 이미지입니다. 원 논문의 실험 사진이 아닙니다.",
    sampleNotice:
      "성능 수치는 논문 초록에서 확인한 값입니다. 대표 이미지는 설명용으로 생성했으며 원 논문의 도판이 아닙니다.",
    highlights: [
      { label: "연구 문제", text: "넓은 구조물에서 가는 균열을 빠르고 일관되게 찾고자 했습니다." },
      { label: "AI의 역할", text: "사진의 각 픽셀을 균열과 배경으로 나누는 분할 모델을 적용했습니다." },
      { label: "주요 결과", text: "IoU 92.3%, 25 FPS, 모델 크기 45MB가 초록에 보고됐습니다." },
      { label: "적용 가능성", text: "현장 점검 영상에서 사람이 확인할 균열 후보를 먼저 표시할 수 있습니다." },
    ],
    sections: [
      {
        id: "background",
        toc: "연구 배경과 문제",
        title: "왜 콘크리트 균열을 실시간으로 찾아야 할까?",
        paragraphs: [
          "교량과 건축물의 콘크리트 균열은 넓은 면적에 가늘고 불규칙하게 나타납니다. 사람이 현장을 촬영한 뒤 모든 사진을 눈으로 확인하면 시간이 오래 걸리고, 작은 균열을 놓칠 수 있습니다.",
          "이 연구는 이미지 속 균열 영역을 픽셀 단위로 나누면서도 현장 영상에 적용할 수 있을 만큼 빠르고 가벼운 모델이 가능한지 확인했습니다.",
        ],
      },
      {
        id: "limits",
        toc: "기존 방식의 한계",
        title: "균열 사진을 찾는 것만으로 충분할까?",
        paragraphs: [
          "사진 한 장에 균열이 있는지만 분류하면 실제 균열의 위치와 길이를 바로 확인하기 어렵습니다. 바닥 얼룩, 그림자, 이음선처럼 균열과 비슷한 무늬도 오탐의 원인이 됩니다.",
          "따라서 이 연구는 균열의 존재 여부를 넘어서, 어느 픽셀이 균열인지 표시하는 이미지 분할 문제로 접근했습니다.",
        ],
      },
      {
        id: "method",
        toc: "AI 활용 방법",
        title: "빠른 분할 모델을 어떻게 비교했을까?",
        paragraphs: [
          "연구팀은 AI-Hub의 콘크리트 균열 데이터를 사용하고 PIDNet을 U-Net 계열과 Mask R-CNN 등과 비교했습니다. 정확도뿐 아니라 처리 속도와 모델 크기를 함께 살폈습니다.",
          "PIDNet은 영상의 세부 경계와 전체 맥락을 함께 처리하도록 설계된 분할 모델입니다. 현장 적용 가능성을 보려면 균열을 잘 찾는 것과 빠르게 처리하는 것을 같이 확인해야 합니다.",
        ],
        steps: [
          { title: "데이터 준비", detail: "AI-Hub 콘크리트 균열 영상 사용" },
          { title: "모델 학습", detail: "균열·배경 픽셀 구분 학습" },
          { title: "모델 비교", detail: "U-Net 계열·Mask R-CNN과 비교" },
          { title: "속도 확인", detail: "IoU·FPS·모델 크기를 함께 평가" },
        ],
      },
      {
        id: "results",
        toc: "주요 결과",
        title: "정확도와 속도는 어느 정도였을까?",
        paragraphs: [
          "[원문에서 확인] 논문 초록에는 PIDNet의 IoU가 92.3%, 처리 속도가 25 FPS, 모델 크기가 45MB라고 보고됐습니다.",
          "IoU는 모델이 표시한 균열 영역과 정답 영역이 얼마나 겹치는지 나타냅니다. FPS는 1초에 처리하는 화면 수입니다. 다만 이 값은 논문의 데이터와 장비 조건에서 측정된 결과입니다.",
        ],
      },
      {
        id: "meaning",
        toc: "연구 의미와 활용성",
        title: "현장 점검에는 어떻게 이어질 수 있을까?",
        paragraphs: [
          { kind: "interpretation", text: "경량 분할 모델은 드론·이동형 카메라·점검 영상에서 균열 후보를 먼저 표시해 사람이 검토할 범위를 줄이는 데 활용 가능성이 있습니다." },
          "토목 연구자는 균열의 정의와 위험 판단 기준을 제공하고, AI 전문가는 데이터 라벨 품질과 모델 속도·일반화 성능을 검증하는 방식으로 역할을 나눌 수 있습니다.",
        ],
      },
      {
        id: "caveats",
        toc: "고려할 점과 한계",
        title: "높은 IoU가 안전 판정을 뜻할까?",
        paragraphs: [
          "아닙니다. 균열을 영상에서 표시하는 것과 구조물의 안전 등급을 결정하는 것은 다른 문제입니다. 최종 판단에는 균열 폭·깊이·위치와 구조 조건을 보는 전문가가 필요합니다.",
          "AI-Hub 데이터에서 얻은 결과가 야간, 비, 오염, 다른 카메라와 콘크리트 표면에서도 유지되는지는 별도 현장 검증이 필요합니다. 자료집 역시 현장 도입까지 검증된 것으로 표현하지 않습니다.",
        ],
      },
      {
        id: "sources",
        toc: "관련 연구 및 자료",
        title: "어디에 근거했나?",
        paragraphs: [
          "근거 논문은 한국정보기술학회논문지(2024)에 발표됐으며 DOI는 10.14801/jkiit.2024.22.12.155입니다.",
          "이 글은 DOI와 초록에 공개된 모델·성능 정보를 연구 협업 관점에서 설명한 요약입니다. 데이터 분할과 하드웨어 등 재현 조건은 논문 본문을 확인해야 합니다.",
        ],
      },
    ],
    facts: [
      { label: "분야", value: "토목 / 구조물 점검" },
      { label: "활용 기술", value: "컴퓨터 비전, 이미지 분할" },
      { label: "데이터 유형", value: "AI-Hub 콘크리트 균열 영상" },
      { label: "평가 지표", value: "IoU, FPS, 모델 크기" },
      { label: "발표", value: "한국정보기술학회논문지 (2024)" },
      { label: "DOI", value: "10.14801/jkiit.2024.22.12.155" },
    ],
    technologies: [
      { title: "컴퓨터 비전", description: "현장 영상에서 균열 패턴을 찾는 기술" },
      { title: "이미지 분할", description: "픽셀마다 균열과 배경을 나누는 방법" },
      { title: "경량 모델", description: "속도와 크기를 줄여 현장 적용을 고려한 모델" },
    ],
    relatedSlugs: ["lettuce-biomass-estimation", "periodontal-bone-loss-analysis", "few-shot-vision"],
  },
  {
    slug: "cancer-cell-classification",
    kind: "case",
    title: "세포 이미지에서 암세포를 자동으로 분류하는 AI 모델 개발",
    summary:
      "수천 장의 현미경 이미지를 AI로 분석해 암세포 유형을 자동 분류한 연구 사례를 살펴보고, 연구 과정과 결과, 다른 연구 분야에의 적용 가능성을 정리합니다.",
    field: "생명과학 · 이미지 분석",
    topicId: "AM-03",
    topicLabel: "컴퓨터 비전",
    domains: ["생명과학", "의료·헬스케어"],
    tags: ["#세포 이미지 분류", "#의료 영상 분석", "#딥러닝"],
    source: "화면 시안용 예시",
    publishedOn: "2025.04.17",
    readingMinutes: 6,
    cover: "medical",
    institution: "서울대학교 생명과학연구원",
    doi: "10.1234/example.2024.001",
    sampleNotice:
      "기관명, DOI, 정확도 92%와 시간 70% 단축은 상세 화면 시안에 있던 예시 값입니다.",
    highlights: [
      {
        label: "연구 문제",
        text: "수천 장의 세포 이미지를 사람이 직접 분류하는 데 많은 시간과 인력이 필요",
      },
      {
        label: "AI의 역할",
        text: "딥러닝 모델로 세포 유형을 자동 분석 및 분류",
      },
      {
        label: "주요 결과",
        text: "딥러닝 모델 정확도 92% · 분석 시간 70% 단축",
      },
      {
        label: "적용 가능성",
        text: "유사한 세포·조직 분석 연구 및 다른 생명과학 분야에도 활용 가능",
      },
    ],
    sections: cancerSections,
    facts: [
      { label: "분야", value: "생명과학 / 암 연구" },
      { label: "활용 기술", value: "컴퓨터 비전, 딥러닝, 이미지 분류" },
      { label: "데이터 유형", value: "현미경 이미지 (H&E 염색 등)" },
      { label: "연구 기관", value: "서울대학교 생명과학연구원" },
      { label: "발표일", value: "2025.04.17" },
      { label: "DOI", value: "10.1234/example.2024.001" },
    ],
    technologies: [
      {
        title: "컴퓨터 비전",
        description: "이미지에서 임상 데이터를 분류하는 AI 기술",
      },
      {
        title: "딥러닝",
        description: "데이터의 복잡한 패턴을 학습하는 방법",
      },
      {
        title: "의료 영상 분석",
        description: "의료 분야 세포 이미지를 분석하는 기술",
      },
    ],
    relatedSlugs: [
      "food-image-quality",
      "medical-imaging-limits",
      "metastasis-multimodal",
    ],
  },
  {
    slug: "microscope-cell-drawing",
    kind: "case",
    title: "현미경 사진 속 세포, 이제 손으로 그리지 않는다",
    summary:
      "광학·형광 현미경 이미지에서 모양이 제각각인 세포의 경계를 자동으로 분할합니다. 세포마다 경계 흐름 방향을 예측해, 새 실험 이미지에도 따로 학습 없이 바로 쓸 수 있습니다.",
    field: "세포생물학 · 이미지 분석",
    topicId: "AM-03",
    topicLabel: "컴퓨터 비전",
    domains: ["생명과학"],
    tags: ["#현미경 세포 분할", "#형광 이미지 객체 추출", "#바이오이미지 자동 라벨링"],
    source: "화면 시안용 예시",
    publishedOn: "2026.10.08",
    readingMinutes: 5,
    cover: "cells",
    highlights: [
      { label: "연구 문제", text: "세포 경계를 사진마다 손으로 그려야 했습니다." },
      { label: "AI의 역할", text: "경계 흐름을 예측해 새 이미지에도 분할을 적용합니다." },
      { label: "주요 결과", text: "수치는 논문 확인 전이라 이 시안에서는 적지 않습니다." },
      { label: "적용 가능성", text: "현미경 이미지를 반복 분석하는 실험실의 출발점입니다." },
    ],
    technologies: [
      { title: "컴퓨터 비전", description: "이미지에서 세포 경계를 찾는 기술" },
      { title: "이미지 분할", description: "픽셀마다 어디가 세포인지 나누는 작업" },
    ],
    relatedSlugs: ["cancer-cell-classification", "medical-imaging-limits"],
  },
  {
    slug: "eeg-behavior",
    kind: "case",
    title: "뇌 신호를 읽어 행동 변화를 예측하다",
    summary:
      "EEG 데이터를 기반으로 한 행동 예측 모델의 연구 사례를 소개합니다. 소규모 데이터에서도 유의미한 결과를 도출한 방법을 다룹니다.",
    field: "신경과학 · 뇌영상 분석",
    topicId: "AM-02",
    topicLabel: "시계열·시공간 딥러닝",
    domains: ["의료·헬스케어"],
    tags: ["#EEG", "#행동 예측", "#생체 신호"],
    source: "화면 시안용 예시",
    publishedOn: "2026.10.05",
    readingMinutes: 5,
    cover: "brain",
    highlights: [
      { label: "연구 문제", text: "뇌 신호와 행동 변화를 함께 보고 싶었습니다." },
      { label: "AI의 역할", text: "시계열 모델이 신호 패턴의 초안을 잡습니다." },
      { label: "주요 결과", text: "소규모 데이터라는 조건을 결과와 함께 읽어야 합니다." },
      { label: "적용 가능성", text: "생체 신호를 다루는 실험의 질문 정리에 쓸 수 있습니다." },
    ],
    technologies: [
      { title: "시계열 딥러닝", description: "시간에 따라 변하는 신호를 학습하는 방법" },
      { title: "생체 신호 분석", description: "EEG 같은 측정값을 연구 질문과 연결하는 작업" },
    ],
    relatedSlugs: ["sensor-logs", "cancer-cell-classification"],
  },
  {
    slug: "protein-structure",
    kind: "case",
    title: "아미노산 서열만으로 단백질 3차원 구조를 예측하다",
    summary:
      "서열 정보에서 원자 수준의 3D 구조를 예측해, 실험으로 수년 걸리던 구조 규명을 앞당긴 사례를 카드 분량으로 정리했습니다.",
    field: "생명과학 · 구조생물학",
    topicId: "AM-01",
    topicLabel: "그래프·기하학적 딥러닝",
    domains: ["생명과학"],
    tags: ["#단백질 구조 예측", "#아미노산 서열 분석"],
    source: "Nature · 2021",
    publishedOn: "2026.09.28",
    readingMinutes: 4,
    cover: "protein",
    highlights: [
      { label: "연구 문제", text: "서열은 알아도 입체 구조를 실험으로 보려면 오래 걸렸습니다." },
      { label: "AI의 역할", text: "서열 사이의 관계를 구조 예측에 사용합니다." },
      { label: "주요 결과", text: "상세 수치는 원문 확인 후 채웁니다." },
      { label: "적용 가능성", text: "구조가 필요한 생명과학 질문의 사전 탐색에 쓰입니다." },
    ],
    technologies: [
      { title: "그래프 딥러닝", description: "아미노산처럼 연결된 단위를 학습하는 방법" },
    ],
    relatedSlugs: ["protein-design", "graph-neural-nets"],
  },
  {
    slug: "battery-life",
    kind: "case",
    title: "리튬이온 배터리의 잔여 수명과 급속 열화를 미리 알 수 있을까",
    summary: "초기 방전 전압 곡선에서 특징을 뽑아, 수백 사이클 뒤의 성능을 예측하는 사례입니다.",
    field: "에너지 · 배터리공학",
    topicId: "AM-08",
    topicLabel: "전통 머신러닝·회귀",
    domains: ["신소재·화학"],
    tags: ["#배터리 수명 조기 예측", "#전기화학 시계열 분석"],
    source: "Nature Energy · 2019",
    publishedOn: "2026.09.20",
    readingMinutes: 4,
    cover: "battery",
    highlights: [
      { label: "연구 문제", text: "수명이 다할 때까지 기다리면 실험이 너무 깁니다." },
      { label: "AI의 역할", text: "초기 곡선의 특징으로 나중 성능을 예측합니다." },
      { label: "주요 결과", text: "원문에 적힌 조건과 같이 읽어야 하는 예측 문제입니다." },
      { label: "적용 가능성", text: "반복 충방전 데이터가 있는 소재 실험에 참고합니다." },
    ],
    technologies: [
      { title: "회귀 모델", description: "숫자로 된 곡선에서 이후 값을 추정하는 방법" },
    ],
    relatedSlugs: ["sensor-logs", "fluid-simulation"],
  },
  {
    slug: "weather-graph",
    kind: "case",
    title: "10일 글로벌 기상 예보를 그래프 신경망으로 계산하다",
    summary: "물리 방정식 계산을 시공간 그래프 신경망으로 대체해 중기 예보 속도를 높인 사례를 소개합니다.",
    field: "기후·지구과학 · 기상학",
    topicId: "AM-02",
    topicLabel: "시계열·시공간 딥러닝",
    domains: ["기후·환경"],
    tags: ["#기상 시계열 예측", "#태풍 경로 추적"],
    source: "Science · 2023",
    publishedOn: "2026.09.14",
    readingMinutes: 4,
    cover: "climate",
    highlights: [
      { label: "연구 문제", text: "전통적인 수치 예보는 계산 시간이 큽니다." },
      { label: "AI의 역할", text: "격자 사이의 관계를 그래프 모델로 학습합니다." },
      { label: "주요 결과", text: "속도가 빨라져도 물리 법칙 전체를 대체했다고 쓰지 않습니다." },
      { label: "적용 가능성", text: "공간 격자 데이터를 가진 지구과학 질문과 맞닿아 있습니다." },
    ],
    technologies: [
      { title: "시공간 딥러닝", description: "위치와 시간이 함께 있는 데이터를 다루는 방법" },
    ],
    relatedSlugs: ["solar-panels", "surrogate-models"],
  },
  {
    slug: "protein-design",
    kind: "case",
    title: "표적에 딱 맞는 단백질을 처음부터 설계하다",
    summary: "조건에 맞는 3D 단백질 뼈대를 확산 모델로 생성하고, 결합 실험으로 확인한 사례입니다.",
    field: "생명공학 · 단백질공학",
    topicId: "AM-04",
    topicLabel: "생성형 AI·확산 모델",
    domains: ["생명과학"],
    tags: ["#단백질 De Novo 디자인", "#맞춤형 바인더 설계"],
    source: "Nature · 2023",
    publishedOn: "2026.09.02",
    readingMinutes: 5,
    cover: "protein",
    highlights: [
      { label: "연구 문제", text: "원하는 결합을 하는 단백질을 처음부터 찾기 어렵습니다." },
      { label: "AI의 역할", text: "조건에 맞는 구조 후보를 생성합니다." },
      { label: "주요 결과", text: "생성 결과는 결합 실험으로 다시 확인해야 합니다." },
      { label: "적용 가능성", text: "후보를 줄이고 싶은 단백질 설계 질문에 해당합니다." },
    ],
    technologies: [
      { title: "확산 모델", description: "조건에 맞는 새로운 구조를 제안하는 생성 모델" },
    ],
    relatedSlugs: ["protein-structure", "diffusion-molecules"],
  },
  {
    slug: "fluid-simulation",
    kind: "case",
    title: "유체 흐름 시뮬레이션을 격자와 상관없이 빠르게 풀다",
    summary: "푸리에 주파수 영역에서 미분방정식의 해를 학습해, 기존 수치해석보다 빠르게 계산하는 사례입니다.",
    field: "기계 · 유체역학",
    topicId: "AM-05",
    topicLabel: "물리 기반 AI·신경 연산자",
    domains: ["신소재·화학"],
    tags: ["#유체 흐름 고속 시뮬레이션", "#물리 미분방정식 AI 해법"],
    source: "ICLR · 2021",
    publishedOn: "2026.08.22",
    readingMinutes: 4,
    cover: "flow",
    highlights: [
      { label: "연구 문제", text: "격자 계산은 정밀하지만 반복 실험에는 느립니다." },
      { label: "AI의 역할", text: "방정식의 해 모양을 학습해 계산을 줄입니다." },
      { label: "주요 결과", text: "빠르다는 표현은 어떤 방정식과 비교했는지에 묶여 있습니다." },
      { label: "적용 가능성", text: "시뮬레이션이 병목인 물리·공학 실험에 참고합니다." },
    ],
    technologies: [
      { title: "신경 연산자", description: "함수와 함수 사이의 관계를 학습하는 모델" },
    ],
    relatedSlugs: ["surrogate-models", "weather-graph"],
  },
  {
    slug: "retrosynthesis",
    kind: "case",
    title: "목표 화합물의 합성 경로를 거꾸로 찾아가다",
    summary: "분자를 분해하는 경로를 트리 탐색으로 훑고, 가능한 반응 규칙의 우선순위를 제안한 사례입니다.",
    field: "유기화학 · 역합성 분석",
    topicId: "AM-06",
    topicLabel: "탐색·최적화",
    domains: ["신소재·화학"],
    tags: ["#유기합성 경로 탐색", "#화학 반응 예측"],
    source: "Nature · 2018",
    publishedOn: "2026.08.11",
    readingMinutes: 4,
    cover: "molecule",
    highlights: [
      { label: "연구 문제", text: "만들 분자는 알아도 합성 순서를 고르기 어렵습니다." },
      { label: "AI의 역할", text: "가능한 반응 경로의 우선순위를 제안합니다." },
      { label: "주요 결과", text: "제안은 화학자가 실험으로 확인하는 후보입니다." },
      { label: "적용 가능성", text: "반응 규칙 데이터가 있는 합성 연구와 맞습니다." },
    ],
    technologies: [
      { title: "탐색·최적화", description: "많은 경로 중에서 다음 후보를 고르는 방법" },
    ],
    relatedSlugs: ["experiment-optimization", "diffusion-molecules"],
  },
  {
    slug: "ancient-inscription",
    kind: "case",
    title: "깨진 고대 비문의 빈 글자를 채우고 연대를 추정하다",
    summary: "손상된 문자열을 언어 모델로 복원하고, 작성 연대와 출토 지역을 함께 추정한 사례입니다.",
    field: "인문학 · 고고학",
    topicId: "AM-07",
    topicLabel: "자연어 처리·LLM",
    domains: [],
    tags: ["#고대 비문 텍스트 복원", "#유물 작성 연대 추정"],
    source: "Nature · 2022",
    publishedOn: "2026.07.30",
    readingMinutes: 4,
    cover: "script",
    highlights: [
      { label: "연구 문제", text: "깨진 글자는 맥락 없이 채우기 어렵습니다." },
      { label: "AI의 역할", text: "문맥으로 빈칸 후보와 연대 단서를 제안합니다." },
      { label: "주요 결과", text: "복원 후보는 전문 연구자의 판정이 필요합니다." },
      { label: "적용 가능성", text: "텍스트가 손상된 기록 연구에 질문을 던집니다." },
    ],
    technologies: [
      { title: "자연어 처리", description: "글자의 맥락을 모델로 다루는 방법" },
    ],
    relatedSlugs: ["literature-review-llm", "research-agent"],
  },
  {
    slug: "solar-panels",
    kind: "case",
    title: "위성 사진에서 미국 전역의 태양광 패널을 찾아 지도로 그리다",
    summary: "대규모 항공·위성 영상에서 태양광 패널의 유무와 면적을 자동으로 식별한 사례입니다.",
    field: "환경·에너지 · 원격 탐사",
    topicId: "AM-03",
    topicLabel: "컴퓨터 비전",
    domains: ["기후·환경"],
    tags: ["#위성 이미지 객체 탐지", "#태양광 인프라 자동 매핑"],
    source: "Joule · 2018",
    publishedOn: "2026.07.18",
    readingMinutes: 4,
    cover: "solar",
    highlights: [
      { label: "연구 문제", text: "넓은 지역의 패널을 사람 눈으로 세기는 어렵습니다." },
      { label: "AI의 역할", text: "위성 사진에서 패널 위치와 면적 후보를 찾습니다." },
      { label: "주요 결과", text: "지역과 해상도가 바뀌면 다시 확인해야 합니다." },
      { label: "적용 가능성", text: "원격 탐사 이미지를 세는 환경 연구에 해당합니다." },
    ],
    technologies: [
      { title: "컴퓨터 비전", description: "사진 속에서 원하는 물체를 찾는 기술" },
    ],
    relatedSlugs: ["weather-graph", "few-shot-vision"],
  },
  {
    slug: "orca-audio",
    kind: "case",
    title: "바닷속 녹음에서 범고래 소리만 골라내다",
    summary:
      "수중 오디오를 스펙트로그램 이미지로 바꿔 탐지한 사례입니다. 시안의 AI 분야 표기는 임시로 컴퓨터 비전을 사용했습니다.",
    field: "해양생물학 · 음향생태학",
    topicId: "AM-03",
    topicLabel: "컴퓨터 비전",
    domains: ["기후·환경"],
    tags: ["#해양 생물 소리 자동 분류", "#수중 오디오 분석"],
    source: "Sci. Rep. · 2019",
    publishedOn: "2026.07.02",
    readingMinutes: 4,
    cover: "audio",
    sampleNotice: "오디오 사례의 AI 기술 분야는 시안에서 컴퓨터 비전으로 임시 표기했습니다.",
    highlights: [
      { label: "연구 문제", text: "긴 수중 녹음에서 특정 소리만 찾으려면 시간이 많이 듭니다." },
      { label: "AI의 역할", text: "소리를 이미지로 바꿔 탐지 모델에 넣습니다." },
      { label: "주요 결과", text: "처리 시간 예시는 원문 조건과 분리해 읽습니다." },
      { label: "적용 가능성", text: "긴 녹음을 가진 생태 조사의 질문과 맞습니다." },
    ],
    technologies: [
      { title: "컴퓨터 비전", description: "스펙트로그램 이미지를 분류하는 임시 분류입니다." },
    ],
    relatedSlugs: ["sensor-logs", "few-shot-vision"],
  },
  {
    slug: "metastasis-multimodal",
    kind: "case",
    title: "전이성 암 조기 예측을 위한 멀티모달 연구",
    summary: "영상과 다른 측정값을 함께 보는 연구 질문을 예시로 정리한 글입니다.",
    field: "생명과학 · 암 연구",
    topicId: "AM-03",
    topicLabel: "컴퓨터 비전",
    domains: ["생명과학", "의료·헬스케어"],
    tags: ["#멀티모달", "#암 연구"],
    source: "화면 시안용 예시",
    publishedOn: "2024.05.01",
    readingMinutes: 4,
    cover: "medical",
    highlights: [
      { label: "연구 문제", text: "한 종류 데이터만으로는 이른 신호를 보기 어려울 수 있습니다." },
      { label: "AI의 역할", text: "서로 다른 데이터 형태를 한 모델에서 다루게 합니다." },
      { label: "주요 결과", text: "이 글에는 확정 수치를 넣지 않았습니다." },
      { label: "적용 가능성", text: "데이터 종류가 두 가지 이상인 연구 질문에 해당합니다." },
    ],
    technologies: [
      { title: "멀티모달 학습", description: "이미지와 표 데이터를 함께 보는 방법" },
    ],
    relatedSlugs: ["cancer-cell-classification", "medical-imaging-limits"],
  },
  {
    slug: "research-agent",
    kind: "trend",
    title: "AI가 가설을 만들고 토론한다: Co-Scientist가 바꾸는 연구의 시작",
    summary:
      "Google의 Co-Scientist는 여러 AI 에이전트가 연구 가설을 생성·비판·비교·개선하도록 설계됐습니다. 2026년 Nature 논문을 바탕으로 작동 원리와 연구자가 반드시 맡아야 할 검증을 정리합니다.",
    field: "AI for Science · 멀티에이전트",
    topicId: "science",
    topicLabel: "과학 AI",
    domains: ["과학 AI", "LLM·생성형 AI"],
    tags: ["#AI Co-Scientist", "#가설 생성", "#멀티에이전트"],
    source: "Nature · Google DeepMind · 2026",
    publishedOn: "2026.10.10",
    readingMinutes: 6,
    cover: "coScientist",
    institution: "Google Research·Google DeepMind 협업",
    doi: "10.1038/s41586-026-10644-y",
    sourceUrl: "https://doi.org/10.1038/s41586-026-10644-y",
    imageAlt:
      "연구자가 여러 AI 에이전트의 가설 생성과 검토 흐름을 살펴보는 설명용 이미지",
    imageCaption:
      "여러 에이전트가 가설을 생성·비판·개선하고 연구자가 검증하는 흐름을 재구성한 이미지입니다. 실제 제품 화면이나 논문 도판이 아닙니다.",
    sampleNotice:
      "내용은 Nature 원 논문과 Google DeepMind 공식 발표를 교차 확인했습니다. 대표 이미지는 설명용 생성 이미지입니다.",
    featuredRank: 1,
    featuredHeadline: "AI가 가설을 만들고 토론하면,\n연구자는 무엇을 검증해야 할까요?",
    featuredSummary:
      "2026년 Nature에 발표된 Co-Scientist를 통해 멀티에이전트의 작동 방식과 실제 연구에서 지켜야 할 검증 경계를 살펴봅니다.",
    highlights: [
      { label: "지금 변하는 점", text: "한 번 답하는 AI에서 가설을 반복 토론하고 개선하는 AI로 넓어졌습니다." },
      { label: "작동 구조", text: "생성·성찰·순위·진화 등 전문 역할을 맡은 에이전트가 협력합니다." },
      { label: "검증 범위", text: "Nature 논문은 세 가지 생의학 문제에서 실제 검증 결과를 보고했습니다." },
      { label: "연구자의 역할", text: "목표·제약을 정하고 출처, 실험 가능성, 재현성을 최종 확인합니다." },
    ],
    sections: coScientistSections,
    facts: [
      { label: "주제", value: "AI 기반 과학 가설 생성" },
      { label: "기반 모델", value: "Gemini 2.0 계열" },
      { label: "검증 분야", value: "약물 재창출·치료 표적·항생제 내성" },
      { label: "원문", value: "Nature (2026.05.19)" },
      { label: "DOI", value: "10.1038/s41586-026-10644-y" },
    ],
    technologies: [
      { title: "멀티에이전트 시스템", description: "서로 다른 역할의 AI가 가설을 만들고 비판하는 구조" },
      { title: "Test-time compute", description: "답을 내기 전 더 많은 반복 추론과 검토에 계산을 쓰는 방식" },
      { title: "도구 기반 근거 확인", description: "웹 검색·전문 데이터베이스·특화 모델을 함께 사용하는 방식" },
    ],
    relatedSlugs: ["literature-review-llm", "private-data-ai", "microscope-cell-drawing"],
  },
  {
    slug: "mattergen-material-design",
    kind: "trend",
    title: "AI가 새로운 소재를 설계한다는 건 무슨 뜻일까?",
    summary: "글을 쓰는 생성형 AI가 연구에서는 무엇을 만들까요? MatterGen을 예로, 후보를 고르는 AI와 새 구조를 제안하는 AI의 차이를 쉽게 풀어봅니다.",
    field: "생성형 AI · 쉬운 기술 해설",
    topicId: "generative",
    topicLabel: "생성형 AI",
    domains: ["과학 AI", "신소재·재료과학"],
    tags: ["#생성형 AI 이해", "#역설계", "#MatterGen"],
    source: "Nature · Microsoft Research · 2025",
    publishedOn: "2026.10.10",
    readingMinutes: 7,
    cover: "mattergen",
    featuredRank: 2,
    featuredHeadline: "글을 쓰던 생성형 AI가\n새로운 소재를 설계한다고요?",
    featuredSummary:
      "MatterGen을 예로, 후보를 고르는 AI와 새 구조를 제안하는 AI가 어떻게 다른지 비전공 연구자의 눈높이로 풀어봅니다.",
    institution: "Microsoft Research AI for Science",
    doi: "10.1038/s41586-025-08628-5",
    sourceUrl: "https://doi.org/10.1038/s41586-025-08628-5",
    imageAlt: "재료 연구자가 AI가 제안한 결정 구조를 검토하는 설명용 이미지",
    imageCaption: "AI의 후보 제안과 연구자의 검토를 설명하기 위해 재구성한 이미지입니다. 실제 MatterGen 화면이나 논문 도판이 아닙니다.",
    sampleNotice: "2026.10.17 쉬운 해설 개편. 2025.01.16 발표 연구를 설명하며 최신 속보나 최신 성능 순위가 아닙니다. 세부 실험 수치와 검증 과정은 연결된 사례 글에서 다룹니다. 읽는 시간은 편집 추정치입니다.",
    companionSlug: "mattergen-experimental-validation",
    glossary: MATTERGEN_GLOSSARY,
    highlights: [
      { label: "한 문장 개념", text: "원하는 성질을 먼저 정하고, 그에 맞을 법한 재료 구조를 AI가 제안합니다." },
      { label: "기존과의 차이", text: "목록에서 후보를 고르는 일과 새로운 후보를 만드는 일은 다릅니다." },
      { label: "사람의 역할", text: "목표와 제약을 정하고, 후보를 계산·실험으로 확인합니다." },
      { label: "기억할 한계", text: "구조 제안은 완제품이나 제조법, 실험 성공을 보장하지 않습니다." },
    ],
    sections: [
      {
        id: "intro", toc: "무엇이 달라졌을까?", title: "생성형 AI는 글과 그림만 만드는 것이 아니다",
        paragraphs: [
          "생성형 AI라고 하면 질문에 답하거나 그림을 그리는 도구를 떠올리기 쉽습니다. 연구에서는 결과물의 형태가 달라질 수 있습니다. 문장 대신 재료를 이루는 원자의 종류와 위치를 제안하는 방식도 있습니다.",
          "MatterGen은 무기 결정 재료의 구조 후보를 만드는 모델입니다. 결정은 원자가 일정한 규칙으로 반복 배열된 구조를 말합니다. 사람이 쓸 만한 아이디어 초안을 받듯이, 연구자는 계산과 실험으로 확인할 구조 후보를 받는다고 이해하면 출발하기 쉽습니다.",
          { kind: "interpretation", text: "주목할 점은 AI가 연구를 혼자 끝낸다는 것이 아니라, 사람이 검토할 후보를 만드는 단계까지 도울 수 있다는 점입니다. 후보를 무엇으로 평가할지 정하는 일은 여전히 중요합니다." },
        ],
      },
      {
        id: "difference", toc: "고르기와 만들기의 차이", title: "메뉴에서 고르는 것과 새 조합을 제안받는 것",
        termIds: ["screening", "inverse-design"],
        paragraphs: [
          "식당에서 이미 있는 메뉴를 조건에 맞게 고르는 것과, 원하는 맛을 설명하고 새 조합을 제안받는 일은 다릅니다. 재료 연구에서도 준비한 후보 목록을 걸러내는 스크리닝과, 조건에 맞는 구조를 생성하는 접근을 구별할 수 있습니다. 이 비유는 두 역할의 차이를 설명하기 위한 것이며 실제 합성 과정을 음식 조리와 같다고 보는 뜻은 아닙니다.",
          "보통 구조를 먼저 정한 뒤 어떤 성질을 가질지 확인합니다. 역설계는 반대로 원하는 성질이나 조건을 먼저 정하고, 그 결과를 낼 수 있는 구조를 찾는 접근입니다. MatterGen은 그 후보를 제안하는 생성 모델의 예입니다.",
          { kind: "application", text: "이미 충분한 후보 목록이 있고 평가만 느리다면, 새 후보를 만들기보다 예측·선별부터 개선하는 편이 맞을 수 있습니다. 기존 목록 바깥을 탐색할 필요가 있는지 먼저 질문해보세요." },
        ],
      },
      {
        id: "how", toc: "작동 원리 쉽게 보기", title: "흐트러진 상태에서 구조를 조금씩 만들어 간다",
        termIds: ["diffusion", "fine-tuning"],
        paragraphs: [
          "확산 모델은 학습 자료를 조금씩 흐트러뜨리고 복원하는 과정을 배웁니다. 새 후보를 만들 때는 잡음에서 시작해 여러 단계에 걸쳐 구조를 만들어갑니다. 이미지 생성 모델이 픽셀을 다룬다면, MatterGen은 원자의 종류·위치와 반복 배열의 틀을 다룹니다.",
          "흐린 그림을 점점 또렷하게 만드는 과정에 비유할 수 있지만, 원래 정답 하나를 되찾는 것은 아닙니다. 학습한 규칙을 바탕으로 새로운 후보를 만드는 것이므로, 보기 그럴듯한 결과라도 실제로 유효한지는 다시 확인해야 합니다.",
          "특정 성질의 목표에 맞추려면 관련 자료로 추가 학습한 모델이 필요할 수 있습니다. 논문의 접근을 ‘챗봇에게 자연어로 주문하면 어떤 소재든 제조법까지 나온다’고 이해하면 안 됩니다.",
        ],
        steps: [
          { title: "목표 정하기", detail: "원하는 성질과 허용할 조건을 적습니다" },
          { title: "후보 제안", detail: "모델이 가능한 구조를 만듭니다" },
          { title: "계산 검토", detail: "중복과 에너지·조건을 확인합니다" },
          { title: "실험 확인", detail: "실제로 만들고 성질을 측정합니다" },
        ],
      },
      {
        id: "fields", toc: "연구자는 무엇을 할까?", title: "AI의 제안을 연구 결과로 바꾸는 것은 검증이다",
        termIds: ["dft"],
        paragraphs: [
          "AI가 구조를 내놓았다고 새 소재의 발견이 끝난 것은 아닙니다. 알려진 구조와 같은지, 계산에서 유망한지, 실제로 합성할 수 있는지, 측정한 성질이 목표와 맞는지를 차례로 살펴야 합니다. 계산 평가에 쓰이는 DFT도 그런 확인 도구 중 하나입니다.",
          "연구자는 무엇을 원하는지와 어떤 조건이 가능한지를 정합니다. 생성한 후보 중 무엇을 실험할지 판단하고 결과를 해석하는 일도 필요합니다. 원 연구의 후보 선정·합성·측정 과정은 연결된 연구사례 글에서 자세히 볼 수 있습니다.",
          { kind: "interpretation", text: "다른 분야에서도 ‘AI가 낼 결과물은 무엇인가’, ‘좋고 나쁨을 누가 어떤 기준으로 확인할 것인가’를 짝으로 질문하면 도움이 됩니다. 다만 MatterGen 자체가 다른 모든 분야에도 바로 작동한다는 의미는 아닙니다." },
        ],
      },
      {
        id: "workflow", toc: "내 연구에 연결하기", title: "모델 이름보다 먼저 적어볼 세 가지 질문",
        paragraphs: [
          { kind: "application", text: "첫째, 기존 후보를 잘 고르면 되는 문제인지, 새 후보가 필요한 문제인지 적어보세요. 둘째, 후보의 좋고 나쁨을 비교할 계산·실험 기준을 적습니다. 셋째, 데이터 이용 권한과 실행 자원, 실제 검증 가능 범위를 확인합니다. 이는 LabBridge의 준비 제안이지 원 논문이 검증한 범용 도입 절차는 아닙니다." },
          "처음부터 새 모델을 학습해야 한다고 생각할 필요는 없습니다. 공개 모델이 내 질문과 자료에 맞는지 검토하는 단계와, 직접 실행하거나 추가 학습하는 단계는 준비 규모가 다릅니다. 실행 여부는 연구실의 조건을 확인한 뒤 결정해야 합니다.",
        ],
      },
      {
        id: "caveats", toc: "오해하지 말아야 할 점", title: "가능성과 검증된 성과를 구분해서 읽기",
        paragraphs: [
          { kind: "caution", text: "AI가 제안한 구조, 계산에서 유망한 구조, 합성에 성공한 물질, 제품에 쓸 수 있는 소재는 서로 다른 단계입니다. 하나의 연구 결과를 모든 소재나 모든 연구실의 성공률로 넓혀 해석하면 안 됩니다." },
          "이 글은 2025년 연구를 이용한 기술 해설입니다. 지금 가장 뛰어난 모델이 무엇인지, 비용이 얼마인지, 우리 연구에서 얼마나 시간을 줄일지는 확인한 글이 아닙니다. 쉬운 비유도 정확한 모델 설명과 실험 검증을 대신하지 않습니다.",
        ],
      },
      {
        id: "sources", toc: "더 읽을 자료", title: "개념은 여기서, 실험 근거는 사례 글에서",
        paragraphs: [
          "원 논문은 Zeni 외, ‘A generative model for inorganic materials design’, Nature (2025), DOI 10.1038/s41586-025-08628-5입니다. 위의 ‘원문 보기’로 이동할 수 있습니다. 공식 해설: https://www.microsoft.com/en-us/research/blog/mattergen-a-new-paradigm-of-materials-design-with-generative-ai/ . 실행 자료: https://github.com/microsoft/mattergen .",
          "연결된 연구사례 글에는 학습 자료와 평가 조건, 후보 선별, 합성·측정 결과와 한계를 보존했습니다. 두 글은 같은 연구를 공유하며 각각 개념 이해와 실제 적용 과정에 초점을 둡니다. LabBridge에서 모델을 실행하거나 실험을 재현한 결과는 아닙니다.",
        ],
      },
    ],
    facts: [
      { label: "글의 성격", value: "연구자를 위한 쉬운 기술 해설" },
      { label: "원 연구", value: "2025.01.16 공개" },
      { label: "내용 개편", value: "2026.10.17" },
      { label: "읽는 순서", value: "개념 이해 → 실제 연구사례" },
    ],
    technologies: [
      { title: "역설계", description: "원하는 결과를 먼저 정하고 후보를 찾는 접근" },
      { title: "확산 모델", description: "잡음에서 출발해 구조 후보를 점차 만드는 모델" },
    ],
    relatedSlugs: ["mattergen-experimental-validation", "research-agent", "surrogate-models"],
  },
  {
    slug: "mattergen-experimental-validation",
    kind: "case",
    title: "MatterGen 연구: AI가 제안한 소재를 어떻게 실험으로 확인했을까?",
    summary:
      "원하는 물성에서 출발해 무기 결정 구조를 제안하는 MatterGen. 생성 성능뿐 아니라 계산 검증·합성 후보 선정·실험 결과를 함께 읽고, 연구실에서 어디까지 맡길 수 있을지 살펴봅니다.",
    field: "재료과학 · AI 생성과 실험 검증",
    topicId: "AM-04",
    topicLabel: "생성형 AI·확산 모델",
    domains: ["과학 AI", "신소재·재료과학"],
    tags: ["#MatterGen", "#신소재 설계", "#확산 모델"],
    source: "Nature · Microsoft Research · 2025",
    publishedOn: "2026.10.17",
    readingMinutes: 10,
    cover: "mattergen",
    featuredRank: 4,
    featuredHeadline: "AI가 제안한 소재,\n실험실에서 정말 만들어졌을까요?",
    featuredSummary:
      "원하는 물성에서 출발해 결정 구조를 제안한 MatterGen이 계산 검증과 합성 실험까지 어떻게 이어졌는지 따라가 봅니다.",
    institution: "Microsoft Research AI for Science · SIAT 실험 협력",
    doi: "10.1038/s41586-025-08628-5",
    sourceUrl: "https://doi.org/10.1038/s41586-025-08628-5",
    imageAlt:
      "재료 연구자가 무작위 원자 배치에서 안정된 결정 구조로 변하는 생성 과정을 검토하는 설명용 이미지",
    imageCaption:
      "생성형 AI가 결정 후보를 만들고 연구자가 실험 검증하는 흐름을 재구성한 이미지입니다. 실제 MatterGen 화면이나 논문 도판이 아닙니다.",
    sampleNotice:
      "2026.10.17 사례 분리: 기존 MatterGen 해설의 연구 근거·실험 수치·한계를 보존했습니다. 2025년 발표 연구이며 LabBridge에서 수행한 협업이나 재현 실험은 아닙니다. 원문 결과와 편집자 제안을 구분합니다. 이미지는 설명용이며 읽는 시간은 편집 추정치입니다.",
    companionSlug: "mattergen-material-design",
    glossary: MATTERGEN_GLOSSARY,
    highlights: [
      { label: "연구 문제", text: "목표 물성에 맞는 재료 구조 후보를 탐색합니다." },
      { label: "AI 역할", text: "결정의 원자 종류·좌표·격자를 함께 다루어 구조 후보를 생성합니다." },
      { label: "주요 결과", text: "실험 후보 4개 중 1개를 합성했습니다. 보편적인 성공률은 아닙니다." },
      { label: "적용 가능성", text: "생성과 계산 평가, 전문가 검토와 실험을 연결하는 과정을 참고합니다." },
    ],
    sections: [
      {
        id: "intro",
        toc: "기술 소개",
        title: "원하는 물성을 말하면 결정 구조를 제안한다",
        termIds: ["inverse-design", "diffusion"],
        paragraphs: [
          "재료 연구자는 원하는 성질을 알고 있어도 그 성질을 낼 결정 구조를 바로 알기는 어렵습니다. 알려진 후보를 계산해 고르는 대신, 목표 성질에서 출발해 가능한 구조를 제안받는다면 탐색의 출발점을 바꿀 수 있습니다. 이처럼 결과 조건에서 후보를 거꾸로 찾는 접근을 역설계라고 부릅니다.",
          "2025년 1월 공개된 Nature 논문의 MatterGen은 원자 종류·좌표·격자를 함께 다루는 확산 모델입니다. 무기 결정 구조를 생성하고, 추가 학습으로 조성·대칭성·물성 조건에 맞는 방향으로 유도합니다. 자연어로 원하는 소재를 말하면 바로 제조법까지 완성하는 챗봇은 아닙니다.",
          { kind: "interpretation", text: "연구자에게 중요한 변화는 생성형 AI의 결과물이 문장이나 그림에 머물지 않고, 후속 계산과 실험의 입력 후보가 된다는 점입니다. 동시에 후보를 평가할 기준과 실패를 걸러낼 절차가 모델 못지않게 중요해집니다." },
        ],
      },
      {
        id: "difference",
        toc: "기존과의 차이",
        title: "수백만 후보를 거르는 것과 무엇이 다를까?",
        termIds: ["screening"],
        paragraphs: [
          "스크리닝은 준비한 후보 집합에서 조건에 맞는 것을 고릅니다. 물성 예측 모델은 주어진 구조의 성질을 추정합니다. 생성 모델은 조건을 바탕으로 구조 후보를 새로 제안합니다. 세 접근은 입력과 출력이 다르며 서로 대체하기보다 한 파이프라인에서 함께 쓰일 수 있습니다.",
          { kind: "application", text: "이미 후보 목록이 충분하고 평가만 느리다면 예측·스크리닝 개선이 먼저일 수 있습니다. 알려진 후보 바깥을 탐색하려는 연구라면 생성 모델을 검토할 이유가 있습니다. ‘생성형이 더 새롭다’는 이유만으로 연구 문제를 바꿀 필요는 없습니다." },
          "단, 모델이 낸 구조 파일은 발견이 끝났다는 증거가 아닙니다. 계산상 안정성 확인, 기존 구조와의 중복 비교, 합성 가능성 검토, 실제 물성 측정이 뒤따라야 합니다. 생성 속도와 연구 전체의 시간·비용 절감도 같은 지표가 아닙니다.",
        ],
      },
      {
        id: "how",
        toc: "쉬운 작동 개념",
        title: "흐트러진 원자에서 조건에 맞는 결정으로",
        termIds: ["fine-tuning"],
        paragraphs: [
          "[원문 모델 설명] 학습 중에는 원자 종류·좌표·격자를 흐트러뜨리고 이를 복원하는 방향을 배웁니다. 생성할 때는 잡음에서 시작해 여러 단계를 거치며 결정 구조를 만듭니다. 이미지의 픽셀 대신 주기적으로 반복되는 원자 배열을 다룬다는 점이 다릅니다.",
          "기본 모델은 Materials Project와 Alexandria를 바탕으로 구성한 Alex-MP-20의 구조 607,683개로 학습했습니다. 각 구조는 원자 수가 최대 20개인 학습 자료입니다. 이 범위는 모델을 이해할 때의 조건이지, 임의의 고분자·표면·복잡한 실험 시료까지 이미 검증했다는 뜻이 아닙니다.",
          "물성 조건을 주려면 해당 성질의 자료로 추가 학습한 모델을 사용합니다.",
          { kind: "interpretation", text: "‘어떤 성질을 원한다’는 질문과 ‘그 성질을 일관되게 정의한 학습·검증 자료가 있는가’는 함께 다뤄야 합니다. 조건의 단위와 계산·측정 방법이 다르면 숫자만 모아 쓰기 어렵습니다." },
        ],
        steps: [
          { title: "구조 학습", detail: "안정된 결정 데이터에서 원자와 격자의 규칙을 배웁니다" },
          { title: "조건 입력", detail: "원하는 조성·대칭성·물성 범위를 정합니다" },
          { title: "후보 생성", detail: "잡음에서 시작해 여러 결정 구조를 복원합니다" },
          { title: "계산·실험", detail: "안정성과 합성 가능성, 실제 물성을 검증합니다" },
        ],
      },
      {
        id: "fields",
        toc: "연구 활용 분야",
        title: "논문은 어느 정도까지 확인했을까?",
        termIds: ["dft", "sun"],
        paragraphs: [
          "[원문 Generating stable, diverse materials·그림 2] 평가는 안정적이고 중복되지 않으며 기준 데이터에 없는 구조의 비율(SUN)과, DFT 계산으로 완화한 구조에서 얼마나 떨어져 있는지를 사용했습니다. DFT는 전자 구조에 기반한 계산 방법이며, 여기서 안정성은 논문이 정한 에너지 기준에 대한 판정입니다.",
          "초록은 이전 생성 모델 대비 새롭고 안정적인 구조의 비율이 2배 이상이라고 요약합니다. 다만 같은 작은 MP-20 학습 자료를 사용한 비교에서는 MatterGen-MP가 이전 모델보다 SUN 구조를 60% 더 생성했다고 보고합니다. 큰 학습 자료의 효과까지 포함한 결과와 같은 자료로 비교한 결과를 구분해 읽어야 합니다.",
          { kind: "interpretation", text: "SUN 비율이 높다는 것은 후속 검토에 유망한 후보가 많다는 뜻이지, 실험 성공률이나 제품 성능이 그만큼 높다는 뜻은 아닙니다. ‘새롭다’는 판정도 비교에 사용한 기준 데이터와 구조 일치 규칙에 의존합니다." },
        ],
      },
      {
        id: "experiment",
        toc: "실험 검증의 실제 범위",
        title: "‘목표 물성의 20% 이내’는 어떤 실험 결과일까?",
        termIds: ["bulk-modulus"],
        paragraphs: [
          "[원문 Experimental validation·그림 6] 네 가지 체적 탄성률 목표 각각에 대해 8,192개 후보를 생성했습니다. 중복·안정성·산소 포함 여부 등을 걸러 75개로 줄이고, 전문가 검토 후 4개를 실험 대상으로 골랐습니다. 그중 한 후보의 합성에 성공했으며 물질은 TaCr₂O₆였습니다.",
          "목표 체적 탄성률은 200 GPa였습니다. 원문은 나노압입 측정과 계산한 푸아송비를 이용해 체적 탄성률을 추정했으며, 네 번 측정의 평균은 158 ± 11 GPa, 최댓값은 169 GPa라고 설명합니다. 초록의 ‘목표값 20% 이내’는 저자들이 시료의 비치밀성을 고려해 최선 추정으로 사용한 최댓값에 해당합니다. 평균값과 바꾸어 적으면 안 됩니다.",
          { kind: "interpretation", text: "핵심은 성공 후보 하나만이 아니라 그 앞의 선별 과정입니다. 4개 중 1개라는 결과를 모든 조성·실험실에서의 합성 확률로 일반화할 수도 없습니다. 생성 모델의 제안과 사람의 검토·실험은 아직 하나의 연속된 연구 과정입니다." },
        ],
      },
      {
        id: "collaboration",
        toc: "실제 협업과 역할",
        title: "모델 개발과 실험 합성은 어떻게 연결됐을까?",
        paragraphs: [
          "Microsoft Research의 2025.01.16 공식 발표 ‘Experimental lab verification’은 중국과학원 SIAT의 Wenjie Li 교수 팀과 협력해 TaCr₂O₆를 합성했다고 설명합니다. 이는 공개 자료에서 확인되는 기관 간 실험 협력이며, LabBridge에서 연결하거나 수행한 프로젝트가 아닙니다.",
          "이 사례에서 AI의 출력은 구조 후보이고 실험의 출력은 실제 합성한 시료와 그 구조·물성 평가입니다. 모델의 생성 결과와 실험으로 확인한 결과를 같은 것으로 취급하지 않는 것이 중요합니다. 공개 자료만으로 각 참여자의 상세 업무 시간·비용·계약 형태까지 알 수는 없습니다.",
          { kind: "application", text: "후속 협업에서는 도메인 연구자가 목표와 합성·측정 제약을, AI 담당자가 실행 조건과 후보 기록·평가 재현성을 논의할 수 있습니다. 이는 LabBridge의 역할 제안이며 원 연구팀의 상세 인력 배치를 그대로 옮긴 것이 아닙니다." },
        ],
      },
      {
        id: "workflow",
        toc: "연구실의 첫 실험 설계",
        title: "처음부터 새 모델을 학습해야 할까?",
        paragraphs: [
          { kind: "application", text: "먼저 한 가지 물질 계열과 한 가지 목표 물성으로 질문을 좁힙니다. 허용 원소, 피해야 할 원소, 목표 단위, 계산 예산과 실험 가능한 조건을 적고 기존 후보 탐색 방식도 비교 대상으로 남겨 두는 것이 좋습니다." },
          "첫 검토는 공개된 사전학습 모델로 제한된 후보를 만들고, 중복과 명백한 제약 위반을 거른 뒤, 선택한 후보를 기존 방식과 같은 계산 기준으로 비교하는 정도로 작게 잡을 수 있습니다. 이 절차는 LabBridge의 제안이며 해당 연구가 모든 연구실에 권장한 표준 절차는 아닙니다.",
          "진행 여부는 ‘생성한 구조 수’보다 ‘같은 검증 예산에서 유효 후보를 얼마나 얻었는가’로 판단해 보세요. 생성 조건·모델 버전·후보 파일·탈락 이유를 함께 기록하면 결과가 좋지 않아도 다음 실험을 설계할 근거가 남습니다. 실제 합성에 들어가기 전에는 재료 전문가의 별도 판단이 필요합니다.",
        ],
      },
      {
        id: "caveats",
        toc: "한계·주의점",
        title: "‘안정적’이라는 예측만으로 충분하지 않다",
        paragraphs: [
          "계산상 에너지가 유리한 구조도 원하는 공정으로 합성되지 않거나, 목표 환경에서 필요한 기능을 보이지 않을 수 있습니다. 논문 역시 실제 활용에 필요한 모든 기준을 평가한 것은 아니며 최종 확인은 실험과 특성 평가라고 설명합니다. 목표 물성 하나를 맞췄다는 이유로 완성된 배터리·촉매·자석을 얻었다고 표현하면 안 됩니다.",
          "[공식 실행 자료, 2026.10.16 확인] 공개 체크포인트는 저장소 코드로 다시 학습한 것으로 논문 당시 모델과 동일하지 않아 결과가 다를 수 있다고 안내합니다. 설치 예시는 Linux와 CUDA GPU를 전제합니다. 코드가 공개됐다는 사실만으로 모든 PC에서 바로 실행되거나 논문 수치를 그대로 재현한다고 볼 수 없습니다.",
          { kind: "caution", text: "이 글은 2025년 연구를 바탕으로 한 기술 해설입니다. 이후 모든 모델과 비교한 최신 순위나 특정 연구실의 도입 비용을 검증한 글이 아닙니다. 공개 자료의 이용 조건과 연구실의 비공개 조성·아이디어 보호도 실행 전에 별도로 확인해야 합니다." },
        ],
      },
      {
        id: "related",
        toc: "관련 기술",
        title: "우리 연구실에 적용하려면 무엇이 필요할까?",
        paragraphs: [
          { kind: "application", text: "새로운 기본 모델을 학습하는 일과 사전학습 모델을 시험하는 일은 준비 규모가 다릅니다. 처음에는 모델·조건의 적용 범위, 계산 자원, 후보 검증 도구, 합성·측정 가능 여부를 확인하세요. 추가 학습이 필요해졌다면 그때 신뢰할 수 있는 물성 라벨과 데이터 이용 권한을 점검합니다." },
          { kind: "application", text: "재료 연구자는 목표 물성과 합성 제약·검증 조건을 정하고, AI 전문가는 생성 실행과 후보 기록·계산 평가의 재현성을 설계하는 역할을 제안할 수 있습니다. 계산 재료과학 역량과 실험 역량도 함께 필요할 수 있습니다. 이는 이 프로젝트의 실제 인력 배치를 단정한 설명이 아니라 후속 협업을 위한 역할 예시입니다." },
          "상담 전 질문은 ‘기존 후보를 고르는 것으로 충분한가’, ‘새 후보의 좋고 나쁨을 무엇으로 확인할 것인가’, ‘실험할 수 있는 후보의 조건과 개수는 어느 정도인가’입니다. 세 질문에 답하기 어렵다면 모델 실행보다 연구 목표와 평가 기준을 먼저 정리하는 편이 좋습니다.",
        ],
      },
      {
        id: "sources",
        toc: "원문과 실행 자료",
        title: "무엇을 확인했고 무엇은 아직 확인하지 않았을까?",
        paragraphs: [
          "Zeni, C., Pinsler, R., Zügner, D. 외, ‘A generative model for inorganic materials design’, Nature 639, 624–632 (2025). 최초 공개일은 2025.01.16이며 DOI는 10.1038/s41586-025-08628-5입니다. 위의 ‘원문 보기’에서 논문으로 이동할 수 있습니다.",
          "2026.10.16에 본문의 학습 자료·그림 2 비교·Experimental validation·Discussion을 확인해 한국어로 요약·재구성했습니다. 원 논문은 CC BY 4.0입니다. 라이선스: https://creativecommons.org/licenses/by/4.0/ . 실행 조건과 체크포인트 주의사항은 Microsoft 공식 저장소 README에서 확인했습니다: https://github.com/microsoft/mattergen .",
          "원문 도판을 복제하지 않았으며, 이 작업에서 코드를 실행하거나 후보를 생성·합성하지 않았습니다. 실제 재현 결과가 아니라 공개 자료 검토와 LabBridge의 적용 제안입니다. 생성 후보를 곧바로 검증된 신소재로 취급하지 않는 것이 이 글의 핵심 경계입니다.",
          "기관 간 실험 협력은 2026.10.17 확인한 Microsoft Research 공식 발표의 ‘Experimental lab verification’을 근거로 적었습니다: https://www.microsoft.com/en-us/research/blog/mattergen-a-new-paradigm-of-materials-design-with-generative-ai/ . 논문 세부 수치는 2026.10.16 검토 기록을 보존했으며 이번 실행에서 새 합성 실험을 수행하지 않았습니다.",
        ],
      },
    ],
    facts: [
      { label: "주제", value: "생성형 무기 재료 설계" },
      { label: "핵심 모델", value: "결정 구조 확산 모델" },
      { label: "실험 검증", value: "실험 선정 후보 4개 중 1개 합성" },
      { label: "원문", value: "Nature (2025.01.16)" },
      { label: "DOI", value: "10.1038/s41586-025-08628-5" },
    ],
    technologies: [
      { title: "확산 모델", description: "잡음 상태에서 조건에 맞는 결정 구조를 복원하는 생성 방법" },
      { title: "역설계", description: "원하는 물성에서 출발해 가능한 구조 후보를 찾는 접근" },
      { title: "계산 재료과학", description: "생성 후보의 에너지와 안정성을 계산으로 검토하는 분야" },
    ],
    relatedSlugs: ["mattergen-material-design", "surrogate-models", "retrosynthesis"],
  },
  {
    slug: "alphaevolve-algorithm-discovery",
    kind: "trend",
    title: "코드를 진화시켜 알고리즘을 찾는다: AlphaEvolve의 연구 방식",
    summary:
      "Google DeepMind의 AlphaEvolve는 LLM이 만든 코드 후보를 자동 평가하고 좋은 해법을 반복 진화시킵니다. 알고리즘 발견에 강한 이유와 적용 가능한 연구 문제의 조건을 정리합니다.",
    field: "과학 AI · 알고리즘 탐색",
    topicId: "science",
    topicLabel: "과학 AI",
    domains: ["과학 AI", "LLM·생성형 AI"],
    tags: ["#AlphaEvolve", "#진화적 탐색", "#알고리즘 발견"],
    source: "Google DeepMind · AlphaEvolve white paper · 2025",
    publishedOn: "2026.10.10",
    readingMinutes: 6,
    cover: "alphaEvolve",
    featuredRank: 3,
    featuredHeadline: "AI가 코드를 고치고 겨루며\n더 나은 알고리즘을 찾는다면?",
    featuredSummary:
      "AlphaEvolve는 LLM이 만든 코드 후보를 자동으로 평가하고 좋은 해법만 남겨 진화시킵니다. 어떤 연구 문제에 맞는지 조건을 정리했습니다.",
    institution: "Google DeepMind",
    sourceUrl: "https://arxiv.org/abs/2506.13131",
    imageAlt:
      "연구자가 여러 알고리즘 후보가 자동 평가를 거쳐 더 나은 경로로 진화하는 과정을 검토하는 설명용 이미지",
    imageCaption:
      "코드 후보를 생성·평가·선택해 개선하는 진화적 탐색 흐름을 재구성한 이미지입니다. 실제 AlphaEvolve 화면이나 연구 도판이 아닙니다.",
    sampleNotice:
      "성과 수치와 적용 조건은 Google DeepMind 공식 발표와 AlphaEvolve 백서에서 확인했습니다. 대표 이미지는 설명용 생성 이미지입니다.",
    highlights: [
      { label: "지금 변하는 점", text: "코드 초안을 쓰는 AI에서 검증 가능한 알고리즘을 반복 탐색하는 AI로 넓어졌습니다." },
      { label: "작동 구조", text: "LLM이 코드를 제안하고 자동 평가기가 실행·채점한 결과로 다음 후보를 고릅니다." },
      { label: "주요 결과", text: "50개가 넘는 수학 문제 중 약 20%에서 기존 최고 해법을 개선했다고 발표했습니다." },
      { label: "적용 조건", text: "정답의 품질을 코드로 자동 측정할 수 있는 문제가 가장 잘 맞습니다." },
    ],
    sections: [
      {
        id: "intro",
        toc: "기술 소개",
        title: "코드를 쓰는 AI에서 알고리즘을 발견하는 AI로",
        paragraphs: [
          "AlphaEvolve는 Gemini 기반 LLM이 알고리즘 코드를 제안하고, 자동 평가기가 각 후보를 실행·채점한 뒤 더 좋은 프로그램을 다음 탐색의 재료로 남기는 진화적 코딩 에이전트입니다.",
          "핵심은 자연어로 그럴듯한 코드를 한 번 만드는 것이 아니라, 측정 가능한 목표를 향해 수많은 변형을 시험하고 선택하는 반복 과정입니다.",
        ],
      },
      {
        id: "difference",
        toc: "기존과의 차이",
        title: "일반 코딩 도우미와 무엇이 다를까?",
        paragraphs: [
          "일반 코딩 도우미는 사용자의 요청에 맞는 코드를 제안하지만 그 코드가 가장 빠르거나 새로운 해법인지 장기간 탐색하지는 않습니다. AlphaEvolve는 Gemini Flash로 후보의 폭을 넓히고 Gemini Pro로 더 깊은 변형을 제안합니다.",
          "각 후보는 사람이 느낌으로 고르는 것이 아니라 정확도·속도·비용처럼 미리 만든 평가 함수로 채점됩니다. 그래서 개선 여부를 자동으로 판별할 수 있는 문제가 중요합니다.",
        ],
      },
      {
        id: "how",
        toc: "쉬운 작동 개념",
        title: "제안하고 실행하고 살아남은 코드를 다시 바꾼다",
        paragraphs: [
          "연구자가 문제의 코드 골격과 평가 기준을 준비하면 LLM이 여러 프로그램 변형을 만듭니다. 평가기가 실행 결과를 점수로 바꾸고, 진화 알고리즘이 높은 점수와 다양한 아이디어를 다음 세대에 남깁니다.",
        ],
        steps: [
          { title: "목표 정의", detail: "정확도·속도처럼 자동 측정할 점수를 정합니다" },
          { title: "코드 변형", detail: "LLM이 서로 다른 알고리즘 후보를 제안합니다" },
          { title: "실행·평가", detail: "테스트와 평가기로 각 후보를 객관적으로 채점합니다" },
          { title: "선택·진화", detail: "좋은 후보를 보존하고 다시 변형해 탐색을 이어갑니다" },
        ],
      },
      {
        id: "fields",
        toc: "연구 활용 분야",
        title: "어떤 문제에서 성과를 보였을까?",
        paragraphs: [
          "Google DeepMind는 수학·컴퓨터과학의 공개 문제 50개 이상에 적용했을 때 약 75%에서 기존 최고 수준의 해법을 다시 찾고, 약 20%에서는 알려진 최고 해법을 개선했다고 발표했습니다.",
          "또한 4×4 복소수 행렬 곱셈을 48회의 스칼라 곱셈으로 수행하는 알고리즘을 찾아 해당 조건에서 Strassen 이후 56년 만의 개선이라고 보고했습니다. 데이터센터 스케줄링과 하드웨어 회로, AI 학습 최적화에도 활용됐습니다.",
        ],
      },
      {
        id: "caveats",
        toc: "한계·주의점",
        title: "모든 연구 문제를 코드 점수로 바꿀 수는 없다",
        paragraphs: [
          "AlphaEvolve는 후보를 자동 실행하고 품질을 정확히 채점할 수 있을 때 강합니다. 사람의 판단이 필요한 연구 질문, 실험 비용이 매우 큰 문제, 안전하지 않은 코드를 격리할 환경이 없는 경우에는 같은 방식을 바로 적용하기 어렵습니다.",
          "자동 평가기가 잘못된 목표를 측정하면 AI는 실제 연구 가치가 아니라 그 점수만 높이는 편법을 찾을 수 있습니다. 테스트 범위, 계산 자원, 보안 격리, 최종 전문가 검토가 필수입니다.",
        ],
      },
      {
        id: "related",
        toc: "관련 기술",
        title: "우리 연구 문제에 맞는지 확인하는 질문",
        paragraphs: [
          "후보 해법을 코드로 표현할 수 있는가, 결과를 자동으로 재현할 수 있는가, 좋은 결과를 하나의 점수나 명확한 기준으로 비교할 수 있는가를 먼저 확인해야 합니다.",
          "세 질문에 답하기 어렵다면 LLM 에이전트보다 평가 데이터와 시뮬레이터를 만드는 일이 먼저입니다. AlphaEvolve는 당시 선별된 학술 사용자 대상 조기 접근을 예고한 연구 시스템이며, 범용 코딩 제품과 같게 보아서는 안 됩니다.",
        ],
      },
    ],
    facts: [
      { label: "주제", value: "진화적 알고리즘 발견" },
      { label: "기반 모델", value: "Gemini Flash·Pro" },
      { label: "평가 범위", value: "수학·컴퓨팅 공개 문제 50개 이상" },
      { label: "공식 발표", value: "Google DeepMind (2025.05.14)" },
      { label: "원문", value: "arXiv:2506.13131" },
    ],
    technologies: [
      { title: "진화적 탐색", description: "높은 점수와 다양한 코드 후보를 남기며 반복 개선하는 방법" },
      { title: "LLM 코드 생성", description: "문제의 코드 골격을 여러 알고리즘 후보로 변형하는 기술" },
      { title: "자동 평가기", description: "후보를 실행해 정확성·속도·비용을 객관적으로 채점하는 장치" },
    ],
    relatedSlugs: ["research-agent", "surrogate-models", "experiment-optimization"],
  },
  {
    slug: "literature-review-llm",
    kind: "trend",
    title: "문헌 리뷰, LLM에게 어디까지 맡겨도 될까",
    summary: "검색·요약은 빠르지만 인용 확인은 여전히 사람 몫입니다. 연구실에서 쓸 때의 체크리스트입니다.",
    field: "LLM·에이전트",
    topicId: "llm",
    topicLabel: "LLM·에이전트",
    domains: ["LLM·생성형 AI"],
    tags: ["#문헌 리뷰", "#요약"],
    source: "예시 출처 A · 10.08",
    publishedOn: "2026.10.08",
    readingMinutes: 3,
    cover: "script",
    sampleNotice: "트렌드 글은 모두 화면 시안용 예시입니다.",
    highlights: [
      { label: "맡길 일", text: "검색어 확장과 1차 요약 초안입니다." },
      { label: "맡기지 말 일", text: "인용 존재 여부와 수치 확인입니다." },
      { label: "차이", text: "검색 창보다 초안은 길어지지만 검증 책임은 같습니다." },
      { label: "주의", text: "각주가 실제 논문인지는 따로 열어서 봅니다." },
    ],
    technologies: [
      { title: "LLM", description: "긴 글을 짧게 정리하는 언어 모델" },
    ],
    relatedSlugs: ["research-agent", "reproducibility-checklist"],
  },
  {
    slug: "surrogate-models",
    kind: "trend",
    title: "느린 시뮬레이션을 대신하는 ‘대리 모델’이 늘고 있다",
    summary: "수치해석 결과로 학습한 모델이 계산 시간을 줄이는 흐름과, 맞는 연구·아닌 연구를 구분합니다.",
    field: "과학 AI",
    topicId: "science",
    topicLabel: "과학 AI",
    domains: ["과학 AI"],
    tags: ["#시뮬레이션", "#대리 모델"],
    source: "예시 출처 B · 10.07",
    publishedOn: "2026.10.06",
    readingMinutes: 4,
    cover: "flow",
    sampleNotice: "트렌드 글은 모두 화면 시안용 예시입니다.",
    highlights: [
      { label: "개념", text: "느린 계산의 입력과 출력을 먼저 모아 빠른 모델을 만듭니다." },
      { label: "차이", text: "방정식을 없애는 것이 아니라 반복 조회를 줄입니다." },
      { label: "활용", text: "같은 형태의 시뮬레이션을 많이 돌리는 연구입니다." },
      { label: "주의", text: "학습 범위 밖 조건에서는 그럴듯한 오답이 나옵니다." },
    ],
    technologies: [
      { title: "대리 모델", description: "비싼 계산을 흉내 내는 빠른 모델" },
    ],
    relatedSlugs: ["fluid-simulation", "experiment-optimization"],
  },
  {
    slug: "few-shot-vision",
    kind: "trend",
    title: "라벨 몇 장으로 시작하는 이미지 분석, 어디까지 왔나",
    summary: "범용 비전 모델 위에 소량 데이터만 더하는 방식이 실험실 이미지 분석의 출발점이 되고 있습니다.",
    field: "비전",
    topicId: "vision",
    topicLabel: "비전",
    domains: [],
    tags: ["#파운데이션 모델", "#이미지 분할"],
    source: "예시 출처 C · 10.06",
    publishedOn: "2026.10.04",
    readingMinutes: 3,
    cover: "cells",
    sampleNotice: "트렌드 글은 모두 화면 시안용 예시입니다.",
    highlights: [
      { label: "개념", text: "큰 모델이 이미 본 시각 특징 위에 우리 라벨을 조금 더합니다." },
      { label: "차이", text: "처음부터 수천 장을 라벨하지 않아도 초안이 나옵니다." },
      { label: "활용", text: "현미경, 재료, 현장 사진처럼 라벨이 적은 이미지입니다." },
      { label: "주의", text: "초안 라벨은 연구자가 샘플을 다시 봐야 합니다." },
    ],
    technologies: [
      { title: "컴퓨터 비전", description: "이미지를 나누고 분류하는 모델" },
    ],
    relatedSlugs: ["microscope-cell-drawing", "cancer-cell-classification"],
  },
  {
    slug: "diffusion-molecules",
    kind: "trend",
    title: "그림 그리던 확산 모델, 분자와 소재를 설계하다",
    summary: "이미지 생성 기술이 화학·재료 연구로 넘어오는 과정과, 실험 검증이 왜 필요한지 적습니다.",
    field: "생성형 AI",
    topicId: "generative",
    topicLabel: "생성형 AI",
    domains: ["LLM·생성형 AI"],
    tags: ["#분자 설계", "#확산 모델"],
    source: "예시 출처 A · 10.03",
    publishedOn: "2026.10.03",
    readingMinutes: 5,
    cover: "molecule",
    sampleNotice: "트렌드 글은 모두 화면 시안용 예시입니다.",
    highlights: [
      { label: "개념", text: "원하는 조건 쪽으로 구조를 조금씩 바꿔 후보를 만듭니다." },
      { label: "차이", text: "데이터베이스 검색과 달리 새로운 후보를 제안합니다." },
      { label: "활용", text: "분자와 소재 후보를 줄이고 싶은 설계 문제입니다." },
      { label: "주의", text: "생성된 후보는 합성·측정 전에는 가설입니다." },
    ],
    technologies: [
      { title: "확산 모델", description: "노이즈에서 조건을 만족하는 구조를 만드는 모델" },
    ],
    relatedSlugs: ["protein-design", "retrosynthesis"],
  },
  {
    slug: "sensor-logs",
    kind: "trend",
    title: "장비 센서 로그, 버리지 말고 모아 두세요",
    summary: "시계열 예측 모델이 쉬워지면서 실험 장비 기록 자체가 연구 자산이 되는 흐름입니다.",
    field: "시계열·예측",
    topicId: "forecast",
    topicLabel: "시계열·예측",
    domains: ["시계열·예측"],
    tags: ["#센서 데이터", "#이상 탐지"],
    source: "예시 출처 D · 10.02",
    publishedOn: "2026.10.02",
    readingMinutes: 3,
    cover: "chart",
    sampleNotice: "트렌드 글은 모두 화면 시안용 예시입니다.",
    highlights: [
      { label: "개념", text: "장비 시간 기록을 모아 이상과 다음 값을 봅니다." },
      { label: "차이", text: "고장난 뒤에 로그를 여는 대신, 모으는 형식부터 정합니다." },
      { label: "활용", text: "센서가 계속 붙는 실험 장비와 환경 측정입니다." },
      { label: "주의", text: "기록이 들쭉날쭉하면 모델보다 수집 방식을 먼저 봅니다." },
    ],
    technologies: [
      { title: "시계열 예측", description: "시간 순서 데이터에서 다음 값을 보는 방법" },
    ],
    relatedSlugs: ["battery-life", "eeg-behavior"],
  },
  {
    slug: "experiment-optimization",
    kind: "trend",
    title: "실험 조건 찾기를 줄여 주는 최적화 도구 정리",
    summary: "온도·농도·시간 조합을 모두 돌려 보지 않고 다음 실험을 추천받는 방법들을 모았습니다.",
    field: "오픈소스·도구",
    topicId: "oss",
    topicLabel: "오픈소스·도구",
    domains: ["오픈소스·도구"],
    tags: ["#실험 최적화", "#베이지안 최적화"],
    source: "예시 출처 B · 09.30",
    publishedOn: "2026.09.30",
    readingMinutes: 2,
    cover: "chart",
    sampleNotice: "트렌드 글은 모두 화면 시안용 예시입니다.",
    highlights: [
      { label: "개념", text: "지금까지의 실험 결과로 다음 조건을 고릅니다." },
      { label: "차이", text: "모든 조합 대신 정보가 큰 조합을 먼저 합니다." },
      { label: "활용", text: "조건 변수가 여러 개인 실험 설계입니다." },
      { label: "주의", text: "측정 노이즈가 크면 추천도 흔들립니다." },
    ],
    technologies: [
      { title: "베이지안 최적화", description: "불확실한 실험에서 다음 조건을 고르는 방법" },
    ],
    relatedSlugs: ["surrogate-models", "retrosynthesis"],
  },
  {
    slug: "reproducibility-checklist",
    kind: "trend",
    title: "AI를 쓴 논문, 무엇을 함께 공개해야 할까",
    summary: "코드·데이터·모델 버전까지, 재현성을 위해 자주 요구되는 항목을 정리했습니다.",
    field: "정책·연구윤리",
    topicId: "ethics",
    topicLabel: "정책·연구윤리",
    domains: [],
    tags: ["#재현성", "#데이터 공개"],
    source: "예시 출처 C · 09.26",
    publishedOn: "2026.09.26",
    readingMinutes: 4,
    cover: "script",
    sampleNotice: "트렌드 글은 모두 화면 시안용 예시입니다.",
    highlights: [
      { label: "개념", text: "모델 이름만으로는 같은 결과를 다시 만들기 어렵습니다." },
      { label: "차이", text: "코드, 데이터 범위, 랜덤 시드, 버전을 같이 적습니다." },
      { label: "활용", text: "AI를 방법에 포함한 논문과 협업 기록입니다." },
      { label: "주의", text: "공개 범위는 기관 규정과 동의 범위를 먼저 봅니다." },
    ],
    technologies: [
      { title: "재현성 기록", description: "다른 사람이 과정을 따라 할 수 있게 적는 항목" },
    ],
    relatedSlugs: ["private-data-ai", "literature-review-llm"],
  },
  {
    slug: "graph-neural-nets",
    kind: "trend",
    title: "구조가 있는 데이터라면 그래프 신경망을 떠올려 보자",
    summary: "분자, 교통망, 기상 격자처럼 연결이 중요한 데이터에서 그래프 모델이 쓰이는 이유를 적습니다.",
    field: "과학 AI",
    topicId: "science",
    topicLabel: "과학 AI",
    domains: ["과학 AI"],
    tags: ["#그래프 신경망", "#분자·소재"],
    source: "예시 출처 D · 09.24",
    publishedOn: "2026.09.24",
    readingMinutes: 3,
    cover: "protein",
    sampleNotice: "트렌드 글은 모두 화면 시안용 예시입니다.",
    highlights: [
      { label: "개념", text: "점과 선의 관계 자체를 모델 입력으로 둡니다." },
      { label: "차이", text: "표로 펼치면 사라지는 이웃 관계를 유지합니다." },
      { label: "활용", text: "분자, 재료, 연결망, 일부 공간 격자입니다." },
      { label: "주의", text: "연결을 어떻게 정의했는지가 결과보다 먼저입니다." },
    ],
    technologies: [
      { title: "그래프 신경망", description: "연결된 데이터 구조를 학습하는 모델" },
    ],
    relatedSlugs: ["protein-structure", "weather-graph"],
  },
  {
    slug: "private-data-ai",
    kind: "trend",
    title: "미공개 데이터, 외부 AI에 올려도 괜찮을까",
    summary: "연구실 밖으로 데이터를 내보내지 않고 AI를 쓰는 선택지와 그 비용을 비교합니다.",
    field: "LLM·에이전트",
    topicId: "llm",
    topicLabel: "LLM·에이전트",
    domains: ["LLM·생성형 AI"],
    tags: ["#보안", "#로컬 모델"],
    source: "예시 출처 A · 09.22",
    publishedOn: "2026.09.22",
    readingMinutes: 3,
    cover: "agent",
    sampleNotice: "트렌드 글은 모두 화면 시안용 예시입니다.",
    highlights: [
      { label: "개념", text: "편의와 데이터 반출 금지를 같이 봐야 합니다." },
      { label: "차이", text: "외부 API와 연구실 안 모델은 운영 비용이 다릅니다." },
      { label: "활용", text: "아직 공개하면 안 되는 실험 데이터입니다." },
      { label: "주의", text: "프롬프트에 붙인 파일도 전송으로 봅니다." },
    ],
    technologies: [
      { title: "로컬 모델", description: "연구실 밖에서 돌지 않는 실행 방식" },
    ],
    relatedSlugs: ["research-agent", "reproducibility-checklist"],
  },
  {
    slug: "food-image-quality",
    kind: "trend",
    title: "식품 품질과 영상 이미지 분석의 최근 동향",
    summary: "식품 사진을 품질 판정에 쓰는 최근 질문을 예시로 모아 둔 글입니다.",
    field: "비전",
    topicId: "vision",
    topicLabel: "비전",
    domains: [],
    tags: ["#식품", "#이미지 분석"],
    source: "화면 시안용 예시",
    publishedOn: "2026.04.10",
    readingMinutes: 3,
    cover: "food",
    sampleNotice: "관련 콘텐츠 자리에 맞춘 화면 시안용 예시입니다.",
    highlights: [
      { label: "개념", text: "색, 형태, 표면 사진을 품질 항목과 연결합니다." },
      { label: "차이", text: "사람이 보는 등급 기준을 먼저 문장으로 적어야 합니다." },
      { label: "활용", text: "반복 촬영이 가능한 식품·재료 실험입니다." },
      { label: "주의", text: "조명과 카메라가 바뀌면 기준도 바뀝니다." },
    ],
    technologies: [
      { title: "컴퓨터 비전", description: "표면 이미지에서 품질 단서를 찾는 기술" },
    ],
    relatedSlugs: ["cancer-cell-classification", "few-shot-vision"],
  },
  {
    slug: "medical-imaging-limits",
    kind: "trend",
    title: "딥러닝 기반 의료 영상 분석의 가능성과 한계",
    summary: "의료 영상 모델을 연구에 쓸 때 성능 숫자 옆에 두어야 할 한계를 정리한 예시입니다.",
    field: "비전",
    topicId: "vision",
    topicLabel: "비전",
    domains: ["의료·헬스케어"],
    tags: ["#의료 영상", "#딥러닝"],
    source: "화면 시안용 예시",
    publishedOn: "2025.04.22",
    readingMinutes: 4,
    cover: "medical",
    sampleNotice: "관련 콘텐츠 자리에 맞춘 화면 시안용 예시입니다.",
    highlights: [
      { label: "가능성", text: "반복 판독을 줄이는 초안을 만들 수 있습니다." },
      { label: "한계", text: "다른 병원, 다른 장비에서는 성능이 달라집니다." },
      { label: "활용", text: "연구 단계의 분류·검출 질문입니다." },
      { label: "주의", text: "임상 결정을 대체하는 표현은 쓰지 않습니다." },
    ],
    technologies: [
      { title: "의료 영상 분석", description: "영상에서 연구 질문을 분류하는 딥러닝" },
    ],
    relatedSlugs: ["cancer-cell-classification", "eeg-behavior"],
  },
];

export const INSIGHTS: InsightArticle[] = seeds.map((seed) => applyInsightCover(enrichInsight(toArticle(seed))));

const INSIGHT_BY_SLUG = new Map(INSIGHTS.map((article) => [article.slug, article]));

export function insightsByKind(kind: InsightKind): InsightArticle[] {
  return INSIGHTS.filter((article) => article.kind === kind).sort((left, right) =>
    right.publishedOn.localeCompare(left.publishedOn),
  );
}

export function getInsight(slug: string): InsightArticle | undefined {
  return INSIGHT_BY_SLUG.get(slug);
}

export function relatedInsights(article: InsightArticle): InsightArticle[] {
  return article.relatedSlugs
    .map((slug) => INSIGHT_BY_SLUG.get(slug))
    .filter((item): item is InsightArticle => item !== undefined);
}

/** 목록 상단에서 돌아가며 보여 줄 추천 글. 편집자가 정한 순서(featuredRank)를 따릅니다. */
export function featuredInsights(kind: InsightKind, limit: number): InsightArticle[] {
  const articles = insightsByKind(kind);
  const ranked = articles
    .filter((article) => article.featuredRank !== undefined)
    .sort((left, right) => (left.featuredRank ?? 0) - (right.featuredRank ?? 0))
    .slice(0, limit);

  // 추천 글을 아직 정하지 않았다면 최신 글 하나라도 보여 줍니다.
  if (ranked.length > 0) return ranked;
  if (articles.length > 0) return [articles[0]];
  throw new Error(`${kind} 글이 없습니다.`);
}

/** 랜딩의 최신 인사이트 3장. 이미지에 보인 글 순서를 유지합니다. */
export const LATEST_LANDING_SLUGS = [
  "research-agent",
  "mattergen-material-design",
  "alphaevolve-algorithm-discovery",
] as const;

export function landingInsights(): InsightArticle[] {
  return LATEST_LANDING_SLUGS.map((slug) => {
    const article = INSIGHT_BY_SLUG.get(slug);
    if (!article) {
      throw new Error(`랜딩 글을 찾지 못했습니다: ${slug}`);
    }
    return article;
  });
}

export function topicCount(kind: InsightKind, topicId: string): number {
  const articles = insightsByKind(kind);
  if (topicId === "all") {
    return articles.length;
  }
  return articles.filter((article) => article.topicId === topicId).length;
}

export function articlePath(article: InsightArticle): string {
  const section = article.kind === "case" ? "cases" : "trends";
  return `/${section}/${article.slug}`;
}

export function kindLabel(kind: InsightKind): string {
  return kind === "case" ? "AI 연구 협업 사례" : "AI 트렌드";
}

export function matchesTopicFilter(article: InsightArticle, topic: string): boolean {
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

export function searchInsights(query: string): InsightArticle[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [];
  }
  return INSIGHTS.filter((article) => {
    const haystack = [article.title, article.summary, article.field, article.topicLabel, ...article.tags]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}
