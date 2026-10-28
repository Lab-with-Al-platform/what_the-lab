// 협업 공간(목록·전체 달력)에서 쓰는 타입, 색, 날짜 도우미, 그리고 데이터 불러오기
import { requestApi } from "@/lib/api";
import { addDays, daysBetween, todayDate } from "@/lib/collab-requests";

/** 협업 상태: 시작 전(대기) · 진행 중 · 완료 · 중도 종료 · 시작 전 취소 */
export type CollabStatus = "waiting" | "active" | "done" | "ended_early" | "canceled";

/** 협업 하나 = 연구 × 전문가 1:1 (연구회원이 [협업 시작하기]를 누른 요청 하나 = 협업 하나) */
export type Collaboration = {
  collaboration_id: number;
  research: { title: string }; // 시작할 때 합의한 연구 제목
  partner: { nickname: string; user_photo: string | null; role: "researcher" | "expert" }; // 상대방
  start_date: string; // YYYY-MM-DD (요청에서 확정된 기간을 복사)
  end_date: string;
  confirmed_on: string; // 협업을 확정한 날. 일정은 이날(또는 시작일 중 이른 날)부터 잡을 수 있어요
  status: CollabStatus;
  opened: boolean; // 예전 [협업 공간 열기] 기록 (지금 화면에서는 쓰지 않아요)
  google_linked: boolean; // 내 구글 캘린더에 이 협업 캘린더를 추가했는지 (구글 연동 전이라 지금은 늘 false)
  discord_channel_url: string | null; // 둘만의 디스코드 채널 링크 (아직 못 만들었으면 null)
};

/** 일정 종류: 미팅 · 작업 기간 · 결과물 마감 · 기타 */
export type ScheduleKind = "meeting" | "work" | "due" | "etc";

export type Schedule = {
  schedule_id: number;
  collaboration_id: number;
  kind: ScheduleKind;
  title: string;
  start_date: string; // 하루짜리면 start_date = end_date
  end_date: string;
  start_time: string | null; // "14:00" (미팅·기타만)
  end_time: string | null; // "15:00" (선택)
  place: string | null; // 장소·링크 "온라인 · 구글 미트" 처럼 자유롭게
  memo: string | null;
  assignee: "researcher" | "expert" | null; // 작업 기간 담당 (비어 있으면 함께)
  series_id: number | null; // 매주 반복으로 만든 일정 묶음
  created_by: number | null; // 등록한 사람 (자동으로 넣은 협업 시작·종료일은 null)
  created_by_nickname: string | null; // 등록한 사람 닉네임
  created_at: string | null; // 등록한 때 (ISO)
  updated_at: string | null; // 마지막으로 고친 때 (ISO)
};

/** 일정 저장할 때 보내는 값 (백엔드 ScheduleInput 과 같은 모양) */
export type ScheduleInput = {
  kind: ScheduleKind;
  title: string;
  start_date: string;
  end_date: string;
  memo: string;
  repeat_weekly: boolean; // 하루짜리 미팅을 매주 같은 요일에 (새로 만들 때만)
  // 화면에서는 안 받지만, 고칠 때 원래 값을 지우지 않도록 그대로 돌려보내요
  start_time?: string | null;
  end_time?: string | null;
  place?: string;
  assignee?: "researcher" | "expert" | null;
};

export const KIND_LABELS: Record<ScheduleKind, string> = { meeting: "미팅", work: "작업 기간", due: "결과물 마감", etc: "기타" };

/**
 * 협업마다 다른 색. Tailwind가 찾을 수 있게 클래스 이름을 통째로 적어 둬요.
 * (색 값은 globals.css 의 --color-collab-1 ~ 6)
 */
export const COLLAB_TONES = [
  { dot: "bg-collab-1", soft: "bg-collab-1-soft", text: "text-collab-1", border: "border-collab-1" },
  { dot: "bg-collab-2", soft: "bg-collab-2-soft", text: "text-collab-2", border: "border-collab-2" },
  { dot: "bg-collab-3", soft: "bg-collab-3-soft", text: "text-collab-3", border: "border-collab-3" },
  { dot: "bg-collab-4", soft: "bg-collab-4-soft", text: "text-collab-4", border: "border-collab-4" },
  { dot: "bg-collab-5", soft: "bg-collab-5-soft", text: "text-collab-5", border: "border-collab-5" },
  { dot: "bg-collab-6", soft: "bg-collab-6-soft", text: "text-collab-6", border: "border-collab-6" },
] as const;
export type CollabTone = (typeof COLLAB_TONES)[number];

/** 협업 번호로 색을 정해요. 같은 협업은 어느 화면에서나 같은 색이에요. */
export function toneOf(collaborationId: number): CollabTone {
  return COLLAB_TONES[(collaborationId - 1) % COLLAB_TONES.length];
}

/** 일정을 잡을 수 있는 기간: 확정한 날(또는 시작일 중 이른 날) ~ 종료일. 백엔드 schedule_period 와 같아요. */
export function schedulePeriod(collab: Collaboration): { first: string; last: string } {
  const first = collab.confirmed_on < collab.start_date ? collab.confirmed_on : collab.start_date;
  return { first, last: collab.end_date };
}

/** 진행 중 탭에 보일 협업인지 (시작 전 + 진행 중) */
export function isOngoing(collab: Collaboration): boolean {
  return collab.status === "waiting" || collab.status === "active";
}

/** 카드 오른쪽 위 글자: 시작 전이면 "시작 D-7", 진행 중이면 종료까지 "D-12", 마지막 날이면 "D-day" */
export function ddayText(collab: Collaboration, today = todayDate()): string {
  if (collab.status === "waiting") {
    const days = daysBetween(today, collab.start_date);
    return days <= 0 ? "오늘 시작" : `시작 D-${days}`;
  }
  const days = daysBetween(today, collab.end_date);
  return days <= 0 ? "D-day" : `D-${days}`;
}

/** 진행률(%) — 시작일부터 종료일까지 오늘이 어디쯤인지 */
export function progress(collab: Collaboration, today = todayDate()): number {
  const total = daysBetween(collab.start_date, collab.end_date) + 1;
  const passed = daysBetween(collab.start_date, today) + 1;
  return Math.max(0, Math.min(100, Math.round((passed / total) * 100)));
}

/** 이 일정이 그 날짜에 걸쳐 있는지 */
export function coversDay(schedule: Schedule, day: string): boolean {
  return schedule.start_date <= day && day <= schedule.end_date;
}

/** 이 협업의 오늘 이후 첫 일정 (이미 시작한 작업 기간은 빼요) */
export function nextSchedule(collaborationId: number, schedules: Schedule[], today = todayDate()): Schedule | undefined {
  return schedules
    .filter((item) => item.collaboration_id === collaborationId && item.start_date >= today)
    .sort((a, b) => (a.start_date + (a.start_time ?? "")).localeCompare(b.start_date + (b.start_time ?? "")))[0];
}

const WEEKDAYS = "일월화수목금토";

/** 2026-10-20 → "10.20 (화)" */
export function dayLabel(date: string): string {
  const day = new Date(`${date}T00:00:00`);
  return `${day.getMonth() + 1}.${day.getDate()} (${WEEKDAYS[day.getDay()]})`;
}

/** 달력에 그릴 날짜들: 그 달 1일이 있는 주의 일요일부터 마지막 날이 있는 주의 토요일까지, 7일씩 묶음 */
export function monthWeeks(year: number, month: number): string[][] {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const firstDay = new Date(`${first}T00:00:00`);
  let cursor = addDays(first, -firstDay.getDay());
  const weeks: string[][] = [];
  do {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(cursor, index)));
    cursor = addDays(cursor, 7);
  } while (Number(cursor.slice(5, 7)) === month);
  return weeks;
}

// ---------------------------------------------------------------------------
// 데이터 불러오기: 백엔드 GET /workspace (협업 + 진행 중 협업의 일정)
// 협업 시작일·종료일은 일정 테이블에 저장하지 않고, 화면에서 달력에 자동으로 넣어 보여 줘요.
// ---------------------------------------------------------------------------

export type WorkspaceData = { collaborations: Collaboration[]; schedules: Schedule[] };

/** 협업 목록 + 내가 볼 수 있는 일정 */
export async function loadWorkspace(): Promise<WorkspaceData> {
  return withAutoItems(await requestApi<WorkspaceData>("/workspace"));
}

/** 일정 추가. 저장한 뒤의 최신 목록을 돌려받아요. */
export async function addSchedule(collaborationId: number, input: ScheduleInput): Promise<WorkspaceData> {
  return withAutoItems(await requestApi<WorkspaceData>(`/workspace/${collaborationId}/schedules`, { method: "POST", body: JSON.stringify(input) }));
}

/** 일정 하나 수정 (반복 일정이어도 이 날짜 하나만) */
export async function updateSchedule(scheduleId: number, input: ScheduleInput): Promise<WorkspaceData> {
  return withAutoItems(await requestApi<WorkspaceData>(`/workspace/schedules/${scheduleId}`, { method: "PUT", body: JSON.stringify(input) }));
}

/** 일정 삭제. series=true 면 같은 반복 일정 중 이 날짜와 그 뒤를 모두 지워요. */
export async function deleteSchedule(scheduleId: number, series = false): Promise<WorkspaceData> {
  return withAutoItems(await requestApi<WorkspaceData>(`/workspace/schedules/${scheduleId}?series=${series}`, { method: "DELETE" }));
}

/** 진행 중 협업마다 "협업 시작"(점)·"협업 종료일"(⚑)을 달력에 넣어요. 번호는 실제 일정과 겹치지 않게 음수예요. */
function withAutoItems(data: WorkspaceData): WorkspaceData {
  const auto = (collab: Collaboration, schedule_id: number, kind: ScheduleKind, title: string, date: string, place: string): Schedule => ({
    schedule_id,
    collaboration_id: collab.collaboration_id,
    kind,
    title,
    start_date: date,
    end_date: date,
    start_time: null,
    end_time: null,
    place,
    memo: null,
    assignee: null,
    series_id: null,
    created_by: null,
    created_by_nickname: null,
    created_at: null,
    updated_at: null,
  });
  const extra = data.collaborations
    .filter(isOngoing)
    .flatMap((collab) => [
      auto(collab, -collab.collaboration_id * 2, "etc", "협업 시작", collab.start_date, "이날부터 협업이 시작돼요"),
      auto(collab, -collab.collaboration_id * 2 - 1, "due", "협업 종료일", collab.end_date, "이날이 지나면 완료로 넘어가요"),
    ]);
  return { ...data, schedules: [...data.schedules, ...extra] };
}