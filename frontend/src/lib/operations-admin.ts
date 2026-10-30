// 운영 조회 API의 응답 모양. 값이 없으면 0으로 채우지 않고 status로 구분합니다.

export type Comparison = { previous: number; absolute: number; rate: number | null };
export type Point = { date: string; count: number };
export type ReadyCount = {
  status: "ready" | "paused" | "not_collected" | "not_linked" | "not_available" | "unavailable" | "hidden";
  value: number | null;
  note?: string;
  active?: number;
  suspended?: number;
  comparison?: Comparison;
  series?: Point[];
};

export type Summary = {
  generated_at: string;
  today: string;
  range: {
    preset: string;
    start: string;
    end: string;
    includes_today: boolean;
    today_in_progress: boolean;
    timezone: string;
  };
  members: {
    completed: ReadyCount;
    in_progress: ReadyCount;
    suspended: ReadyCount;
    roles: { status: string; counts: { researcher: number; expert: number; unset: number }; note: string };
    steps: { status: string; counts: Record<string, number>; labels: Record<string, string>; note: string };
    accounts_created: ReadyCount;
    signup_completed_in_period: ReadyCount;
  };
  researches: ResearchSummary;
  unavailable: { id: string; status: string; label: string; note: string }[];
};

export type ResearchSummary = {
  registered: ReadyCount;
  records: ReadyCount;
  created: ReadyCount;
  first_registered_in_period: ReadyCount;
  fields: { status: string; items: { id: string; name: string; count: number }[]; note: string };
  abandonment: { status: string; note: string };
};

export type MemberItem = {
  user_id: number;
  nickname: string;
  role: string | null;
  role_label: string;
  affiliation: string | null;
  signup_step: string;
  signup_step_label: string;
  status: string;
  status_label: string;
  created_at: string;
};

export type MemberDetail = MemberItem & {
  is_admin: boolean;
  researches: { research_id: number; title: string; status: string; status_label: string; created_at: string }[];
  actions: { status: string; next_status?: string | null; note: string };
  admin_actions?: { status: string; next_is_admin?: boolean | null; note: string };
  audit: {
    status: string;
    note: string;
    items?: { actor_user_id: number; action: string; before_status: string; after_status: string; reason: string; notice: string; created_at: string }[];
  };
};

export function auditActionLabel(action: string): string {
  if (action === "suspend") return "정지";
  if (action === "restore") return "해제";
  if (action === "grant_admin") return "관리자 부여";
  if (action === "revoke_admin") return "관리자 해제";
  return action;
}

export type ResearchItem = {
  research_id: number;
  title: string;
  user_id: number;
  owner_nickname: string;
  status: string;
  status_label: string;
  status_note: string;
  progress?: ResearchProgress;
  fields: { id: string; name: string }[];
  created_at: string;
  updated_at: string;
};

// 관리자 목록의 요약 표시입니다. 모집 상태와 확정 프로젝트 상태를 DB에서 합치지는 않습니다.
export const RESEARCH_PROGRESS_STATES = [
  { code: "recruiting", label: "모집 중", tone: "brand" },
  { code: "unmatched_closed", label: "모집 종료·미매칭", tone: "warning" },
  { code: "recruitment_canceled", label: "모집 취소", tone: "neutral" },
  { code: "scheduled", label: "진행 예정", tone: "brand" },
  { code: "in_progress", label: "진행 중", tone: "success" },
  { code: "paused", label: "일시 중지", tone: "warning" },
  { code: "completion_pending", label: "종료 확인 중", tone: "brand" },
  { code: "completed", label: "완료", tone: "neutral" },
  { code: "discontinued", label: "중단", tone: "warning" },
  { code: "not_applicable", label: "해당 없음", tone: "neutral" },
  { code: "not_linked", label: "연동 전", tone: "neutral" },
] as const;

export type ResearchProgressCode = (typeof RESEARCH_PROGRESS_STATES)[number]["code"];
export type ResearchProgress = { code: ResearchProgressCode; note: string };

/** 구형 API에 진행 정보가 없어도 등록 여부만으로 모집·진행 중이라고 추측하지 않습니다. */
export function researchProgress(item: Pick<ResearchItem, "status" | "progress">) {
  const fallback: ResearchProgress = item.status === "draft"
    ? { code: "not_applicable", note: "임시저장 연구는 모집·진행 상태의 대상이 아닙니다." }
    : { code: "not_linked", note: "모집·완료 상태가 없습니다. 협업 요청의 현재 상태는 협업 요청 탭에서 따로 봅니다." };
  const progress = item.status === "draft" ? fallback : item.progress ?? fallback;
  const state = RESEARCH_PROGRESS_STATES.find(value => value.code === progress.code);
  if (!state) return { code: fallback.code, label: "연동 전", tone: "neutral", note: fallback.note };
  return { ...state, note: progress.note };
}

export type ResearchDetail = ResearchItem & {
  is_primary: boolean;
  task_unsure: boolean;
  able_works: { id: string; name: string }[];
  data_types: { code: string; label: string }[];
  data_status: { code: string | null; label: string | null };
  share_policy: { code: string | null; label: string | null; note: string };
  body_access: { status: string; note: string };
};

export type PageResult<T> = { total: number; page: number; page_size: number; items: T[] };

export const PRESETS = [
  { id: "today", label: "오늘" },
  { id: "7d", label: "최근 7일" },
  { id: "30d", label: "최근 30일" },
  { id: "month", label: "이번 달" },
] as const;

export function statusText(status: string): string {
  if (status === "not_collected") return "수집 전";
  if (status === "paused") return "수집 멈춤";
  if (status === "unavailable") return "표 없음";
  if (status === "not_linked") return "연동 전";
  if (status === "not_available") return "이번 단계 없음";
  if (status === "hidden") return "비공개";
  return "집계됨";
}

/** 이전 기간이 0건이면 퍼센트를 만들지 않습니다. */
export function comparisonText(comparison: Comparison | undefined): string {
  if (!comparison) return "";
  const sign = comparison.absolute > 0 ? "+" : "";
  const absolute = `이전 ${comparison.previous}건 · ${sign}${comparison.absolute}건`;
  if (comparison.rate === null) return `${absolute} · 비율 없음`;
  return `${absolute} · ${Math.round(comparison.rate * 100)}%`;
}

export function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
