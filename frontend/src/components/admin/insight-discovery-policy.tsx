"use client";

import { DISCOVERY_PROFILES, discoveryWindowLabels, type DiscoveryPolicy } from "@/lib/admin-insights";
import { ADMIN_INPUT } from "./insight-editor";

/** 설정과 예정된 탐색 순서를 표시할 뿐, 이 컴포넌트에서 수집을 실행하지 않습니다. */
export function InsightDiscoveryPolicy({ policy, initialDays, maxItems, busy, onChange }: {
  policy: DiscoveryPolicy; initialDays: number; maxItems: number; busy: boolean;
  onChange: (update: Partial<DiscoveryPolicy>) => void;
}) {
  return <section aria-labelledby="discovery-policy-title" className="space-y-4 rounded-card border border-line bg-page p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 id="discovery-policy-title" className="text-base font-semibold">후보 부족 시 기간 확장</h3><p className="mt-1 text-xs leading-6 text-muted">최근 자료를 먼저 찾고, 중복을 제외한 적합 후보가 부족하면 이전 기간을 추가로 조회하는 정책입니다.</p></div><span className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-muted">예정된 탐색 규칙 · 실행 미연결</span></div>
    <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" className="accent-brand" disabled={busy} checked={policy.enabled} onChange={(event) => onChange({ enabled: event.target.checked })} />후보가 부족하면 기간 자동 확장</label>
    <fieldset disabled={busy || !policy.enabled} className="min-w-0 space-y-4">
      <label className="block max-w-sm text-sm font-semibold">기간 확장 기준 후보 수<input type="number" className={ADMIN_INPUT} min={1} max={maxItems} required value={policy.target_candidates} onChange={(event) => onChange({ target_candidates: Number(event.target.value) })} /></label>
      <p className="text-xs leading-6 text-muted">현재 회차에서 새로 찾은 적합 후보가 이 수에 못 미치면 확장합니다. 최대 저장 수({maxItems}개) 이하로 설정하며, 게시 할당량이나 자동 승인 기준이 아닙니다.</p>
      <div className="space-y-3">{DISCOVERY_PROFILES.map((profile) => <div key={profile.id} className="grid min-w-0 gap-3 rounded-card border border-line bg-white p-4 lg:grid-cols-[1fr_150px_1.4fr] lg:items-center">
        <p className="text-sm font-semibold">{profile.label}</p>
        <label className="min-w-0 text-xs font-semibold">최대 탐색 기간<select aria-label={`${profile.label} 최대 탐색 기간`} className={ADMIN_INPUT} value={policy[profile.id]} onChange={(event) => onChange({ [profile.id]: Number(event.target.value) })}>{profile.stages.map((days) => <option key={days} value={days}>{days}일</option>)}</select></label>
        <div className="min-w-0"><p className="text-sm font-semibold leading-6 text-brand" aria-label={`${profile.label} 탐색 순서`}>{discoveryWindowLabels(profile.stages, policy[profile.id], policy.enabled, initialDays)}</p><p className="mt-1 text-xs leading-5 text-muted">{profile.note}</p></div>
      </div>)}</div>
      <details className="rounded-card border border-line bg-white p-4"><summary className="cursor-pointer text-sm font-semibold">조회량·실행 시간 상한</summary><div className="mt-3 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold">회차당 최대 출처 요청 수<input type="number" className={ADMIN_INPUT} required min={1} max={100} value={policy.max_source_requests} onChange={(event) => onChange({ max_source_requests: Number(event.target.value) })} /></label>
        <label className="text-xs font-semibold">회차당 최대 실행 시간 · 초<input type="number" className={ADMIN_INPUT} required min={10} max={600} value={policy.max_run_seconds} onChange={(event) => onChange({ max_run_seconds: Number(event.target.value) })} /></label>
      </div><p className="mt-2 text-xs leading-6 text-muted">모든 출처·유형을 합친 회차 상한입니다. 페이지 이동·재시도도 요청 수에 포함하는 설계이며, 실제 제한 적용은 수집기 연결 때 검증합니다.</p></details>
    </fieldset>
    {!policy.enabled ? <p className="text-sm text-muted">고정 기간 모드 · 최근 {initialDays}일만 탐색하도록 설정합니다.</p> : null}
    <ul className="list-inside list-disc space-y-1 text-xs leading-6 text-muted"><li>원문 발표일 기준 · 수집일과 구분하며 같은 기간을 반복 조회하지 않습니다.</li><li>상한까지 후보가 없으면 부족한 채 종료합니다. 품질 조건은 낮추지 않습니다.</li><li>통신 오류·호출 제한은 ‘후보 없음’으로 판단해 과거 범위를 넓히지 않습니다.</li><li>과거 대표 사례·핵심 연구는 별도 발굴 대상으로 남깁니다. 자동 무제한 검색은 하지 않습니다.</li></ul>
  </section>;
}
