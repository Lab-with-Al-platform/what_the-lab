// 방문 통계 API 응답. 값이 null이면 0으로 바꾸지 않습니다.

import type { ReadyCount } from "@/lib/operations-admin";

export type AnalyticsMetric = { status: ReadyCount["status"]; value: number | null; note?: string };
export type AnalyticsPoint = { date: string; page_views: number; sessions: number; until: string };

export type AnalyticsReport = {
  generated_at: string;
  timezone: string;
  collection: { status: string; enabled: boolean; started_at: string | null; note: string };
  range?: { preset: string; grain: string; start: string; end: string; includes_today?: boolean };
  visits: {
    visitors: AnalyticsMetric;
    sessions: AnalyticsMetric;
    page_views: AnalyticsMetric;
    series: AnalyticsPoint[];
    pages: { target: string; label: string; page_views: number; sessions: number }[];
    referrer: AnalyticsMetric;
    device: AnalyticsMetric;
  };
  articles: {
    target: string;
    kind: string;
    slug: string;
    page_views: number;
    read_sessions: number;
    expert_clicks: number;
    related_opens: number;
    note: string;
  }[];
  registration: {
    status: string;
    note: string;
    create: Funnel | null;
    resume: { saved: number; completed: number; watching: number; incomplete: number; completion_rate: number | null; window: string; note: string } | null;
    edit: { opened: number; note: string } | null;
    completed_without_attempt?: number;
    reasons: { code: string; label: string; count: number; kind: string }[];
    signals: { code: string; label: string; count: number; kind: string }[];
  };
};

type Funnel = {
  opened: number;
  reached: { step: string; label: string; count: number }[];
  completed: number;
  watching: number;
  incomplete: number;
  completion_rate: number | null;
  window: string;
};

/** 화면 배치를 볼 때만 쓰는 가상 보고서. 서버에 저장하지 않습니다. */
export function demoAnalyticsReport(): AnalyticsReport {
  return {
    generated_at: "2026-10-26T03:00:00+00:00",
    timezone: "Asia/Seoul",
    collection: { status: "ready", enabled: false, started_at: "2026-10-01T00:00:00+00:00", note: "디자인 평가용 가상 수치입니다. 실제 수집이 아닙니다." },
    visits: {
      visitors: { status: "not_collected", value: null, note: "사람 수는 세지 않습니다." },
      sessions: { status: "ready", value: 128, note: "가상 세션. 하루 막대를 더한 값이 아닙니다." },
      page_views: { status: "ready", value: 540, note: "가상 페이지 조회" },
      series: [
        { date: "2026-10-20", page_views: 70, sessions: 22, until: "2026-10-20" },
        { date: "2026-10-21", page_views: 80, sessions: 24, until: "2026-10-21" },
        { date: "2026-10-22", page_views: 64, sessions: 20, until: "2026-10-22" },
        { date: "2026-10-23", page_views: 90, sessions: 28, until: "2026-10-23" },
        { date: "2026-10-24", page_views: 76, sessions: 21, until: "2026-10-24" },
        { date: "2026-10-25", page_views: 88, sessions: 26, until: "2026-10-25" },
        { date: "2026-10-26", page_views: 72, sessions: 19, until: "2026-10-26" },
      ],
      pages: [
        { target: "home", label: "홈", page_views: 180, sessions: 90 },
        { target: "cases", label: "사례 목록", page_views: 140, sessions: 70 },
        { target: "case", label: "사례 글", page_views: 120, sessions: 60 },
      ],
      referrer: { status: "not_collected", value: null, note: "유입 주소는 수집하지 않았습니다." },
      device: { status: "not_collected", value: null, note: "기기 유형은 수집하지 않았습니다." },
    },
    articles: [
      { target: "case/lettuce-biomass-estimation", kind: "case", slug: "lettuce-biomass-estimation", page_views: 40, read_sessions: 28, expert_clicks: 6, related_opens: 4, note: "가상. 클릭은 협업 확정이 아닙니다." },
    ],
    registration: {
      status: "ready",
      note: "가상 신규 작성입니다. 수정 모드는 빼 두었습니다.",
      create: {
        opened: 80,
        reached: [
          { step: "research", label: "01 연구", count: 80 },
          { step: "data", label: "02 데이터", count: 52 },
          { step: "collaboration", label: "03 협업", count: 31 },
          { step: "review", label: "04 확인", count: 18 },
        ],
        completed: 11,
        watching: 6,
        incomplete: 63,
        completion_rate: 11 / 80,
        window: "24h",
      },
      resume: { saved: 20, completed: 4, watching: 3, incomplete: 13, completion_rate: 0.2, window: "7d", note: "가상 임시저장" },
      edit: { opened: 5, note: "신규 등록 비율에 넣지 않습니다." },
      completed_without_attempt: 0,
      reasons: [{ code: "later", label: "나중에 이어서 작성", count: 9, kind: "answer" }, { code: "unanswered", label: "답하지 않음", count: 4, kind: "skipped" }],
      signals: [{ code: "title_required", label: "title_required", count: 7, kind: "validation" }],
    },
  };
}
