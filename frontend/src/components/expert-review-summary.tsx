/**
 * Published, participant-verified post-collaboration review UI.
 * 5-star average and the Bayesian LAB TRUST index are separate measures.
 * Demo fixtures are local-only and labeled as such.
 */
"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { reportPublicReview, type PublicExpertRating } from "@/lib/reviews";
import { Modal } from "@/components/modal";
import type { DemoReview } from "@/lib/expert-local-demo";

const REVIEW_CRITERIA = ["전문성", "소통", "일정 준수", "결과물 품질"] as const;

export function ExpertReviewSummary({ completedCount, demo, verified }: { completedCount: number; demo?: DemoReview | null; verified?: PublicExpertRating | null }) {
  if (demo) {
    return (
      <section aria-labelledby="demo-review-summary" className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-[#f1dfc1] bg-gradient-to-br from-[#fffdf8] via-[#fffaf1] to-[#f8f5ed]">
          <div className="flex items-center justify-between gap-3 border-b border-[#f0e5d1] px-5 py-3">
            <h2 id="demo-review-summary" className="text-[13px] font-bold text-[#806032]">연구자 협업 평가</h2>
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">
              DEMO · 가상 평가
            </span>
          </div>
          <div className="grid gap-5 px-5 py-6 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center sm:gap-6">
            <div className="text-center sm:border-r sm:border-[#f0e5d1] sm:pr-5">
              <p className="text-[11px] font-semibold text-[#9c855b]">시연용 종합 평점</p>
              <div className="mt-2 flex items-baseline justify-center gap-1">
                <span aria-hidden="true" className="text-[25px] text-[#eea62f]">★</span>
                <strong className="text-[43px] font-bold tracking-[-0.055em] text-[#29324c]">{demo.average.toFixed(1)}</strong>
                <span className="text-xs text-[#9b96a0]">/ 5</span>
              </div>
              <p className="mt-1 text-[11px] text-[#977d51]">가상 후기 {demo.entries.length}건</p>
            </div>
            <div className="space-y-3">
              {demo.scores.map((score) => (
                <div key={score.label} className="grid grid-cols-[76px_minmax(0,1fr)_30px] items-center gap-3 text-[12px]">
                  <span className="font-medium text-[#727581]">{score.label}</span>
                  <div role="meter" aria-label={score.label + " 시연 점수"} aria-valuemin={0} aria-valuemax={5} aria-valuenow={score.value} className="h-2 overflow-hidden rounded-full bg-[#f1e7d8]">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#ffcb68] to-[#eca128]" style={{ width: `${score.value / 5 * 100}%` }} />
                  </div>
                  <span className="text-right font-bold tabular-nums text-[#56516a]">{score.value.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="border-t border-[#f0e5d1] px-5 py-2.5 text-[11px] leading-5 text-[#987b49]">
            화면 확인을 위한 가상의 점수입니다. 실제 이용자 평가·검증 정보가 아닙니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <h3 className="text-[15px] font-bold text-[#26314b]">시연용 협업 후기 {demo.entries.length}건</h3>
          <span className="text-[11px] font-medium text-[#93866f]">모든 후기는 가상 예시입니다</span>
        </div>
        <ul className="divide-y divide-[#e9edf5]">
          {demo.entries.map((entry) => (
            <li key={entry.id} className="grid gap-2 py-5 first:pt-1 sm:grid-cols-[106px_minmax(0,1fr)] sm:gap-4">
              <time dateTime={entry.date} className="text-xs text-[#8a94a9]">{entry.date.slice(0, 7).replace("-", ".")}</time>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-[13px] font-bold leading-6 text-ink">{entry.project}</h4>
                  <span className="text-[12px] font-bold text-[#b67b22]">★ {entry.score.toFixed(1)}</span>
                </div>
                <p className="mt-1 text-[11px] text-[#7685a0]">{entry.author} · 데모 후기</p>
                <p className="mt-2 rounded-xl bg-[#f5f7fc] px-4 py-3 text-[12px] leading-6 text-[#46516a]">“{entry.text}”</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="rounded-xl border border-[#e2e8f4] bg-[#f7f9fd] p-3 text-[11px] text-[#64718a]">
          실제 평점·LAB TRUST 신뢰 지수에는 이 가상 데이터가 반영되지 않습니다.
        </div>
      </section>
    );
  }

  if (verified && verified.count > 0) return <VerifiedReviewSummary data={verified} />;
  return (
    <section aria-labelledby="expert-review-summary" className="overflow-hidden rounded-2xl border border-[#f0e2c7] bg-gradient-to-br from-[#fffdf8] via-[#fffaf1] to-[#faf7f0]">
      <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] sm:gap-6 sm:p-6">
        <div className="flex flex-col justify-center sm:border-r sm:border-[#efe2cb] sm:pr-5">
          <p className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#98703c]">
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="m10 1.8 2.3 4.7 5.2.8-3.8 3.7.9 5.3L10 13.8 5.4 16.3l.9-5.3-3.8-3.7 5.2-.8L10 1.8Z" />
            </svg>
            연구자 협업 평가
          </p>
          <h2 id="expert-review-summary" className="mt-3 text-[19px] font-bold tracking-tight text-[#3d4150]">아직 공개된 평가가 없어요</h2>
          <p className="mt-2 text-xs leading-6 text-[#7b7e8b]">
            현재 공개 요약에 포함된 완료 협업은 {completedCount}건(최근 최대 50건)입니다. 협업 기록과 평가는 서로 다른 정보이며, 실제 종료된 협업에서 연구회원이 평가를 제출하고 공개 대기 기간이 지나면 점수가 표시됩니다.
          </p>
          <span className="mt-3 w-fit rounded-full border border-[#e7dbc6] bg-white/75 px-3 py-1.5 text-[11px] font-semibold text-[#96784e]">평가 점수 미제공</span>
        </div>
        <div className="grid content-center gap-3">
          {REVIEW_CRITERIA.map((label) => (
            <div key={label} className="grid grid-cols-[70px_minmax(0,1fr)_30px] items-center gap-3 text-[12px]">
              <span className="font-medium text-[#777785]">{label}</span>
              <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-[#efe9dc]">
                <div className="h-full w-0 rounded-full bg-[#e4ab52]" />
              </div>
              <span className="text-right font-semibold text-[#9c9485]" aria-label={label + " 평가 없음"}>—</span>
            </div>
          ))}
          <p className="pt-1 text-[11px] leading-5 text-[#988e7c]">미평가 상태를 0점으로 계산하거나 빈 막대를 평점으로 해석하지 않습니다.</p>
        </div>
      </div>
    </section>
  );
}

const CRITERIA_LABELS: { key: keyof PublicExpertRating["criteria"]; label: string }[] = [
  { key: "expertise", label: "전문성" },
  { key: "communication", label: "소통" },
  { key: "timeliness", label: "일정 준수" },
  { key: "quality", label: "결과물 품질" },
];

function VerifiedReviewSummary({ data }: { data: PublicExpertRating }) {
  const [reportId, setReportId] = useState<number | null>(null);
  const [reason, setReason] = useState("abuse");
  const [description, setDescription] = useState("");
  const [reportError, setReportError] = useState("");
  const [submittedIds, setSubmittedIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function submitReport() {
    if (reportId === null || submitting) return;
    setSubmitting(true);
    setReportError("");
    try {
      await reportPublicReview(reportId, reason, description);
      setSubmittedIds((ids) => [...ids, reportId]);
      setReportId(null);
      setDescription("");
    } catch (error) {
      setReportError(error instanceof ApiError ? error.message : "신고를 접수하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="verified-expert-reviews" className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-[#f0dfc4] bg-gradient-to-br from-[#fffdfa] via-[#fff9ec] to-[#fcfaf5]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0e7d7] px-5 py-3">
          <h2 id="verified-expert-reviews" className="text-[14px] font-bold text-[#695332]">연구자 협업 평가</h2>
          <span className="rounded-full bg-[#e4f4eb] px-2.5 py-1 text-[10px] font-bold text-[#267747]">실제 완료 협업 기반</span>
        </div>
        <div className="grid gap-5 px-5 py-6 sm:grid-cols-[165px_minmax(0,1fr)] sm:items-center">
          <div className="text-center sm:border-r sm:border-[#ece0cd] sm:pr-5">
            <p className="text-[11px] font-semibold text-[#958469]">종합 평점</p>
            <div className="mt-1 flex items-baseline justify-center gap-1">
              <span className="text-[26px] text-[#efa92d]" aria-hidden="true">★</span>
              <strong className="text-[43px] font-extrabold tracking-tight text-[#2c3450]">{data.average?.toFixed(1) ?? "—"}</strong>
              <span className="text-xs text-[#8991a1]">/ 5</span>
            </div>
            <p className="mt-1 text-[11px] font-medium text-[#8e866f]">검증된 평가 {data.count}건</p>
          </div>
          <div className="space-y-3">
            {CRITERIA_LABELS.map(({ key, label }) => {
              const score = data.criteria[key];
              return (
                <div key={key} className="grid grid-cols-[75px_minmax(0,1fr)_31px] items-center gap-3 text-[12px]">
                  <span className="font-medium text-[#787583]">{label}</span>
                  <div role="meter" aria-label={label + " 평균"} aria-valuemin={0} aria-valuemax={5} aria-valuenow={score ?? 0} className="h-2 overflow-hidden rounded-full bg-[#ece7de]">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#ffcc6b] to-[#eba12b]" style={{ width: (score ?? 0) / 5 * 100 + "%" }} />
                  </div>
                  <strong className="text-right tabular-nums text-[#565468]">{score?.toFixed(1) ?? "—"}</strong>
                </div>
              );
            })}
          </div>
        </div>
        <p className="border-t border-[#f0e7d7] px-5 py-3 text-[11px] leading-5 text-[#927d5f]">{data.policy}</p>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[16px] font-bold text-ink">협업 후기 {data.count}건</h3>
        <span className="text-[11px] text-muted">최근 최대 20건 · 익명으로 표시</span>
      </div>
      <ul className="divide-y divide-[#ecedf3]">
        {data.reviews.map((item) => (
          <li key={item.review_id} className="grid gap-2 py-5 first:pt-1 sm:grid-cols-[102px_minmax(0,1fr)] sm:gap-4">
            <time dateTime={item.created_at} className="text-xs text-muted">{item.created_at.slice(0,10).replaceAll("-",".")}</time>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-[13px] text-[#354566]">{item.author} · 완료 협업 평가</strong>
                <span className="text-[12px] font-bold text-[#bd8424]">★ {item.score.toFixed(1)}</span>
              </div>
              {item.comment ? (
                <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-[#f6f8fc] px-4 py-3 text-[13px] leading-6 text-[#526079]">{item.comment}</p>
              ) : <p className="mt-2 text-xs text-muted">점수 평가만 남겼습니다.</p>}
              <div className="mt-2 flex justify-end">
                {submittedIds.includes(item.review_id) ? (
                  <span className="text-[11px] font-semibold text-[#267747]">신고 접수됨</span>
                ) : (
                  <button type="button" onClick={() => { setReportId(item.review_id); setReportError(""); }} className="min-h-9 rounded-lg px-3 text-[11px] text-muted hover:bg-[#f2f4f9] hover:text-[#b35353]">부적절한 후기 신고</button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {reportId !== null && (
        <Modal title="후기 신고" description="부적절한 후기만 신고해 주세요. 운영자가 내용을 검토합니다."
          onClose={() => { if (!submitting) setReportId(null); }}
          footer={
            <div className="flex items-center justify-end gap-2">
              <button type="button" disabled={submitting} onClick={() => setReportId(null)} className="min-h-11 rounded-lg border border-line px-5 text-sm font-semibold text-muted">취소</button>
              <button type="button" disabled={submitting} onClick={submitReport} className="min-h-11 rounded-lg bg-[#5142d8] px-5 text-sm font-bold text-white disabled:opacity-50">
                {submitting ? "접수 중…" : "신고 접수"}
              </button>
            </div>
          }>
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-ink">
              신고 사유
              <select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm">
                <option value="abuse">욕설·비방·혐오</option>
                <option value="privacy">개인정보·연구 비밀 노출</option>
                <option value="false_claim">허위 사실 주장</option>
                <option value="other">기타</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-ink">
              자세한 내용 (선택)
              <textarea rows={3} maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)}
                placeholder="문제가 되는 내용을 간단히 설명해 주세요." className="mt-2 w-full rounded-lg border border-line p-3 text-[13px] leading-6" />
            </label>
            <p className="text-xs leading-5 text-muted">신고만으로 평가가 자동 삭제되지는 않습니다. 로그인한 회원만 신고할 수 있으며, 중복 신고는 제한됩니다.</p>
            {reportError && <p role="alert" className="text-sm font-semibold text-danger">{reportError}</p>}
          </div>
        </Modal>
      )}
    </section>
  );
}
