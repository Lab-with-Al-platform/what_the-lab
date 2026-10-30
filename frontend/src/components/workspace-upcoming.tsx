"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { addDays } from "@/lib/collab-requests";
import { Collaboration, dayLabel, KIND_LABELS, Schedule, taskDay, toneOf, WorkspaceTask } from "@/lib/workspace";

const RANGE_DAYS = 14; // 오늘부터 2주

type Row = { date: string; schedule?: Schedule; task?: WorkspaceTask };

/**
 * 오른쪽: 오늘부터 2주 안의 일정 + 열린 요청.
 * 작업 기간은 끝나는 날에 "○○ 끝"으로, 요청은 기한 날에 (기한이 없거나 지났으면 오늘에) 보여요.
 */
export function UpcomingList({
  collabs,
  schedules,
  tasks,
  today,
  onPick,
}: {
  collabs: Collaboration[];
  schedules: Schedule[];
  tasks: WorkspaceTask[];
  today: string;
  onPick: (schedule: Schedule) => void; // 일정을 누르면 일정 보기 창 (요청은 협업 상세로 이동)
}) {
  const until = addDays(today, RANGE_DAYS);
  const rows: Row[] = [
    ...schedules.map((schedule): Row => ({ date: schedule.kind === "work" ? schedule.end_date : schedule.start_date, schedule })),
    ...tasks.map((task): Row => ({ date: taskDay(task, today), task })),
  ]
    .filter(({ date }) => date >= today && date <= until)
    .sort((a, b) => (a.date + (a.schedule?.start_time ?? "")).localeCompare(b.date + (b.schedule?.start_time ?? "")));
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
          {rows.map(({ date, schedule, task }) => {
            const collabId = (schedule ?? task)!.collaboration_id;
            const body = (
              <Line date={date} today={today} collabTitle={nameOf(collabId)} collabId={collabId}>
                {schedule ? <ScheduleText schedule={schedule} /> : <TaskText task={task!} today={today} />}
              </Line>
            );
            const box = "flex w-full gap-3 rounded-button py-3 text-left";
            return (
              <li key={schedule ? `s${schedule.schedule_id}` : `t${task!.task_id}`} className="border-t border-line first:border-t-0">
                {schedule ? (
                  <button type="button" onClick={() => onPick(schedule)} disabled={schedule.schedule_id < 0} className={`${box} enabled:hover:bg-page`}>
                    {body}
                  </button>
                ) : (
                  <Link href={`/workspace/${collabId}`} className={`${box} hover:bg-page`}>
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** 한 줄: 왼쪽 날짜 칸 + 오른쪽 내용 + 협업 이름 */
function Line({ date, today, collabTitle, collabId, children }: { date: string; today: string; collabTitle: string; collabId: number; children: ReactNode }) {
  const tone = toneOf(collabId);
  const isToday = date === today;
  const [md, weekday] = dayLabel(date).split(" ");
  return (
    <>
      <div className={`w-12 shrink-0 rounded-button py-1.5 text-center ${isToday ? "bg-brand-soft" : "bg-page"}`}>
        <p className={`text-[13px] font-bold ${isToday ? "text-brand" : "text-ink"}`}>{md}</p>
        <p className="text-[11px] text-faint">{isToday ? "오늘" : weekday.replace(/[()]/g, "")}</p>
      </div>
      <div className="min-w-0 flex-1">
        {children}
        <p className={`mt-1 flex items-center gap-1 text-[11px] font-semibold ${tone.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
          <span className="truncate">{collabTitle}</span>
        </p>
      </div>
    </>
  );
}

function ScheduleText({ schedule }: { schedule: Schedule }) {
  return (
    <>
      <p className="text-[13px] font-semibold">
        {schedule.start_time ? `${schedule.start_time} ` : ""}
        {schedule.kind === "work" ? `${schedule.title} 끝` : schedule.title}
      </p>
      <p className="mt-0.5 text-[11px] text-faint">{schedule.place ?? KIND_LABELS[schedule.kind]}</p>
    </>
  );
}

/** 요청: 📌 내용 + (받은/보낸 · 기한 없음/지남) */
function TaskText({ task, today }: { task: WorkspaceTask; today: string }) {
  const late = task.due_date !== null && task.due_date < today;
  return (
    <>
      <p className="truncate text-[13px] font-semibold">📌 {task.content}</p>
      <p className="mt-0.5 text-[11px] text-faint">
        {task.direction === "in" ? <span className="font-semibold text-danger">내가 할 요청</span> : `${task.assignee_nickname} 님에게 보낸 요청`}
        {task.due_date === null && " · 기한 없음"}
        {late && <span className="font-semibold text-danger"> · 기한 지남</span>}
      </p>
    </>
  );
}