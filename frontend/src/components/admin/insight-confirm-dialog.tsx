"use client";

import { useEffect, useRef } from "react";
import { formatAdminTime, type CandidateDetail, type Draft } from "@/lib/admin-insights";
import { ADMIN_BUTTON } from "./admin-ui";

export type ConfirmAction = { action: "approve" | "publish" | "rewrite"; scheduledFor: string | null };

export function InsightConfirmDialog({ action, candidate, draft, busy, onCancel, onConfirm }: {
  action: ConfirmAction; candidate: CandidateDetail; draft: Draft; busy: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    cancelRef.current?.focus();
    return () => dialog?.close();
  }, []);
  const approving = action.action === "approve";
  const rewriting = action.action === "rewrite";
  const title = rewriting ? "다시 작성을 요청할까요?" : approving ? "이 판본을 승인할까요?" : "이 승인본을 게시할까요?";
  const help = rewriting ? "게시 승인이 아닙니다. 현재 원고와 공개본은 그대로 두고, 작업 회차에 보완 의도만 남깁니다." : approving ? "승인은 현재 저장된 판본에만 적용됩니다. 본문이나 근거를 수정하면 다시 승인해야 합니다." : "승인된 내용을 공개 API의 게시 스냅샷으로 저장합니다. 실제 게시 동작이며 자동 취소 기능은 아직 없습니다.";
  const confirmLabel = rewriting ? "다시 작성 요청" : approving ? "이 판본 승인" : "승인본 게시";
  return <dialog ref={ref} aria-labelledby="insight-confirm-title" onCancel={(event) => {
    // 확인창의 Esc가 바깥 편집 모달까지 닫지 않도록 전달을 멈춥니다.
    event.preventDefault(); event.stopPropagation(); if (!busy) onCancel();
  }} className="m-auto max-h-[85vh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-card border border-line bg-white p-6 text-ink shadow-card backdrop:bg-ink/40">
    <h2 id="insight-confirm-title" className="text-xl font-bold">{title}</h2>
    <p className="mt-3 text-sm leading-6 text-muted">{help}</p>
    <dl className="mt-5 space-y-3 rounded-card bg-page p-4 text-sm [overflow-wrap:anywhere]">
      <div><dt className="text-muted">제목</dt><dd className="mt-1 font-semibold">{draft.title}</dd></div>
      <div><dt className="text-muted">판본 / 변경 번호</dt><dd>{candidate.current_revision} / {candidate.version}</dd></div>
      <div><dt className="text-muted">글 주소</dt><dd>{draft.slug}</dd></div>
      <div><dt className="text-muted">출처</dt><dd>{draft.source.url}</dd></div>
      <div><dt className="text-muted">기술 ID</dt><dd>{draft.keyword_ids.join(", ") || "없음 · 일반 전문가 탐색"}</dd></div>
      <div><dt className="text-muted">게시 가능 시각 · 한국 시간</dt><dd>{formatAdminTime(approving ? action.scheduledFor : candidate.scheduled_for)}</dd></div>
    </dl>
    <p className="mt-4 text-xs leading-5 text-muted">예약 시각이 되어도 자동으로 게시되지는 않습니다. 일반 사례·트렌드 화면의 새 API 연동 역시 별도 단계입니다.</p>
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      <button ref={cancelRef} type="button" disabled={busy} onClick={onCancel} className={ADMIN_BUTTON}>돌아가기</button>
      <button type="button" disabled={busy} onClick={onConfirm} className={`${ADMIN_BUTTON} bg-brand text-white hover:bg-brand-hover`}>{busy ? "처리 중…" : confirmLabel}</button>
    </div>
  </dialog>;
}
