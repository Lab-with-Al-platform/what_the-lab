"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { addDays, daysBetween } from "@/lib/collab-requests";
import { dayLabel } from "@/lib/workspace";
import {
  acceptChange,
  CHANNEL_KEEP_DAYS,
  CollaborationDetail,
  completeBlockers,
  declineChange,
  extendCollaboration,
  MAX_EXTEND_DAYS,
  requestComplete,
  STOP_REASONS,
  StopReason,
  stopCollaboration,
  WAITING_TEXT_LIMIT,
} from "@/lib/workspace-detail";
import { INPUT_CLASS, Modal } from "@/components/modal";

type Dialog = "extend" | "complete" | "stop" | null;

/** 시각(ISO) → 한국 "12.5 15:00" */
function kstTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("month")}.${get("day")} ${get("hour")}:${get("minute")}`;
}

/**
 * 진행 중 협업의 [⋯] 메뉴 (머리 버튼 줄 오른쪽 끝): 기간 연장 요청 · 조기 완료 요청 · 협업 중단
 * - 조기 완료는 진행 중인 요청 · 남은 일정이 없을 때만 눌러져요 (회색이면 이유를 보여 줘요)
 * - 답을 기다리는 요청이 있으면 연장 · 조기 완료는 잠겨요 (협업마다 하나)
 */
export function EndingMenu({ detail, onChange }: { detail: CollaborationDetail; onChange: (next: CollaborationDetail) => void }) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const box = useRef<HTMLDivElement>(null);
  const blockers = completeBlockers(detail);
  const pending = detail.pending_change ? "답을 기다리는 요청이 있어요" : null;

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function pick(next: Dialog) {
    setOpen(false);
    setDialog(next);
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label="협업 기간 · 마무리"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-button border border-line bg-card text-lg font-bold text-muted hover:bg-page"
      >
        ⋯
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1.5 w-64 overflow-hidden rounded-card border border-line bg-card py-1 shadow-card">
          <MenuItem disabled={pending} onClick={() => pick("extend")}>
            ⏩ 기간 연장 요청
          </MenuItem>
          <MenuItem disabled={pending ?? blockers.text} onClick={() => pick("complete")}>
            ✅ 조기 완료 요청
          </MenuItem>
          <div className="my-1 border-t border-line" />
          <MenuItem danger onClick={() => pick("stop")}>
            ⛔ 협업 중단
          </MenuItem>
        </div>
      )}
      {dialog === "extend" && <ExtendDialog detail={detail} onClose={() => setDialog(null)} onSaved={onChange} />}
      {dialog === "complete" && <CompleteDialog detail={detail} onClose={() => setDialog(null)} onSaved={onChange} />}
      {dialog === "stop" && <StopDialog detail={detail} onClose={() => setDialog(null)} onSaved={onChange} />}
    </div>
  );
}

/** 메뉴 한 줄. disabled 에 이유 글자를 넣으면 회색 + 아래에 이유 */
function MenuItem({ disabled, danger, onClick, children }: { disabled?: string | null; danger?: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={Boolean(disabled)}
      onClick={onClick}
      className={`block w-full px-4 py-2.5 text-left text-[13px] font-semibold hover:bg-page disabled:cursor-not-allowed disabled:bg-card ${
        danger ? "text-danger" : disabled ? "text-faint" : "text-ink"
      }`}
    >
      {children}
      {disabled && <span className="mt-0.5 block text-[11px] font-normal text-faint">{disabled}</span>}
    </button>
  );
}

/** 저장 버튼 공통: 누르는 동안 잠그고, 실패하면 이유를 보여 줘요 */
function useSave(onSaved: (next: CollaborationDetail) => void, onClose: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(action: () => Promise<CollaborationDetail>) {
    setBusy(true);
    setError("");
    try {
      onSaved(await action());
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "잠시 후 다시 시도해 주세요");
      setBusy(false);
    }
  }
  return { busy, error, save };
}

function Footer({ onClose, label, disabled, danger, onClick }: { onClose: () => void; label: string; disabled: boolean; danger?: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onClose} className="h-10 rounded-button px-4 text-sm font-semibold text-muted">
        닫기
      </button>
      <button type="button" disabled={disabled} onClick={onClick} className={`h-10 rounded-button px-5 text-sm font-semibold text-white disabled:opacity-40 ${danger ? "bg-danger" : "bg-brand"}`}>
        {label}
      </button>
    </div>
  );
}

/** [기간 연장 요청] 창: 새 종료일(지금 종료일 다음 날 ~ +30일) + 사유 */
function ExtendDialog({ detail, onClose, onSaved }: { detail: CollaborationDetail; onClose: () => void; onSaved: (next: CollaborationDetail) => void }) {
  const { collaboration: collab } = detail;
  const first = addDays(collab.end_date, 1);
  const last = addDays(collab.end_date, MAX_EXTEND_DAYS);
  const [end, setEnd] = useState(addDays(collab.end_date, 14));
  const [reason, setReason] = useState("");
  const { busy, error, save } = useSave(onSaved, onClose);
  const inRange = Boolean(end) && end >= first && end <= last;
  const ready = inRange && reason.trim() !== "";

  return (
    <Modal
      title="기간 연장 요청"
      description={`${collab.partner.nickname} 님이 수락하면 종료일이 바뀌어요.`}
      onClose={onClose}
      footer={<Footer onClose={onClose} label="연장 요청하기" disabled={!ready || busy} onClick={() => save(() => extendCollaboration(collab.collaboration_id, { end_date: end, reason }))} />}
    >
      <p className="text-sm font-semibold">새 종료일</p>
      <input type="date" value={end} min={first} max={last} onChange={(event) => setEnd(event.target.value)} className={`${INPUT_CLASS} mt-2`} />
      {inRange ? (
        <p className="mt-1.5 text-xs text-muted">
          {dayLabel(collab.end_date)} → <b className="text-ink">{dayLabel(end)}</b> · {daysBetween(collab.end_date, end)}일 연장
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
        · 한 번에 {MAX_EXTEND_DAYS}일까지 늘릴 수 있어요 (필요하면 다시 요청할 수 있어요)
        <br />· {collab.partner.nickname} 님이 3일 안에(종료일이 더 빠르면 종료일까지) 답하지 않으면 요청이 사라져요
        <br />· 등록된 일정 · 요청 기한은 그대로예요
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </Modal>
  );
}

/** [조기 완료 요청] 창: 한마디(선택). 상대가 수락하면 바로 '완료' */
function CompleteDialog({ detail, onClose, onSaved }: { detail: CollaborationDetail; onClose: () => void; onSaved: (next: CollaborationDetail) => void }) {
  const { collaboration: collab } = detail;
  const [note, setNote] = useState("");
  const { busy, error, save } = useSave(onSaved, onClose);

  return (
    <Modal
      title="조기 완료 요청"
      description={`${collab.partner.nickname} 님이 수락하면 협업이 바로 완료돼요. (종료일 ${dayLabel(collab.end_date)})`}
      onClose={onClose}
      footer={<Footer onClose={onClose} label="조기 완료 요청하기" disabled={busy} onClick={() => save(() => requestComplete(collab.collaboration_id, note))} />}
    >
      <p className="text-sm font-semibold">한마디 (선택)</p>
      <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={WAITING_TEXT_LIMIT} rows={3} placeholder="결과물 다 받았어요. 수고 많으셨어요!" className={`${INPUT_CLASS} mt-2 h-auto py-3`} />
      <div className="mt-3 rounded-button bg-brand-soft px-3 py-2.5 text-xs leading-relaxed text-brand">
        · 완료되면 디스코드 채널은 잠기고 {CHANNEL_KEEP_DAYS}일 뒤 삭제돼요
        <br />· 두 사람 모두 30일 안에 서로 평가를 남길 수 있어요
        <br />· {collab.partner.nickname} 님이 3일 안에 답하지 않으면 요청이 사라져요
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </Modal>
  );
}

/** [협업 중단] 창: 사유 고르기 + 상대에게 남길 말 (둘 다 필수). 누르면 바로 끝나요 */
function StopDialog({ detail, onClose, onSaved }: { detail: CollaborationDetail; onClose: () => void; onSaved: (next: CollaborationDetail) => void }) {
  const { collaboration: collab } = detail;
  const [reason, setReason] = useState<StopReason | null>(null);
  const [text, setText] = useState("");
  const { busy, error, save } = useSave(onSaved, onClose);
  const openTasks = completeBlockers(detail).openTasks;
  const ready = reason !== null && text.trim() !== "";

  return (
    <Modal
      title="협업을 중단할까요?"
      description={`${collab.research.title} · ${collab.partner.nickname} 님과의 협업 (${dayLabel(collab.end_date)} 종료 예정)`}
      onClose={onClose}
      footer={
        <Footer onClose={onClose} label="협업 중단하기" danger disabled={!ready || busy} onClick={() => reason && save(() => stopCollaboration(collab.collaboration_id, { reason, text }))} />
      }
    >
      <p className="text-sm font-semibold">
        중단 사유 <span className="text-danger">*</span>
      </p>
      <div className="mt-2 grid gap-1.5">
        {STOP_REASONS.map(([code, label]) => (
          <label key={code} className={`flex cursor-pointer items-center gap-2 rounded-button border px-3 py-2.5 text-[13px] ${reason === code ? "border-brand bg-brand-soft" : "border-line"}`}>
            <input type="radio" name="stop-reason" checked={reason === code} onChange={() => setReason(code)} className="accent-brand" />
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
        중단하면 되돌릴 수 없어요.
        <br />· {collab.partner.nickname} 님에게 사유와 함께 알림이 가요
        {openTasks > 0 && (
          <>
            <br />· 진행 중인 요청 {openTasks}개는 &ldquo;협업 종료로 마감&rdquo;으로 남아요
          </>
        )}
        <br />· 디스코드 채널은 바로 잠기고 {CHANNEL_KEEP_DAYS}일 뒤 삭제돼요
        <br />· 누가 중단했는지 기록에 남고, {collab.partner.nickname} 님이 평가를 남길 수 있어요 (나는 평가하지 않아요)
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </Modal>
  );
}

/**
 * 진행 중 협업의 받은 · 보낸 요청 상자 (머리 안): 연장 · 조기 완료
 * 상대 것이면 [수락] [다시 얘기해요], 내 것이면 "답 기다리는 중". 메뉴에 숨기지 않아요.
 * 요청이 없고 종료가 7일 안이면 "기간이 더 필요하면 ⋯ → 기간 연장 요청" 안내 한 줄
 */
export function ChangeBox({ detail, onChange }: { detail: CollaborationDetail; onChange: (next: CollaborationDetail) => void }) {
  const { collaboration: collab } = detail;
  const change = detail.pending_change && detail.pending_change.kind !== "start" ? detail.pending_change : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const left = daysBetween(collab.today, collab.end_date);

  if (!change) {
    if (left > 7) return null;
    return (
      <p className="mt-4 rounded-button bg-page px-4 py-2.5 text-[13px] text-muted">
        🗓 협업이 {dayLabel(collab.end_date)}에 끝나요 ({left <= 0 ? "오늘 마지막 날" : `${left}일 남음`}) · 기간이 더 필요하면 오른쪽 위 <b>⋯ → 기간 연장 요청</b>
      </p>
    );
  }

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

  const extend = change.kind === "extend";
  const what = extend ? "기간 연장을" : "조기 완료를";
  return (
    <div className="mt-5 rounded-card border border-[#f3dfb2] bg-editorial-warning-soft px-4 py-3.5 text-[13px] sm:px-5">
      {change.mine ? (
        <p>
          {what} 요청했어요 · <span className="text-muted">{kstTime(change.expires_at)}까지 답을 기다려요</span>
        </p>
      ) : (
        <p>
          <b>{change.requested_by_nickname}</b> 님이 {what} 요청했어요 · <span className="text-faint">{kstTime(change.expires_at)}까지 답해 주세요</span>
        </p>
      )}
      {extend && (
        <p className="mt-1">
          <b>
            {dayLabel(change.old_end_date)} → {dayLabel(change.new_end_date!)}
          </b>{" "}
          <span className="text-muted">({daysBetween(change.old_end_date, change.new_end_date!)}일 연장)</span>
        </p>
      )}
      {change.reason && <p className="mt-1 text-muted">&ldquo;{change.reason}&rdquo;</p>}
      {!change.mine && !extend && <p className="mt-1 text-xs text-editorial-warning">수락하면 오늘 협업이 완료되고, 채널은 {CHANNEL_KEEP_DAYS}일 뒤 삭제돼요</p>}

      {!change.mine &&
        (declining ? (
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
              {extend ? "수락" : "수락하고 완료"}
            </button>
            <button type="button" disabled={busy} onClick={() => setDeclining(true)} className="h-8 rounded-button border border-line bg-card px-3 text-xs font-semibold">
              다시 얘기해요
            </button>
          </div>
        ))}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}

/** 끝난 협업 (완료 · 중단): 어떻게 끝났는지 + 채널 삭제 안내. 시작 전 취소는 CanceledNote (workspace-waiting.tsx) */
export function EndedNote({ detail }: { detail: CollaborationDetail }) {
  const { collaboration: collab } = detail;
  if (collab.status !== "done" && collab.status !== "ended_early") return null;
  const day = collab.ended_at ? kstTime(collab.ended_at).split(" ")[0] : "";
  // 끝난 날(한국)이 종료일과 같거나 앞이면 조기 완료, 종료일이 지나 자동으로 끝났으면 정상 완료
  const endedOn = collab.ended_at ? new Date(collab.ended_at).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }) : null;
  const early = collab.status === "done" && endedOn !== null && endedOn <= collab.end_date;
  // 중단한 사람이 상대가 아니면 나 (중단한 사람은 평가하지 않아요)
  const stoppedByMe = collab.status === "ended_early" && collab.ended_by_nickname !== null && collab.ended_by_nickname !== collab.partner.nickname;
  return (
    <div className="mt-5 rounded-card border border-line bg-page px-4 py-3.5 text-[13px] sm:px-5">
      {collab.status === "done" ? (
        <b>{day} {early ? "조기 완료했어요" : "협업이 완료됐어요"} 🎉</b>
      ) : (
        <>
          <b>
            {day} {collab.ended_by_nickname ?? "상대"} 님이 협업을 중단했어요
          </b>
          {collab.end_reason && <p className="mt-1 text-muted">사유: {collab.end_reason}</p>}
        </>
      )}
      <p className="mt-1.5 text-xs text-faint">
        {collab.discord_delete_at ? `디스코드 채널은 ${kstTime(collab.discord_delete_at).split(" ")[0]}에 삭제돼요 (지금은 읽기만) · ` : ""}
        {stoppedByMe ? `직접 중단한 협업이라 평가는 ${collab.partner.nickname} 님만 남겨요` : "평가는 아래 카드에서 30일 안에 남길 수 있어요"}
      </p>
    </div>
  );
}