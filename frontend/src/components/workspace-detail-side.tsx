"use client";

import { ReactNode, useState } from "react";
import { daysBetween, photoOrDefault } from "@/lib/collab-requests";
import { DATA_STATUS_LABELS, DATA_TYPE_LABELS, MEETING_LABELS, OUTPUT_LABELS, REWARD_LABELS, SHARE_LABELS } from "@/lib/my-research";
import { ableWorkName, fieldName } from "@/lib/taxonomy-options";
import { Schedule } from "@/lib/workspace";
import { CollaborationDetail, CollabTask, personLine, ROLE_LABELS } from "@/lib/workspace-detail";
import { Modal } from "@/components/modal";
import { Avatar } from "@/components/request-parts";

const WEEKDAYS = "일월화수목금토";
const AGENDA_LIMIT = 6; // 다가오는 일정은 6줄까지 (나머지는 [전체 일정 보기])

const KIND_STYLE: Record<string, { bar: string; label: string }> = {
  meeting: { bar: "bg-brand", label: "미팅" },
  work: { bar: "bg-collab-6", label: "작업 기간" },
  due: { bar: "bg-danger", label: "마감" },
  data: { bar: "bg-collab-2", label: "데이터" },
  etc: { bar: "bg-faint", label: "기타" },
};

type AgendaItem = { day: string; schedule?: Schedule; task?: CollabTask };

// ---------------------------------------------------------------------------
// 다가오는 일정: 일정 + 기한 있는 요청(진행 중)을 날짜별로 섞어서
// ---------------------------------------------------------------------------

export function AgendaCard({
  detail,
  editable,
  onAdd,
  onPick,
}: {
  detail: CollaborationDetail;
  editable: boolean;
  onAdd: () => void;
  onPick: (schedule: Schedule) => void;
}) {
  const [all, setAll] = useState(false);
  const today = detail.collaboration.today;
  // 진행 전·진행 중: 오늘 이후 일정 + 열린 요청 / 끝난 협업: 지난 일정 전부 (기록)
  // 열린 요청: 기한이 있으면 그날, 기한이 없거나 지났으면 오늘 칸 (끝날 때까지 매일 보여요)
  const items: AgendaItem[] = editable
    ? [
        // 오늘 걸쳐 있는 작업 기간도 보여요 (끝나는 날이 오늘 이후면)
        ...detail.schedules.filter((item) => item.end_date >= today).map((schedule): AgendaItem => ({ day: schedule.start_date < today ? today : schedule.start_date, schedule })),
        ...detail.tasks
          .filter((task) => task.status === "open")
          .map((task): AgendaItem => ({ day: task.due_date && task.due_date > today ? task.due_date : today, task })),
      ]
    : detail.schedules.map((schedule): AgendaItem => ({ day: schedule.start_date, schedule }));
  items.sort((a, b) => a.day.localeCompare(b.day) || (a.schedule?.start_time ?? "").localeCompare(b.schedule?.start_time ?? ""));
  const days = groupByDay(items);
  const shown = all ? days : limitRows(days, AGENDA_LIMIT);
  const hiddenCount = items.length - shown.reduce((sum, [, rows]) => sum + rows.length, 0);

  return (
    <section className="rounded-card bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold">{editable ? "다가오는 일정" : "일정 기록"}</h2>
        {editable && (
          <button type="button" onClick={onAdd} className="h-8 rounded-button px-2.5 text-[13px] font-semibold text-muted hover:bg-page hover:text-ink">
            ＋ 추가
          </button>
        )}
      </div>

      {days.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-faint">{editable ? "아직 잡힌 일정이 없어요. 첫 미팅부터 잡아 보세요." : "남은 일정 기록이 없어요."}</p>
      ) : (
        <ul className="mt-2">
          {shown.map(([day, rows]) => {
            const isToday = day === today;
            const date = new Date(`${day}T00:00:00`);
            return (
              <li key={day} className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 border-t border-line py-2.5 first:border-t-0">
                <div className={`flex h-11 flex-col items-center justify-center rounded-button leading-tight ${isToday ? "bg-brand text-white" : "bg-page"}`}>
                  <b className="text-base font-extrabold">{date.getDate()}</b>
                  <span className={`text-[10px] font-semibold ${isToday ? "text-white/85" : "text-muted"}`}>
                    {isToday ? "오늘" : `${date.getMonth() + 1}월 ${WEEKDAYS[date.getDay()]}`}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col justify-center gap-1">
                  {rows.map((row) => (row.schedule ? <ScheduleRow key={`s${row.schedule.schedule_id}`} schedule={row.schedule} onPick={onPick} /> : <TaskRow key={`t${row.task!.task_id}`} task={row.task!} today={today} />))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {hiddenCount > 0 && (
        <button type="button" onClick={() => setAll(true)} className="mt-2 text-[12px] font-semibold text-brand hover:underline">
          {hiddenCount}개 더 보기
        </button>
      )}
    </section>
  );
}

function ScheduleRow({ schedule, onPick }: { schedule: Schedule; onPick: (schedule: Schedule) => void }) {
  const style = KIND_STYLE[schedule.kind] ?? KIND_STYLE.etc;
  const time = schedule.start_time ?? (schedule.start_date !== schedule.end_date ? `~${schedule.end_date.slice(5).replace("-", ".").replace(/^0/, "")}` : "");
  return (
    <button type="button" onClick={() => onPick(schedule)} className="flex min-w-0 items-center gap-2 rounded text-left text-[13px] hover:text-brand">
      <span className={`h-4 w-[3px] shrink-0 rounded ${style.bar}`} title={style.label} />
      <span className="min-w-0 flex-1 truncate">{schedule.title}</span>
      {time && <span className="shrink-0 text-xs text-muted">{time}</span>}
    </button>
  );
}

function TaskRow({ task, today }: { task: CollabTask; today: string }) {
  // 오늘 칸에 올라온 이유: 기한 없음 / 기한 지남
  const late = task.due_date && task.due_date < today ? daysBetween(task.due_date, today) : 0;
  return (
    <div className="flex min-w-0 items-center gap-2 text-[13px] text-muted">
      <span className="h-4 w-[3px] shrink-0 rounded bg-line" />
      <span className="min-w-0 flex-1 truncate">
        요청 · {task.content}
        {!task.due_date && <span className="ml-1 text-faint">· 기한 없음</span>}
        {late > 0 && <span className="ml-1 font-semibold text-danger">· {late}일 지남</span>}
      </span>
      {task.direction === "in" ? (
        <span className="shrink-0 rounded bg-danger-soft px-1.5 py-px text-[10px] font-bold text-danger">내가 할 일</span>
      ) : (
        <span className="shrink-0 text-xs">{task.assignee_nickname}</span>
      )}
    </div>
  );
}

function groupByDay(items: AgendaItem[]): [string, AgendaItem[]][] {
  const map = new Map<string, AgendaItem[]>();
  items.forEach((item) => map.set(item.day, [...(map.get(item.day) ?? []), item]));
  return [...map.entries()];
}

function limitRows(days: [string, AgendaItem[]][], limit: number): [string, AgendaItem[]][] {
  const result: [string, AgendaItem[]][] = [];
  let count = 0;
  for (const [day, rows] of days) {
    if (count >= limit) break;
    const take = rows.slice(0, limit - count);
    result.push([day, take]);
    count += take.length;
  }
  return result;
}

// ---------------------------------------------------------------------------
// 시작 전 준비 (진행 전에만): 데이터로 자동 체크
// ---------------------------------------------------------------------------

export function PrepCard({ detail, onAddMeeting }: { detail: CollaborationDetail; onAddMeeting: () => void }) {
  const { collaboration: collab, schedules } = detail;
  const [open, setOpen] = useState(false);
  const checks: { done: boolean; text: string; action?: ReactNode }[] = [
    { done: Boolean(collab.discord_channel_url), text: collab.discord_channel_url ? "디스코드 채널 열림" : "디스코드 채널 만드는 중" },
    {
      done: schedules.some((item) => item.kind === "meeting"),
      text: "첫 미팅 잡기",
      action: <SmallButton onClick={onAddMeeting}>일정 추가</SmallButton>,
    },
    ...(detail.google_enabled ? [{ done: collab.google_linked, text: "내 구글 캘린더에 추가 (선택)" }] : []),
    { done: false, text: "합의 내용 다시 확인하기", action: <SmallButton onClick={() => setOpen(true)}>보기</SmallButton> },
  ];
  const doneCount = checks.filter((check) => check.done).length;

  return (
    <section className="rounded-card bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold">시작 전 준비</h2>
        <span className="text-xs font-bold text-muted">
          {doneCount} / {checks.length}
        </span>
      </div>
      <ul className="mt-3 grid gap-2.5">
        {checks.map((check) => (
          <li key={check.text} className="flex items-center gap-2.5 text-[13px]">
            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 text-[11px] ${check.done ? "border-success bg-success text-white" : "border-line"}`}>
              {check.done ? "✓" : ""}
            </span>
            <span className={`flex-1 ${check.done ? "text-muted" : ""}`}>{check.text}</span>
            {!check.done && check.action}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-5 text-faint">대화해 보고 맞지 않으면 시작 전에 협업을 취소할 수 있어요.</p>
      {open && <AgreementModal detail={detail} onClose={() => setOpen(false)} />}
    </section>
  );
}

function SmallButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} className="h-7 shrink-0 rounded-button border border-line px-2.5 text-xs font-semibold hover:bg-page">
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// 함께하는 사람 + 합의 내용 요약 (전체는 창으로)
// ---------------------------------------------------------------------------

export function PartnerCard({ detail }: { detail: CollaborationDetail }) {
  const [open, setOpen] = useState(false);
  const partner = detail.collaboration.partner;
  const rows = agreementRows(detail, true);

  return (
    <section className="rounded-card bg-card p-5 shadow-card">
      <div className="flex items-center gap-3">
        <Avatar src={photoOrDefault(partner.user_photo, partner.role)} size={44} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold">{partner.nickname}</p>
          <p className="truncate text-xs text-muted">{[ROLE_LABELS[partner.role], personLine(partner)].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      {partner.introduce && <p className="mt-3 rounded-button bg-page px-3 py-2 text-[13px] text-muted">{partner.introduce}</p>}

      <div className="my-4 h-px bg-line" />
      <p className="text-xs font-bold text-faint">합의 내용</p>
      <dl className="mt-2.5 grid grid-cols-[60px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13px]">
        {rows.map(([label, value]) => (
          <Row key={label} label={label}>
            {value}
          </Row>
        ))}
      </dl>
      <button type="button" onClick={() => setOpen(true)} className="mt-3 text-[12px] font-semibold text-brand hover:underline">
        합의 내용 전체 보기
      </button>
      {open && <AgreementModal detail={detail} onClose={() => setOpen(false)} />}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-ink/90">{children}</dd>
    </>
  );
}

/** 합의 내용을 [이름, 값] 줄로. short=true 면 오른쪽 칸 요약용 (자주 보는 것만) */
function agreementRows({ agreement: a }: CollaborationDetail, short: boolean): [string, ReactNode][] {
  const join = (values: string[]) => values.filter(Boolean).join(", ") || "-";
  const share = a.share_policy ? SHARE_LABELS[a.share_policy] : null;
  const data =
    share && a.share_policy === "conditional" ? (
      <span>
        <b className="font-semibold text-editorial-warning">🔒 {share.title}</b>
        {a.share_condition ? ` · ${a.share_condition}` : ""}
      </span>
    ) : (
      share?.title ?? "-"
    );
  const meeting = [a.meeting_type ? MEETING_LABELS[a.meeting_type] : "", a.face_to_area ?? ""].filter(Boolean).join(" · ") || "-";
  const works = a.task_unsure ? "아직 정하지 않음 (같이 정해요)" : join((a.able_work_ids ?? []).map(ableWorkName));

  const rows: [string, ReactNode][] = [
    ["맡길 일", works],
    ["결과물", join((a.outputs ?? []).map((code) => OUTPUT_LABELS[code]))],
    ["데이터", data],
    ["미팅", meeting],
    ["보상", join((a.rewards ?? []).map((code) => REWARD_LABELS[code]))],
  ];
  if (short) return rows;
  return [
    ["연구 설명", <span key="d" className="whitespace-pre-line">{a.description || "-"}</span>],
    ["분야", join((a.field_ids ?? []).map(fieldName))],
    ...rows,
    ["데이터 종류", join((a.data_types ?? []).map((code) => DATA_TYPE_LABELS[code]))],
    ["데이터 상태", a.data_status ? DATA_STATUS_LABELS[a.data_status] : "-"],
  ];
}

function AgreementModal({ detail, onClose }: { detail: CollaborationDetail; onClose: () => void }) {
  const { agreement: a, collaboration: collab } = detail;
  const researcher = collab.my_side === "researcher" ? collab.me : collab.partner;
  const expert = collab.my_side === "expert" ? collab.me : collab.partner;
  return (
    <Modal
      title="합의 내용"
      description="협업을 확정할 때 두 사람이 확인한 내용이에요. 연구 글을 나중에 고쳐도 여기는 바뀌지 않아요."
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="h-11 rounded-button border border-line px-5 text-sm font-semibold text-muted hover:bg-page">
            닫기
          </button>
        </div>
      }
    >
      <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-[100px_minmax(0,1fr)]">
        {agreementRows(detail, false).map(([label, value]) => (
          <Row key={label} label={label}>
            {value}
          </Row>
        ))}
        {a.message && (
          <Row label="요청할 때">
            <Quote text={a.message} who={researcher.nickname} />
          </Row>
        )}
        {a.reply_message && (
          <Row label="수락할 때">
            <Quote text={a.reply_message} who={expert.nickname} />
          </Row>
        )}
      </dl>
    </Modal>
  );
}

function Quote({ text, who }: { text: string; who: string }) {
  return (
    <span className="block rounded-button bg-page px-3 py-2">
      <span className="whitespace-pre-line">{text}</span>
      <span className="mt-1 block text-[11px] text-faint">{who}</span>
    </span>
  );
}