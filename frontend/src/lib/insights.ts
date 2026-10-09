/**
 * 화면 시안용 인사이트 글입니다.
 * 목록의 정보 구조는 design/인사이트_시안 을 따르고,
 * 문장·수치는 확정 이미지가 보여 준 예시만 자세히 적었습니다.
 * 백엔드가 생기기 전에는 이 파일이 목록과 상세의 데이터 소스입니다.
 */

export type InsightKind = "case" | "trend";

export type CoverTheme =
  | "cells"
  | "biomass"
  | "dental"
  | "concrete"
  | "coScientist"
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

export interface InsightSection {
  id: string;
  toc: string;
  title: string;
  paragraphs: string[];
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
  institution?: string;
  doi?: string;
  sourceUrl?: string;
  imageAlt?: string;
  imageCaption?: string;
  sampleNotice?: string;
  featured?: boolean;
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
  featured?: boolean;
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
      "[LabBridge 해석] 당장은 문헌이 많고 후보 조합이 넓은 분야에서 ‘무엇부터 실험할지’ 좁히는 용도가 현실적입니다. 다른 분야에 적용하려면 해당 분야의 데이터베이스, 평가 기준, 안전 규칙을 별도로 연결해야 합니다.",
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
    featured: true,
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
          "[LabBridge 해석] 이 사례는 거대한 모델이 없어도 연구 질문과 측정 기준이 명확하면 AI 협업을 시작할 수 있음을 보여 줍니다. 연구자는 촬영 조건과 생육 지표를 정하고, 데이터 전문가는 특징 정리와 회귀 모델 검증을 맡을 수 있습니다.",
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
      "치과병원 연구진과 융합과학 연구팀이 파노라마 X-ray에서 치조골 수준과 CEJ를 검출하고 치주골 손실률을 계산한 공동 연구 사례입니다.",
    field: "치과 · 의료 영상 분석",
    topicId: "AM-03",
    topicLabel: "컴퓨터 비전",
    domains: ["의료·헬스케어"],
    tags: ["#치과 영상 치아·골 분석", "#파노라마 X-ray", "#컴퓨터 비전"],
    source: "Scientific Reports · 2020",
    publishedOn: "2026.10.10",
    readingMinutes: 6,
    cover: "dental",
    institution: "서울대학교치과병원·융합과학 공동연구",
    doi: "10.1038/s41598-020-64509-z",
    sourceUrl: "https://doi.org/10.1038/s41598-020-64509-z",
    imageAlt:
      "치과 연구자와 AI 연구자가 파노라마 치과 X-ray의 치조골 경계 분석 결과를 함께 검토하는 설명용 이미지",
    imageCaption:
      "치과 영상과 AI 분석의 협업 과정을 재구성한 설명용 이미지입니다. 실제 환자나 원 논문의 도판이 아닙니다.",
    sampleNotice:
      "결과 수치는 논문 초록에서 확인한 값입니다. 대표 이미지는 설명용으로 생성했으며 진단 결과나 원 논문의 도판이 아닙니다.",
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
          "치주염을 평가할 때 파노라마 X-ray에서 치조골 수준과 치아의 기준점을 찾아 골 손실 정도를 판단합니다. 영상마다 여러 치아를 확인해야 하므로 연구 자료가 많아질수록 반복 측정 부담이 커집니다.",
          "이 연구는 딥러닝이 영상에서 필요한 기준점을 찾고, 기존 계산 방법과 결합해 치주골 손실률을 정량화할 수 있는지 확인했습니다.",
        ],
      },
      {
        id: "limits",
        toc: "기존 방식의 한계",
        title: "사람이 직접 판독할 때 어떤 차이가 생길까?",
        paragraphs: [
          "영상의 밝기와 치아 상태가 다르고 기준점이 흐린 경우에는 측정자의 경험이 중요합니다. 많은 영상을 반복해서 볼 때는 시간과 일관성도 함께 문제가 됩니다.",
          "AI의 목적은 전문의 판단을 없애는 것이 아니라, 반복 측정의 초안을 만들고 연구자가 확인할 지점을 좁히는 데 있습니다.",
        ],
      },
      {
        id: "method",
        toc: "AI 활용 방법",
        title: "딥러닝과 기존 계산 방식을 어떻게 결합했을까?",
        paragraphs: [
          "연구팀은 딥러닝으로 치조골 수준과 CEJ를 검출했습니다. 그다음 기존 컴퓨터 보조 진단 방식으로 두 기준점 사이의 관계를 계산해 골 손실률을 구했습니다.",
          "치과병원 영상치의학·치주과 연구진은 임상적으로 의미 있는 기준과 결과 검증을 맡고, 융합과학 연구진은 영상 처리와 모델 개발을 담당한 공동 연구로 확인됩니다.",
        ],
        steps: [
          { title: "영상 준비", detail: "파노라마 X-ray와 전문가 기준 확보" },
          { title: "기준점 검출", detail: "딥러닝으로 골 수준과 CEJ 탐색" },
          { title: "손실률 계산", detail: "기존 CAD 방식과 검출 결과 결합" },
          { title: "전문의 비교", detail: "전문의 판단과 통계적 일치도 확인" },
        ],
      },
      {
        id: "results",
        toc: "주요 결과",
        title: "전문의 판단과 얼마나 비슷했을까?",
        paragraphs: [
          "[원문에서 확인] 논문 초록에는 영상의학 전문의 진단과의 상관계수가 0.73, 급내상관계수(ICC)가 0.91로 보고됐습니다.",
          "상관계수는 두 측정이 함께 변하는 정도를, ICC는 같은 대상을 측정했을 때 값이 얼마나 일관되는지를 보는 지표입니다. 이 숫자를 곧바로 임상 진단 정확도라고 표현해서는 안 됩니다.",
        ],
      },
      {
        id: "meaning",
        toc: "연구 의미와 활용성",
        title: "이 사례가 AI 협업을 잘 보여 주는 이유는?",
        paragraphs: [
          "[LabBridge 해석] 의료 영상 AI는 좋은 모델만으로 완성되지 않습니다. 어떤 기준점을 찾아야 하는지, 오류가 연구 결론에 어떤 영향을 주는지 판단하는 도메인 연구자가 필요합니다.",
          "반대로 AI 전문가는 데이터 전처리, 검출 모델, 평가 지표를 설계합니다. 두 역할이 분리되면서도 결과 검증에서는 다시 만난다는 점이 LabBridge가 지향하는 협업 구조와 닮아 있습니다.",
        ],
      },
      {
        id: "caveats",
        toc: "고려할 점과 한계",
        title: "연구 결과를 어디까지 해석해야 할까?",
        paragraphs: [
          "이 연구 결과는 논문에서 사용한 데이터와 평가 조건에 대한 것입니다. 다른 병원, 장비, 촬영 조건, 환자 집단에서 사용하려면 별도 검증이 필요합니다.",
          "이 글은 연구 사례 소개이며 의료 조언이나 자동 진단 서비스 안내가 아닙니다. 실제 진단과 치료 결정은 의료 전문가의 판단이 필요합니다.",
        ],
      },
      {
        id: "sources",
        toc: "관련 연구 및 자료",
        title: "어디에 근거했나?",
        paragraphs: [
          "근거 논문은 Scientific Reports(2020)에 발표됐으며 DOI는 10.1038/s41598-020-64509-z입니다.",
          "이 글은 DOI와 초록에서 확인한 방법·결과를 중심으로 작성했습니다. 데이터 규모와 세부 학습 조건은 논문 본문을 함께 확인해야 합니다.",
        ],
      },
    ],
    facts: [
      { label: "분야", value: "치과 / 의료 영상" },
      { label: "활용 기술", value: "딥러닝 검출, 컴퓨터 보조 분석" },
      { label: "데이터 유형", value: "파노라마 치과 X-ray" },
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
          "[LabBridge 해석] 경량 분할 모델은 드론·이동형 카메라·점검 영상에서 균열 후보를 먼저 표시해 사람이 검토할 범위를 줄이는 데 활용 가능성이 있습니다.",
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
    featured: true,
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
    featured: true,
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

export const INSIGHTS: InsightArticle[] = seeds.map(toArticle);

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

export function featuredInsight(kind: InsightKind): InsightArticle {
  const featured = insightsByKind(kind).find((article) => article.featured);
  const fallback = insightsByKind(kind)[0];
  if (!featured && !fallback) {
    throw new Error(`${kind} 글이 없습니다.`);
  }
  return featured ?? fallback;
}

/** 랜딩의 최신 인사이트 3장. 이미지에 보인 글 순서를 유지합니다. */
export const LATEST_LANDING_SLUGS = [
  "research-agent",
  "lettuce-biomass-estimation",
  "periodontal-bone-loss-analysis",
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
