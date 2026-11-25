/**
 * 전문가 목록·상세의 화면 시안용 예시입니다.
 * labbridge-ui-v3의 정보 구조를 따랐고, 인물·소속·건수는 실제 프로필이 아닙니다.
 * Availability는 새 협업을 받을 수 있는지만 말합니다. 진행 중인 연구가 있어도 요청 자체를 막지 않습니다.
 */

export type Availability = "available" | "negotiable";

export interface ExpertProject {
  period: string;
  title: string;
  field: string;
  organization: string;
  role: string;
  outcome: string;
}

export interface ExpertCondition {
  label: string;
  value: string;
}

export interface ExpertProfile {
  slug: string;
  name: string;
  initial: string;
  title: string;
  affiliation: string;
  availability: Availability;
  status: string;
  summary: string;
  intro: string;
  canHelp: string[];
  domains: string[];
  tasks: string[];
  tech: string;
  keywords: string;
  researchCount: number;
  paperCount: number;
  projects: ExpertProject[];
  conditions: ExpertCondition[];
  tone: "brand" | "expert";
}

const SHARED_CONDITIONS: ExpertCondition[] = [
  { label: "참여 가능 시간", value: "주 4~6시간 · 평일 저녁, 주말 오전" },
  { label: "협업 방식", value: "온라인 중심 · 대면은 월 1회, 서울·경기" },
  { label: "참여 기간", value: "최소 2개월 ~ 최대 6개월" },
  { label: "동시 참여", value: "한 번에 1개 연구까지" },
  { label: "데이터 조건", value: "비식별화된 데이터만 · 반출 불가 시 원격 작업" },
  { label: "성과 관련", value: "논문 게재 시 공동저자 표기 희망" },
];

const SHARED_HELP = ["데이터 품질 검토와 분석 기준 정리", "모델 설계, 학습, 성능 평가", "실패 사례 분석과 연구 결과 정리"];

export const EXPERT_SAMPLE_NOTICE =
  "이름, 소속, 연구 건수, 협업 조건은 화면 시안용 예시입니다. 전문가 인증·별점·저장된 요청은 아직 없습니다.";

export const EXPERTS: ExpertProfile[] = [
  {
    slug: "kim-seoyoon",
    name: "김서윤",
    initial: "김",
    title: "의료영상 AI · 박사",
    affiliation: "OO대학교 의료AI 연구소",
    availability: "available",
    status: "바로 참여 가능",
    summary: "의료영상 데이터의 품질 검증부터 분할 모델 평가까지 함께해요.",
    intro: "의료영상 분류·분할 연구를 진행했습니다. 임상 데이터의 품질 검증부터 모델 평가까지 연구팀과 함께 설계할 수 있습니다.",
    canHelp: SHARED_HELP,
    domains: ["의료·바이오", "생명정보학"],
    tasks: ["컴퓨터 비전", "객체 검출·분할"],
    tech: "PyTorch · MONAI · 의료영상 분할",
    keywords: "세포 현미경 CT X-ray 데이터 정리 데이터 분석 분류 라벨링 머신러닝",
    researchCount: 5,
    paperCount: 4,
    tone: "brand",
    projects: [
      {
        period: "2025.09 – 2026.06",
        title: "흉부 X-ray 이상 소견 탐지 공동 연구",
        field: "의료·바이오",
        organization: "OO대학교병원 영상의학과",
        role: "데이터 정제, 탐지 모델 개발",
        outcome: "학회 발표 1건 · 오류 사례 분석 보고서",
      },
      {
        period: "2024.11 – 2025.05",
        title: "병리 슬라이드 암 조직 분류",
        field: "의료·바이오",
        organization: "△△대학교 병리학교실",
        role: "분류 모델 설계, 오류 사례 분석",
        outcome: "SCI 논문 1편 게재",
      },
      {
        period: "2024.03 – 2024.08",
        title: "단백질 구조 이미지 기반 기능 예측",
        field: "생명정보학",
        organization: "□□연구원",
        role: "이미지 특징 추출 파이프라인 구축",
        outcome: "내부 연구 보고서 · 후속 과제 연계",
      },
    ],
    conditions: SHARED_CONDITIONS,
  },
  {
    slug: "lee-junho",
    name: "이준호",
    initial: "이",
    title: "자연어 처리 · 석사",
    affiliation: "언어지능 연구팀",
    availability: "available",
    status: "바로 참여 가능",
    summary: "논문과 연구 문헌에서 필요한 근거를 찾아 정리하는 AI를 만듭니다.",
    intro: "논문과 연구 문헌에서 필요한 근거를 찾아 정리하는 AI를 만듭니다.",
    canHelp: SHARED_HELP,
    domains: ["인문·사회", "교육·인지과학"],
    tasks: ["자연어 처리", "문서 검색"],
    tech: "RAG · 한국어 NLP · LLM 평가",
    keywords: "논문 고문서 텍스트 언어 데이터 정리 데이터 분석 검색 요약",
    researchCount: 3,
    paperCount: 2,
    tone: "expert",
    projects: [],
    conditions: SHARED_CONDITIONS,
  },
  {
    slug: "park-harin",
    name: "박하린",
    initial: "박",
    title: "시계열 · 인과추론 · 박사",
    affiliation: "데이터과학 센터",
    availability: "negotiable",
    status: "참여 중 · 11월부터 협의 가능",
    summary: "관측 데이터의 흐름을 읽고, 연구 질문에 맞는 예측 모델을 설계해요.",
    intro: "관측 데이터의 흐름을 읽고, 연구 질문에 맞는 예측 모델을 설계해요.",
    canHelp: SHARED_HELP,
    domains: ["기후·환경", "인문·사회"],
    tasks: ["시계열·예측", "수치 예측"],
    tech: "Python · Stan · 인과추론",
    keywords: "기후 발전량 수치 예측 대기 데이터 분석 머신러닝",
    researchCount: 5,
    paperCount: 3,
    tone: "expert",
    projects: [],
    conditions: SHARED_CONDITIONS,
  },
  {
    slug: "choi-dohyun",
    name: "최도현",
    initial: "최",
    title: "생명정보학 AI · 박사",
    affiliation: "OO대학교 생명과학과",
    availability: "negotiable",
    status: "참여 중 · 10월 말 종료 예정",
    summary: "유전체와 단백질 데이터를 연결해 질병 위험과 기능을 예측합니다.",
    intro: "유전체와 단백질 데이터를 연결해 질병 위험과 기능을 예측합니다.",
    canHelp: SHARED_HELP,
    domains: ["생명정보학", "의료·바이오"],
    tasks: ["그래프·기하학", "수치 예측"],
    tech: "GNN · PyTorch Geometric · 유전체 분석",
    keywords: "단백질 구조 그래프 유전체 수치 데이터 분석 머신러닝",
    researchCount: 4,
    paperCount: 3,
    tone: "brand",
    projects: [],
    conditions: SHARED_CONDITIONS,
  },
  {
    slug: "oh-taekyung",
    name: "오태경",
    initial: "오",
    title: "로보틱스 · 강화학습 · 박사",
    affiliation: "지능로봇 연구실",
    availability: "available",
    status: "바로 참여 가능",
    summary: "현실 실험 전, 시뮬레이션에서 로봇의 행동과 제어 전략을 검증해요.",
    intro: "현실 실험 전, 시뮬레이션에서 로봇의 행동과 제어 전략을 검증해요.",
    canHelp: SHARED_HELP,
    domains: ["로보틱스", "신소재·화학"],
    tasks: ["탐색·최적화", "강화학습"],
    tech: "강화학습 · ROS · 시뮬레이션",
    keywords: "로봇 제어 시뮬레이션 물리 행동 머신러닝",
    researchCount: 3,
    paperCount: 2,
    tone: "expert",
    projects: [],
    conditions: SHARED_CONDITIONS,
  },
  {
    slug: "han-jimin",
    name: "한지민",
    initial: "한",
    title: "컴퓨터 비전 · 석사",
    affiliation: "원격탐사 연구팀",
    availability: "available",
    status: "바로 참여 가능",
    summary: "위성영상에서 토지 변화와 환경 문제의 징후를 찾아냅니다.",
    intro: "위성영상에서 토지 변화와 환경 문제의 징후를 찾아냅니다.",
    canHelp: SHARED_HELP,
    domains: ["기후·환경", "지구과학"],
    tasks: ["컴퓨터 비전", "객체 검출·분할"],
    tech: "CNN · GIS · OpenCV",
    keywords: "위성 영상 이미지 기후 토지 환경 현미경 머신러닝",
    researchCount: 2,
    paperCount: 1,
    tone: "brand",
    projects: [],
    conditions: SHARED_CONDITIONS,
  },
];

/** 시안에 상세 이력이 없는 전문가는 같은 형식의 예시 두 건을 채웁니다. */
function sampleProjects(expert: ExpertProfile): ExpertProject[] {
  if (expert.projects.length > 0) {
    return expert.projects;
  }

  return [
    {
      period: "2025.09 – 2026.06",
      title: `${expert.domains[0]} 데이터 분석 공동 연구`,
      field: expert.domains[0],
      organization: expert.affiliation,
      role: "데이터 품질 검토, 모델 설계와 평가",
      outcome: "연구 보고서 · 학회 발표",
    },
    {
      period: "2024.11 – 2025.05",
      title: `${expert.tasks[0]} 모델 활용 연구`,
      field: expert.domains[1] ?? expert.domains[0],
      organization: expert.affiliation,
      role: "모델 학습과 실패 사례 분석",
      outcome: "분석 파이프라인 구축",
    },
  ];
}

export interface FieldStat {
  label: string;
  count: number;
}

/**
 * 오른쪽 카드의 원그래프용 분야별 건수입니다.
 * 합계는 프로필의 연구 건수와 같고, 비율은 이 화면에 적은 연구 경험의 분야를 따릅니다.
 */
export function fieldStats(expert: ExpertProfile): FieldStat[] {
  const weights = new Map<string, number>();
  for (const project of expert.projects) {
    weights.set(project.field, (weights.get(project.field) ?? 0) + 1);
  }
  if (weights.size === 0 || expert.researchCount <= 0) {
    return [];
  }

  const weightSum = [...weights.values()].reduce((sum, weight) => sum + weight, 0);
  const stats = [...weights.entries()].map(([label, weight]) => {
    const exact = (weight / weightSum) * expert.researchCount;
    return { label, count: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let used = stats.reduce((sum, stat) => sum + stat.count, 0);
  const byRemainder = [...stats].sort((left, right) => right.remainder - left.remainder);
  let index = 0;
  while (used < expert.researchCount) {
    byRemainder[index % byRemainder.length].count += 1;
    used += 1;
    index += 1;
  }
  return stats.map(({ label, count }) => ({ label, count })).filter((stat) => stat.count > 0);
}

export function listExperts(): ExpertProfile[] {
  return EXPERTS.map((expert) => ({ ...expert, projects: sampleProjects(expert) }));
}

export function getExpert(slug: string): ExpertProfile | undefined {
  return listExperts().find((expert) => expert.slug === slug);
}

export function expertTasks(): string[] {
  return [...new Set(EXPERTS.flatMap((expert) => expert.tasks))];
}

export function expertDomains(): string[] {
  return [...new Set(EXPERTS.flatMap((expert) => expert.domains))];
}

export function relatedExperts(expert: ExpertProfile): ExpertProfile[] {
  const others = listExperts().filter((item) => item.slug !== expert.slug);
  const sameField = others.filter((item) => item.domains.some((domain) => expert.domains.includes(domain)));
  const rest = others.filter((item) => !sameField.includes(item));
  return [...sameField, ...rest].slice(0, 2);
}

export function matchesExpertQuery(expert: ExpertProfile, query: string): boolean {
  const haystack = [expert.name, expert.title, expert.summary, expert.tech, expert.keywords, ...expert.domains, ...expert.tasks]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}
