/**
 * Evaluation UI for the adopted B expert profile.
 *
 * The service has not launched a verified, bilateral review datastore.
 * Never generate sample scores or infer ratings from a collaboration's dates.
 * This component intentionally exposes a clear and polished empty state.
 */
import type { DemoReview } from "@/lib/expert-local-demo";

const REVIEW_CRITERIA = ["전문성", "소통", "일정 준수", "결과물 품질"] as const;

export function ExpertReviewSummary({ completedCount, demo }: { completedCount: number; demo?: DemoReview | null }) {
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
          실제 평점·리뷰는 평가 시스템 구축 후 검증된 데이터만 표시됩니다.
        </div>
      </section>
    );
  }

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
