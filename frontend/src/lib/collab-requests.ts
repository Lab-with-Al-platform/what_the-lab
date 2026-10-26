// 협업 요청(연구자 → AI 전문가) 화면에서 쓰는 타입·문구·계산. 백엔드 응답(snake_case) 모양 그대로예요.
// 날짜 규칙 숫자는 백엔드 app/request_rules.py 와 같아요. (둘을 함께 고쳐요)
import { apiAsset } from "@/lib/api";
import type { Research } from "@/lib/my-research";

/**
 * 요청 상태
 * - pending: 보냈고 전문가 답을 기다리는 중 (답 기한이 지나면 expired)
 * - accepted: 전문가가 수락함 → 연구자가 선택 기한 안에 [협업 시작]을 눌러야 해요 (지나면 expired)
 * - started: 협업 시작 → 협업 공간으로 넘어가요 (급한 요청은 수락하는 순간 started)
 * - rejected: 전문가가 거절함
 * - expired: 기한 안에 답(또는 선택)이 없었음
 * - canceled: 닫힘. 이유는 cancel_reason
 */
export type RequestStatus = "pending" | "accepted" | "started" | "rejected" | "expired" | "canceled";

export type RejectReason = "schedule" | "field_mismatch" | "data_terms" | "other";

/**
 * canceled 이유
 * - withdrawn: 연구자가 답 전에 취소 (같은 전문가에게 한 번 더 보낼 수 있어요)
 * - declined: 수락된 요청을 연구자가 거절
 * - expert_withdrew: 전문가가 수락을 취소
 * - other_started: 같은 연구의 협업이 3개가 차서 자동으로 닫힘
 */
export type CancelReason = "withdrawn" | "declined" | "expert_withdrew" | "other_started";

/** 요청에 함께 담기는 값 (양쪽 화면 공통) */
type RequestBase = {
  request_id: number;
  status: RequestStatus;
  is_urgent: boolean; // 급해요 (내일부터 시작, 수락하면 바로 협업 시작)
  start_date: string; // 희망 시작일 YYYY-MM-DD
  end_date: string; // 희망 종료일 YYYY-MM-DD
  accepted_start_date: string | null; // 전문가가 조정한 시작일 (그대로 수락이면 null)
  accepted_end_date: string | null; // 전문가가 조정한 종료일
  message: string | null; // 연구자가 쓴 메시지
  created_at: string; // 보낸 때 (ISO)
  expires_at: string; // 전문가 답 기한 (ISO)
  select_expires_at: string | null; // 수락된 뒤 연구자가 [협업 시작]을 눌러야 하는 기한 (ISO)
  responded_at: string | null; // 전문가가 수락·거절한 때
  started_at: string | null;
  reply_message: string | null; // 전문가가 수락하며 남긴 한마디
  reject_reason: RejectReason | null;
  reject_text: string | null; // 거절 사유 직접 입력 (선택)
  cancel_reason: CancelReason | null;
  cancel_text: string | null; // 전문가가 수락을 취소한 이유
};

/** 연구자 화면(보낸 요청) 한 줄 */
export type SentRequest = RequestBase & {
  research_id: number;
  expert: { user_id: number; nickname: string; user_photo: string | null };
};

/** 전문가가 보는 연구 내용 (내 연구에 적은 그대로) */
export type RequestResearch = Pick<
  Research,
  | "title"
  | "description"
  | "field_ids"
  | "able_work_ids"
  | "task_unsure"
  | "outputs"
  | "rewards"
  | "meeting_type"
  | "face_to_area"
  | "data_types"
  | "data_status"
  | "share_policy"
  | "share_condition"
>;

/** 전문가 화면(받은 요청) 한 줄 */
export type ReceivedRequest = RequestBase & {
  overlap_count: number; // 이 요청 기간과 겹치는, 내가 진행 중인 협업 수 (수락할 때 안내)
  researcher: {
    nickname: string;
    user_photo: string | null;
    institution_name: string | null;
    department: string | null;
    is_verified: boolean; // 기관 이메일 인증
  };
  research: RequestResearch;
};

export const REJECT_REASON_LABELS: Record<RejectReason, string> = {
  schedule: "일정이 맞지 않아요",
  field_mismatch: "맡길 일이 제 분야와 달라요",
  data_terms: "데이터 공유 조건을 지키기 어려워요",
  other: "기타",
};

export const LIMITS = { reply: 200, rejectText: 200, withdrawText: 200 } as const;

// 날짜 규칙 (백엔드 request_rules.py 와 같은 값)
export const RULES = {
  normalLeadDays: 3, // 일반 요청: 오늘부터 3일 뒤부터 시작일
  urgentLeadDays: 1, // 급해요: 내일부터
  adjustDays: 7, // 전문가가 시작일을 앞뒤로 옮길 수 있는 최대 날 수
  adjustGapDays: 2, // 앞당길 때 가장 이른 시작일 = 오늘 + 2일
  maxTries: 2, // 같은 연구로 같은 전문가에게 보낼 수 있는 횟수
  maxOpen: 3, // 한 연구로 답 기다리는·수락된 요청 수
  maxActive: 3, // 한 연구로 동시에 진행하는 협업 수
} as const;

/** 2026-10-13 → 10.13 */
export function shortDate(date: string): string {
  const [, month, day] = date.slice(0, 10).split("-");
  return `${Number(month)}.${Number(day)}`;
}

/** 2026-10-13 → 2026.10.13 */
export function dotDate(date: string): string {
  return date.slice(0, 10).replaceAll("-", ".");
}

/** 희망 기간 → "2026.10.13 ~ 2026.12.31 · 약 2.5개월" */
export function formatPeriod(start: string | null, end: string | null): string {
  if (!start || !end) {
    if (start) return `${dotDate(start)}부터 · 종료일 미정`;
    if (end) return `${dotDate(end)}까지 · 시작일 미정`;
    return "기간 미정";
  }
  return `${dotDate(start)} ~ ${dotDate(end)} · ${periodLength(start, end)}`;
}

/** 기간 길이 → "약 2.5개월" / "약 3주" */
export function periodLength(start: string, end: string): string {
  const days = (Date.parse(end) - Date.parse(start)) / 86_400_000;
  const months = Math.round((days / 30) * 2) / 2; // 0.5개월 단위로 반올림
  return months >= 1 ? `약 ${months}개월` : `약 ${Math.max(1, Math.round(days / 7))}주`;
}

/** 짧은 희망 기간 → "10.13 ~ 12.31" */
export function shortPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return "미정";
  return `${start ? shortDate(start) : "미정"} ~ ${end ? shortDate(end) : "미정"}`;
}

/** 실제로 진행할 기간: 전문가가 조정했으면 조정한 기간, 아니면 요청한 기간 */
export function effectivePeriod(request: RequestBase): { start: string; end: string; adjusted: boolean } {
  if (request.accepted_start_date && request.accepted_end_date) {
    return { start: request.accepted_start_date, end: request.accepted_end_date, adjusted: true };
  }
  return { start: request.start_date, end: request.end_date, adjusted: false };
}

/**
 * 기한(ISO) → "10.25 밤" / "10.25 14:30". 백엔드는 'n일 밤까지'를 다음 날 0시로 저장해요.
 */
export function deadlineText(iso: string): string {
  const when = new Date(iso);
  if (when.getHours() === 0 && when.getMinutes() === 0) {
    when.setDate(when.getDate() - 1);
    return `${when.getMonth() + 1}.${when.getDate()} 밤`;
  }
  return `${when.getMonth() + 1}.${when.getDate()} ${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
}

/** 기한까지 남은 시간 → "3일 남음" / "오늘 마감" / "5시간 남음" */
export function timeLeft(iso: string): string {
  const hours = (Date.parse(iso) - Date.now()) / 3_600_000;
  if (hours <= 0) return "마감";
  if (hours < 24) return `${Math.max(1, Math.floor(hours))}시간 남음`;
  return `${Math.floor(hours / 24)}일 남음`;
}

/** 만료까지 남은 날 (오늘 기준, 0이면 오늘 만료) */
export function daysLeft(expiresAt: string): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 86_400_000));
}

/** YYYY-MM-DD + n일 → YYYY-MM-DD */
export function addDays(date: string, days: number): string {
  const next = new Date(`${date.slice(0, 10)}T00:00:00`);
  next.setDate(next.getDate() + days);
  return localDate(next);
}

/** 두 날짜 사이 날 수 (끝 - 시작) */
export function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);
}

/** 오늘 날짜 YYYY-MM-DD (내 컴퓨터 시간 기준) */
export function todayDate(): string {
  return localDate(new Date());
}

function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** 요청 보낼 때 고를 수 있는 가장 빠른 시작일 */
export function earliestStart(urgent: boolean): string {
  return addDays(todayDate(), urgent ? RULES.urgentLeadDays : RULES.normalLeadDays);
}

/** 전문가가 조정할 수 있는 시작일 범위: 원래 시작일 ±7일, 가장 이른 날은 오늘 + 2일 */
export function adjustRange(originalStart: string): { low: string; high: string } {
  const back = addDays(originalStart, -RULES.adjustDays);
  const gap = addDays(todayDate(), RULES.adjustGapDays);
  return { low: back > gap ? back : gap, high: addDays(originalStart, RULES.adjustDays) };
}

/**
 * 같은 연구로 같은 전문가에게 또 보낼 수 있는지. 보낼 수 없으면 이유, 보낼 수 있으면 null.
 * previous: 그 연구·그 전문가로 예전에 보낸 요청들 (최근 순)
 */
export function secondTryBlock(previous: SentRequest[]): string | null {
  if (previous.length === 0) return null;
  if (previous.length >= RULES.maxTries) return "이 전문가에게는 이 연구로 두 번까지만 요청할 수 있어요";
  const last = previous[0];
  if (last.status === "pending") return "이 전문가에게 이미 보낸 요청이 있어요";
  if (last.status === "accepted") return "이 전문가가 이미 수락한 요청이 있어요";
  if (last.status === "started") return "이 전문가와 이미 협업 중이에요";
  if (last.status === "rejected") return "거절한 전문가에게는 같은 연구로 다시 보낼 수 없어요";
  const noAnswer = last.status === "expired" && !last.responded_at;
  const withdrawn = last.status === "canceled" && last.cancel_reason === "withdrawn";
  return noAnswer || withdrawn ? null : "수락 후 끝난 요청이라 같은 연구로 다시 보낼 수 없어요";
}

/** 연구자가 스스로 닫은 요청(취소·거절)은 요청관리 목록에서 숨겨요. (한 번 더 보내기 계산에만 써요) */
export function closedByMe(request: SentRequest): boolean {
  return request.status === "canceled" && (request.cancel_reason === "withdrawn" || request.cancel_reason === "declined");
}

/** 프로필 사진이 없으면 회원 유형별 기본 그림 */
export function photoOrDefault(photo: string | null, role: "researcher" | "expert"): string {
  return photo ? apiAsset(photo) : `/profile-images/default-${role}.png`;
}