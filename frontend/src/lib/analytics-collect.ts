// 방문·글 이동·등록 과정의 허용 사건만 보냅니다.
// 세션 번호는 페이지 방문과 글 조회에만 붙입니다. 계정·연구 본문은 보내지 않습니다.

import { API_BASE_URL } from "@/lib/api";

const IDLE_MS = 30 * 60 * 1000;
const SESSION_KEY = "lb-analytics-session";
const SESSION_AT = "lb-analytics-session-at";
const ATTEMPT_KEY = "lb-writing-attempt";

const SESSION_EVENTS = new Set(["page_view", "article_view"]);

export const STEP_TARGETS = ["research", "data", "collaboration", "review"] as const;

export const LEAVE_REASONS = [
  ["later", "나중에 이어서 작성하려고요"],
  ["explain_hard", "연구 내용을 어떻게 설명할지 모르겠어요"],
  ["data_not_ready", "데이터가 아직 준비되지 않았어요"],
  ["security", "공유·보안 조건이 걱정돼요"],
  ["input_hard", "입력이 많거나 어려워요"],
  ["error", "오류가 났어요"],
] as const;

export type LeaveReason = (typeof LEAVE_REASONS)[number][0] | "unanswered";

type AnalyticsEvent = {
  event_name: string;
  target: string;
  attempt_id?: string;
  mode?: "create" | "resume" | "edit";
  result_code?: string;
  reason_code?: LeaveReason;
  research_id?: number;
};

/** 공개 화면의 정해진 페이지만 방문으로 봅니다. 주소의 검색어는 쓰지 않습니다. */
export function pageKey(pathname: string): string | null {
  if (pathname === "/") return "home";
  if (pathname === "/cases") return "cases";
  if (pathname.startsWith("/cases/")) return "case";
  if (pathname === "/trends") return "trends";
  if (pathname.startsWith("/trends/")) return "trend";
  if (pathname === "/experts") return "experts";
  if (pathname.startsWith("/experts/")) return "expert";
  return null;
}

/** 이 탭의 임시 세션. 30분 동안 기록이 없으면 새 번호를 만듭니다. */
export function analyticsSessionId(storage: Storage, now = Date.now()): string {
  const seenAt = Number(storage.getItem(SESSION_AT) || "0");
  let sessionId = storage.getItem(SESSION_KEY);
  if (!sessionId || now - seenAt > IDLE_MS) {
    sessionId = crypto.randomUUID();
    storage.setItem(SESSION_KEY, sessionId);
  }
  storage.setItem(SESSION_AT, String(now));
  return sessionId;
}

/**
 * 등록 창을 연 시도 번호.
 * 개발 모드가 같은 창을 두 번 그릴 때는 방금 만든 번호를 다시 씁니다.
 */
export function writingAttemptId(storage: Storage, now = Date.now()): string {
  const saved = storage.getItem(ATTEMPT_KEY);
  if (saved) {
    const [attemptId, openedAt] = saved.split("|");
    if (attemptId && now - Number(openedAt) < 2000) return attemptId;
  }
  const attemptId = crypto.randomUUID();
  storage.setItem(ATTEMPT_KEY, `${attemptId}|${now}`);
  return attemptId;
}

function browserStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function skippedPage(): boolean {
  if (window.location.pathname.startsWith("/admin")) return true;
  if (navigator.webdriver) return true;
  const host = window.location.hostname;
  // 개발 PC의 방문은 운영 수치에 섞지 않습니다.
  return host === "localhost" || host === "127.0.0.1";
}

/** 수집이 실패하거나 꺼져 있어도 화면 이동은 막지 않습니다. */
export function sendAnalytics(event: AnalyticsEvent): void {
  const storage = browserStorage();
  if (!storage || skippedPage()) return;
  const pendingKey = [
    "lb-analytics-id",
    event.event_name,
    event.target,
    event.attempt_id ?? "",
    event.result_code ?? "",
    event.reason_code ?? "",
  ].join(":");
  let eventId = storage.getItem(pendingKey);
  if (!eventId) {
    eventId = crypto.randomUUID();
    storage.setItem(pendingKey, eventId);
  }
  const sessionId = SESSION_EVENTS.has(event.event_name) ? analyticsSessionId(storage) : undefined;
  const body = {
    event_id: eventId,
    event_name: event.event_name,
    target: event.target,
    session_id: sessionId,
    attempt_id: event.attempt_id,
    mode: event.mode,
    result_code: event.result_code,
    reason_code: event.reason_code,
    research_id: event.research_id,
  };
  fetch(`${API_BASE_URL}/analytics/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    keepalive: true,
    body: JSON.stringify(body),
  })
    .then((response) => {
      if (response.ok) storage.removeItem(pendingKey);
    })
    .catch(() => undefined);
}
