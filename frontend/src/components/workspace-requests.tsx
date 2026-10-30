"use client";

import Link from "next/link";
import { daysBetween } from "@/lib/collab-requests";
import { Collaboration, toneOf, WorkspaceTask } from "@/lib/workspace";

const SHOWN = 5; // 최신 5개까지

/**
 * 오른쪽: 진행 중 협업들의 열린 요청, 최신순 5개.
 * 내가 받은 요청은 "내가 할 일"(빨강), 보낸 요청은 "○○ 님에게". 누르면 그 협업 상세로 가요.
 */
export function RequestList({ collabs, tasks, today }: { collabs: Collaboration[]; tasks: WorkspaceTask[]; today: string }) {
  const latest = [...tasks].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, SHOWN);
  const mine = tasks.filter((task) => task.direction === "in").length;
  const titleOf = (id: number) => collabs.find((item) => item.collaboration_id === id)?.research.title ?? "";

  return (
    <section className="rounded-card border border-line bg-card p-5 shadow-card">
      <h2 className="flex items-center text-[15px] font-bold">
        요청
        {tasks.length > 0 && <span className="ml-1 text-brand">{tasks.length}</span>}
        {mine > 0 && <span className="ml-auto rounded bg-danger-soft px-1.5 py-px text-[11px] font-bold text-danger">내가 할 일 {mine}</span>}
      </h2>
      {latest.length === 0 ? (
        <p className="mt-4 text-sm text-faint">진행 중인 요청이 없어요. 디스코드에서 /요청 으로 남길 수 있어요</p>
      ) : (
        <ul className="mt-2">
          {latest.map((task) => {
            const tone = toneOf(task.collaboration_id);
            return (
              <li key={task.task_id} className="border-t border-line first:border-t-0">
                <Link href={`/workspace/${task.collaboration_id}`} className="block rounded-button py-3 hover:bg-page">
                  <p className="flex items-start gap-1.5 text-[13px] font-semibold leading-snug">
                    <span aria-hidden="true">📌</span>
                    <span className="line-clamp-2 min-w-0">{task.content}</span>
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted">
                    {task.direction === "in" ? (
                      <span className="font-semibold text-danger">{task.requested_by_nickname} → 나</span>
                    ) : (
                      <span>나 → {task.assignee_nickname}</span>
                    )}
                    <span className="text-faint">·</span>
                    <DueText due={task.due_date} today={today} />
                  </p>
                  <p className={`mt-1 flex items-center gap-1 text-[11px] font-semibold ${tone.text}`}>
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
                    <span className="truncate">{titleOf(task.collaboration_id)}</span>
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {tasks.length > SHOWN && <p className="mt-1 text-[11px] text-faint">최신 {SHOWN}개만 보여요. 나머지는 각 협업 상세에서 볼 수 있어요</p>}
    </section>
  );
}

/** 기한: "기한 없음" / "~11.10 · D-3" / "오늘까지" / "2일 지남"(빨강) */
function DueText({ due, today }: { due: string | null; today: string }) {
  if (!due) return <span className="text-faint">기한 없음</span>;
  const [, month, day] = due.split("-").map(Number);
  const left = daysBetween(today, due);
  if (left < 0) return <span className="font-semibold text-danger">~{month}.{day} · {-left}일 지남</span>;
  return <span className={left <= 2 ? "font-semibold text-danger" : ""}>~{month}.{day} · {left === 0 ? "오늘까지" : `D-${left}`}</span>;
}