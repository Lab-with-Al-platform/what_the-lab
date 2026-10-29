"use client";

import { useState } from "react";
import { CollabDecision, CollabTask, CollaborationDetail, dueText } from "@/lib/workspace-detail";

type Filter = "in" | "out" | "done";

// ---------------------------------------------------------------------------
// 요청: [받은 · 보낸 · 끝난] 으로 나눠 보여요. (남기기·완료 버튼은 다음 단계에서 붙여요)
// ---------------------------------------------------------------------------

export function TasksCard({ detail }: { detail: CollaborationDetail }) {
  const { tasks, collaboration: collab } = detail;
  const open = tasks.filter((task) => task.status === "open");
  const counts = {
    in: open.filter((task) => task.direction === "in").length,
    out: open.filter((task) => task.direction === "out").length,
    done: tasks.length - open.length,
  };
  // 처음 보이는 칸: 받은 요청이 있으면 받은, 없고 보낸 게 있으면 보낸
  const [filter, setFilter] = useState<Filter>(counts.in || !counts.out ? "in" : "out");
  const shown = filter === "done" ? tasks.filter((task) => task.status !== "open") : open.filter((task) => task.direction === filter);

  return (
    <section className="rounded-card bg-card p-5 shadow-card sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-extrabold">요청</h2>
        <div className="inline-flex gap-0.5 rounded-button bg-page p-1" role="group" aria-label="요청 나눠 보기">
          {(
            [
              ["in", "받은"],
              ["out", "보낸"],
              ["done", "끝난"],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={`h-7 rounded-[7px] px-3 text-xs font-semibold ${filter === key ? "bg-card text-ink shadow-sm" : "text-muted"}`}
            >
              {label}
              {counts[key] > 0 && <span className={`ml-1 ${filter === key ? "text-brand" : "text-faint"}`}>{counts[key]}</span>}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-faint">대화하다 나온 &ldquo;이것 좀 해 주세요&rdquo;를 남겨 두면 위로 찾아 올라가지 않아도 돼요.</p>

      {shown.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-faint">{EMPTY[filter]}</p>
      ) : (
        <ul className="mt-3">
          {shown.map((task) => (
            <TaskItem key={task.task_id} task={task} today={collab.today} />
          ))}
        </ul>
      )}
    </section>
  );
}

const EMPTY: Record<Filter, string> = {
  in: "받은 요청이 없어요.",
  out: "보낸 요청이 없어요.",
  done: "끝난 요청이 없어요.",
};

function TaskItem({ task, today }: { task: CollabTask; today: string }) {
  const due = dueText(task, today);
  const closed = task.status !== "open";
  const who = task.direction === "in" ? `${task.requested_by_nickname} → 나` : `나 → ${task.assignee_nickname}`;
  return (
    <li className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-x-3 border-t border-line py-3.5 first:border-t-0 first:pt-1">
      <span
        className={`mt-0.5 grid h-[22px] w-[22px] place-items-center rounded-full border-2 text-[11px] ${
          task.status === "done" ? "border-success bg-success text-white" : task.direction === "out" ? "border-dashed border-line" : "border-line"
        }`}
        aria-hidden="true"
      >
        {task.status === "done" ? "✓" : ""}
      </span>
      <div className="min-w-0">
        <p className={`font-semibold leading-snug ${closed ? "text-muted line-through decoration-faint" : ""}`}>{task.content}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
          <span>{who}</span>
          <span className="text-faint">·</span>
          <span className="text-faint">{task.source === "discord" ? "디스코드" : "웹"}</span>
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 text-right">
        <span className={`whitespace-nowrap text-xs font-bold ${due.soon ? "text-danger" : task.due_date ? "text-muted" : "font-medium text-faint"}`}>{due.text}</span>
        {task.status === "canceled" && <span className="text-[11px] text-faint">취소됨</span>}
        {task.status === "open" && task.direction === "out" && <span className="rounded bg-brand-soft px-1.5 py-px text-[11px] font-semibold text-brand">상대 진행 중</span>}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// 정한 것: 동의 기다림 → 확정 (최근 것부터 번호). 바뀐 결정은 접어 두고, 거절·철회는 보이지 않아요
// ---------------------------------------------------------------------------

export function DecisionsCard({ detail }: { detail: CollaborationDetail }) {
  const [showReplaced, setShowReplaced] = useState(false);
  const { decisions } = detail;
  const pending = decisions.filter((item) => item.status === "proposed");
  const agreed = decisions.filter((item) => item.status === "agreed");
  const replaced = decisions.filter((item) => item.status === "replaced");
  const byId = new Map(decisions.map((item) => [item.decision_id, item]));
  // 번호: 이 협업에서 몇 번째로 올라온 결정인지 (오래된 것이 1번)
  const numbers = new Map([...decisions].sort((a, b) => a.decision_id - b.decision_id).map((item, index) => [item.decision_id, index + 1]));

  return (
    <section className="rounded-card bg-card p-5 shadow-card sm:px-6">
      <h2 className="text-base font-extrabold">
        정한 것{agreed.length > 0 && <span className="ml-1 text-faint">{agreed.length}</span>}
      </h2>
      <p className="mt-1 text-xs text-faint">한 사람이 제안하고 상대가 동의하면 확정돼요. 나중에 &ldquo;그때 뭐라고 정했지?&rdquo; 할 때 여기서 찾아요.</p>

      {pending.length + agreed.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-faint">아직 정한 것이 없어요.</p>
      ) : (
        <ol className="mt-3 grid gap-2">
          {[...pending, ...agreed].map((item) => (
            <DecisionItem key={item.decision_id} item={item} no={numbers.get(item.decision_id) ?? 0} replaced={item.replaces_id ? byId.get(item.replaces_id) : undefined} />
          ))}
        </ol>
      )}

      {replaced.length > 0 && (
        <div className="mt-2">
          <button type="button" onClick={() => setShowReplaced((value) => !value)} className="text-[12px] font-semibold text-brand hover:underline">
            {showReplaced ? "바뀐 결정 접기" : `바뀐 결정 ${replaced.length}개 보기`}
          </button>
          {showReplaced && (
            <ol className="mt-2 grid gap-2">
              {replaced.map((item) => (
                <DecisionItem key={item.decision_id} item={item} no={numbers.get(item.decision_id) ?? 0} />
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}

function DecisionItem({ item, no, replaced }: { item: CollabDecision; no: number; replaced?: CollabDecision }) {
  const pending = item.status === "proposed";
  const old = item.status === "replaced";
  return (
    <li
      className={`grid grid-cols-[26px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-0.5 rounded-button border px-3.5 py-3 ${
        pending ? "border-brand/30 bg-brand-soft" : "border-line"
      }`}
    >
      <span className={`pt-0.5 text-xs font-extrabold tabular-nums ${pending ? "text-brand" : "text-faint"}`}>{String(no).padStart(2, "0")}</span>
      <p className={`font-semibold leading-snug ${old ? "text-faint line-through" : ""}`}>{item.content}</p>
      <span className={`whitespace-nowrap text-xs font-semibold ${pending ? "text-brand" : old ? "text-faint" : "text-success"}`}>
        {pending ? (item.mine ? "상대 동의 기다림" : "내 동의 기다림") : old ? "↺ 바뀜" : "✓ 두 사람 동의"}
      </span>
      <p className="col-start-2 text-xs text-muted">
        {item.mine ? "내가" : `${item.proposed_by_nickname} 님이`} 제안 · {shortDate(item.created_at)}
        {item.answered_at && !pending ? ` · ${shortDate(item.answered_at)} 확정` : ""}
        {replaced ? (
          <>
            {" "}
            · <s className="text-faint">{replaced.content}</s>에서 바뀜
          </>
        ) : null}
      </p>
    </li>
  );
}

/** ISO 시각 → "10.20" */
function shortDate(iso: string): string {
  const day = new Date(iso);
  return `${day.getMonth() + 1}.${day.getDate()}`;
}