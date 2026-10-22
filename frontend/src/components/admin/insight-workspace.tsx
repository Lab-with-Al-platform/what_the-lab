"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageContainer } from "@/components/page-container";
import { ApiError, requestApi } from "@/lib/api";
import { STATUS_LABELS, visiblePageNumbers, type WorkspaceItem, type WorkspaceResult } from "@/lib/admin-insights";
import { ADMIN_BUTTON } from "./admin-ui";
import { InsightEditorDialog } from "./insight-editor-dialog";
import { InsightCollectionSettings } from "./insight-collection-settings";
import { InsightWorkspaceTable } from "./insight-workspace-table";
import styles from "./insight-workspace.module.css";

const MENUS = [{ id: "all", label: "전체 목록", description: "수집후보와 게시글" },
  { id: "collected", label: "수집후보", description: "초안·검토 대기·수정본" },
  { id: "published", label: "게시글", description: "공개 중인 원고" },
  { id: "settings", label: "자동수집 설정", description: "주기·출처·검색 조건" }] as const;
type Menu = typeof MENUS[number]["id"];
const BUTTON = ADMIN_BUTTON;
const EMPTY: WorkspaceResult = { items: [], total: 0, page: 1, counts: { all: 0, collected: 0, published: 0 }, categories: [], keywords: [] };
// 표의 행 수를 제한해 긴 카드처럼 세로로 늘어나지 않게 합니다.
const PAGE_SIZE = 6;

export function InsightAdminWorkspace() {
  const [gate, setGate] = useState("loading");
  const [retry, setRetry] = useState(0);
  const [menu, setMenu] = useState<Menu>("all");
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
  const [settingsDirty, setSettingsDirty] = useState(false);
  const dirtyChanged = useCallback((value: boolean) => setSettingsDirty(value), []);
  // 사이드 메뉴가 조회 범위의 유일한 기준입니다. 같은 기능의 필터를 두지 않습니다.
  const scope = menu === "settings" ? "all" : menu;
  const activeFilters = [kind, status, category, keyword].filter(Boolean).length;
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
    if (gate !== "granted" || menu === "settings") return;
    const controller = new AbortController();
    setLoading(true); setError("");
    const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE), scope, q: search, order });
    if (kind) params.set("kind", kind); if (status) params.set("status", status);
    if (category) params.set("category", category); if (keyword) params.set("keyword", keyword);
    requestApi<WorkspaceResult>(`/admin/insights/workspace?${params}`, { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) setData(value); })
      .catch((problem) => { if (!controller.signal.aborted) {
        setError(problem.message); setData(EMPTY);
        if (problem instanceof ApiError && [401, 403].includes(problem.status ?? 0)) setGate("blocked");
      } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [gate, menu, scope, kind, status, category, keyword, page, search, order, version]);

  function changeMenu(next: Menu) {
    if (settingsDirty && !window.confirm("저장하지 않은 수집 설정을 버리고 이동할까요?")) return;
    setMenu(next); setStatus(""); setPage(1); setError("");
  }
  function reset() {
    setKind(""); setStatus(""); setCategory(""); setKeyword(""); setQuery(""); setSearch(""); setPage(1);
  }
  return <PageContainer className="py-4 md:py-6">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold tracking-wide text-brand">운영 · 인사이트</p><h1 className="mt-1 text-2xl font-bold text-ink">인사이트 관리자</h1></div>{gate === "granted" && menu !== "settings" ? <button className={`${BUTTON} bg-brand text-white`} onClick={() => setSelected({ item: null })}>후보 직접 등록</button> : null}</div>
    {gate === "loading" ? <p role="status">관리자 권한을 확인하고 있습니다…</p> : gate !== "granted" ? <section className="rounded-card border border-line bg-white p-6"><h2 className="text-xl font-semibold">로그인과 인사이트 관리자 권한이 필요합니다</h2><p className="mt-3 text-sm text-muted">{error || "관리자 계정으로 로그인해 주세요."}</p><div className="mt-5 flex gap-3"><Link className={`${BUTTON} inline-flex items-center`} href="/login">로그인 페이지</Link><button className={BUTTON} onClick={() => setRetry(retry + 1)}>권한 다시 확인</button></div></section> : <div className="grid items-start gap-3 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-6">
      <aside className={styles.sidebar}><nav aria-label="인사이트 관리자 메뉴" className={styles.menu}>{MENUS.map((item) => <button key={item.id} type="button" title={item.description} aria-current={menu === item.id ? "page" : undefined} className={styles.menuButton} onClick={() => changeMenu(item.id)}><span>{item.label}</span>{item.id !== "settings" ? <span className={styles.count}>{data.counts[item.id]}</span> : null}</button>)}</nav></aside>
      <div className="min-w-0">{menu === "settings" ? <InsightCollectionSettings onDirty={dirtyChanged} /> : <section className={styles.panel}>
        <div className={styles.toolbar}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><h2 className="text-base font-bold">{MENUS.find((item) => item.id === menu)?.label}</h2><span className="rounded-md bg-page px-2 py-0.5 text-xs text-muted">{data.total}</span></div><button aria-label="목록 새로고침" className={`${BUTTON} bg-white text-muted`} disabled={loading} onClick={() => setVersion(version + 1)}>↻ 새로고침</button></div>
        <form className="mt-3 space-y-2" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(query); }}>
          <div className="flex items-center gap-2"><div className={styles.search}><input aria-label="원고 제목·DOI·키워드 검색" className={styles.control} maxLength={200} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="제목·DOI·키워드 검색" /></div><button className={`${BUTTON} bg-ink text-white`}>검색</button><button type="button" aria-label="필터 초기화" className={`${BUTTON} bg-white text-muted`} onClick={reset}>초기화</button></div>
          <details><summary className={styles.filterSummary}>상세 필터 {activeFilters ? <span className="font-semibold text-brand">{activeFilters}개 적용</span> : null}</summary><div className={styles.filters}>
            <label className={styles.filterLabel}>유형<select aria-label="유형 필터" className={styles.control} value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }}><option value="">사례·트렌드 전체</option><option value="case">협업사례</option><option value="trend">AI 트렌드</option></select></label>
            <label className={styles.filterLabel}>상태<select aria-label="상태 필터" className={styles.control} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">모든 상태</option>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className={styles.filterLabel}>연구 분야<select aria-label="분야 카테고리 필터" className={styles.control} value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}><option value="">모든 분야</option>{data.categories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className={styles.filterLabel}>분류 키워드<select aria-label="키워드 필터" className={styles.control} value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }}><option value="">모든 키워드</option>{data.keywords.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className={styles.filterLabel}>정렬<select aria-label="등록·수집일 정렬" className={styles.control} value={order} onChange={(e) => { setOrder(e.target.value); setPage(1); }}><option value="newest">등록·수집일 최신순</option><option value="oldest">등록·수집일 오래된순</option></select></label>
          </div><p className={styles.filterNote}>분야·키워드 선택지는 현재 게시된 원고 기준입니다. 후보에만 있는 값은 검색으로 찾을 수 있습니다.</p></details>
        </form>
        {error ? <p role="alert" className="mt-4 rounded-card bg-danger-soft p-4 text-sm leading-7">{error}</p> : null}
        </div>
        <div className={styles.resultBar}><p role="status">{loading ? "목록을 불러오고 있습니다…" : `검색 결과 ${data.total}건`}</p><span>등록·수집일 기준 · {PAGE_SIZE}개씩 표시</span></div>
        <InsightWorkspaceTable items={data.items} loading={loading} onSelect={(item) => setSelected({ item })} />
        {!loading && !data.items.length ? <div className="py-10 text-center text-sm"><p className="text-muted">조건에 맞는 원고가 없습니다.</p><button className={`${BUTTON} mt-3`} onClick={reset}>필터 초기화</button></div> : null}
        <nav className={styles.pagination} aria-label="인사이트 페이지 이동">
          <span className="sr-only">총 {totalPages}페이지, 현재 {page}페이지</span>
          <button type="button" className={styles.pageButton} aria-label="이전 페이지" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m14 6-6 6 6 6" /></svg></button>
          {visiblePageNumbers(page, totalPages).map((number) => <button key={number} type="button" className={styles.pageButton} aria-label={`${number}페이지`} aria-current={number === page ? "page" : undefined} disabled={loading} onClick={() => setPage(number)}>{number}</button>)}
          <button type="button" className={styles.pageButton} aria-label="다음 페이지" disabled={loading || page >= totalPages} onClick={() => setPage(page + 1)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m10 6 6 6-6 6" /></svg></button>
        </nav>
      </section>}</div>
    </div>}
    {selected ? <InsightEditorDialog item={selected.item} onClose={() => setSelected(null)} onChanged={() => setVersion((value) => value + 1)} /> : null}
  </PageContainer>;
}
