"use client";

import { useCallback, useEffect, useState } from "react";
import { requestApi } from "@/lib/api";
import { SOURCE_KIND_LABELS, formatAdminTime, type DiscoveryPolicy, type CollectionSource, type CollectionConfig, type CollectionSettings } from "@/lib/admin-insights";
import { ADMIN_INPUT } from "./insight-editor";
import { ADMIN_BUTTON } from "./admin-ui";
import { InsightDiscoveryPolicy } from "./insight-discovery-policy";

const PATH = "/admin/insights/collection-settings";
const BUTTON = ADMIN_BUTTON;

export function InsightCollectionSettings({ onDirty }: { onDirty: (dirty: boolean) => void }) {
  const [saved, setSaved] = useState<CollectionSettings | null>(null);
  const [config, setConfig] = useState<CollectionConfig | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = !!config && JSON.stringify(config) !== JSON.stringify(saved?.config);
  const load = useCallback(async () => {
    const value = await requestApi<CollectionSettings>(PATH);
    setSaved(value); setConfig(value.config); setError(""); setNotice("");
  }, []);
  useEffect(() => { load().catch((problem) => setError(problem.message)); }, [load]);
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = ""; }
    function guard(event: MouseEvent) {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.getAttribute("href")?.startsWith("#")) return;
      if (!window.confirm("저장하지 않은 수집 설정을 버리고 이동할까요?")) { event.preventDefault(); event.stopPropagation(); }
    }
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guard, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", guard, true); };
  }, [dirty]);

  function change(update: Partial<CollectionConfig>) { if (config) setConfig({ ...config, ...update }); }
  function changePolicy(update: Partial<DiscoveryPolicy>) {
    if (config) change({ discovery_policy: { ...config.discovery_policy, ...update }, ...(update.enabled ? { lookback_days: 30 } : {}) });
  }
  function changeMaximum(maximum: number) {
    if (config) change({ max_items: maximum, discovery_policy: { ...config.discovery_policy,
      target_candidates: Math.min(config.discovery_policy.target_candidates, Math.max(1, maximum)) } });
  }
  function changeSource(index: number, update: Partial<CollectionSource>) {
    if (config) change({ sources: config.sources.map((source, i) => i === index ? { ...source, ...update } : source) });
  }
  function toggleKind(index: number, kind: keyof typeof SOURCE_KIND_LABELS, checked: boolean) {
    if (!config) return;
    // 기존 배열을 직접 바꾸지 않고 새 배열을 만들어 React가 변경을 감지하게 합니다.
    const selected = new Set(config.sources[index].content_kinds ?? []);
    if (checked) selected.add(kind); else selected.delete(kind);
    changeSource(index, { content_kinds: (Object.keys(SOURCE_KIND_LABELS) as (keyof typeof SOURCE_KIND_LABELS)[]).filter((value) => selected.has(value)) });
  }
  async function save() {
    if (!saved || !config || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const normalized = { ...config, keywords: config.keywords.map((value) => value.trim()).filter(Boolean) };
      const value = await requestApi<CollectionSettings>(PATH, { method: "PUT", body: JSON.stringify({ expected_version: saved.version, config: normalized }) });
      setSaved(value); setConfig(value.config); setNotice("팀 공통 수집 설정을 저장했습니다. 수집·예약 실행은 시작되지 않았습니다.");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "설정을 저장하지 못했습니다."); }
    finally { setBusy(false); }
  }
  return <section className="min-w-0 rounded-card border border-line bg-white p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold">자동수집 설정</h2><p className="mt-2 text-sm leading-7 text-muted">출처와 수집 조건을 팀 공통 DB에 보관합니다. 게시 주기와 별개의 설정입니다.</p></div><span className="rounded-full bg-brand-soft px-3 py-2 text-xs font-semibold text-brand">설정 저장만 · 실행기 미연결</span></div>
    {error ? <p role="alert" className="mt-5 whitespace-pre-wrap rounded-card bg-danger-soft p-4 text-sm leading-7">{error}</p> : null}
    {notice ? <p role="status" className="mt-5 rounded-card bg-brand-soft p-4 text-sm leading-7">{notice}</p> : null}
    {!config ? <div className="mt-6"><p>설정을 불러오고 있습니다…</p>{error ? <button className={`${BUTTON} mt-4`} onClick={() => void load().catch((problem) => setError(problem.message))}>설정 다시 조회</button> : null}</div> : <form className="mt-7 space-y-7" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-semibold">수집 간격 · 일<input className={ADMIN_INPUT} type="number" min={1} max={30} required value={config.interval_days} onChange={(e) => change({ interval_days: Number(e.target.value) })} /></label>
        <label className="text-sm font-semibold">기준 시각 · 한국 시간<input className={ADMIN_INPUT} type="time" required value={config.preferred_time} onChange={(e) => change({ preferred_time: e.target.value })} /></label>
        <label className="text-sm font-semibold">우선 탐색 기간 · 일<input className={ADMIN_INPUT} type="number" min={1} max={365} required readOnly={config.discovery_policy.enabled} aria-describedby="initial-window-note" value={config.lookback_days} onChange={(e) => change({ lookback_days: Number(e.target.value) })} /><span id="initial-window-note" className="mt-1 block text-xs font-normal leading-5 text-muted">{config.discovery_policy.enabled ? "단계별 확장은 최근 30일부터 시작" : "고정 기간 모드에서는 직접 변경 가능"}</span></label>
        <label className="text-sm font-semibold">회차당 최대 저장 후보 수<input className={ADMIN_INPUT} type="number" min={1} max={50} required value={config.max_items} onChange={(e) => changeMaximum(Number(e.target.value))} /><span className="mt-1 block text-xs font-normal leading-5 text-muted">저장 상한 · 게시 수량과는 별개</span></label>
      </fieldset>
      <InsightDiscoveryPolicy policy={config.discovery_policy} initialDays={config.lookback_days} maxItems={config.max_items} busy={busy} onChange={changePolicy} />
      <label className="block text-sm font-semibold">검색 키워드 · 한 줄에 하나, 최대 20개<textarea className={ADMIN_INPUT} rows={4} disabled={busy} value={config.keywords.join("\n")} onChange={(e) => change({ keywords: e.target.value.split("\n") })} /></label>
      <fieldset disabled={busy} className="space-y-4"><legend className="mb-2 text-base font-semibold">원문·서지 출처 관리 · {config.sources.length}곳</legend><p className="text-xs leading-6 text-muted">출처마다 활용할 글을 복수 선택합니다. 용도는 탐색 방향이며, 그곳의 모든 글이 검증된 협업사례라는 뜻은 아닙니다. 연구기관 소식·블로그는 연결된 논문과 대조하세요. Crossref는 서지 대조용입니다. URL에 키·암호·검색 매개변수를 넣지 마세요. 실제 수집 연결·이용 조건 검증은 다음 단계입니다.</p>
        {config.sources.map((source, index) => <div key={index} className="grid min-w-0 gap-3 rounded-card border border-line p-4 xl:grid-cols-[auto_1fr_1.5fr_auto]">
          <label className="flex min-h-11 items-center gap-2 text-sm"><input aria-label={`출처 ${index + 1} 수집 대상`} type="checkbox" checked={source.selected} onChange={(e) => changeSource(index, { selected: e.target.checked })} />대상</label>
          <label className="min-w-0 text-xs font-semibold">출처 {index + 1} 이름<input className={ADMIN_INPUT} maxLength={100} required value={source.name} onChange={(e) => changeSource(index, { name: e.target.value })} /></label>
          <label className="min-w-0 text-xs font-semibold">출처 {index + 1} 기본 URL<input className={ADMIN_INPUT} type="url" maxLength={1000} required value={source.url} onChange={(e) => changeSource(index, { url: e.target.value })} /></label>
          <button type="button" className={`${BUTTON} self-end`} disabled={config.sources.length <= 1} aria-label={`출처 ${index + 1} 삭제`} onClick={() => change({ sources: config.sources.filter((_, i) => i !== index) })}>삭제</button>
          <fieldset aria-label={`출처 ${index + 1} 활용 용도`} className="flex min-w-0 flex-wrap items-center gap-2 xl:col-span-2 xl:col-start-2"><legend className="mb-2 text-xs text-muted">활용할 글 · 복수 선택</legend>{(Object.entries(SOURCE_KIND_LABELS) as [keyof typeof SOURCE_KIND_LABELS, string][]).map(([kind, label]) => {
            const checked = source.content_kinds?.includes(kind) ?? false;
            return <label key={kind} className={`${BUTTON} cursor-pointer focus-within:ring-2 focus-within:ring-brand/20 ${checked ? "border-brand/30 bg-brand-soft text-brand" : "bg-white text-muted"}`}><input type="checkbox" className="accent-brand" aria-label={`출처 ${index + 1} ${label}`} checked={checked} onChange={(event) => toggleKind(index, kind, event.target.checked)} />{label}</label>;
          })}{!source.content_kinds?.length ? <span className="text-xs text-muted">미분류</span> : null}</fieldset>
        </div>)}
        <button type="button" className={BUTTON} disabled={config.sources.length >= 20} onClick={() => change({ sources: [...config.sources, { name: "", url: "", selected: true, content_kinds: [] }] })}>출처 추가</button>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5"><p className="text-xs leading-6 text-muted">{saved?.saved ? `저장 버전 ${saved.version} · ${formatAdminTime(saved.updated_at)}` : "아직 저장하지 않은 기본 제안값입니다."}<br />{dirty ? "저장하지 않은 설정 있음" : "현재 표시된 설정"} · 자동 수집과 자동 게시가 켜지지 않습니다.</p><div className="flex flex-wrap gap-2"><button type="button" className={BUTTON} disabled={busy} onClick={() => {
        if (!dirty || window.confirm("저장하지 않은 설정을 버리고 다시 조회할까요?")) void load().catch((problem) => setError(problem.message));
      }}>설정 다시 조회</button><button type="submit" className={`${BUTTON} bg-brand text-white`} disabled={busy || (saved?.saved && !dirty)}>{busy ? "저장 중…" : "설정 저장"}</button></div></div>
    </form>}
  </section>;
}
