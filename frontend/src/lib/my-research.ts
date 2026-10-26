// 내 연구(연구회원) 화면에서 쓰는 타입·문구·규칙. 백엔드 응답(snake_case) 모양 그대로예요.

export type DataType = "image" | "text" | "table" | "audio" | "etc";
export type DataStatus = "none" | "collecting" | "raw" | "ready";
export type SharePolicy = "open" | "conditional";
export type OutputType = "analysis" | "model" | "tool" | "figure" | "unknown";
export type RewardCode = "research_fund" | "authorship" | "undecided";
export type MeetingType = "online" | "offline_ok";
export type ResearchStatus = "draft" | "registered"; // 임시 저장 / 등록 완료

export type Research = {
  research_id: number;
  status: ResearchStatus;
  is_primary: boolean; // 지정한 연구 (전문가 찾기·협업 요청에 기본으로 쓰임). 한 사람당 1개
  // 1단계 연구
  title: string;
  field_ids: string[]; // 연구 분야 FIELD ID (분류표), 1~3개
  description: string;
  // 2단계 데이터
  data_types: DataType[];
  data_status: DataStatus | null;
  share_policy: SharePolicy | null;
  share_condition: string | null; // share_policy가 conditional일 때 조건 설명
  // 3단계 협업
  able_work_ids: string[]; // AI에게 맡기고 싶은 일 UG ID, 0~3개
  task_unsure: boolean; // "잘 모르겠어요"를 골랐는지 (able_work_ids와 함께 쓸 수 없음)
  outputs: OutputType[];
  rewards: RewardCode[]; // 선택
  meeting_type: MeetingType | null; // 선택
  face_to_area: string | null;
  created_at: string; // ISO 날짜
  updated_at: string;
};

/** 저장할 때 보내는 값 (번호·지정·날짜는 서버가 정해요) */
export type ResearchInput = Omit<Research, "research_id" | "is_primary" | "created_at" | "updated_at"> & {
  writing_attempt_id?: string; // 등록 창의 작성 시도. 연구 표에는 저장하지 않아요.
};

export const LIMITS = {
  title: 60,
  description: 500,
  fields: 3,
  ableWorks: 3,
  shareCondition: 100,
  area: 50,
} as const;

export const DATA_TYPE_LABELS: Record<DataType, string> = {
  image: "사진·영상",
  text: "글·문서",
  table: "숫자·표",
  audio: "음성",
  etc: "기타",
};

export const DATA_STATUS_LABELS: Record<DataStatus, string> = {
  none: "아직 없음",
  collecting: "모으는 중",
  raw: "있지만 정리 안 됨",
  ready: "정리됨",
};

export const SHARE_LABELS: Record<SharePolicy, { title: string; detail: string }> = {
  open: { title: "외부 공유 가능", detail: "전문가에게 데이터를 그대로 보낼 수 있어요" },
  conditional: { title: "조건이 있어요", detail: "개인정보, 기관 승인, 보안 서약 등이 필요해요" },
};

export const OUTPUT_LABELS: Record<OutputType, string> = {
  analysis: "분석 결과",
  model: "학습된 모델",
  tool: "자동화 도구",
  figure: "논문용 그림·표",
  unknown: "아직 모름",
};

export const REWARD_LABELS: Record<RewardCode, string> = {
  research_fund: "연구비",
  authorship: "논문 저자·사사",
  undecided: "상의 후 결정",
};

export const MEETING_LABELS: Record<MeetingType, string> = {
  online: "온라인만",
  offline_ok: "대면도 가능",
};

/** 등록(임시 저장 아님)에 필요한 단계별 조건. 막힌 이유를 코드로 돌려주고, 없으면 통과예요. */
export function stepBlocker(step: number, input: ResearchInput): string | null {
  if (step === 1) {
    if (input.title.trim() === "") return "title_required";
    if (input.field_ids.length === 0) return "field_required";
    if (input.description.trim() === "") return "description_required";
    return null;
  }
  if (step === 2) {
    if (input.data_types.length === 0) return "data_type_required";
    if (input.data_status === null) return "data_status_required";
    if (input.share_policy === null) return "share_required";
    if (input.share_policy === "conditional" && (input.share_condition ?? "").trim() === "") {
      return "share_condition_required";
    }
    return null;
  }
  if (step === 3) {
    if (!(input.able_work_ids.length > 0 || input.task_unsure)) return "work_required";
    if (input.outputs.length === 0) return "output_required";
    if (input.meeting_type === "offline_ok" && (input.face_to_area ?? "").trim() === "") {
      return "area_required";
    }
    return null;
  }
  return null;
}

/** 그 단계에서 [다음]으로 넘어갈 수 있는지. */
export function stepReady(step: number, input: ResearchInput): boolean {
  return stepBlocker(step, input) === null;
}

/** 빈 입력값 (새 연구 작성) */
export function emptyInput(): ResearchInput {
  return {
    status: "draft",
    title: "",
    field_ids: [],
    description: "",
    data_types: [],
    data_status: null,
    share_policy: null,
    share_condition: null,
    able_work_ids: [],
    task_unsure: false,
    outputs: [],
    rewards: [],
    meeting_type: null,
    face_to_area: null,
  };
}

/** 저장된 연구 → 수정 창의 입력값 */
export function toInput(research: Research): ResearchInput {
  return {
    status: research.status,
    title: research.title,
    field_ids: research.field_ids,
    description: research.description,
    data_types: research.data_types,
    data_status: research.data_status,
    share_policy: research.share_policy,
    share_condition: research.share_condition,
    able_work_ids: research.able_work_ids,
    task_unsure: research.task_unsure,
    outputs: research.outputs,
    rewards: research.rewards,
    meeting_type: research.meeting_type,
    face_to_area: research.face_to_area,
  };
}

/** 2026-10-08T... → 10월 8일 */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}