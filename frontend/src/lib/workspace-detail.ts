// 협업 상세 (/workspace/[id]) 에서 쓰는 타입과 데이터 불러오기, 화면 글자 도우미
// 백엔드: GET /api/v1/workspace/{collaboration_id} (backend/app/workspace_detail.py)
import { requestApi } from "@/lib/api";
import { daysBetween } from "@/lib/collab-requests";
import { CAREER_LABELS, JOB_LABELS } from "@/lib/my-career";
import { DataStatus, DataType, MeetingType, OutputType, RewardCode, SharePolicy } from "@/lib/my-research";
import { POSITION_OPTIONS } from "@/lib/profile-settings";
import { CollabStatus, Schedule } from "@/lib/workspace";

/** 협업한 두 사람. 역할에 따라 채워지는 칸이 달라요 (전문가: 직업·경력 / 연구회원: 기관·학과·직위) */
export type DetailPerson = {
  user_id: number;
  nickname: string;
  user_photo: string | null;
  role: "researcher" | "expert";
  current_job?: string | null; // 전문가: grad_student / researcher / employee …
  ai_career?: string | null; // 전문가: lt1 / 1_3 / 3_5 …
  affiliation?: string | null;
  introduce?: string | null;
  institution_name?: string | null; // 연구회원
  department?: string | null;
  position?: string | null; // 연구회원: master / phd …
};

/** 협업을 시작할 때 두 사람이 확인한 내용 (연구 글을 나중에 고쳐도 바뀌지 않는 복사본) */
export type Agreement = {
  title: string;
  description: string | null;
  field_ids: string[];
  able_work_ids: string[];
  task_unsure: boolean;
  outputs: OutputType[];
  rewards: RewardCode[];
  data_types: DataType[];
  data_status: DataStatus | null;
  share_policy: SharePolicy | null;
  share_condition: string | null;
  meeting_type: MeetingType | null;
  face_to_area: string | null;
  message: string | null; // 연구회원이 요청할 때 쓴 말
  reply_message: string | null; // 전문가가 수락할 때 쓴 말
};

/** 요청: 한 사람이 상대에게 맡기는 일. direction 은 "나" 기준 (in = 내가 받은 / out = 내가 보낸) */
export type CollabTask = {
  task_id: number;
  requested_by: number;
  assignee: number;
  content: string;
  due_date: string | null;
  status: "open" | "done" | "canceled";
  closed_at: string | null;
  source: "web" | "discord";
  created_at: string;
  requested_by_nickname: string;
  assignee_nickname: string;
  direction: "in" | "out";
};

/** 정한 것: 제안 → 상대 동의로 확정. mine = 내가 제안했는지 */
export type CollabDecision = {
  decision_id: number;
  proposed_by: number;
  content: string;
  status: "proposed" | "agreed" | "declined" | "withdrawn" | "replaced";
  answered_at: string | null;
  answer_note: string | null;
  replaces_id: number | null;
  source: "web" | "discord";
  created_at: string;
  proposed_by_nickname: string;
  mine: boolean;
};

/** 기간 연장 · 조기 완료 요청. mine = 내가 보냈는지 (내 것이면 [철회], 상대 것이면 [수락]·[다시 얘기해요]) */
export type ChangeRequest = {
  change_id: number;
  kind: "extend" | "complete";
  requested_by: number;
  old_end_date: string;
  new_end_date: string | null;
  reason: string | null;
  status: "pending" | "accepted" | "declined" | "withdrawn" | "expired";
  answer_note: string | null;
  expires_at: string;
  answered_at: string | null;
  created_at: string;
  requested_by_nickname: string;
  mine?: boolean;
};

export type CollaborationDetail = {
  collaboration: {
    collaboration_id: number;
    research: { title: string };
    status: CollabStatus;
    start_date: string;
    end_date: string;
    confirmed_on: string;
    today: string; // 서버의 한국 날짜 (D-day·타임라인 '오늘')
    my_side: "researcher" | "expert";
    me: DetailPerson;
    partner: DetailPerson;
    discord_channel_url: string | null;
    google_linked: boolean;
    google_calendar_url: string | null;
    ended_at: string | null;
    ended_by_nickname: string | null;
    end_reason: string | null;
  };
  agreement: Agreement;
  schedules: Schedule[];
  tasks: CollabTask[];
  decisions: CollabDecision[];
  pending_change: ChangeRequest | null;
  extensions: ChangeRequest[]; // 수락된 연장 기록
  google_enabled: boolean;
};

/** 협업 상세 한 장. 남의 협업이면 404 (ApiError) */
export async function loadDetail(collaborationId: number): Promise<CollaborationDetail> {
  return requestApi<CollaborationDetail>(`/workspace/${collaborationId}`);
}

// ---------------------------------------------------------------------------
// 화면 글자 도우미
// ---------------------------------------------------------------------------

export const ROLE_LABELS = { researcher: "연구자", expert: "AI 전문가" } as const;

/** 상대 소개 한 줄: 전문가 "연구원 · AI 3~5년", 연구회원 "서울대학교 · 컴퓨터공학과 · 석사과정" */
export function personLine(person: DetailPerson): string {
  if (person.role === "expert") {
    const job = person.current_job ? JOB_LABELS[person.current_job] : null;
    const career = person.ai_career ? `AI ${CAREER_LABELS[person.ai_career]}` : null;
    return [job, career, person.affiliation].filter(Boolean).join(" · ");
  }
  const position = POSITION_OPTIONS.find((option) => option.value === person.position)?.label;
  return [person.institution_name, person.department, position].filter(Boolean).join(" · ");
}

/** 머리 오른쪽 큰 글자: 진행 전 "시작까지 D-5" / 진행 중 "종료까지 D-12" (마지막 날 "오늘 종료") / 끝남 null */
export function periodHeadline(collab: CollaborationDetail["collaboration"]): { label: string; dday: string } | null {
  if (collab.status === "waiting") {
    const days = daysBetween(collab.today, collab.start_date);
    return { label: "시작까지", dday: days <= 0 ? "오늘" : `D-${days}` };
  }
  if (collab.status === "active") {
    const days = daysBetween(collab.today, collab.end_date);
    return { label: "종료까지", dday: days <= 0 ? "오늘" : `D-${days}` };
  }
  return null;
}

/** 요청 기한 글자와 급한지: "~10.22 · D-2" (2일 이내면 급함) / 기한 없음 */
export function dueText(task: CollabTask, today: string): { text: string; soon: boolean } {
  if (!task.due_date) return { text: "기한 없음", soon: false };
  const [, month, day] = task.due_date.split("-").map(Number);
  const left = daysBetween(today, task.due_date);
  if (task.status !== "open") return { text: `~${month}.${day}`, soon: false };
  const tail = left < 0 ? ` · ${-left}일 지남` : left === 0 ? " · 오늘" : ` · D-${left}`;
  return { text: `~${month}.${day}${tail}`, soon: left <= 2 };
}

export const TASK_LIMIT = 300; // 백엔드 MAX_TASK 와 같은 글자 수

/** [＋ 요청 남기기]: 상대에게 요청 보내기 (기한은 선택) */
export async function addTask(collaborationId: number, input: { content: string; due_date: string | null }): Promise<CollaborationDetail> {
  return requestApi<CollaborationDetail>(`/workspace/${collaborationId}/tasks`, { method: "POST", body: JSON.stringify(input) });
}

/** 받은 요청 [완료] */
export async function completeTask(taskId: number): Promise<CollaborationDetail> {
  return requestApi<CollaborationDetail>(`/workspace/tasks/${taskId}/done`, { method: "POST" });
}

/** 보낸 요청 [기한 변경]: 비우면(null) 기한 없음 */
export async function changeTaskDue(taskId: number, dueDate: string | null): Promise<CollaborationDetail> {
  return requestApi<CollaborationDetail>(`/workspace/tasks/${taskId}/due`, { method: "POST", body: JSON.stringify({ due_date: dueDate }) });
}

/** 끝난 요청 [되돌리기]: 완료는 받은 사람이, 취소는 보낸 사람이 다시 진행 중으로 */
export async function reopenTask(taskId: number): Promise<CollaborationDetail> {
  return requestApi<CollaborationDetail>(`/workspace/tasks/${taskId}/reopen`, { method: "POST" });
}

/** 보낸 요청 [취소] */
export async function cancelTask(taskId: number): Promise<CollaborationDetail> {
  return requestApi<CollaborationDetail>(`/workspace/tasks/${taskId}/cancel`, { method: "POST" });
}

