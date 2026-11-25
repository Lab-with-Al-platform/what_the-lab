"use client";

import Link from "next/link";
import { KeyboardEvent, useState } from "react";
import { coversDay, isPast, monthWeeks, Schedule, taskDay, toneOf, WorkspaceTask } from "@/lib/workspace";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_IN_CELL = 3; // 한 칸에 보여 줄 일정 수 (넘으면 "+n개")
const KIND_ORDER = { work: 0, due: 1, meeting: 2, etc: 3 } as const; // 작업 기간 띠를 위에 두어 줄이 덜 흔들리게

/**
 * 진행 중 협업들의 일정을 한 달력에. (협업별로 끄고 켜기는 위 "내 협업" 목록에서 해요)
 * 열린 요청은 기한 날에 📌 로 (기한이 없거나 지났으면 오늘 칸). 누르면 그 협업 상세로 가요. 
 * onAdd(날짜?) = 일정 추가 창 열기 (날짜 숫자를 누르면 그 날짜로) / onPick(일정) = 일정 보기 창
 * googleUrl = 있으면 [구글 캘린더] 버튼 (구글에 추가해 둔 협업이 하나라도 있을 때)
 */
export function WorkspaceCalendar({
  schedules,
  tasks,
  today,
  onAdd,
  onPick,
  googleUrl,
  canAdd = true,
}: {
  schedules: Schedule[];
  tasks: WorkspaceTask[];
  today: string;
  onAdd: (date?: string) => void;
  onPick: (schedule: Schedule) => void;
  googleUrl?: string;
  canAdd?: boolean; // false 면 [+ 일정 추가]를 잠가요 (시작 전 협업만 있을 때)
}) {
  const thisMonth = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
  const [month, setMonth] = useState(thisMonth);
  const weeks = monthWeeks(month.year, month.month);

  function move(step: number) {
    setMonth(({ year, month }) => {
      const next = month + step;
      if (next === 0) return { year: year - 1, month: 12 };
      if (next === 13) return { year: year + 1, month: 1 };
      return { year, month: next };
    });
  }

  return (
    <section className="w-full min-w-0 flex-1 rounded-card border border-line bg-card p-4 shadow-card sm:p-5">
      {/* 위: 달 이동 */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-1 text-lg font-bold sm:text-xl">
          {month.year}년 {month.month}월
        </h2>
        <NavButton label="이전 달" onClick={() => move(-1)}>
          ‹
        </NavButton>
        <button type="button" onClick={() => setMonth(thisMonth)} className="h-8 rounded-button border border-line px-3 text-xs font-semibold text-muted hover:bg-page">
          오늘
        </button>
        <NavButton label="다음 달" onClick={() => move(1)}>
          ›
        </NavButton>
        {googleUrl && (
          <a
            href={googleUrl}
            target="_blank"
            rel="noreferrer"
            title="구글 캘린더에서 추가해 둔 협업 일정을 한 번에 봐요"
            className="ml-auto inline-flex h-8 items-center rounded-button border border-line px-3 text-xs font-semibold text-ink hover:bg-page"
          >
            📅 구글 캘린더
          </a>
        )}
        <button
          type="button"
          disabled={!canAdd}
          title={canAdd ? undefined : "협업이 시작되면 일정을 넣을 수 있어요"}
          onClick={() => onAdd()}
          className={`${googleUrl ? "" : "ml-auto "}h-8 rounded-button bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40`}
        >
          + 일정 추가
        </button>
      </div>

      {!schedules.some((item) => item.schedule_id > 0) && (
        <p className="mt-4 rounded-button bg-page px-4 py-3 text-[13px] text-muted">아직 잡은 일정이 없어요. [+ 일정 추가]나 달력의 날짜를 눌러 첫 미팅을 넣어 보세요.</p>
      )}

      <Legend />

      {/* 달력 */}
      <div className="mt-2 grid grid-cols-7 border-b border-line text-xs">
        {WEEKDAYS.map((day, index) => (
          <div key={day} className={`px-1 py-2 sm:px-2 ${index === 0 ? "text-danger" : index === 6 ? "text-researcher" : "text-muted"}`}>
            {day}
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} className="grid grid-cols-7 border-b border-line last:border-b-0">
          {week.map((day, index) => (
            <DayCell
              key={day}
              day={day}
              index={index}
              inMonth={Number(day.slice(5, 7)) === month.month}
              today={today}
              items={schedules.filter((item) => coversDay(item, day))}
              tasks={tasks.filter((task) => taskDay(task, today) === day)}
              onAdd={(date) => canAdd && onAdd(date)}
              onPick={onPick}
            />
          ))}
        </div>
      ))}
    </section>
  );
}

function DayCell({
  day,
  index,
  inMonth,
  today,
  items,
  tasks,
  onAdd,
  onPick,
}: {
  day: string;
  index: number;
  inMonth: boolean;
  today: string;
  items: Schedule[];
  tasks: WorkspaceTask[]; // 이날 보여 줄 열린 요청
  onAdd: (date: string) => void;
  onPick: (schedule: Schedule) => void;
}) {
  // 먼저 시작한 띠가 위에 오도록 (종류 → 시작일 → 시간 → 번호 순)
  const sorted = [...items].sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.start_date.localeCompare(b.start_date) ||
      (a.start_time ?? "").localeCompare(b.start_time ?? "") ||
      a.schedule_id - b.schedule_id,
  );
  const visible = sorted.slice(0, MAX_IN_CELL);
    // 일정을 먼저, 남는 자리에 요청 (열린 요청을 완료한 요청보다 앞에)
  const orderedTasks = [...tasks].sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
  const shownTasks = orderedTasks.slice(0, Math.max(0, MAX_IN_CELL - visible.length));
  const more = sorted.length - visible.length + tasks.length - shownTasks.length;
  const numberColor = !inMonth ? "text-line" : index === 0 ? "text-danger" : index === 6 ? "text-researcher" : "text-ink";

  return (
    <div className={`min-h-[84px] min-w-0 py-1 sm:min-h-[108px] ${index > 0 ? "border-l border-line/60" : ""}`}>
      {/* 날짜 숫자를 누르면 그 날짜로 일정 추가 */}
      <button type="button" onClick={() => onAdd(day)} title={`${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일에 일정 추가`} className="block px-1 sm:px-2">
        {day === today ? (
          <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-brand text-xs font-bold text-white">{Number(day.slice(8))}</span>
        ) : (
          <span className={`inline-grid h-6 min-w-6 place-items-center rounded-full text-xs hover:bg-page ${numberColor}`}>{Number(day.slice(8))}</span>
        )}
      </button>
      <div className="mt-0.5 space-y-0.5">
        {visible.map((item) => (
          <Chip key={item.schedule_id} item={item} day={day} today={today} weekStart={index === 0} weekEnd={index === 6} onPick={onPick} />
      ))}
        {shownTasks.map((task) => (
          <TaskChip key={`t${task.task_id}`} task={task} today={today} />
        ))}
        {more > 0 && <p className="px-1 text-[10px] font-semibold text-faint sm:px-2 sm:text-[11px]">+{more}개</p>}
      </div>
    </div>
  );
}

/** 달력 칸 안의 일정 한 줄. 작업 기간은 여러 날에 걸친 띠로 보이게 칸 끝까지 칠해요. 누르면 일정 보기 창. 지난 일정은 흐리게. */
function Chip({
  item,
  day,
  today,
  weekStart,
  weekEnd,
  onPick,
}: {
  item: Schedule;
  day: string;
  today: string;
  weekStart: boolean;
  weekEnd: boolean;
  onPick: (schedule: Schedule) => void;
}) {
  const tone = toneOf(item.collaboration_id);
  const faded = isPast(item, today) ? "opacity-40" : ""; // 끝난 날이 오늘 전이면 흐리게
  const clickable = item.schedule_id > 0; // 자동으로 넣은 협업 시작·종료일은 안 열려요
  const press = clickable ? { role: "button", tabIndex: 0, onClick: () => onPick(item), onKeyDown: (event: KeyboardEvent) => event.key === "Enter" && onPick(item) } : {};
  if (item.kind === "work") {
    const first = item.start_date === day;
    const last = item.end_date === day;
    const showTitle = first || weekStart; // 띠 이름은 시작한 날(또는 주의 첫날)에만
    return (
      <div
        {...press}
        title={item.title}
        className={`h-5 truncate px-1.5 ${clickable ? "cursor-pointer" : ""} text-[11px] font-semibold leading-5 ${tone.soft} ${tone.text} ${first || weekStart ? "ml-1 rounded-l" : ""} ${last || weekEnd ? "mr-1 rounded-r" : ""} ${faded}`}
      >
        <span className="hidden sm:inline">{showTitle ? item.title : "\u00a0"}</span>
      </div>
    );
  }
  if (item.kind === "due") {
    return (
      <div
        {...press}
        title={item.title}
        className={`mx-1 flex h-5 items-center gap-1 truncate rounded border bg-card px-1 ${clickable ? "cursor-pointer hover:bg-page" : ""} text-[11px] font-semibold ${tone.border} ${tone.text} ${faded}`}
      >
        <span aria-hidden="true">⚑</span>
        <span className="hidden truncate sm:inline">{item.title}</span>
      </div>
    );
  }
  return (
    <div
      {...press}
      title={`${item.start_time ?? ""} ${item.title}`}
      className={`mx-1 flex h-5 items-center gap-1 truncate rounded text-[11px] text-ink ${clickable ? "cursor-pointer hover:bg-page" : ""} ${faded}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
      <span className="hidden truncate sm:inline">
        {item.start_time ? `${item.start_time} ` : ""}
        {item.title}
      </span>
    </div>
  );
}

/** 달력 칸 안의 요청 한 줄 (📌). 완료한 요청은 ✓ 로 흐리게. 누르면 그 협업 상세의 요청 카드로 가요. */
function TaskChip({ task, today }: { task: WorkspaceTask; today: string }) {
  const tone = toneOf(task.collaboration_id);
  const done = task.status === "done";
  const late = !done && task.due_date !== null && task.due_date < today; // 완료한 요청은 빨갛게 안 해요
  const who = task.direction === "in" ? `${task.requested_by_nickname} → 나` : `나 → ${task.assignee_nickname}`;
  const when = done
    ? `${task.closed_on ?? ""} 완료`
    : task.due_date === null
      ? "기한 없음"
      : late
        ? `기한 ${task.due_date} 지남`
        : `기한 ${task.due_date}`;
  return (
    <Link
      href={`/workspace/${task.collaboration_id}`}
      title={`요청 · ${task.content} (${who} · ${when})`}
      className={`mx-1 flex h-5 items-center gap-1 truncate rounded px-0.5 text-[11px] hover:bg-page ${late ? "text-danger" : tone.text} ${done ? "opacity-40" : ""}`}
    >
      <span aria-hidden="true">{done ? "✓" : "📌"}</span>
      <span className="hidden truncate sm:inline">{task.content}</span>
    </Link>
  );
}

function Legend() {
  return (
    <div className="mt-3 flex justify-end gap-3 text-[11px] text-muted">
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-ink" />
        미팅
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-4 rounded-sm bg-line" />
        작업 기간
      </span>
      <span>⚑ 마감</span>
      <span>📌 요청</span>
      <span>✓ 완료</span>
      <span className="opacity-40">흐림 = 지난 일정 · 완료</span>
    </div>
  );
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-button border border-line text-lg text-muted hover:bg-page"
    >
      {children}
    </button>
  );
}