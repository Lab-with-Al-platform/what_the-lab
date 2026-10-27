"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OperationsFrame } from "./operations-frame";
import { ApiError, requestApi } from "@/lib/api";
import { visiblePageNumbers, type WorkspaceItem, type WorkspaceResult } from "@/lib/admin-insights";
import { ADMIN_BUTTON } from "./admin-ui";
import { InsightEditorDialog } from "./insight-editor-dialog";
import { InsightImportDialog } from "./insight-import-dialog";
import { InsightCollectionSettings } from "./insight-collection-settings";
import { InsightWorkspaceTable } from "./insight-workspace-table";
import { InsightStatisticsPanel, type ViewMetric } from "./insight-statistics";
import styles from "./insight-workspace.module.css";

const MENUS = [{ id: "all", label: "전체 목록", description: "수집후보와 게시글" },
  { id: "collected", label: "수집후보", description: "초안·검토 대기·수정본" },
  { id: "published", label: "게시글", description: "공개 중인 원고" },
  { id: "stats", label: "통계", description: "공개 글 조회수" },
  { id: "settings", label: "자동수집 설정", description: "주기·출처·검색 조건" }] as const;
type Menu = typeof MENUS[number]["id"];
const BUTTON = ADMIN_BUTTON;
const EMPTY: WorkspaceResult = { items: [], total: 0, page: 1, counts: { all: 0, collected: 0, published: 0 }, categories: [], keywords: [] };
// 표의 행 수를 제한해 긴 카드처럼 세로로 늘어나지 않게 합니다.
const PAGE_SIZE = 6;

export function InsightAdminWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const [gate, setGate] = useState("loading");
  const [retry, setRetry] = useState(0);
  const menu = (MENUS.some(item => item.id === params.get("tab")) ? params.get("tab") : "all") as Menu;
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [keyword, setKeyword] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState("newest");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [data, setData] = useState<WorkspaceResult>(EMPTY);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<{ item: WorkspaceItem | null } | null>(null);
  const [importing, setImporting] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [views, setViews] = useState<Record<string, { period_views: ViewMetric; cumulative_views: ViewMetric }>>({});
  const viewPreset = params.get("viewPreset") || "30d";
  const dirtyChanged = useCallback((value: boolean) => setSettingsDirty(value), []);
  // 상단 탭이 조회 범위의 유일한 기준입니다. 같은 기능의 필터를 두지 않습니다.
  const scope = menu === "collected" || menu === "published" ? menu : "all";
  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  useEffect(() => {
    let active = true;
    setGate("loading"); setError("");
    requestApi<{ can_manage_insights: boolean }>("/admin/insights/access")
      .then((value) => { if (active) setGate(value.can_manage_insights ? "granted" : "blocked"); })
      .catch((problem) => { if (active) { setGate("blocked"); setError(problem.message); } });
    return () => { active = false; };
  }, [retry]);

  useEffect(() => {
    if (gate !== "granted" || menu === "settings" || menu === "stats") return;
    const controller = new AbortController();
    setLoading(true); setError("");
    const listOrder = order === "oldest" || order === "period" || order === "cumulative" ? order : "newest";
    const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE), scope, q: search, order: listOrder });
    if (listOrder === "period" || listOrder === "cumulative") params.set("view_preset", viewPreset);
    if (kind) params.set("kind", kind); if (status) params.set("status", status);
    if (category) params.set("category", category); if (keyword) params.set("keyword", keyword);
    requestApi<WorkspaceResult>(`/admin/insights/workspace?${params}`, { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) setData(value); })
      .catch((problem) => { if (!controller.signal.aborted) {
        setError(problem.message); setData(EMPTY);
        if (problem instanceof ApiError && [401, 403].includes(problem.status ?? 0)) setGate("blocked");
      } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [gate, menu, scope, kind, status, category, keyword, page, search, order, version, viewPreset]);

  useEffect(() => {
    if (gate !== "granted" || menu === "settings" || menu === "stats") return;
    const ids = data.items.map(item => item.publication_id).filter((id): id is string => Boolean(id));
    if (!ids.length) { setViews({}); return; }
    let active = true;
    requestApi<{ items: Record<string, { period_views: ViewMetric; cumulative_views: ViewMetric }> }>(`/admin/insights/statistics/counts?ids=${ids.join(",")}&preset=${viewPreset}`)
      .then(body => { if (active) setViews(body.items); })
      .catch(() => { if (active) setViews({}); });
    return () => { active = false; };
  }, [data.items, gate, menu, viewPreset]);

  function changeMenu(next: Menu) {
    if (settingsDirty && !window.confirm("저장하지 않은 수집 설정을 버리고 이동할까요?")) return;
    const search = new URLSearchParams(params);
    if (next === "all") search.delete("tab"); else search.set("tab", next);
    router.replace(`/admin/insights?${search}`, { scroll: false });
    setStatus(""); setPage(1); setError("");
  }
  function changePreset(value: string) {
    const search = new URLSearchParams(params);
    search.set("viewPreset", value);
    router.replace(`/admin/insights?${search}`, { scroll: false });
    setPage(1);
  }
  function reset() {
    setKind(""); setStatus(""); setCategory(""); setKeyword(""); setQuery(""); setSearch(""); setOrder("newest"); setPage(1);
    const search = new URLSearchParams(params);
    search.delete("viewPreset");
    router.replace(`/admin/insights?${search}`, { scroll: false });
  }
  const presetLabel = viewPreset === "7d" ? "최근 7일" : viewPreset === "today" ? "오늘" : viewPreset === "month" ? "이번 달" : "최근 30일";
  const orderLabel = order === "oldest" ? "등록·수집일 오래된순" : order === "period" ? "기간 조회수순" : order === "cumulative" ? "누적 조회수순" : "등록·수집일 최신순";
  return <OperationsFrame title="인사이트 관리" description="수집후보와 게시글을 한곳에서 검토하고, 원고의 공개 상태를 관리하세요.">
    {gate === "loading" ? <p role="status">관리자 권한을 확인하고 있습니다…</p> : gate !== "granted" ? <section className="rounded-card border border-line bg-white p-6"><h2 className="text-xl font-semibold">로그인과 인사이트 관리자 권한이 필요합니다</h2><p className="mt-3 text-sm text-muted">{error || "관리자 계정으로 로그인해 주세요."}</p><div className="mt-5 flex gap-3"><Link className={`${BUTTON} inline-flex items-center`} href="/login">로그인 페이지</Link><button className={BUTTON} onClick={() => setRetry(retry + 1)}>권한 다시 확인</button></div></section> : <div className={styles.panel}>
      <nav aria-label="인사이트 관리 탭" className={styles.tabs}>{MENUS.map((item) => <button key={item.id} type="button" title={item.description} aria-current={menu === item.id ? "page" : undefined} className={`${styles.tabButton} ${item.id === "settings" ? styles.tabSpan : ""}`} onClick={() => changeMenu(item.id)}><span>{item.label}</span>{item.id !== "settings" && item.id !== "stats" ? <span className={styles.count}>{data.counts[item.id]}</span> : null}</button>)}</nav>
      <div className="min-w-0">{menu === "settings" ? <div className="p-4 md:p-5"><InsightCollectionSettings onDirty={dirtyChanged} /></div> : menu === "stats" ? <InsightStatisticsPanel /> : <section>
        <div className={styles.toolbar}>
        <h2 className="sr-only">{MENUS.find((item) => item.id === menu)?.label}</h2>
        <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(query); }}>
          <div className={styles.searchRow}><div className={styles.search}><input aria-label="원고 제목·DOI·키워드 검색" className={styles.control} maxLength={200} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="제목·DOI·키워드 검색" /></div><div className={styles.searchActions}><button className={`${BUTTON} bg-ink text-white`}>검색</button><button type="button" aria-label="필터 초기화" className={`${BUTTON} bg-white text-muted`} onClick={reset}>초기화</button><button type="button" aria-label="목록 새로고침" className={`${BUTTON} bg-white text-muted`} disabled={loading} onClick={() => setVersion(version + 1)}>새로고침</button></div><div className={styles.createActions}><button type="button" className={`${BUTTON} bg-white`} onClick={() => setImporting(true)}>후보 묶음 가져오기</button><button type="button" className={`${BUTTON} bg-brand text-white`} onClick={() => setSelected({ item: null })}>+ 후보 직접 등록</button></div></div>
        </form>
        {error ? <p role="alert" className="mt-4 rounded-card bg-danger-soft p-4 text-sm leading-7">{error}</p> : null}
        </div>
        <div className={styles.resultBar}><p role="status">{loading ? "목록을 불러오고 있습니다…" : `검색 결과 ${data.total}건`}</p><span>조회 기간 {presetLabel} · {orderLabel} · {PAGE_SIZE}개씩 표시</span></div>
        <InsightWorkspaceTable items={data.items} loading={loading} onSelect={(item) => setSelected({ item })} views={views} statHref={(publicationId) => `/admin/insights/statistics/${publicationId}?preset=${viewPreset}&from=published`} kind={kind} status={status} category={category} keyword={keyword} order={order} viewPreset={viewPreset} categories={data.categories} keywords={data.keywords} onKind={(value) => { setKind(value); setPage(1); }} onStatus={(value) => { setStatus(value); setPage(1); }} onCategory={(value) => { setCategory(value); setPage(1); }} onKeyword={(value) => { setKeyword(value); setPage(1); }} onOrder={(value) => { setOrder(value); setPage(1); }} onPreset={changePreset} />
        {!loading && !data.items.length ? <div className="py-10 text-center text-sm"><p className="text-muted">조건에 맞는 원고가 없습니다.</p><button className={`${BUTTON} mt-3`} onClick={reset}>필터 초기화</button></div> : null}
        <nav className={styles.pagination} aria-label="인사이트 페이지 이동">
          <span className="sr-only">총 {totalPages}페이지, 현재 {page}페이지</span>
          <button type="button" className={styles.pageButton} aria-label="이전 페이지" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m14 6-6 6 6 6" /></svg></button>
          {visiblePageNumbers(page, totalPages).map((number) => <button key={number} type="button" className={styles.pageButton} aria-label={`${number}페이지`} aria-current={number === page ? "page" : undefined} disabled={loading} onClick={() => setPage(number)}>{number}</button>)}
          <button type="button" className={styles.pageButton} aria-label="다음 페이지" disabled={loading || page >= totalPages} onClick={() => setPage(page + 1)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m10 6 6 6-6 6" /></svg></button>
        </nav>
      </section>}</div>
    </div>}
    {importing ? <InsightImportDialog onClose={() => setImporting(false)} onChanged={() => setVersion((value) => value + 1)} /> : null}
    {selected ? <InsightEditorDialog item={selected.item} onClose={() => setSelected(null)} onChanged={() => setVersion((value) => value + 1)} /> : null}
  </OperationsFrame>;
}
