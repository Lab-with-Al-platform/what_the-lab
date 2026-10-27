"use client";

import { useState } from "react";
import { coversDay, monthWeeks, Schedule, toneOf } from "@/lib/workspace";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_IN_CELL = 3; // 한 칸에 보여 줄 일정 수 (넘으면 "+n개")
const KIND_ORDER = { work: 0, due: 1, meeting: 2, etc: 3 } as const; // 작업 기간 띠를 위에 두어 줄이 덜 흔들리게

/**
 * 열어 둔 협업들의 일정을 한 달력에. (협업별로 끄고 켜기는 위 "내 협업" 목록에서 해요)
 * openedCount = 열어 둔 협업 수 (0이면 "열면 보여요" 안내)
 */
export function WorkspaceCalendar({ schedules, today, openedCount }: { schedules: Schedule[]; today: string; openedCount: number }) {
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
        {/* TODO(다음 단계): 일정 추가 창 */}
        <button type="button" className="ml-auto h-8 rounded-button bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-hover">
          + 일정 추가
        </button>
      </div>

      {openedCount === 0 ? (
        <p className="mt-4 rounded-button bg-page px-4 py-3 text-[13px] text-muted">🔒 협업 공간을 열면 그 협업의 일정이 이 달력에 보여요.</p>
      ) : (
        !schedules.some((item) => item.schedule_id > 0) && (
          <p className="mt-4 rounded-button bg-page px-4 py-3 text-[13px] text-muted">아직 잡은 일정이 없어요. [+ 일정 추가]로 첫 미팅이나 작업 기간을 넣어 보세요.</p>
        )
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
            />
          ))}
        </div>
      ))}
    </section>
  );
}

function DayCell({ day, index, inMonth, today, items }: { day: string; index: number; inMonth: boolean; today: string; items: Schedule[] }) {
  // 먼저 시작한 띠가 위에 오도록 (종류 → 시작일 → 시간 → 번호 순)
  const sorted = [...items].sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.start_date.localeCompare(b.start_date) ||
      (a.start_time ?? "").localeCompare(b.start_time ?? "") ||
      a.schedule_id - b.schedule_id,
  );
  const visible = sorted.slice(0, MAX_IN_CELL);
  const more = sorted.length - visible.length;
  const numberColor = !inMonth ? "text-line" : index === 0 ? "text-danger" : index === 6 ? "text-researcher" : "text-ink";

  return (
    <div className={`min-h-[84px] min-w-0 py-1 sm:min-h-[108px] ${index > 0 ? "border-l border-line/60" : ""}`}>
      <div className="px-1 sm:px-2">
        {day === today ? (
          <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-brand text-xs font-bold text-white">{Number(day.slice(8))}</span>
        ) : (
          <span className={`inline-block h-6 text-xs leading-6 ${numberColor}`}>{Number(day.slice(8))}</span>
        )}
      </div>
      <div className="mt-0.5 space-y-0.5">
        {visible.map((item) => (
          <Chip key={item.schedule_id} item={item} day={day} weekStart={index === 0} weekEnd={index === 6} />
        ))}
        {more > 0 && <p className="px-1 text-[10px] font-semibold text-faint sm:px-2 sm:text-[11px]">+{more}개</p>}
      </div>
    </div>
  );
}

/** 달력 칸 안의 일정 한 줄. 작업 기간은 여러 날에 걸친 띠로 보이게 칸 끝까지 칠해요. */
function Chip({ item, day, weekStart, weekEnd }: { item: Schedule; day: string; weekStart: boolean; weekEnd: boolean }) {
  const tone = toneOf(item.collaboration_id);
  if (item.kind === "work") {
    const first = item.start_date === day;
    const last = item.end_date === day;
    const showTitle = first || weekStart; // 띠 이름은 시작한 날(또는 주의 첫날)에만
    return (
      <div
        title={item.title}
        className={`h-5 truncate px-1.5 text-[11px] font-semibold leading-5 ${tone.soft} ${tone.text} ${first || weekStart ? "ml-1 rounded-l" : ""} ${last || weekEnd ? "mr-1 rounded-r" : ""}`}
      >
        <span className="hidden sm:inline">{showTitle ? item.title : "\u00a0"}</span>
      </div>
    );
  }
  if (item.kind === "due") {
    return (
      <div title={item.title} className={`mx-1 flex h-5 items-center gap-1 truncate rounded border bg-card px-1 text-[11px] font-semibold ${tone.border} ${tone.text}`}>
        <span aria-hidden="true">⚑</span>
        <span className="hidden truncate sm:inline">{item.title}</span>
      </div>
    );
  }
  return (
    <div title={`${item.start_time ?? ""} ${item.title}`} className="mx-1 flex h-5 items-center gap-1 truncate text-[11px] text-ink">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
      <span className="hidden truncate sm:inline">
        {item.start_time ? `${item.start_time} ` : ""}
        {item.title}
      </span>
    </div>
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
    </div>
  );
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="grid h-8 w-8 place-items-center rounded-button border border-line text-lg text-muted hover:bg-page">
      {children}
    </button>
  );
}