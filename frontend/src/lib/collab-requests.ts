// 협업 요청(연구자 → AI 전문가) 화면에서 쓰는 타입·문구·계산. 백엔드 응답(snake_case) 모양 그대로예요.
import { apiAsset } from "@/lib/api";
import type { Research } from "@/lib/my-research";

/**
 * 요청 상태
 * - pending: 보냈고 전문가 답을 기다리는 중 (7일 지나면 expired)
 * - accepted: 전문가가 수락함 → 연구자가 [협업 시작하기]로 확정해야 해요
 * - started: 연구자가 확정함 → 협업 공간으로 넘어가요
 * - rejected: 전문가가 거절함
 * - expired: 7일 동안 답이 없었음
 * - canceled: 연구자가 취소함 (연구자 화면에서는 사라져요)
 */
export type RequestStatus = "pending" | "accepted" | "started" | "rejected" | "expired" | "canceled";

export type RejectReason = "schedule" | "field_mismatch" | "data_terms" | "other";

/** 요청에 함께 담기는 값 (양쪽 화면 공통) */
type RequestBase = {
  request_id: number;
  status: RequestStatus;
  start_date: string | null; // 희망 시작일 YYYY-MM-DD (비워서 보낼 수 있어요)
  end_date: string | null; // 희망 종료일 YYYY-MM-DD (비워서 보낼 수 있어요)
  message: string | null; // 연구자가 쓴 메시지 (비워서 보낼 수 있어요)
  created_at: string; // 보낸 때 (ISO)
  expires_at: string; // 답이 없으면 만료되는 때 (보낸 때 + 7일)
  responded_at: string | null; // 전문가가 수락·거절한 때
  reply_message: string | null; // 전문가가 수락하며 남긴 한마디
  reject_reason: RejectReason | null;
  reject_text: string | null; // 거절 사유 직접 입력 (선택)
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

export const LIMITS = { reply: 200, rejectText: 200 } as const;

/** 2026-10-13 → 10.13 */
export function shortDate(date: string): string {
  const [, month, day] = date.slice(0, 10).split("-");
  return `${Number(month)}.${Number(day)}`;
}

/** 2026-10-13 → 2026.10.13 */
export function dotDate(date: string): string {
  return date.slice(0, 10).replaceAll("-", ".");
}



/** 희망 기간 → "2026.10.13 ~ 2026.12.31 · 약 2.5개월". 비어 있으면 "기간 미정" */
export function formatPeriod(start: string | null, end: string | null): string {
  if (!start || !end) {
    if (start) return `${dotDate(start)}부터 · 종료일 미정`;
    if (end) return `${dotDate(end)}까지 · 시작일 미정`;
    return "기간 미정";
  }
  const days = (Date.parse(end) - Date.parse(start)) / 86_400_000;
  const months = Math.round((days / 30) * 2) / 2; // 0.5개월 단위로 반올림
  const length = months >= 1 ? `약 ${months}개월` : `약 ${Math.max(1, Math.round(days / 7))}주`;
  return `${dotDate(start)} ~ ${dotDate(end)} · ${length}`;
}

/** 짧은 희망 기간 → "10.13 ~ 12.31". 비어 있으면 "미정" */
export function shortPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return "미정";
  return `${start ? shortDate(start) : "미정"} ~ ${end ? shortDate(end) : "미정"}`;
}

/** 만료까지 남은 날 (오늘 기준, 0이면 오늘 만료) */
export function daysLeft(expiresAt: string): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 86_400_000));
}

/** 프로필 사진이 없으면 회원 유형별 기본 그림 */
export function photoOrDefault(photo: string | null, role: "researcher" | "expert"): string {
  return photo ? apiAsset(photo) : `/profile-images/default-${role}.png`;
}