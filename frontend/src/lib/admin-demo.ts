import type { MemberDetail, MemberItem, PageResult, Point, ResearchDetail, ResearchItem, ResearchProgressCode, Summary } from "./operations-admin";

// 디자인 평가 전용입니다. 이 파일의 자료는 API나 DB로 전송하지 않습니다.
export const DEMO_TODAY = "2026-10-26";
const DAY_MS = 86_400_000;
const REFERENCE = new Date(`${DEMO_TODAY}T00:00:00+09:00`).getTime();
const STEP_LABELS: Record<string, string> = { role: "회원 유형", verify: "소속 확인", info: "기본 정보", done: "가입 완료" };

function dateAt(offset: number): string {
  return new Date(REFERENCE + offset * DAY_MS + 9 * 3_600_000).toISOString().slice(0, 10);
}

export const DEMO_MEMBERS: MemberItem[] = Array.from({ length: 60 }, (_, day) => {
  const count = 7 + Math.floor(day * .28) + [0, 3, 5, 2, 6, 1, 0][day % 7];
  return Array.from({ length: count }, (_, index): MemberItem => {
    const id = 10000 + day * 40 + index;
    const step = id % 15 === 0 ? "verify" : id % 19 === 0 ? "info" : id % 23 === 0 ? "role" : "done";
    const role = step === "role" ? null : id % 3 === 0 ? "expert" : "researcher";
    const status = id % 37 === 0 ? "suspended" : "active";
    return { user_id: id, nickname: `가상${role === "expert" ? "전문가" : "연구자"}${id}`, role, role_label: role === "expert" ? "AI 전문가" : role === "researcher" ? "연구자" : "미선택", affiliation: `가상 ${["A대학교", "B연구원", "C대학교", "D연구팀"][id % 4]}`, signup_step: step, signup_step_label: STEP_LABELS[step], status, status_label: status === "active" ? "정상" : "정지", created_at: `${dateAt(day - 59)}T${String(9 + index % 10).padStart(2, "0")}:00:00+09:00` };
  });
}).flat().reverse();

const FIELD_NAMES = ["생명과학", "의료·헬스케어", "기후·환경", "신소재·화학", "인문·사회", "공학·제조"];
const DEMO_PROGRESS: { code: ResearchProgressCode; note: string }[] = [
  { code: "recruiting", note: "가상 예시: 공개 모집이 열려 있고 최종 매칭 전입니다." },
  { code: "unmatched_closed", note: "가상 예시: 모집 기한이 지났고 확정된 협업이 없습니다." },
  { code: "recruitment_canceled", note: "가상 예시: 프로젝트 확정 전에 연구자가 모집을 철회했습니다. 기한 만료와 구분합니다." },
  { code: "scheduled", note: "가상 예시: 매칭·프로젝트 확정 후 실제 시작 전입니다." },
  { code: "in_progress", note: "가상 예시: 프로젝트 시작이 확인된 협업입니다." },
  { code: "paused", note: "가상 예시: 데이터 접근 복구를 기다리며 참여자들이 작업 중지와 재개 예정일에 합의했습니다. 협업 관계는 유지합니다." },
  { code: "completion_pending", note: "가상 예시: 종료 요청 후 참여자의 확인을 기다리고 있습니다. 아직 완료가 아닙니다." },
  { code: "completed", note: "가상 예시: 종료 확인을 마친 협업입니다. 종료일만으로 판단하지 않습니다." },
  { code: "discontinued", note: "가상 예시: 시작한 협업을 목표를 마치지 못한 채 종료하기로 확정했습니다. 정상 완료와 구분합니다." },
];
export const DEMO_RESEARCHES: ResearchItem[] = Array.from({ length: 216 }, (_, index) => {
  const owner = DEMO_MEMBERS[(index * 5) % DEMO_MEMBERS.length];
  const field = index % FIELD_NAMES.length;
  const status = index % 4 === 0 ? "draft" : "registered";
  // 임시저장을 건너뛰고 등록된 연구에 아홉 상태를 차례로 배정합니다.
  const registeredIndex = index - Math.floor(index / 4) - 1;
  // 임시저장과 진행 중이 동시에 붙지 않도록, 등록된 가상 연구에만 예시를 연결합니다.
  const progress = status === "draft"
    ? { code: "not_applicable" as const, note: "임시저장 연구는 진행 상태의 대상이 아닙니다." }
    : { ...DEMO_PROGRESS[registeredIndex % DEMO_PROGRESS.length] };
  // 최근의 작성량이 조금 더 많은 분포로 만들어 변화가 있는 추이를 평가합니다.
  const created = `${dateAt(-Math.floor((index / 216) ** 1.4 * 54))}T11:00:00+09:00`;
  return { research_id: 20000 + index, title: `${["세포 이미지 분석", "의료영상 패턴 탐색", "기후 관측 예측", "신소재 물성 분석", "연구 문헌 비교", "제조 공정 이상 탐지"][field]} 연구 · 가상 ${index + 1}`, user_id: owner.user_id, owner_nickname: owner.nickname, status, status_label: status === "registered" ? "등록" : "임시저장", status_note: "디자인 데모용 가상 연구입니다.", progress, fields: [{ id: `DEMO-FIELD-${field}`, name: FIELD_NAMES[field] }], created_at: created, updated_at: created };
});

function countIn(items: { created_at: string }[], start: string, end: string): number {
  return items.filter(item => item.created_at.slice(0, 10) >= start && item.created_at.slice(0, 10) < end).length;
}

function seriesFor(items: { created_at: string }[], start: string, end: string): Point[] {
  const points: Point[] = [];
  for (let time = new Date(`${start}T00:00:00+09:00`).getTime(); time < new Date(`${end}T00:00:00+09:00`).getTime(); time += DAY_MS) {
    const date = new Date(time + 9 * 3_600_000).toISOString().slice(0, 10);
    points.push({ date, count: items.filter(item => item.created_at.startsWith(date)).length });
  }
  return points;
}

export function demoSummary(preset = "7d"): Summary {
  const days = preset === "today" ? 1 : preset === "month" ? 26 : preset === "30d" ? 30 : 7;
  const start = dateAt(1 - days);
  const end = dateAt(1);
  const count = (value: number, note: string) => ({ status: "ready" as const, value, note });
  const created = (items: { created_at: string }[]) => {
    const current = countIn(items, start, end);
    const previous = countIn(items, dateAt(1 - days * 2), start);
    return { ...count(current, "계정·연구 생성일을 집계한 가상 예시"), series: seriesFor(items, start, end), comparison: { previous, absolute: current - previous, rate: previous ? (current - previous) / previous : null } };
  };
  const completed = DEMO_MEMBERS.filter(item => item.signup_step === "done");
  const registered = DEMO_RESEARCHES.filter(item => item.status === "registered");
  return {
    generated_at: `${DEMO_TODAY}T12:00:00+09:00`, today: DEMO_TODAY,
    range: { preset, start, end, includes_today: true, today_in_progress: true, timezone: "Asia/Seoul" },
    members: {
      completed: { ...count(completed.length, "현재 가입 완료 · 가상 집계"), active: completed.filter(item => item.status === "active").length, suspended: completed.filter(item => item.status === "suspended").length },
      in_progress: count(DEMO_MEMBERS.length - completed.length, "가입 단계가 완료되지 않은 계정"),
      suspended: count(DEMO_MEMBERS.filter(item => item.status === "suspended").length, "정지 상태 예시"),
      roles: { status: "ready", counts: { researcher: DEMO_MEMBERS.filter(item => item.role === "researcher").length, expert: DEMO_MEMBERS.filter(item => item.role === "expert").length, unset: DEMO_MEMBERS.filter(item => !item.role).length }, note: "현재 역할 구성 · 가입 진행 계정 포함" },
      steps: { status: "ready", counts: Object.fromEntries(Object.keys(STEP_LABELS).map(step => [step, DEMO_MEMBERS.filter(item => item.signup_step === step).length])), labels: STEP_LABELS, note: "현재 가입 단계의 분포이며 단계별 전환율이 아닙니다." },
      accounts_created: created(DEMO_MEMBERS), signup_completed_in_period: { status: "not_collected", value: null, note: "실제 API의 최초 가입 완료 시각은 수집 전입니다." },
    },
    researches: {
      registered: count(registered.length, "현재 등록된 연구 · 공개 모집과는 다름"), records: count(DEMO_RESEARCHES.length, "임시저장을 포함한 연구"), created: created(DEMO_RESEARCHES),
      first_registered_in_period: { status: "not_collected", value: null, note: "실제 최초 등록 이벤트는 수집 전입니다." },
      fields: { status: "ready", items: FIELD_NAMES.map((name, index) => ({ id: `DEMO-FIELD-${index}`, name, count: registered.filter(item => item.fields.some(field => field.name === name)).length })), note: "현재 등록 연구의 분야 · 가상 예시" },
      abandonment: { status: "not_collected", note: "실제 작성 과정은 수집 전입니다. 데모 탭에서 시각 예시를 확인할 수 있습니다." },
    },
    unavailable: [{ id: "traffic", status: "not_collected", label: "방문·인사이트 조회", note: "실제 수집 전 · 운영 데이터로 표시하지 않음" }, { id: "projects", status: "not_linked", label: "협업 프로젝트", note: "연구 등록과 구분 · 실제 협업 흐름 연결 전" }],
  };
}

function pageItems<T>(items: T[], params: URLSearchParams): PageResult<T> {
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = 10;
  return { total: items.length, page, page_size: pageSize, items: items.slice((page - 1) * pageSize, page * pageSize) };
}

export function demoMembers(params: URLSearchParams): PageResult<MemberItem> {
  const q = (params.get("q") ?? "").toLowerCase();
  return pageItems(DEMO_MEMBERS.filter(item => (!q || `${item.user_id} ${item.nickname}`.toLowerCase().includes(q)) && (!params.get("role") || (item.role ?? "unset") === params.get("role")) && (!params.get("status") || params.get("status") === "any" || item.status === params.get("status")) && (!params.get("signup_step") || item.signup_step === params.get("signup_step")) && (!params.get("created_start") || item.created_at.slice(0, 10) >= params.get("created_start")!) && (!params.get("created_end") || item.created_at.slice(0, 10) < params.get("created_end")!)), params);
}

export function demoResearches(params: URLSearchParams): PageResult<ResearchItem> {
  const q = (params.get("q") ?? "").toLowerCase();
  const items = DEMO_RESEARCHES.filter(item => (!q || `${item.research_id} ${item.title} ${item.owner_nickname}`.toLowerCase().includes(q)) && (!params.get("status") || item.status === params.get("status")) && (!params.get("progress_status") || item.progress?.code === params.get("progress_status")) && (!params.get("field_id") || item.fields.some(field => field.id === params.get("field_id"))) && !params.get("able_work_id") && (!params.get("created_start") || item.created_at.slice(0, 10) >= params.get("created_start")!) && (!params.get("created_end") || item.created_at.slice(0, 10) < params.get("created_end")!));
  return pageItems(items, params);
}

export function demoMemberDetail(id: string): MemberDetail | undefined {
  const member = DEMO_MEMBERS.find(item => item.user_id === Number(id));
  if (!member) return undefined;
  return { ...member, is_admin: false, researches: DEMO_RESEARCHES.filter(item => item.user_id === member.user_id), actions: { status: "not_available", note: "데모는 읽기 전용이며 상태를 변경하지 않습니다." }, admin_actions: { status: "not_available", note: "데모는 읽기 전용이며 권한을 변경하지 않습니다." }, audit: { status: "not_collected", note: "조치 이력 없음" } };
}

export function demoResearchDetail(id: string): ResearchDetail | undefined {
  const research = DEMO_RESEARCHES.find(item => item.research_id === Number(id));
  if (!research) return undefined;
  return { ...research, is_primary: false, task_unsure: true, able_works: [], data_types: [{ code: "image", label: "이미지 · 가상 예시" }], data_status: { code: "collecting", label: "수집 중" }, share_policy: { code: "conditional", label: "조건부 공유", note: "글의 공개 여부와 다릅니다." }, body_access: { status: "hidden", note: "비공개 연구 본문과 원자료는 데모에도 넣지 않습니다." } };
}
