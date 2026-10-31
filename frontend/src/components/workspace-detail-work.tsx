"use client";

import { useState } from "react";
import {
  addTask,
  cancelTask,
  changeTaskDue,
  CollabDecision,
  CollabTask,
  CollaborationDetail,
  completeTask,
  dayText,
  dueText,
  eventText,
  eventTime,
  keepTaskDue,
  reopenTask,
  returnTask,
  talkTaskDue,
  TASK_LIMIT,
  TASK_NOTE_LIMIT,
  TaskEvent,
} from "@/lib/workspace-detail";
import { FieldTitle, INPUT_CLASS, Modal, ModalActions, useSaving } from "@/components/modal";

type Filter = "all" | "in" | "out" | "done";

// 줄 오른쪽 끝 띠의 색: 받은(주황) · 보낸(보라) · 완료(초록 + ✓)
const EDGE = {
  in: "bg-editorial-warning-soft shadow-[inset_3px_0_0_#f0a13a]",
  out: "bg-brand-soft shadow-[inset_3px_0_0_var(--color-brand)]",
  done: "bg-success-soft text-success shadow-[inset_3px_0_0_var(--color-success)]",
} as const;
const TAB_DOT = { in: "bg-[#f0a13a]", out: "bg-brand", done: "bg-success" } as const;

// ---------------------------------------------------------------------------
// 요청: [전체 · 받은 · 보낸 · 완료]. 줄은 흰색, 오른쪽 끝 띠 색으로 상태를 보여요. 취소한 요청은 목록에서 빠져요
// ---------------------------------------------------------------------------

export function TasksCard({
  detail,
  editable,
  onChange,
}: {
  detail: CollaborationDetail;
  editable: boolean; // 끝난 협업이면 보기만
  onChange: (next: CollaborationDetail) => void; // 저장한 뒤 받은 최신 상세
}) {
  const { tasks, collaboration: collab } = detail;
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  // 진행 중: 받은 → 보낸, 같은 쪽은 기한 가까운 순 (기한 없음은 뒤) / 완료는 아래에 따로
  const open = tasks
    .filter((task) => task.status === "open")
    .sort((a, b) => Number(a.direction === "out") - Number(b.direction === "out") || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const done = tasks.filter((task) => task.status === "done");
  const counts = {
    in: open.filter((task) => task.direction === "in").length,
    out: open.filter((task) => task.direction === "out").length,
    done: done.length,
  };
  const shownOpen = filter === "all" ? open : filter === "done" ? [] : open.filter((task) => task.direction === filter);
  const shownDone = filter === "all" || filter === "done" ? done : [];
  const item = (task: CollabTask) => <TaskItem key={task.task_id} task={task} today={collab.today} endDate={collab.end_date} editable={editable} onChange={onChange} />;

  return (
    <section className="rounded-card bg-card p-5 shadow-card sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-extrabold">요청</h2>
        <div className="inline-flex gap-0.5 rounded-button bg-page p-1" role="group" aria-label="요청 나눠 보기">
          {(
            [
              ["all", "전체", counts.in + counts.out + counts.done],
              ["in", "받은", counts.in],
              ["out", "보낸", counts.out],
              ["done", "완료", counts.done],
            ] as [Filter, string, number][]
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={`inline-flex h-7 items-center gap-1.5 rounded-[7px] px-3 text-xs font-semibold ${filter === key ? "bg-card text-ink shadow-sm" : "text-muted"}`}
            >
              {key !== "all" && <span className={`h-[7px] w-[7px] rounded-full ${TAB_DOT[key]}`} aria-hidden="true" />}
              {label}
              <span className={filter === key ? "text-ink" : "text-faint"}>{count}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-faint">대화하다 나온 &ldquo;이것 좀 해 주세요&rdquo;를 남겨 두면 위로 찾아 올라가지 않아도 돼요.</p>

      {shownOpen.length + shownDone.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-faint">{EMPTY[filter]}</p>
      ) : (
        <div className="mt-4 grid gap-2.5">
          {shownOpen.map(item)}
          {shownDone.length > 0 && filter === "all" && shownOpen.length > 0 && (
            <p className="mt-1 flex items-center gap-2.5 text-[11.5px] font-semibold text-faint after:h-px after:flex-1 after:bg-line">완료 {shownDone.length}</p>
          )}
          {shownDone.map(item)}
        </div>
      )}

      {editable && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-4 flex w-full items-center gap-2 rounded-card border border-dashed border-line px-4 py-3 text-left text-[13px] text-muted hover:border-brand hover:text-brand"
        >
          ＋ {collab.partner.nickname} 님에게 요청 남기기
        </button>
      )}
      {adding && (
        <TaskDialog
          detail={detail}
          onClose={() => setAdding(false)}
          onSaved={(next) => {
            setAdding(false);
            setFilter("all"); // 방금 남긴 요청이 보이게
            onChange(next);
          }}
        />
      )}
    </section>
  );
}

const EMPTY: Record<Filter, string> = {
  all: "아직 요청이 없어요.",
  in: "받은 요청이 없어요.",
  out: "보낸 요청이 없어요.",
  done: "완료한 요청이 없어요.",
};

/** 요청 한 줄: 흰 바탕 + 오른쪽 끝 띠(받은 주황 · 보낸 보라 · 완료 초록 ✓) */
function TaskItem({
  task,
  today,
  endDate,
  editable,
  onChange,
}: {
  task: CollabTask;
  today: string;
  endDate: string; // 협업 종료일 (기한을 바꿀 수 있는 마지막 날)
  editable: boolean;
  onChange: (next: CollaborationDetail) => void;
}) {
  const [confirming, setConfirming] = useState(false); // [취소] 한 번 더 확인
  const [dialog, setDialog] = useState<"due" | "talk" | "return" | "keep" | null>(null); // 열린 창
  const [showLog, setShowLog] = useState(false); // 기록 펼치기
  const { saving, error, run } = useSaving();
  const isDone = task.status === "done";
  const kind = isDone ? "done" : task.direction;
  const mine = task.direction === "in"; // 내가 받은 요청
  const canComplete = editable && !isDone && mine; // 받은 사람: 완료 · 기한 얘기하기
  const canEdit = editable && !isDone && !mine; // 보낸 사람: 기한 변경 · 취소
  const canReopen = editable && isDone && mine; // 완료는 받은 사람이 되돌려요
  const canReturn = editable && isDone && !mine; // 보낸 사람은 완료된 요청을 다시 요청
  const who = mine ? `${task.requested_by_nickname} → 나` : `나 → ${task.assignee_nickname}`;
  // 마지막으로 일어난 일 (남김 빼고). 위 상자(기한 얘기 · 다시 요청)에 이미 보이면 한 줄은 빼요
  const latest = task.events.filter((event) => event.kind !== "created").at(-1);
  const showLatest = latest && latest.event_id !== task.talk?.event_id && latest.event_id !== task.returned?.event_id;
  const unfinished = task.status === "open" && task.events.some((event) => event.kind === "ended"); // 협업 종료로 마감
  const closeDialog = () => setDialog(null);
  const saved = (next: CollaborationDetail) => {
    setDialog(null);
    onChange(next);
  };

  return (
    <div
      id={`task-${task.task_id}`}
      className="grid min-h-[72px] scroll-mt-24 grid-cols-[minmax(0,1fr)_26px] overflow-hidden rounded-card border border-line bg-card transition-shadow hover:shadow-[0_4px_14px_rgba(16,28,60,0.07)] target:border-brand target:shadow-[0_0_0_3px_rgba(80,54,244,0.18)] sm:grid-cols-[minmax(0,1fr)_auto_26px]"
    >
      <div className="min-w-0 py-3.5 pl-[18px] pr-1">
        <p className={`whitespace-pre-line font-semibold leading-snug ${isDone ? "text-muted" : ""}`}>{task.content}</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          <DueLabel task={task} today={today} />
          <Dot />
          <span>{who}</span>
          <Dot />
          <span>{task.source === "discord" ? "디스코드" : "웹"}</span>
          {unfinished && <span className="rounded bg-page px-1.5 py-px font-semibold text-faint">협업 종료로 마감 · 미완료</span>}
          {task.events.length > 0 && (
            <>
              <Dot />
              <button type="button" onClick={() => setShowLog(!showLog)} aria-expanded={showLog} className="font-semibold text-faint hover:text-brand">
                기록 {task.events.length} {showLog ? "▴" : "▾"}
              </button>
            </>
          )}
        </p>

        {/* 받은 사람이 기한 수정을 요청함 → 보낸 사람이 [기한 변경] 또는 [지금 기한 유지]로 답할 차례 */}
        {task.talk && (
          <div className="mt-2.5 rounded-[9px] bg-editorial-warning-soft px-3 py-2 text-[12.5px] leading-relaxed text-[#8a5a12]">
            <p>
              🗓{" "}
              {mine ? (
                <>기한 수정을 요청했어요{task.talk.new_due ? ` (${dayText(task.talk.new_due)}까지)` : " (지금 기한으로는 어려움)"} · {task.requested_by_nickname} 님 답을 기다려요</>
              ) : (
                <>
                  <b className="text-ink">{task.talk.actor_nickname}</b> 님이{" "}
                  {task.talk.new_due ? (
                    <>
                      <b className="text-ink">{dayText(task.talk.new_due)}</b>까지로 바꿔 달래요
                    </>
                  ) : (
                    "지금 기한으로는 어렵대요"
                  )}
                </>
              )}
              <span className="text-faint"> · {eventTime(task.talk.created_at)}</span>
            </p>
            <p className="mt-0.5 break-words">“{task.talk.note}”</p>
            {canEdit && (
              <p className="mt-1.5 flex flex-wrap gap-3 text-xs font-semibold">
                <button type="button" onClick={() => setDialog("due")} className="text-brand hover:underline" title="요청한 날이 미리 채워져 있어요. 그대로 저장하면 수락이에요">
                  기한 변경
                </button>
                <button type="button" onClick={() => setDialog("keep")} className="text-muted hover:text-ink">
                  지금 기한 유지
                </button>
              </p>
            )}
          </div>
        )}

        {/* 보낸 사람이 다시 요청함 (다시 완료할 때까지) */}
        {task.returned && (
          <div className="mt-2.5 rounded-[9px] bg-danger-soft px-3 py-2 text-[12.5px] leading-relaxed text-danger">
            <p>
              ↩ {mine ? <><b>{task.returned.actor_nickname}</b> 님이 다시 요청했어요</> : "다시 요청했어요"}
              <span className="text-faint"> · {eventTime(task.returned.created_at)}</span>
            </p>
            <p className="mt-0.5 break-words text-ink">“{task.returned.note}”</p>
          </div>
        )}

        {/* 마지막으로 일어난 일 한 줄: 누가 · 무엇을 */}
        {showLatest && !showLog && (
          <p className="mt-1.5 text-[11.5px] text-faint">
            {eventTime(latest.created_at)} · {latest.actor_nickname ? `${latest.actor_nickname} 님` : "자동"} · {eventText(latest)}
          </p>
        )}
        {showLog && <TaskLog events={task.events} />}

        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        {confirming && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-danger">이 요청을 취소할까요?</span>
            <button type="button" onClick={() => setConfirming(false)} disabled={saving} className="h-7 rounded-button border border-line px-2.5 font-semibold text-muted hover:bg-page">
              아니요
            </button>
            <button
              type="button"
              onClick={() => run(async () => onChange(await cancelTask(task.task_id)))}
              disabled={saving}
              className="h-7 rounded-button bg-danger px-2.5 font-semibold text-white disabled:opacity-60"
            >
              {saving ? "취소하는 중…" : "요청 취소"}
            </button>
          </p>
        )}
      </div>

      {/* 버튼: 넓은 화면은 오른쪽, 좁은 화면은 내용 아래 */}
      <div className="col-start-1 row-start-2 flex items-center gap-3 px-[18px] pb-3 empty:hidden sm:col-start-2 sm:row-start-1 sm:px-4 sm:pb-0">
        {canComplete && (
          <>
            <button
              type="button"
              onClick={() => run(async () => onChange(await completeTask(task.task_id)))}
              disabled={saving}
              className="text-xs font-semibold text-faint hover:text-success disabled:opacity-50"
            >
              {saving ? "완료하는 중…" : "완료"}
            </button>
            <button type="button" onClick={() => setDialog("talk")} className="text-xs font-semibold text-faint hover:text-brand">
              기한 얘기하기
            </button>
          </>
        )}
        {canEdit && !confirming && (
          <>
            <button type="button" onClick={() => setDialog("due")} className="text-xs font-semibold text-faint hover:text-brand">
              기한 변경
            </button>
            <button type="button" onClick={() => setConfirming(true)} className="text-xs font-semibold text-faint hover:text-danger">
              취소
            </button>
          </>
        )}
        {canReopen && (
          <button
            type="button"
            onClick={() => run(async () => onChange(await reopenTask(task.task_id)))}
            disabled={saving}
            title="완료를 잘못 눌렀다면 다시 진행 중으로"
            className="text-xs font-semibold text-faint hover:text-brand disabled:opacity-50"
          >
            {saving ? "되돌리는 중…" : "↩ 되돌리기"}
          </button>
        )}
        {canReturn && (
          <button type="button" onClick={() => setDialog("return")} className="text-xs font-semibold text-faint hover:text-danger">
            다시 요청
          </button>
        )}
      </div>

      {/* 오른쪽 끝 띠: 색으로 상태, 완료만 ✓ */}
      <span
        className={`col-start-2 row-span-2 row-start-1 flex items-center justify-center sm:col-start-3 sm:row-span-1 ${EDGE[kind]}`}
        title={{ in: "받은 요청", out: "보낸 요청", done: "완료" }[kind]}
      >
        {isDone && (
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m3 8.5 3 3 7-7" />
          </svg>
        )}
      </span>

      {dialog === "due" && (
        <DueDialog task={task} today={today} endDate={endDate} asked={task.talk} onClose={closeDialog} onSaved={saved} />
      )}
      {dialog === "keep" && <KeepDialog task={task} onClose={closeDialog} onSaved={saved} />}
      {dialog === "talk" && <TalkDialog task={task} today={today} endDate={endDate} onClose={closeDialog} onSaved={saved} />}
      {dialog === "return" && <ReturnDialog task={task} today={today} endDate={endDate} onClose={closeDialog} onSaved={saved} />}
    </div>
  );
}

/** 요청 기록 (오래된 것부터): "10.31 14:05 · 김연구 · 기한 변경 11.9 → 11.14 · 디스코드" + 이유 */
function TaskLog({ events }: { events: TaskEvent[] }) {
  return (
    <ol className="mt-2.5 space-y-1.5 border-l-2 border-line pl-3 text-[11.5px] leading-relaxed">
      {events.map((event) => (
        <li key={event.event_id}>
          <span className="text-faint">{eventTime(event.created_at)}</span>
          <span className="text-muted"> · {event.actor_nickname ? `${event.actor_nickname} 님` : "자동"} · </span>
          <span className="font-semibold text-ink">{eventText(event)}</span>
          <span className="text-faint"> · {event.source === "discord" ? "디스코드" : "웹"}</span>
          {event.note && <span className="block break-words text-muted">“{event.note}”</span>}
        </li>
      ))}
    </ol>
  );
}

/** 기한 글자: "~11.6 · D-6" (2일 이내 · 지남은 빨강) / "기한 없음" / 완료면 "11.8 완료" */
function DueLabel({ task, today }: { task: CollabTask; today: string }) {
  if (task.status === "done" && task.closed_at) {
    const day = new Date(task.closed_at);
    return <span className="font-semibold">{`${day.getMonth() + 1}.${day.getDate()} 완료`}</span>;
  }
  if (!task.due_date) return <span className="text-faint">기한 없음</span>;
  const due = dueText(task, today);
  return <span className={`font-bold ${due.soon ? "text-danger" : "text-ink"}`}>{due.text}</span>;
}

function Dot() {
  return <span className="h-[3px] w-[3px] rounded-full bg-[#c6cddd]" aria-hidden="true" />;
}

/**
 * 보낸 사람의 [기한 변경] 창: 오늘 ~ 협업 종료일, 비우면 기한 없음.
 * 기한 수정 요청에 답하는 중이면(asked) 요청한 날을 미리 채워요. 그대로 저장하면 수락, 고치면 다른 날로 바뀌어요.
 */
function DueDialog({
  task,
  today,
  endDate,
  asked,
  onClose,
  onSaved,
}: {
  task: CollabTask;
  today: string;
  endDate: string;
  asked?: TaskEvent | null; // 답을 기다리는 기한 수정 요청
  onClose: () => void;
  onSaved: (next: CollaborationDetail) => void;
}) {
  const [due, setDue] = useState(asked?.new_due ?? task.due_date ?? "");
  const { saving, error, run } = useSaving();
  const dueOk = !due || (due >= today && due <= endDate);

  return (
    <Modal
      title="기한 변경"
      description={`${task.assignee_nickname} 님에게 보낸 요청의 기한을 바꿔요.`}
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          onSave={() => run(async () => onSaved(await changeTaskDue(task.task_id, due || null)))}
          canSave={dueOk && due !== (task.due_date ?? "")}
          saving={saving}
          error={error}
          saveLabel="기한 바꾸기"
        />
      }
    >
      <p className="mb-5 rounded-button bg-page px-4 py-3 text-sm leading-relaxed">
        {task.content}
        <span className="mt-1 block text-xs text-muted">지금 기한: {dayText(task.due_date)}</span>
      </p>
      {asked && (
        <p className="mb-5 rounded-button bg-editorial-warning-soft px-4 py-3 text-[13px] leading-relaxed text-[#8a5a12]">
          🗓 {asked.actor_nickname} 님이 {asked.new_due ? `${dayText(asked.new_due)}까지로 바꿔 달래요.` : "지금 기한으로는 어렵대요."} “{asked.note}”
          <span className="mt-1 block text-xs">
            {asked.new_due ? "요청한 날이 채워져 있어요. 그대로 저장하면 수락이에요." : "새 기한을 골라 주세요."}
          </span>
        </p>
      )}
      <FieldTitle optional htmlFor="task-new-due">
        새 기한
      </FieldTitle>
      <input id="task-new-due" type="date" value={due} min={today} max={endDate} onChange={(event) => setDue(event.target.value)} className={INPUT_CLASS} />
      <p className={`mt-2 text-xs ${dueOk ? "text-muted" : "text-danger"}`}>
        {dueOk ? "오늘부터 협업 종료일까지 고를 수 있어요. 비우면 기한 없음이에요." : "오늘부터 협업 종료일 사이로 골라 주세요."}
      </p>
    </Modal>
  );
}

/** 보낸 사람의 [지금 기한 유지] 창: 기한 수정 요청에 "지금 기한 그대로 갈게요"로 답해요. 이유는 선택 */
function KeepDialog({ task, onClose, onSaved }: { task: CollabTask; onClose: () => void; onSaved: (next: CollaborationDetail) => void }) {
  const [note, setNote] = useState("");
  const { saving, error, run } = useSaving();

  return (
    <Modal
      title="지금 기한 유지"
      description={`${task.assignee_nickname} 님의 기한 수정 요청에 지금 기한(${dayText(task.due_date)}) 그대로 가자고 답해요. 디스코드에서도 알려 드려요.`}
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          onSave={() => run(async () => onSaved(await keepTaskDue(task.task_id, note.trim() || null)))}
          canSave
          saving={saving}
          error={error}
          saveLabel="지금 기한 유지"
        />
      }
    >
      <p className="mb-5 rounded-button bg-page px-4 py-3 text-sm leading-relaxed">{task.content}</p>
      <FieldTitle optional htmlFor="keep-note" extra={`${note.length} / ${TASK_NOTE_LIMIT}`}>
        이유
      </FieldTitle>
      <textarea
        id="keep-note"
        value={note}
        maxLength={TASK_NOTE_LIMIT}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
        autoFocus
        placeholder="예: 11.10 회의 전에 꼭 필요해요"
        className="w-full rounded-button border border-line bg-card px-4 py-3 text-sm outline-none placeholder:text-faint focus:border-brand"
      />
    </Modal>
  );
}

/** 받은 사람의 [기한 얘기하기] 창: 원하는 기한(선택) + 이유(필수). 기한은 바뀌지 않고, 보낸 사람에게 알려요 */
function TalkDialog({
  task,
  today,
  endDate,
  onClose,
  onSaved,
}: {
  task: CollabTask;
  today: string;
  endDate: string;
  onClose: () => void;
  onSaved: (next: CollaborationDetail) => void;
}) {
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const { saving, error, run } = useSaving();
  const dueOk = !due || (due >= today && due <= endDate);

  return (
    <Modal
      title="기한 얘기하기"
      description={`${task.requested_by_nickname} 님에게 기한 수정을 요청해요. 보낸 사람이 [기한 변경] 또는 [지금 기한 유지]로 답해요. 디스코드에서도 알려 드려요.`}
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          onSave={() => run(async () => onSaved(await talkTaskDue(task.task_id, { due_date: due || null, note: note.trim() })))}
          canSave={dueOk && Boolean(note.trim())}
          saving={saving}
          error={error}
          saveLabel="보내기"
        />
      }
    >
      <p className="mb-5 rounded-button bg-page px-4 py-3 text-sm leading-relaxed">
        {task.content}
        <span className="mt-1 block text-xs text-muted">지금 기한: {dayText(task.due_date)}</span>
      </p>
      <div className="space-y-6">
        <div>
          <FieldTitle optional htmlFor="talk-due">
            원하는 기한
          </FieldTitle>
          <input id="talk-due" type="date" value={due} min={today} max={endDate} onChange={(event) => setDue(event.target.value)} className={INPUT_CLASS} />
          <p className={`mt-2 text-xs ${dueOk ? "text-muted" : "text-danger"}`}>
            {dueOk ? "비우면 \"지금 기한으로는 어려워요\"로 보내져요." : "오늘부터 협업 종료일 사이로 골라 주세요."}
          </p>
        </div>
        <div>
          <FieldTitle required htmlFor="talk-note" extra={`${note.length} / ${TASK_NOTE_LIMIT}`}>
            이유
          </FieldTitle>
          <textarea
            id="talk-note"
            value={note}
            maxLength={TASK_NOTE_LIMIT}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="예: 샘플 사진까지 같이 보려면 시간이 더 필요해요"
            className="w-full rounded-button border border-line bg-card px-4 py-3 text-sm outline-none placeholder:text-faint focus:border-brand"
          />
        </div>
      </div>
    </Modal>
  );
}

/** 보낸 사람의 [다시 요청] 창: 부족한 점(필수) + 새 기한(선택, 비우면 원래 기한. 원래 기한이 지났으면 필수) */
function ReturnDialog({
  task,
  today,
  endDate,
  onClose,
  onSaved,
}: {
  task: CollabTask;
  today: string;
  endDate: string;
  onClose: () => void;
  onSaved: (next: CollaborationDetail) => void;
}) {
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const { saving, error, run } = useSaving();
  const pastDue = Boolean(task.due_date && task.due_date < today); // 원래 기한이 지났으면 새 기한 필수
  const dueOk = due ? due >= today && due <= endDate : !pastDue;

  return (
    <Modal
      title="다시 요청"
      description={`완료된 요청을 다시 진행 중으로 돌려요. ${task.assignee_nickname} 님에게 디스코드로도 알려 드려요.`}
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          onSave={() => run(async () => onSaved(await returnTask(task.task_id, { note: note.trim(), due_date: due || null })))}
          canSave={dueOk && Boolean(note.trim())}
          saving={saving}
          error={error}
          saveLabel="다시 요청"
        />
      }
    >
      <p className="mb-5 rounded-button bg-page px-4 py-3 text-sm leading-relaxed">{task.content}</p>
      <div className="space-y-6">
        <div>
          <FieldTitle required htmlFor="return-note" extra={`${note.length} / ${TASK_NOTE_LIMIT}`}>
            무엇이 부족한가요
          </FieldTitle>
          <textarea
            id="return-note"
            value={note}
            maxLength={TASK_NOTE_LIMIT}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            autoFocus
            placeholder="예: 날짜 칸 형식이 아직 섞여 있어요"
            className="w-full rounded-button border border-line bg-card px-4 py-3 text-sm outline-none placeholder:text-faint focus:border-brand"
          />
        </div>
        <div>
          {pastDue ? (
            <FieldTitle required htmlFor="return-due">
              새 기한
            </FieldTitle>
          ) : (
            <FieldTitle optional htmlFor="return-due">
              새 기한
            </FieldTitle>
          )}
          <input id="return-due" type="date" value={due} min={today} max={endDate} onChange={(event) => setDue(event.target.value)} className={INPUT_CLASS} />
          <p className={`mt-2 text-xs ${dueOk ? "text-muted" : "text-danger"}`}>
            {pastDue
              ? `원래 기한(${dayText(task.due_date)})이 지났어요. 오늘부터 협업 종료일 사이로 새 기한을 정해 주세요.`
              : `비우면 원래 기한(${dayText(task.due_date)}) 그대로예요.`}
          </p>
        </div>
      </div>
    </Modal>
  );
}

/** [＋ 요청 남기기] 창: 내용(필수) + 기한(선택, 오늘 ~ 협업 종료일) */
function TaskDialog({
  detail,
  onClose,
  onSaved,
}: {
  detail: CollaborationDetail;
  onClose: () => void;
  onSaved: (next: CollaborationDetail) => void;
}) {
  const { collaboration: collab } = detail;
  const [content, setContent] = useState("");
  const [due, setDue] = useState("");
  const { saving, error, run } = useSaving();
  const dueOk = !due || (due >= collab.today && due <= collab.end_date);
  const canSave = Boolean(content.trim()) && dueOk;

  function save() {
    run(async () => onSaved(await addTask(collab.collaboration_id, { content: content.trim(), due_date: due || null })));
  }

  return (
    <Modal
      title="요청 남기기"
      description={`${collab.partner.nickname} 님에게 맡길 일을 남겨요. 받은 사람이 [완료]를 누르면 끝나요.`}
      onClose={onClose}
      footer={<ModalActions onCancel={onClose} onSave={save} canSave={canSave} saving={saving} error={error} saveLabel="요청 남기기" />}
    >
      <div className="space-y-6">
        <div>
          <FieldTitle required htmlFor="task-content" extra={`${content.length} / ${TASK_LIMIT}`}>
            요청 내용
          </FieldTitle>
          <textarea
            id="task-content"
            value={content}
            maxLength={TASK_LIMIT}
            onChange={(event) => setContent(event.target.value)}
            rows={4}
            autoFocus
            placeholder="예: 1차 모델 결과를 정확도·F1 표로 정리해 주세요"
            className="w-full rounded-button border border-line bg-card px-4 py-3 text-sm outline-none placeholder:text-faint focus:border-brand"
          />
        </div>
        <div>
          <FieldTitle optional htmlFor="task-due">
            기한
          </FieldTitle>
          <input id="task-due" type="date" value={due} min={collab.today} max={collab.end_date} onChange={(event) => setDue(event.target.value)} className={INPUT_CLASS} />
          <p className={`mt-2 text-xs ${dueOk ? "text-muted" : "text-danger"}`}>
            {dueOk ? "기한을 정하면 다가오는 일정에도 보여요. 오늘부터 협업 종료일까지 고를 수 있어요." : "오늘부터 협업 종료일 사이로 골라 주세요."}
          </p>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// 정한 것: 동의 기다림 → 확정 (최근 것부터 번호). 바뀐 결정은 접어 두고, 거절·철회는 보이지 않아요
// 지금은 화면에서 숨겨 둬요. 디스코드 명령어를 붙일 때 다시 넣어요
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