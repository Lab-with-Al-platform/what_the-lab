// 내 이력(AI 전문가 프로필) 화면에서 쓰는 타입·문구·규칙. 백엔드 응답(snake_case) 모양 그대로예요.
import { API_BASE_URL } from "@/lib/api";

export type MeetingType = "online" | "offline_ok";
export type TimeCode = "lt5" | "5_10" | "gt10";
export type RewardCode = "research_fund" | "authorship" | "undecided";

export type Collaboration = {
  meeting_type: MeetingType;
  face_to_area: string | null;
  available_time: TimeCode;
  rewards: RewardCode[];
};

export type Portfolio = {
  portfolio_id: number;
  title: string;
  able_work_ids: string[];
  skills: string[];
  role: string;
  has_pdf: boolean; // PDF를 올렸는지
  pdf_size: number | null; // 바이트
};

export type Career = {
  career_id: number;
  company: string | null;
  job: string;
  start_month: string; // YYYY-MM
  end_month: string | null; // null = 재직 중
};

export type Education = {
  education_id: number;
  school: string;
  major: string;
  graduated_year: string | null;
};

export type Certificate = {
  certificate_id: number;
  name: string;
  issuer: string | null;
  acquired_year: string | null;
};

export type CareerProfile = {
  nickname: string;
  user_photo: string | null;
  introduce: string | null;
  current_job: string;
  ai_career: string;
  is_public: boolean; // 연구자 찾기 목록에 공개 중인지
  able_work_ids: string[];
  domain_ids: string[];
  collaboration: Collaboration | null;
  portfolios: Portfolio[];
  careers: Career[];
  educations: Education[];
  certificates: Certificate[];
};

export type AbleWorkOption = { able_work_id: string; name: string; show_default: boolean };
export type FieldCategory = {
  field_category_id: string;
  name: string;
  fields: { field_id: string; name: string }[];
};

// 백엔드 제한과 같은 값. 바꿀 때는 backend/app/routers/expert_*.py 도 같이 바꿔 주세요.
export const LIMITS = {
  introduce: 40,
  domains: 5,
  ableWorks: 3,
  title: 60,
  role: 200,
  skills: 10,
  skill: 30,
  short: 50, // 회사·직무·학교·전공·자격증 이름 등
  area: 50,
  pdfMb: 20,
} as const;

export const JOB_LABELS: Record<string, string> = {
  grad_student: "대학원생",
  researcher: "연구원",
  employee: "기업 재직",
  freelancer: "프리랜서",
  professor: "교수",
  etc: "기타",
};

export const CAREER_LABELS: Record<string, string> = {
  lt1: "1년 미만",
  "1_3": "1~3년",
  "3_5": "3~5년",
  "5_10": "5~10년",
  gt10: "10년 이상",
};

export const MEETING_LABELS: Record<MeetingType, string> = {
  online: "온라인만",
  offline_ok: "대면도 가능",
};

export const TIME_LABELS: Record<TimeCode, string> = {
  lt5: "5시간 이하",
  "5_10": "5~10시간",
  gt10: "10시간 이상",
};

export const REWARD_LABELS: Record<RewardCode, string> = {
  research_fund: "연구비",
  authorship: "논문 저자·사사",
  undecided: "상의 후 결정",
};

export type RequiredKey = "ableWorks" | "introduce" | "domains" | "collaboration" | "portfolio";

/** 공개하려면 꼭 채워야 하는 것. 백엔드 missing_required 와 같은 기준이에요. */
export function requiredChecks(profile: CareerProfile) {
  return [
    { key: "ableWorks", label: "할 수 있는 일", done: profile.able_work_ids.length > 0 },
    { key: "introduce", label: "한 줄 소개", done: Boolean(profile.introduce) },
    { key: "domains", label: "도메인 키워드", done: profile.domain_ids.length > 0 },
    { key: "collaboration", label: "협업 조건", done: profile.collaboration !== null },
    { key: "portfolio", label: "포트폴리오 1개", done: profile.portfolios.length > 0 },
  ] as const satisfies readonly { key: RequiredKey; label: string; done: boolean }[];
}

/** 선택 항목. 채우면 연구자가 더 믿고 요청해요. */
export function optionalChecks(profile: CareerProfile) {
  return [
    { label: "경력", done: profile.careers.length > 0 },
    { label: "학력", done: profile.educations.length > 0 },
    { label: "자격증", done: profile.certificates.length > 0 },
  ];
}

/** 2022-03 → 2022.03 */
export function formatMonth(month: string): string {
  return month.replace("-", ".");
}

/** 2516582 → 2.4MB */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/** 포트폴리오 PDF 보기 주소. 로그인 쿠키가 있어야 열려요(본인만). */
export function portfolioPdfUrl(portfolioId: number): string {
  return `${API_BASE_URL}/expert/portfolios/${portfolioId}/pdf`;
}