"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, requestApi } from "@/lib/api";

type Report = {
  report_id: number;
  review_id: number;
  reason: "abuse" | "privacy" | "false_claim" | "other";
  description: string;
  status: "pending" | "dismissed" | "actioned";
  created_at: string;
  comment: string;
  visibility: "visible" | "hidden";
  reviewer_side: "researcher" | "expert";
  reviewee_id: number;
};
const REASON = { abuse: "욕설·비방", privacy: "개인정보·연구 비밀", false_claim: "허위 사실", other: "기타" };
type Decision = "hide" | "dismiss" | "restore";

/** Moderator-only review queue; the backend checks is_admin on every action. */
export default function ReviewModerationPage() {
  const [items, setItems] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState("");
  const [working, setWorking] = useState<number | null>(null);
  const [reasonById, setReasonById] = useState<Record<number,string>>({});
  const [success, setSuccess] = useState("");

  const reload = useCallback(async () => {
    setLoading(true); setFailure("");
    try {
      setItems(await requestApi<Report[]>("/reviews/moderation/reports"));
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : "신고 목록을 불러오지 못했습니다.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function decide(report: Report, decision: Decision) {
    if (working !== null) return;
    const reason = (reasonById[report.report_id] ?? "").trim();
    if (reason.length < 5) {
      setFailure("처리 사유를 5자 이상 작성해 주세요.");
      return;
    }
    if (!window.confirm(decision === "hide" ? "이 후기를 비공개 처리할까요? 공개 평점 집계에서도 제외됩니다." : decision === "dismiss" ? "신고를 기각할까요?" : "후기를 복원할까요?")) return;
    setWorking(report.report_id); setFailure(""); setSuccess("");
    try {
      await requestApi(`/reviews/moderation/reports/${report.report_id}`, {
        method: "PUT", body: JSON.stringify({ decision, reason }),
      });
      setSuccess("검토 결정이 저장됐습니다. 변경된 공개 점수는 다음 조회부터 반영됩니다.");
      await reload();
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : "신고 처리에 실패했습니다.");
    } finally { setWorking(null); }
  }

  return <div className="space-y-6">
    <header className="rounded-2xl border border-[#e3e9f3] bg-gradient-to-r from-[#f7f9ff] to-white p-6 sm:p-8">
      <p className="text-[11px] font-bold tracking-[0.11em] text-[#5968ac]">TRUST & SAFETY</p>
      <h1 className="mt-2 text-[26px] font-extrabold tracking-tight text-[#263655]">협업 후기 신고 관리</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#6a7892]">
        신고는 자동 삭제되지 않습니다. 운영자가 내용을 검토하고 사유를 기록한 뒤 비공개·기각을 결정합니다.
        비공개 후기는 공개 평점과 후기 목록에서 제외됩니다.
      </p>
      <button type="button" onClick={()=>void reload()} className="mt-4 min-h-10 rounded-lg border border-[#cbd4e8] bg-white px-4 text-sm font-semibold text-[#365184]">목록 새로고침</button>
    </header>
    {failure && <p role="alert" className="rounded-xl border border-[#f0cfcf] bg-[#fff7f7] p-4 text-sm text-[#a23c3c]">{failure}</p>}
    {success && <p role="status" className="rounded-xl bg-[#eef8f3] p-4 text-sm font-semibold text-[#24724c]">{success}</p>}
    {loading ? <p role="status" className="py-12 text-center text-sm text-muted">신고를 확인하는 중…</p>
      : items.length === 0 ? <div className="rounded-2xl border border-[#e4e9f3] bg-white px-6 py-14 text-center">
        <span className="text-3xl" aria-hidden="true">✓</span>
        <h2 className="mt-3 text-lg font-bold text-ink">처리 대기 중인 신고가 없습니다.</h2>
        <p className="mt-2 text-sm text-muted">새 신고가 접수되면 이 목록에 표시됩니다.</p>
      </div> : (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-ink">처리 대기 {items.length}건</h2>
          {items.map((report) => <section key={report.report_id} className="rounded-2xl border border-[#e3e8f2] bg-white p-5 shadow-[0_6px_20px_rgba(15,34,77,0.045)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-[#fff1e7] px-3 py-1 text-xs font-bold text-[#9f5c2f]">{REASON[report.reason]}</span>
              <span className="text-[11px] text-muted">신고 #{report.report_id} · 후기 #{report.review_id}</span>
            </div>
            <p className="mt-3 break-words text-[12px] leading-6 text-[#66758f]">{report.description || "신고자가 별도 설명을 남기지 않았습니다."}</p>
            <p className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-[#edf0f5] bg-[#f7f9fd] px-4 py-4 text-[13px] leading-6 text-[#36445e]">{report.comment || "점수 평가만 있는 후기입니다."}</p>
            <p className="mt-2 text-[11px] text-muted">현재 공개 상태: {report.visibility === "visible" ? "공개" : "비공개"} · 대상 전문가 ID {report.reviewee_id}</p>
            <label className="mt-4 block text-[12px] font-bold text-[#40506d]">
              검토 사유 (필수, 5~300자)
              <textarea rows={2} maxLength={300} value={reasonById[report.report_id] ?? ""}
                onChange={(event) => setReasonById((prev)=>({...prev,[report.report_id]:event.target.value}))}
                className="mt-2 w-full rounded-xl border border-[#dce3ef] p-3 text-sm leading-6 outline-none focus:border-brand"
                placeholder="비공개·기각 결정의 근거를 기록해 주세요." />
            </label>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={()=>void decide(report,"dismiss")} disabled={working!==null} className="min-h-11 rounded-lg border border-[#d2dbe9] bg-white px-4 text-sm font-semibold text-[#485b79] disabled:opacity-50">신고 기각</button>
              {report.visibility === "hidden" ? (
                <button type="button" onClick={()=>void decide(report,"restore")} disabled={working!==null} className="min-h-11 rounded-lg bg-[#317b66] px-4 text-sm font-bold text-white disabled:opacity-50">후기 복원</button>
              ) : (
                <button type="button" onClick={()=>void decide(report,"hide")} disabled={working!==null} className="min-h-11 rounded-lg bg-[#ae4747] px-4 text-sm font-bold text-white disabled:opacity-50">후기 비공개</button>
              )}
            </div>
          </section>)}
        </div>
      )}
  </div>;
}
