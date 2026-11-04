"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { EMPTY_SCORES, REVIEW_LABELS, getReviewContext, submitReview, reportPublicReview, type ReviewContext, type ReviewScores } from "@/lib/reviews";


function ScorePicker({ title, hint, value, onChange, disabled }: {
  title: string; hint: string; value: number; onChange: (score: number) => void; disabled: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-2 rounded-xl border border-[#e8ecf4] bg-[#fbfcff] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
      <legend className="sr-only">{title}</legend>
      <div className="max-w-[300px]">
        <p className="text-[13px] font-bold text-ink">{title}</p>
        <p className="mt-1 text-[11px] leading-5 text-muted">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label={title + " 점수"}>
        {[1, 2, 3, 4, 5].map((score) => (
          <button key={score} type="button" disabled={disabled}
            onClick={() => onChange(score)}
            aria-pressed={value === score}
            aria-label={title + " " + score + "점"}
            className={"grid size-10 place-items-center rounded-lg border text-[14px] font-bold transition-all focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60 " +
              (value === score
                ? "border-[#5145d9] bg-[#5145d9] text-white shadow-[0_5px_15px_rgba(79,65,216,0.17)]"
                : "border-[#e0e6f2] bg-white text-[#71809f] hover:border-[#a7b2e9] hover:bg-[#f2f3fe]")}>
            {score}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Actual review form in both collaborator workspaces; never trusts a client-supplied role or status. */
export function CollaborationReviewCard({ collaborationId }: { collaborationId: number }) {
  const [context, setContext] = useState<ReviewContext | null>(null);
  const [scores, setScores] = useState<ReviewScores>({ ...EMPTY_SCORES });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [success, setSuccess] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState("privacy");
  const [reportComment, setReportComment] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  useEffect(() => {
    let active = true;
    setContext(null);
    setLoadError("");
    getReviewContext(collaborationId)
      .then((next) => { if (active) setContext(next); })
      .catch((error) => { if (active) setLoadError(error instanceof ApiError ? error.message : "평가 정보를 불러오지 못했습니다."); });
    return () => { active = false; };
  }, [collaborationId]);

  function beginEdit() {
    if (!context?.my_review || !context.can_edit) return;
    const r = context.my_review;
    setScores({ expertise: r.expertise, communication: r.communication, timeliness: r.timeliness, quality: r.quality, comment: r.comment });
    setEditing(true);
    setSuccess("");
    setSaveError("");
  }

  async function save() {
    if (!context || busy) return;
    setBusy(true);
    setSaveError("");
    setSuccess("");
    try {
      const next = await submitReview(collaborationId, scores, editing);
      setContext(next);
      setEditing(false);
      setSuccess(editing ? "평가가 수정되었습니다." : "평가가 제출되었습니다.");
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : "평가 저장에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function reportReceived() {
    if (!context?.received_review || reportBusy) return;
    setReportBusy(true); setSaveError("");
    try {
      await reportPublicReview(context.received_review.review_id, reportReason, reportComment);
      setReportDone(true); setReporting(false);
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : "신고 접수에 실패했습니다.");
    } finally { setReportBusy(false); }
  }

  if (loadError) return (
    <section id="review" aria-label="협업 평가" className="rounded-2xl border border-[#f1d5d0] bg-white p-5">
      <p role="alert" className="text-sm text-danger">{loadError}</p>
      <button type="button" onClick={() => window.location.reload()} className="mt-3 min-h-10 rounded-lg border border-line px-4 text-sm font-semibold text-ink">다시 불러오기</button>
    </section>
  );
  if (!context) return <div id="review" role="status" className="rounded-2xl border border-line bg-white px-5 py-8 text-center text-sm text-muted">평가 정보를 확인하는 중입니다…</div>;

  const existing = context.my_review;
  const showForm = (!existing && context.can_submit) || editing;
  const labels = REVIEW_LABELS[context.side];
  const valid = labels.every((item) => scores[item.key] >= 1 && scores[item.key] <= 5);
  const deadline = context.submission_deadline ? new Date(context.submission_deadline).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" }) : "";

  return (
    <section id="review" aria-labelledby="review-heading" className="scroll-mt-20 overflow-hidden rounded-[20px] border border-[#dfe6f4] bg-white shadow-[0_10px_30px_rgba(21,42,84,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e8edf7] bg-gradient-to-r from-[#f3f5ff] via-[#f7f8ff] to-white px-5 py-5 sm:px-6">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="rounded-full bg-[#e3e8ff] px-2.5 py-1 text-[10px] font-bold text-[#5144aa]">COLLABORATION REVIEW</span>
            <span className="text-[11px] font-semibold text-[#7d89a0]">실제 종료 협업 기반</span>
          </div>
          <h2 id="review-heading" className="text-[19px] font-extrabold tracking-[-0.025em] text-[#25314e]">
            {context.partner} 님과의 협업 평가
          </h2>
          <p className="mt-1.5 text-[12px] leading-5 text-muted">프로젝트가 종료된 뒤 30일 이내에 실제 참여자만 평가할 수 있어요.</p>
        </div>
        <span className={"rounded-full px-3 py-1.5 text-[11px] font-bold " + (existing ? "bg-[#e9f7ed] text-[#26794b]" : context.eligible ? "bg-[#eef1ff] text-[#475abb]" : "bg-[#f3f4f7] text-[#747c90]")}>
          {existing ? "제출 완료" : context.eligible ? "평가 작성 가능" : "작성 기간 종료"}
        </span>
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        {context.status === "ended_early" && (
          <div className="rounded-xl border border-[#f0dfc8] bg-[#fffbf4] p-3 text-xs leading-6 text-[#8d6738]">
            중도 종료한 협업은 평가를 남길 수 있지만, 전문가의 공개 평점에는 합산되지 않습니다.
          </div>
        )}
        <div className="rounded-xl bg-[#f7f9fd] px-4 py-3 text-[12px] leading-6 text-[#66748f]">
          <strong className="text-[#435474]">연구:</strong> {context.research_title}
          <p>{existing ? (context.can_edit ? "제출 후 48시간 이내에 한 번 수정할 수 있어요." : "평가 수정 가능 기간이 종료됐거나 수정한 적이 있어요.") : context.eligible ? `작성 기한: ${deadline}` : "현재 작성할 수 있는 기간이 아닙니다."}</p>
          <p className="mt-1 text-[11px] text-[#8a95ae]">{context.public_policy} 완료 후 7일이 지나 공개돼요.</p>
        </div>
        {existing && !editing && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[14px] font-bold text-ink">내가 제출한 평가</h3>
              {context.can_edit && <button type="button" onClick={beginEdit} className="min-h-10 rounded-lg border border-[#cbd5ed] bg-white px-4 text-[12px] font-semibold text-[#4055a4] hover:bg-[#f4f6ff]">평가 한 번 수정하기</button>}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {labels.map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-lg border border-[#e7ebf4] px-4 py-3 text-sm">
                  <span className="text-[#67758e]">{item.label}</span>
                  <b className="text-[#334b89]">★ {existing[item.key]} / 5</b>
                </div>
              ))}
            </div>
            {existing.comment && <p className="whitespace-pre-wrap break-words rounded-xl bg-[#f7f9fd] px-4 py-3 text-[13px] leading-6 text-ink">{existing.comment}</p>}
            <p className="text-xs text-[#78849b]">{existing.visibility === "hidden" ? "이 후기는 운영 검토에 따라 공개되지 않습니다." : "평가가 저장됐습니다. 공개 정책에 따라 표시됩니다."}</p>
          </div>
        )}
        {context.received_review && (
          <section aria-labelledby="received-review-title" className="space-y-3 rounded-2xl border border-[#e1e8f4] bg-[#f8faff] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="received-review-title" className="text-[15px] font-bold text-[#30446f]">상대방이 나에게 남긴 협업 평가</h3>
              <span className="rounded-full bg-[#e6ecfb] px-2.5 py-1 text-[10px] font-bold text-[#536cb0]">7일 공개 대기 후 · 당사자만</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {REVIEW_LABELS[context.received_review.reviewer_side].map((item) => (
                <div key={item.key} className="flex justify-between gap-3 rounded-lg bg-white px-3 py-2.5 text-[12px]">
                  <span className="text-muted">{item.label}</span>
                  <b className="text-[#3e54a0]">★ {context.received_review?.[item.key]} / 5</b>
                </div>
              ))}
            </div>
            {context.received_review.comment ? (
              <p className="whitespace-pre-wrap break-words rounded-xl bg-white p-4 text-[12px] leading-6 text-[#516079]">{context.received_review.comment}</p>
            ) : <p className="text-xs text-muted">상대가 점수만 남겼습니다.</p>}
            <p className="text-[11px] leading-5 text-muted">이 피드백은 협업 당사자에게만 제공됩니다. 연구회원에 대한 평점은 공개 전문가 평점에 합산되지 않습니다.</p>
            {reportDone ? <p role="status" className="text-[12px] font-semibold text-[#27714b]">신고가 접수되었습니다.</p>
              : <button type="button" onClick={() => setReporting(!reporting)} className="min-h-9 rounded-lg border border-[#cdd6e7] bg-white px-3 text-xs font-semibold text-[#6d748d]">이 평가 신고하기</button>}
            {reporting && !reportDone && (
              <div className="space-y-3 rounded-xl border border-[#dce4f1] bg-white p-4">
                <label className="block text-[12px] font-bold text-ink">신고 사유
                  <select value={reportReason} onChange={(event)=>setReportReason(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-line bg-white px-3 text-xs">
                    <option value="privacy">개인정보·연구 비밀</option>
                    <option value="abuse">욕설·비방</option>
                    <option value="false_claim">허위 사실</option>
                    <option value="other">기타</option>
                  </select>
                </label>
                <label className="block text-[12px] font-bold text-ink">신고 내용 (선택)
                  <textarea rows={2} maxLength={300} value={reportComment} onChange={(event)=>setReportComment(event.target.value)} className="mt-2 w-full rounded-lg border border-line p-3 text-xs" />
                </label>
                {saveError && <p role="alert" className="text-xs font-semibold text-danger">{saveError}</p>}
                <button type="button" disabled={reportBusy} onClick={() => void reportReceived()} className="min-h-10 rounded-lg bg-[#5142d8] px-4 text-xs font-bold text-white disabled:opacity-50">
                  {reportBusy ? "신고 중…" : "신고 제출"}
                </button>
              </div>
            )}
          </section>
        )}
        {showForm && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-bold text-ink">{editing ? "평가 수정" : "4가지 항목 평가"}</h3>
              <span className="text-[12px] text-[#8490a7]">모든 항목 필수 · 각 1~5점</span>
            </div>
            {labels.map((item) => (
              <ScorePicker key={item.key} title={item.label} hint={item.hint}
                value={scores[item.key]} disabled={busy}
                onChange={(score) => setScores((prev) => ({ ...prev, [item.key]: score }))} />
            ))}
            <div>
              <label htmlFor="review-comment" className="text-[13px] font-bold text-ink">협업 후기 <span className="font-normal text-muted">(선택)</span></label>
              <textarea id="review-comment" maxLength={500} rows={4} value={scores.comment} disabled={busy}
                placeholder="서로 도움이 되었던 점이나 개선할 점을 구체적이고 존중하는 언어로 적어주세요. 연구 개인정보는 쓰지 말아 주세요."
                onChange={(e) => setScores((prev) => ({ ...prev, comment: e.target.value }))}
                className="mt-2 w-full resize-y rounded-xl border border-[#dfe5f1] p-4 text-[13px] leading-6 outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:opacity-60" />
              <p className="mt-1 text-right text-[11px] text-muted">{scores.comment.length}/500</p>
            </div>
            <div className="rounded-xl bg-[#f7f9fd] p-3 text-[12px] leading-6 text-muted">
              신뢰할 수 있는 평가를 위해 실제 경험만 작성해 주세요. 허위 주장·개인정보·비방은 신고 및 운영 검토 대상입니다.
              제출하면 수정은 한 번, 48시간 이내에만 가능하며 서버에 기록이 남습니다.
            </div>
            {saveError && <p role="alert" className="text-[13px] font-semibold text-danger">{saveError}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              {editing && <button type="button" disabled={busy} onClick={() => { setEditing(false); setSaveError(""); }} className="min-h-11 rounded-lg border border-line px-5 text-sm font-semibold text-muted">수정 취소</button>}
              <button type="button" disabled={!valid || busy} onClick={save}
                className="min-h-11 rounded-xl bg-[#5142d8] px-6 text-[13px] font-bold text-white shadow-[0_5px_14px_rgba(81,66,216,0.15)] hover:bg-[#4334be] disabled:cursor-not-allowed disabled:opacity-40">
                {busy ? "안전하게 저장하는 중…" : editing ? "수정된 평가 저장" : "협업 평가 제출"}
              </button>
            </div>
          </div>
        )}
        {!context.eligible && !existing && <p className="text-sm leading-6 text-muted">이 협업은 평가 작성 기간이 지났거나 아직 평가 가능한 상태가 아닙니다.</p>}
        {success && <p role="status" className="rounded-xl bg-[#eef8f1] p-3 text-[13px] font-semibold text-[#287747]">{success}</p>}
      </div>
    </section>
  );
}
