// 협업 요청 조회의 응답. 성공률 필드는 없습니다.

import type { Comparison, ReadyCount } from "@/lib/operations-admin";

export type RequestCount = {
  status: string;
  label: string;
  value: number | null;
  state: ReadyCount["status"];
  note: string;
};

export type CollaborationRequest = {
  request_id: number;
  research_id: number;
  title: string;
  owner_nickname: string;
  expert_id: number;
  expert_nickname: string;
  status: string;
  status_label: string;
  created_at: string;
  responded_at: string | null;
  started_at: string | null;
  expires_at: string;
};

export type CollaborationReport = {
  table_ready: boolean;
  note: string;
  counts: RequestCount[];
  created_in_period: ReadyCount;
  missing: { id: string; label: string; status: ReadyCount["status"]; value: null; note: string }[];
  total: number;
  page: number;
  page_size: number;
  items: CollaborationRequest[];
  range?: { preset: string; start: string; end: string };
};

/** 화면 배치를 볼 때만 쓰는 가상 요청. 서버에 저장하지 않습니다. */
export function demoCollaborationReport(): CollaborationReport {
  return {
    table_ready: true,
    note: "디자인 평가용 가상 요청입니다. 시작 수를 요청 수로 나눈 성공률이 아닙니다.",
    counts: [
      { status: "pending", label: "답변 대기", value: 4, state: "ready", note: "가상" },
      { status: "accepted", label: "전문가 수락", value: 2, state: "ready", note: "가상" },
      { status: "started", label: "협업 시작", value: 1, state: "ready", note: "가상. 완료가 아닙니다." },
      { status: "rejected", label: "거절", value: 1, state: "ready", note: "가상" },
      { status: "expired", label: "기한 만료", value: 0, state: "ready", note: "가상" },
      { status: "canceled", label: "취소", value: 1, state: "ready", note: "가상" },
    ],
    created_in_period: {
      status: "ready",
      value: 3,
      note: "가상으로 이 기간에 생긴 요청입니다.",
      comparison: { previous: 1, absolute: 2, rate: 2 } satisfies Comparison,
    },
    missing: [
      { id: "applications", label: "참여 신청", status: "not_linked", value: null, note: "표가 없습니다." },
      { id: "milestones", label: "마일스톤", status: "not_linked", value: null, note: "표가 없습니다." },
      { id: "completion", label: "완료", status: "not_linked", value: null, note: "표가 없습니다." },
      { id: "evaluation", label: "평가", status: "not_linked", value: null, note: "표가 없습니다." },
    ],
    total: 1,
    page: 1,
    page_size: 20,
    items: [
      {
        request_id: 41,
        research_id: 7,
        title: "가상 연구 · 세포 이미지 경계",
        owner_nickname: "가상 연구자",
        expert_id: 12,
        expert_nickname: "가상 전문가",
        status: "started",
        status_label: "협업 시작",
        created_at: "2026-10-20T03:00:00Z",
        responded_at: "2026-10-21T03:00:00Z",
        started_at: "2026-10-22T03:00:00Z",
        expires_at: "2026-10-27T03:00:00Z",
      },
    ],
  };
}
