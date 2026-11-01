// 알림(헤더 종·알림 화면)에서 쓰는 타입과 계산. 백엔드 응답(snake_case) 모양 그대로예요.

export type NotificationType =
  | "request_received"
  | "request_accepted"
  | "request_rejected"
  | "request_canceled"
  | "request_expired"
  | "request_withdrawn"
  | "collab_started"
  // 협업 공간: 요청 (한 사람이 한 일 → 상대에게). 디스코드는 DM 대신 협업 채널 멘션으로 가요
  | "task_created"
  | "task_done"
  | "task_canceled"
  | "task_reopened"
  | "task_due"
  | "task_due_talk"
  | "task_due_kept"
  | "task_returned"
  // 협업 공간: 아침 브리핑 (하루 한 번)
  | "task_due_soon"
  | "task_overdue"
  | "task_talk_waiting"
  | "collab_ending";

/** 알림 한 건 (GET /notifications 의 items) */
export type NotificationItem = {
  notification_id: number;
  type: NotificationType;
  title: string; // "neural_kim 님이 협업 요청을 수락했어요"
  detail: string; // 연구 제목, 거절 사유 등
  link: string; // 누르면 갈 화면
  read: boolean;
  created_at: string;
};

export type NotificationList = { unread: number; items: NotificationItem[] };

export const UNREAD_POLL_MS = 60_000; // 안 읽은 수를 새로 가져오는 간격 (1분)

/** 종류별 동그라미 아이콘 글자와 색 */
export const NOTIFICATION_ICONS: Record<NotificationType, { icon: string; className: string }> = {
  request_received: { icon: "✉", className: "bg-brand-soft text-brand" },
  request_accepted: { icon: "✓", className: "bg-success-soft text-success" },
  request_rejected: { icon: "✕", className: "bg-danger-soft text-danger" },
  request_canceled: { icon: "↩", className: "bg-page text-faint" },
  request_expired: { icon: "⏱", className: "bg-page text-faint" },
  collab_started: { icon: "▶", className: "bg-expert-soft text-expert" },
    request_withdrawn: { icon: "↩", className: "bg-page text-faint" },
  task_created: { icon: "📌", className: "bg-brand-soft text-brand" },
  task_done: { icon: "✓", className: "bg-success-soft text-success" },
  task_canceled: { icon: "✕", className: "bg-page text-faint" },
  task_reopened: { icon: "↩", className: "bg-brand-soft text-brand" },
  task_due: { icon: "📅", className: "bg-brand-soft text-brand" },
  task_due_talk: { icon: "🗓", className: "bg-editorial-warning-soft text-[#8a5a12]" },
  task_due_kept: { icon: "📌", className: "bg-page text-muted" },
  task_returned: { icon: "↩", className: "bg-danger-soft text-danger" },
  task_due_soon: { icon: "⏰", className: "bg-editorial-warning-soft text-[#8a5a12]" },
  task_overdue: { icon: "!", className: "bg-danger-soft text-danger" },
  task_talk_waiting: { icon: "🗓", className: "bg-editorial-warning-soft text-[#8a5a12]" },
  collab_ending: { icon: "⏳", className: "bg-expert-soft text-expert" },
};

/** 제목을 닉네임과 나머지로 나눠요. 닉네임만 굵게 보여 주려고. "neural_kim 님이 …" → ["neural_kim", " 님이 …"] */
export function splitActor(title: string): [string, string] {
  const at = title.indexOf(" 님");
  return at > 0 ? [title.slice(0, at), title.slice(at)] : ["", title];
}

/** 언제 왔는지: 방금 / 3분 전 / 2시간 전 / 어제 / 10월 21일 */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const created = new Date(iso);
  const minutes = Math.floor((now.getTime() - created.getTime()) / 60_000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (created.toDateString() === yesterday.toDateString()) return "어제";
  return `${created.getMonth() + 1}월 ${created.getDate()}일`;
}