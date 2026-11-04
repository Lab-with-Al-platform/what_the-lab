"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { addDays, daysBetween } from "@/lib/collab-requests";
import { dayLabel } from "@/lib/workspace";
import {
  acceptChange,
  CANCEL_REASONS,
  CancelReason,
  cancelCollaboration,
  CHANNEL_KEEP_DAYS,
  CollaborationDetail,
  declineChange,
  MAX_POSTPONE_DAYS,
  postponeStart,
  WAITING_TEXT_LIMIT,
  withdrawChange,
} from "@/lib/workspace-detail";
import { INPUT_CLASS, Modal } from "@/components/modal";

/** 시각(ISO) → 한국 "11.7 12:00" */
function kstTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("month")}.${get("day")} ${get("hour")}:${get("minute")}`;
}

/**
 * 시작 전 안내 상자 (협업 상세 머리 안). 이 기간에 할 수 있는 것: 디스코드 대화 · 시작일 미루기 · 협업 취소
 * 시작일 미루기 요청이 있으면 상자 안에: 상대 것이면 [수락] [다시 얘기해요], 내 것이면 "답 기다리는 중 · [요청 철회]"
 */
export function WaitingBox({ detail, onChange }: { detail: CollaborationDetail; onChange: (next: CollaborationDetail) => void }) {
  const { collaboration: collab } = detail;
  const [dialog, setDialog] = useState<"cancel" | "postpone" | null>(null);
  const pending = detail.pending_change?.kind === "start" ? detail.pending_change : null;
  const dday = daysBetween(collab.today, collab.start_date);
  const postponeBlocked = detail.postponed ? "시작일 미루기는 한 번만 할 수 있어요" : pending ? "답을 기다리는 요청이 있어요" : "";

  return (
    <div className="mt-5 rounded-card border border-[#f3dfb2] bg-editorial-warning-soft px-4 py-4 sm:px-5">
      <p className="text-[15px] font-extrabold">
        ⏳ 시작 전 · <span className="text-brand">D-{dday}</span>{" "}
        <span className="text-[13px] font-medium text-muted">
          {dayLabel(collab.start_date)} 시작 ~ {dayLabel(collab.end_date)}
        </span>
      </p>
      <p className="mt-1 text-[13px] text-muted">
        협업 기능(요청 · 일정)은 <b className="text-ink">시작일부터</b> 쓸 수 있어요. 그 전에는 디스코드 채널에서 준비 얘기를 나눠 주세요.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {collab.discord_channel_url && (
          <a href={collab.discord_channel_url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-button bg-brand px-4 text-[13px] font-semibold text-white hover:bg-brand-hover">
            💬 채널에서 대화하기
          </a>
        )}
        <button
          type="button"
          disabled={Boolean(postponeBlocked)}
          title={postponeBlocked || undefined}
          onClick={() => setDialog("postpone")}
          className="inline-flex h-10 items-center rounded-button border border-line bg-card px-4 text-[13px] font-semibold hover:bg-page disabled:cursor-not-allowed disabled:bg-page disabled:text-faint"
        >
          🗓 시작일 미루기
        </button>
        <button type="button" onClick={() => setDialog("cancel")} className="inline-flex h-10 items-center rounded-button border border-[#f3c9c9] bg-card px-4 text-[13px] font-semibold text-danger hover:bg-danger-soft">
          협업 취소
        </button>
      </div>

      {pending && <PendingPostpone change={pending} onChange={onChange} />}

      {dialog === "cancel" && <CancelDialog detail={detail} onClose={() => setDialog(null)} onSaved={onChange} />}
      {dialog === "postpone" && <PostponeDialog detail={detail} onClose={() => setDialog(null)} onSaved={onChange} />}
    </div>
  );
}

/** 안내 상자 안의 시작일 미루기 요청 한 줄 */
function PendingPostpone({ change, onChange }: { change: NonNullable<CollaborationDetail["pending_change"]>; onChange: (next: CollaborationDetail) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const moved = `${dayLabel(change.old_start_date!)} → ${dayLabel(change.new_start_date!)}`;

  async function run(action: () => Promise<CollaborationDetail>) {
    setBusy(true);
    setError("");
    try {
      onChange(await action());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "잠시 후 다시 시도해 주세요");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 border-t border-dashed border-[#ead59f] pt-3 text-[13px]">
      {change.mine ? (
        <p>
          시작일을 미루자고 요청했어요 · <span className="text-muted">{kstTime(change.expires_at)}까지 답을 기다려요</span>
        </p>
      ) : (
        <p>
          <b>{change.requested_by_nickname}</b> 님이 시작일을 미루자고 했어요 · <span className="text-faint">{kstTime(change.expires_at)}까지 답해 주세요</span>
        </p>
      )}
      <p className="mt-1">
        <b>{moved}</b> <span className="text-muted">(종료 {dayLabel(change.old_end_date)} → {dayLabel(change.new_end_date!)})</span>
      </p>
      {change.reason && <p className="mt-1 text-muted">&ldquo;{change.reason}&rdquo;</p>}

      {change.mine ? (
        <button type="button" disabled={busy} onClick={() => run(() => withdrawChange(change.change_id))} className="mt-2 h-8 rounded-button border border-line bg-card px-3 text-xs font-semibold disabled:opacity-50">
          요청 철회
        </button>
      ) : declining ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={WAITING_TEXT_LIMIT} placeholder="한 줄 이유 (선택)" className={`${INPUT_CLASS} h-9 min-w-0 flex-1`} />
          <button type="button" disabled={busy} onClick={() => run(() => declineChange(change.change_id, note))} className="h-9 rounded-button bg-ink px-3 text-xs font-semibold text-white disabled:opacity-50">
            다시 얘기해요 보내기
          </button>
          <button type="button" onClick={() => setDeclining(false)} className="h-9 rounded-button px-2 text-xs text-muted">
            닫기
          </button>
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <button type="button" disabled={busy} onClick={() => run(() => acceptChange(change.change_id))} className="h-8 rounded-button bg-brand px-3 text-xs font-semibold text-white disabled:opacity-50">
            수락
          </button>
          <button type="button" disabled={busy} onClick={() => setDeclining(true)} className="h-8 rounded-button border border-line bg-card px-3 text-xs font-semibold">
            다시 얘기해요
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}

/** [협업 취소] 창: 사유 고르기 + 상대에게 남길 말 (둘 다 필수) */
function CancelDialog({ detail, onClose, onSaved }: { detail: CollaborationDetail; onClose: () => void; onSaved: (next: CollaborationDetail) => void }) {
  const { collaboration: collab } = detail;
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const deleteDay = dayLabel(addDays(collab.today, CHANNEL_KEEP_DAYS));
  const ready = reason !== null && text.trim() !== "";

  async function submit() {
    if (!reason) return;
    setBusy(true);
    setError("");
    try {
      onSaved(await cancelCollaboration(collab.collaboration_id, { reason, text }));
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "잠시 후 다시 시도해 주세요");
      setBusy(false);
    }
  }

  return (
    <Modal
      title="협업을 취소할까요?"
      description={`${collab.research.title} · ${collab.partner.nickname} 님과의 협업 (${dayLabel(collab.start_date)} 시작 예정)`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-button px-4 text-sm font-semibold text-muted">
            닫기
          </button>
          <button type="button" disabled={!ready || busy} onClick={submit} className="h-10 rounded-button bg-danger px-5 text-sm font-semibold text-white disabled:opacity-40">
            협업 취소하기
          </button>
        </div>
      }
    >
      <p className="text-sm font-semibold">
        취소 사유 <span className="text-danger">*</span>
      </p>
      <div className="mt-2 grid gap-1.5">
        {CANCEL_REASONS.map(([code, label]) => (
          <label key={code} className={`flex cursor-pointer items-center gap-2 rounded-button border px-3 py-2.5 text-[13px] ${reason === code ? "border-brand bg-brand-soft" : "border-line"}`}>
            <input type="radio" name="cancel-reason" checked={reason === code} onChange={() => setReason(code)} className="accent-brand" />
            {label}
          </label>
        ))}
      </div>
      <p className="mt-4 text-sm font-semibold">
        {collab.partner.nickname} 님에게 남길 말 <span className="text-danger">*</span>
      </p>
      <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={WAITING_TEXT_LIMIT} rows={3} className={`${INPUT_CLASS} mt-2 h-auto py-3`} />
      <p className="mt-1 text-right text-[11px] text-faint">
        {text.length} / {WAITING_TEXT_LIMIT}
      </p>
      <div className="mt-3 rounded-button bg-danger-soft px-3 py-2.5 text-xs leading-relaxed text-[#9e2626]">
        취소하면 되돌릴 수 없어요.
        <br />· {collab.partner.nickname} 님에게 사유와 함께 알림이 가요
        <br />· 디스코드 채널은 바로 잠기고(읽기 · 파일 받기는 가능) <b>{deleteDay}</b>에 삭제돼요
        <br />· 구글 캘린더의 이 협업 일정이 지워져요
        <br />· 협업은 &ldquo;취소됨&rdquo;으로 기록에 남아요 (평가 없음)
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </Modal>
  );
}

/** [시작일 미루기] 창: 새 시작일(원래 시작일 다음 날 ~ +14일) + 사유 */
function PostponeDialog({ detail, onClose, onSaved }: { detail: CollaborationDetail; onClose: () => void; onSaved: (next: CollaborationDetail) => void }) {
  const { collaboration: collab } = detail;
  const first = addDays(collab.start_date, 1);
  const last = addDays(collab.start_date, MAX_POSTPONE_DAYS);
  const [start, setStart] = useState(addDays(collab.start_date, 7));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shift = start ? daysBetween(collab.start_date, start) : 0;
  const inRange = Boolean(start) && start >= first && start <= last;
  const newEnd = inRange ? addDays(collab.end_date, shift) : null;
  const ready = inRange && reason.trim() !== "";

  async function submit() {
    setBusy(true);
    setError("");
    try {
      onSaved(await postponeStart(collab.collaboration_id, { start_date: start, reason }));
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "잠시 후 다시 시도해 주세요");
      setBusy(false);
    }
  }

  return (
    <Modal
      title="시작일 미루기"
      description="상대가 수락하면 시작일과 종료일이 같이 밀려요. 협업 기간 길이는 그대로예요."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-button px-4 text-sm font-semibold text-muted">
            닫기
          </button>
          <button type="button" disabled={!ready || busy} onClick={submit} className="h-10 rounded-button bg-brand px-5 text-sm font-semibold text-white disabled:opacity-40">
            미루자고 요청하기
          </button>
        </div>
      }
    >
      <p className="text-sm font-semibold">새 시작일</p>
      <input type="date" value={start} min={first} max={last} onChange={(event) => setStart(event.target.value)} className={`${INPUT_CLASS} mt-2`} />
      {inRange ? (
        <p className="mt-1.5 text-xs text-muted">
          {dayLabel(collab.start_date)} → <b className="text-ink">{dayLabel(start)}</b> · {shift}일 뒤 &nbsp;|&nbsp; 종료일 {dayLabel(collab.end_date)} → <b className="text-ink">{dayLabel(newEnd!)}</b>
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-danger">
          {dayLabel(first)} ~ {dayLabel(last)} 중에서 골라 주세요
        </p>
      )}
      <p className="mt-4 text-sm font-semibold">
        사유 <span className="text-danger">*</span>
      </p>
      <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={WAITING_TEXT_LIMIT} rows={3} className={`${INPUT_CLASS} mt-2 h-auto py-3`} />
      <p className="mt-1 text-right text-[11px] text-faint">
        {reason.length} / {WAITING_TEXT_LIMIT}
      </p>
      <div className="mt-3 rounded-button bg-brand-soft px-3 py-2.5 text-xs leading-relaxed text-brand">
        · 고를 수 있는 날: {dayLabel(first)} ~ {dayLabel(last)} (원래 시작일 + {MAX_POSTPONE_DAYS}일까지)
        <br />· 시작일 미루기는 한 협업에 한 번만 할 수 있어요
        <br />· {collab.partner.nickname} 님이 3일 안에 답하지 않으면 요청이 사라져요
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </Modal>
  );
}

/** 취소된 협업: 누가 · 언제 · 왜 + 채널 삭제 안내 */
export function CanceledNote({ detail }: { detail: CollaborationDetail }) {
  const { collaboration: collab } = detail;
  if (collab.status !== "canceled") return null;
  return (
    <div className="mt-5 rounded-card border border-line bg-page px-4 py-3.5 text-[13px] sm:px-5">
      <b>
        {collab.ended_at ? `${kstTime(collab.ended_at).split(" ")[0]} ` : ""}
        {collab.ended_by_nickname ?? "상대"} 님이 협업을 취소했어요
      </b>
      {collab.end_reason && <p className="mt-1 text-muted">사유: {collab.end_reason}</p>}
      <p className="mt-1.5 text-xs text-faint">
        {collab.discord_delete_at ? `디스코드 채널은 ${kstTime(collab.discord_delete_at).split(" ")[0]}에 삭제돼요 · ` : ""}평가는 없어요
      </p>
    </div>
  );
}

/** 시작 전에 잠근 카드 (요청 · 일정): 숨기지 않고 "시작하면 쓸 수 있는 것"을 보여 줘요 */
export function LockedCard({ title, startDate, action }: { title: string; startDate: string; action: string }) {
  return (
    <section className="rounded-card bg-card p-5 shadow-card sm:px-6">
      <h2 className="text-base font-extrabold">{title}</h2>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-button border border-dashed border-line bg-page px-4 py-3.5 text-[13px] text-faint">
        <span>🔒 {dayLabel(startDate)}부터 쓸 수 있어요</span>
        <button type="button" disabled className="h-8 shrink-0 cursor-not-allowed rounded-button border border-line px-3 text-xs font-semibold text-line">
          {action}
        </button>
      </div>
    </section>
  );
}