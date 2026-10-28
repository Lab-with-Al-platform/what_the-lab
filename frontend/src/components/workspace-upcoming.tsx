"use client";

import { addDays } from "@/lib/collab-requests";
import { Collaboration, dayLabel, KIND_LABELS, Schedule, toneOf } from "@/lib/workspace";

const RANGE_DAYS = 14; // 오늘부터 2주

/** 오른쪽: 오늘부터 2주 안의 일정. 작업 기간은 끝나는 날에 "○○ 끝"으로 보여요. */
export function UpcomingList({
  collabs,
  schedules,
  today,
  onPick,
}: {
  collabs: Collaboration[];
  schedules: Schedule[];
  today: string;
  onPick: (schedule: Schedule) => void; // 누르면 일정 보기 창
}) {
  const until = addDays(today, RANGE_DAYS);
  const rows = schedules
    .map((item) => ({ item, date: item.kind === "work" ? item.end_date : item.start_date }))
    .filter(({ date }) => date >= today && date <= until)
    .sort((a, b) => (a.date + (a.item.start_time ?? "")).localeCompare(b.date + (b.item.start_time ?? "")));
  const nameOf = (id: number) => {
    const collab = collabs.find((item) => item.collaboration_id === id);
    return collab ? `${collab.research.title.slice(0, 10)}… · ${collab.partner.nickname}` : "";
  };

  return (
    <section className="rounded-card border border-line bg-card p-5 shadow-card">
      <h2 className="flex items-center text-[15px] font-bold">
        다가오는 일정
        <span className="ml-auto text-[11px] font-normal text-faint">2주</span>
      </h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-faint">2주 안에 잡힌 일정이 없어요</p>
      ) : (
        <ul className="mt-2">
          {rows.map(({ item, date }) => {
            const tone = toneOf(item.collaboration_id);
            const isToday = date === today;
            const [md, weekday] = dayLabel(date).split(" ");
            return (
              <li key={item.schedule_id} className="border-t border-line first:border-t-0">
                <button
                  type="button"
                  onClick={() => onPick(item)}
                  disabled={item.schedule_id < 0}
                  className="flex w-full gap-3 rounded-button py-3 text-left enabled:hover:bg-page"
                >
                  <div className={`w-12 shrink-0 rounded-button py-1.5 text-center ${isToday ? "bg-brand-soft" : "bg-page"}`}>
                    <p className={`text-[13px] font-bold ${isToday ? "text-brand" : "text-ink"}`}>{md}</p>
                    <p className="text-[11px] text-faint">{isToday ? "오늘" : weekday.replace(/[()]/g, "")}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">
                      {item.start_time ? `${item.start_time} ` : ""}
                      {item.kind === "work" ? `${item.title} 끝` : item.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-faint">{item.place ?? KIND_LABELS[item.kind]}</p>
                    <p className={`mt-1 flex items-center gap-1 text-[11px] font-semibold ${tone.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                      <span className="truncate">{nameOf(item.collaboration_id)}</span>
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}