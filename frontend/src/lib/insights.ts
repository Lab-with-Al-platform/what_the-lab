/**
 * 화면 시안용 인사이트 글입니다.
 * 목록의 정보 구조는 design/인사이트_시안 을 따르고,
 * 문장·수치는 확정 이미지가 보여 준 예시만 자세히 적었습니다.
 * 백엔드가 생기기 전에는 이 파일이 목록과 상세의 데이터 소스입니다.
 */

export type InsightKind = "case" | "trend";

export type CoverTheme =
  | "cells"
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

const agentSections: InsightSection[] = [
  {
    id: "intro",
    toc: "기술 소개",
    title: "무슨 흐름인가?",
    paragraphs: [
      "문헌 검색과 요약에 머물던 LLM이, 실험 계획 초안과 데이터 정리까지 돕는 연구 보조 에이전트로 넓어지고 있습니다. 이 글은 그 흐름을 비-AI 연구실 기준으로 짧게 정리한 예시입니다.",
    ],
  },
  {
    id: "difference",
    toc: "기존과의 차이",
    title: "검색 창과 무엇이 다른가?",
    paragraphs: [
      "예전 도구는 질문을 넣으면 문단을 돌려주는 데서 끝났습니다. 에이전트라고 부르는 흐름은 검색, 요약, 표 정리처럼 여러 단계를 이어서 초안을 만듭니다.",
      "그래도 실험의 맞음과 틀림을 판단하는 주체는 연구자입니다.",
    ],
  },
  {
    id: "how",
    toc: "쉬운 작동 개념",
    title: "어떻게 동작한다고 이해하면 될까?",
    paragraphs: [
      "사람이 할 일을 잘게 나누고, 모델이 각 단계의 초안을 만든 뒤, 사람이 고치는 구조로 이해하면 됩니다. 논문 읽기, 실험 조건 후보 적기, 결과 표 정리처럼 반복되는 칸부터 맡기는 편이 안전합니다.",
    ],
    steps: [
      { title: "질문 나누기", detail: "한 번에 맡기지 않고 단계로 쪼갭니다" },
      { title: "근거 붙이기", detail: "요약마다 원문 위치를 같이 보게 합니다" },
      { title: "사람 검토", detail: "숫자와 인용은 연구자가 확인합니다" },
      { title: "범위 제한", detail: "공개해도 되는 자료만 입력합니다" },
    ],
  },
  {
    id: "fields",
    toc: "연구 활용 분야",
    title: "어떤 연구에 써 볼 수 있나?",
    paragraphs: [
      "문헌이 많은 분야, 실험 일지를 자주 정리하는 분야, 조건 조합이 많은 분야에서 먼저 이야기가 나옵니다. 내 연구의 어느 단계가 가장 느린지 적어 보는 것이 시작입니다.",
    ],
  },
  {
    id: "caveats",
    toc: "한계·주의점",
    title: "어디부터는 사람이 봐야 할까?",
    paragraphs: [
      "없는 논문을 만들어 내거나 숫자를 바꿔 적을 수 있습니다. 미공개 데이터와 환자·시료 정보는 외부 서비스에 올리지 않는 기준이 먼저입니다.",
      "이 페이지의 문장은 화면 시안용 예시이며, 특정 제품을 추천하지 않습니다.",
    ],
  },
  {
    id: "related",
    toc: "관련 기술",
    title: "함께 볼 기술",
    paragraphs: [
      "자연어 처리·LLM, 연구 자동화, 데이터 공개 범위가 이 글을 읽는 뒤에 이어서 볼 키워드입니다.",
    ],
  },
];

const seeds: ArticleSeed[] = [
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
    title: "논문 읽기부터 실험 설계까지, 연구 보조 에이전트가 온다",
    summary:
      "최근 주목받는 LLM 에이전트의 연구 활용 사례와 가능성을 정리합니다. 문헌 검색·요약에 머물던 도구가 실험 계획 초안까지 넓어지는 흐름입니다.",
    field: "LLM·에이전트",
    topicId: "llm",
    topicLabel: "LLM·에이전트",
    domains: ["LLM·생성형 AI"],
    tags: ["#LLM", "#연구 자동화", "#에이전트"],
    source: "화면 시안용 예시",
    publishedOn: "2026.10.07",
    readingMinutes: 4,
    cover: "brain",
    sampleNotice: "트렌드 글의 문장과 날짜는 화면 배치 확인용 예시입니다.",
    featured: true,
    highlights: [
      { label: "지금 변하는 점", text: "요약 도구가 실험 계획 초안까지 역할을 넓히고 있습니다." },
      { label: "연구자의 역할", text: "판단과 검증, 그리고 공개하면 안 되는 데이터 선별입니다." },
      { label: "먼저 볼 단계", text: "문헌 정리, 표 만들기처럼 느린 반복 작업입니다." },
      { label: "주의", text: "없는 인용과 숫자를 만들 수 있으므로 원문 확인이 필요합니다." },
    ],
    sections: agentSections,
    facts: [
      { label: "주제", value: "LLM·에이전트" },
      { label: "활용 기술", value: "자연어 처리, 연구 보조 에이전트" },
      { label: "데이터 유형", value: "공개 논문·실험 일지 초안" },
      { label: "발행", value: "LabBridge 시안" },
      { label: "게시일", value: "2026.10.07" },
    ],
    technologies: [
      { title: "자연어 처리·LLM", description: "논문과 실험 노트의 문장을 다루는 모델" },
      { title: "에이전트", description: "여러 단계를 이어서 초안을 만드는 사용 방식" },
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
  "microscope-cell-drawing",
  "research-agent",
  "eeg-behavior",
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
