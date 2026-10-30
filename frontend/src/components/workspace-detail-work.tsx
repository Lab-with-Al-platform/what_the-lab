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
  dueText,
  reopenTask,
  TASK_LIMIT,
} from "@/lib/workspace-detail";
import { FieldTitle, INPUT_CLASS, Modal, ModalActions, useSaving } from "@/components/modal";

type Filter = "in" | "out" | "done";

// ---------------------------------------------------------------------------
// 요청: [받은 · 보낸 · 끝난] 으로 나눠 보여요. 받은 요청은 [완료], 보낸 요청은 [취소]
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
  const open = tasks.filter((task) => task.status === "open");
  const counts = {
    in: open.filter((task) => task.direction === "in").length,
    out: open.filter((task) => task.direction === "out").length,
    done: tasks.length - open.length,
  };
  // 처음 보이는 칸: 받은 요청이 있으면 받은, 없고 보낸 게 있으면 보낸
  const [filter, setFilter] = useState<Filter>(counts.in || !counts.out ? "in" : "out");
  const [adding, setAdding] = useState(false);
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
            <TaskItem key={task.task_id} task={task} today={collab.today} endDate={collab.end_date} editable={editable} onChange={onChange} />
          ))}
        </ul>
      )}

      {editable && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 flex w-full items-center gap-2 rounded-button border border-dashed border-line px-3 py-2.5 text-left text-[13px] text-muted hover:border-brand hover:text-brand"
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
            setFilter("out"); // 방금 남긴 요청이 보이게
            onChange(next);
          }}
        />
      )}
    </section>
  );
}

const EMPTY: Record<Filter, string> = {
  in: "받은 요청이 없어요.",
  out: "보낸 요청이 없어요.",
  done: "끝난 요청이 없어요.",
};

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
  const [changingDue, setChangingDue] = useState(false); // [기한 변경] 창
  const { saving, error, run } = useSaving();
  const due = dueText(task, today);
  const closed = task.status !== "open";
  const canComplete = editable && !closed && task.direction === "in";
  const canCancel = editable && !closed && task.direction === "out";
  // 되돌리기: 완료는 받은 사람(in)이, 취소는 보낸 사람(out)이
  const canReopen = editable && ((task.status === "done" && task.direction === "in") || (task.status === "canceled" && task.direction === "out"));
  const who = task.direction === "in" ? `${task.requested_by_nickname} → 나` : `나 → ${task.assignee_nickname}`;

  return (
    <li className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-x-3 border-t border-line py-3.5 first:border-t-0 first:pt-1">
      {canComplete ? (
        <button
          type="button"
          onClick={() => run(async () => onChange(await completeTask(task.task_id)))}
          disabled={saving}
          title="완료로 표시"
          aria-label="완료로 표시"
          className="group mt-0.5 grid h-[22px] w-[22px] place-items-center rounded-full border-2 border-line text-[11px] text-success hover:border-success disabled:opacity-50"
        >
          <span className="opacity-0 group-hover:opacity-70">✓</span>
        </button>
      ) : (
        <span
          className={`mt-0.5 grid h-[22px] w-[22px] place-items-center rounded-full border-2 text-[11px] ${
            task.status === "done" ? "border-success bg-success text-white" : task.direction === "out" ? "border-dashed border-line" : "border-line"
          }`}
          aria-hidden="true"
        >
          {task.status === "done" ? "✓" : ""}
        </span>
      )}

      <div className="min-w-0">
        <p className={`whitespace-pre-line font-semibold leading-snug ${closed ? "text-muted line-through decoration-faint" : ""}`}>{task.content}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
          <span>{who}</span>
          <span className="text-faint">·</span>
          <span className="text-faint">{task.source === "discord" ? "디스코드" : "웹"}</span>
        </p>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        {confirming && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-danger">이 요청을 취소할까요? 나중에 되돌릴 수 있어요.</span>
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

      <div className="flex flex-col items-end gap-1 text-right">
        <span className={`whitespace-nowrap text-xs font-bold ${due.soon ? "text-danger" : task.due_date ? "text-muted" : "font-medium text-faint"}`}>{due.text}</span>
        {task.status === "canceled" && <span className="text-[11px] text-faint">취소됨</span>}
        {canReopen && (
          <button
            type="button"
            onClick={() => run(async () => onChange(await reopenTask(task.task_id)))}
            disabled={saving}
            title={task.status === "done" ? "완료를 잘못 눌렀다면 다시 진행 중으로" : "취소를 잘못 눌렀다면 다시 진행 중으로"}
            className="text-[11px] font-semibold text-muted hover:text-brand disabled:opacity-50"
          >
            {saving ? "되돌리는 중…" : "↩ 되돌리기"}
          </button>
        )}
        {canComplete && (
          <button
            type="button"
            onClick={() => run(async () => onChange(await completeTask(task.task_id)))}
            disabled={saving}
            className="h-7 rounded-button bg-brand px-2.5 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {saving ? "…" : "완료"}
          </button>
        )}
        {!closed && task.direction === "out" && <span className="rounded bg-brand-soft px-1.5 py-px text-[11px] font-semibold text-brand">상대 진행 중</span>}
        {canCancel && !confirming && (
          <span className="flex gap-2 text-[11px] font-semibold">
            <button type="button" onClick={() => setChangingDue(true)} className="text-muted hover:text-brand">
              기한 변경
            </button>
            <button type="button" onClick={() => setConfirming(true)} className="text-faint hover:text-danger">
              취소
            </button>
          </span>
        )}
      </div>
      {changingDue && (
        <DueDialog
          task={task}
          today={today}
          endDate={endDate}
          onClose={() => setChangingDue(false)}
          onSaved={(next) => {
            setChangingDue(false);
            onChange(next);
          }}
        />
      )}
    </li>
  );
}

/** 보낸 사람의 [기한 변경] 창: 오늘 ~ 협업 종료일, 비우면 기한 없음 */
function DueDialog({
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
  const [due, setDue] = useState(task.due_date ?? "");
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
      <p className="mb-5 rounded-button bg-page px-4 py-3 text-sm leading-relaxed">{task.content}</p>
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