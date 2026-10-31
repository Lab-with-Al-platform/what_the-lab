/**
 * Evaluation UI for the adopted B expert profile.
 *
 * The service has not launched a verified, bilateral review datastore.
 * Never generate sample scores or infer ratings from a collaboration's dates.
 * This component intentionally exposes a clear and polished empty state.
 */
const REVIEW_CRITERIA = ["전문성", "소통", "일정 준수", "결과물 품질"] as const;

export function ExpertReviewSummary({ completedCount }: { completedCount: number }) {
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
            현재 공개 요약에 포함된 완료 협업은 {completedCount}건(최근 최대 50건)입니다. 협업 기록과 평가는 서로 다른 정보이며, 평점은 검증된 평가가 도입된 후 표시됩니다.
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
