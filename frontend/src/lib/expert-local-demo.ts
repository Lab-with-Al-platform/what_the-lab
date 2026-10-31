import type { ExpertCollaboration, ExpertPublicProfile } from "@/lib/expert-search";
import type { Career, Certificate, Education, Portfolio } from "@/lib/my-career";

/**
 * Visual QA fixtures ONLY. Never loaded from API, never written to a database.
 * Only four specifically seeded demo identities on localhost in Next development mode
 * may receive this overlay. Production builds are always excluded.
 */
export type DemoReview = {
  average: number;
  scores: readonly { label: string; value: number }[];
  entries: readonly { id: string; date: string; project: string; author: string; score: number; text: string }[];
};

type DemoDetails = {
  affiliation: string;
  condition: NonNullable<ExpertPublicProfile["collaboration"]>;
  engagedUntil: string | null;
  skills: string[];
  portfolioTitles: [string, string];
  portfolioRoles: [string, string];
  career: [string, string, string, string | null];
  previousCareer: [string, string, string, string];
  school: string;
  major: string;
  certificateNames: [string, string];
  collabCategories: [string[], string[], string[]];
  collabWorks: [string[], string[], string[]];
  reviews: [string, string, string];
  rating: number;
  scores: [number, number, number, number];
};

const EXAMPLES: Record<string, DemoDetails> = {
  "[데모] LLM 전문가": {
    affiliation: "시연용 AI 연구실",
    condition: { meeting_type: "offline_ok", face_to_area: "서울·경기", available_time: "5_10", rewards: ["research_fund", "authorship"] },
    engagedUntil: null,
    skills: ["Python", "LangChain", "RAG", "LLM 평가", "FastAPI"],
    portfolioTitles: ["시연용 논문 검색 AI 어시스턴트", "시연용 지식베이스 RAG 챗봇"],
    portfolioRoles: ["문서 청킹·임베딩·검색 정확도 검증", "LLM 검색 파이프라인 설계 및 평가"],
    career: ["시연 AI 연구원", "생성형 AI · LLM 연구", "2024-02", null],
    previousCareer: ["시연 데이터 연구소", "NLP 엔지니어", "2021-03", "2024-01"],
    school: "시연대학교 대학원",
    major: "인공지능학과",
    certificateNames: ["시연용 클라우드 AI 수료", "시연용 데이터 분석 교육 수료"],
    collabCategories: [["F03", "F10"], ["F03"], ["F03", "F08"]],
    collabWorks: [["UG08", "UG05"], ["UG08"], ["UG05", "UG01"]],
    reviews: [
      "논문 데이터 구조를 빠르게 파악하고 재현 가능한 검색 파이프라인을 제안해 주셨습니다.",
      "실험 결과와 한계점을 명확하게 설명해 공동 연구 방향을 잡기 수월했습니다.",
      "업무 단계를 구체적으로 정리해 연구팀이 후속 작업을 진행하기 편리했습니다.",
    ],
    rating: 4.8,
    scores: [4.9, 4.7, 4.8, 4.8],
  },
  "[데모] 의료 AI 전문가": {
    affiliation: "시연용 의료 AI 랩",
    condition: { meeting_type: "online", face_to_area: null, available_time: "5_10", rewards: ["undecided"] },
    engagedUntil: "2026-11-28",
    skills: ["PyTorch", "MONAI", "DICOM", "영상 분할", "의료 멀티모달"],
    portfolioTitles: ["시연용 의료영상 병변 탐지", "시연용 임상 데이터 멀티모달 분석"],
    portfolioRoles: ["데이터 전처리·모델 성능 비교", "영상·정형 데이터 융합 모델 검토"],
    career: ["시연 메디컬 AI 센터", "의료영상 분석 연구원", "2023-04", null],
    previousCareer: ["시연 바이오 데이터랩", "컴퓨터 비전 연구원", "2020-03", "2023-03"],
    school: "시연과학대학교",
    major: "의료정보학",
    certificateNames: ["시연용 의료 AI 실무 과정", "시연용 연구 데이터 윤리 교육"],
    collabCategories: [["F02"], ["F02", "F03"], ["F02"]],
    collabWorks: [["UG04"], ["UG04", "UG06"], ["UG06", "UG01"]],
    reviews: [
      "의료영상 데이터의 품질 이슈를 세심하게 확인하고 분석 기준을 잡아 주셨습니다.",
      "연구자가 이해하기 쉽게 모델의 민감도와 한계를 설명해 주셨습니다.",
      "데이터 보안과 분석 재현성을 함께 고려한 점이 인상적이었습니다.",
    ],
    rating: 4.9,
    scores: [5.0, 4.8, 4.9, 4.9],
  },
  "[데모] 비전 전문가": {
    affiliation: "시연용 비전 연구팀",
    condition: { meeting_type: "offline_ok", face_to_area: "서울·인천", available_time: "gt10", rewards: ["authorship"] },
    engagedUntil: null,
    skills: ["OpenCV", "YOLO", "PyTorch", "Segmentation", "MLOps"],
    portfolioTitles: ["시연용 객체 탐지 모델 최적화", "시연용 시각 품질 검사 자동화"],
    portfolioRoles: ["객체 탐지 추론 최적화", "이미지 분할 및 성능 테스트"],
    career: ["시연 비전 연구팀", "컴퓨터 비전 개발자", "2023-01", null],
    previousCareer: ["시연 영상기술 연구실", "AI 모델 연구보조", "2021-02", "2022-12"],
    school: "시연공과대학교",
    major: "컴퓨터공학",
    certificateNames: ["시연용 AI 모델 운영 교육", "시연용 이미지 분석 실무 과정"],
    collabCategories: [["F03", "F05"], ["F03"], ["F05"]],
    collabWorks: [["UG04", "UG11"], ["UG04"], ["UG11"]],
    reviews: [
      "학습 데이터의 편향을 먼저 짚고 평가 지표를 개선할 수 있었습니다.",
      "적은 데이터에서도 가능한 실험 대안을 제시해 진행이 빨랐습니다.",
      "모델 성능뿐 아니라 실제 사용 시 응답 속도도 검토해 주셨습니다.",
    ],
    rating: 4.7,
    scores: [4.8, 4.7, 4.6, 4.7],
  },
  "[데모] 데이터 전문가": {
    affiliation: "시연용 데이터 스튜디오",
    condition: { meeting_type: "online", face_to_area: null, available_time: "lt5", rewards: ["research_fund"] },
    engagedUntil: null,
    skills: ["Pandas", "Scikit-learn", "SQL", "데이터 품질", "예측 분석"],
    portfolioTitles: ["시연용 이상 거래 탐지 모델", "시연용 시계열 수요 예측"],
    portfolioRoles: ["피처 엔지니어링과 데이터 품질 점검", "모형 검증·지표 설계·시각화"],
    career: ["시연 데이터 스튜디오", "데이터 사이언티스트", "2022-08", null],
    previousCareer: ["시연 리스크 분석팀", "데이터 분석가", "2019-01", "2022-07"],
    school: "시연대학교",
    major: "통계·데이터과학",
    certificateNames: ["시연용 통계 분석 과정", "시연용 머신러닝 실무 수료"],
    collabCategories: [["F08", "F03"], ["F08"], ["F03", "F07"]],
    collabWorks: [["UG01", "UG03"], ["UG03"], ["UG01", "UG02"]],
    reviews: [
      "데이터 정합성 문제를 빠르게 찾아 검증 가능한 분석 환경을 만들었습니다.",
      "모델의 해석 가능성과 결과 전달 방식을 충분히 고려했습니다.",
      "연구 목표에 맞는 성능 지표를 함께 정리해 주셨습니다.",
    ],
    rating: 4.6,
    scores: [4.7, 4.7, 4.5, 4.5],
  },
};

const DEMO_PERIODS = [
  { start_date: "2026-06-03", end_date: "2026-07-12" },
  { start_date: "2026-03-05", end_date: "2026-05-18" },
  { start_date: "2026-01-06", end_date: "2026-02-24" },
] as const;

const CRITERIA = ["전문성", "소통", "일정 준수", "결과물 품질"] as const;

export function getLocalExpertDemo(profile: ExpertPublicProfile): { profile: ExpertPublicProfile; reviews: DemoReview } | null {
  // Do not enable this fixture on Vercel or any shared environment, even with a crafted URL.
  if (process.env.NODE_ENV !== "development") return null;
  if (typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return null;
  const sample = EXAMPLES[profile.nickname];
  if (!sample || profile.affiliation !== sample.affiliation) return null;

  const portfolios: Portfolio[] = [
    ...profile.portfolios, // Keep the real local-DB demo portfolio so the UI also exercises real API fields.
    ...sample.portfolioTitles.map((title, i) => ({
      portfolio_id: -((i + 1) * 10 + Number(profile.user_id)),
      title,
      role: sample.portfolioRoles[i],
      able_work_ids: sample.collabWorks[i],
      skills: sample.skills.slice(0, 4),
      has_pdf: false,
      pdf_size: null,
    })),
  ];

  const careers: Career[] = [
    { career_id: -1, company: sample.career[0], job: sample.career[1], start_month: sample.career[2], end_month: sample.career[3] },
    { career_id: -2, company: sample.previousCareer[0], job: sample.previousCareer[1], start_month: sample.previousCareer[2], end_month: sample.previousCareer[3] },
  ];
  const educations: Education[] = [
    { education_id: -1, school: sample.school, major: sample.major, graduated_year: "2021" },
  ];
  const certificates: Certificate[] = sample.certificateNames.map((name, i) => ({
    certificate_id: -1 - i,
    name,
    issuer: "시연용 교육기관",
    acquired_year: i === 0 ? "2025" : "2023",
  }));
  const collaborations: ExpertCollaboration[] = DEMO_PERIODS.map((period, i) => ({
    ...period,
    ongoing: false,
    title: "시연용 완료 협업 연구",
    partner_nickname: null,
    private: true,
    category_ids: sample.collabCategories[i],
    able_work_ids: sample.collabWorks[i],
  }));

  const reviews: DemoReview = {
    average: sample.rating,
    scores: CRITERIA.map((label, i) => ({ label, value: sample.scores[i] })),
    entries: sample.reviews.map((text, i) => ({
      id: `demo-${i + 1}`,
      date: DEMO_PERIODS[i].end_date,
      project: ["데모 연구 협업 · 데이터 분석 및 설계", "데모 연구 협업 · 프로토타입 개발", "데모 연구 협업 · 모델 평가"][i],
      author: `시연 연구회원 ${String.fromCharCode(65 + i)}`,
      score: [sample.rating + 0.1, sample.rating, sample.rating - 0.1][i],
      text,
    })),
  };
  return {
    profile: { ...profile, portfolios, careers, educations, certificates, collaborations, collaboration: sample.condition, engaged: Boolean(sample.engagedUntil), engaged_until: sample.engagedUntil },
    reviews,
  };
}
