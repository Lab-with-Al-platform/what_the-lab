"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, requestApi } from "@/lib/api";
import { KIND_LABELS, visiblePageNumbers } from "@/lib/admin-insights";
import { demoDetail, demoStatistics, type ViewArticle, type ViewMetric, type ViewReport } from "@/lib/insight-view-demo";
export type { ViewMetric };
import { ADMIN_BUTTON } from "./admin-ui";
import { ChartPanel, DistributionChart, PeriodToolbar, StatCard, TrendChart } from "./admin-charts";
import { InsightEditorDialog } from "./insight-editor-dialog";
import { OperationsFrame } from "./operations-frame";
import type { WorkspaceItem } from "@/lib/admin-insights";
import admin from "./admin-workspace.module.css";
import styles from "./insight-workspace.module.css";

const GRAINS = [{ id: "day", label: "일" }, { id: "week", label: "주" }, { id: "month", label: "월" }] as const;
type Grain = (typeof GRAINS)[number]["id"];

export function viewText(metric: ViewMetric | undefined): string {
  if (!metric || metric.status !== "ready" || metric.value === null) return "—";
  return metric.value.toLocaleString("ko-KR");
}

function shareText(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 100)}%`;
}

export function InsightStatisticsPanel() {
  const params = useSearchParams();
  const router = useRouter();
  const demo = params.get("statsDemo") === "1";
  const preset = params.get("viewPreset") || "30d";
  const kind = params.get("statsKind") || "";
  const grain = (params.get("grain") as Grain) || "day";
  const page = Number(params.get("statsPage") || "1");
  const order = params.get("statsOrder") || "period";
  const query = params.get("statsQ") || "";
  const [draftQuery, setDraftQuery] = useState(query);
  const [data, setData] = useState<ViewReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function update(next: Record<string, string | null>, resetPage = false) {
    const search = new URLSearchParams(params);
    search.set("tab", "stats");
    if (resetPage) search.delete("statsPage");
    for (const [key, value] of Object.entries(next)) {
      if (!value) search.delete(key); else search.set(key, value);
    }
    router.replace(`/admin/insights?${search}`, { scroll: false });
  }

  useEffect(() => { setDraftQuery(query); }, [query]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    const options = { preset, kind, grain, q: query, page, order };
    const result = demo ? Promise.resolve(demoStatistics(options)) : requestApi<ViewReport>(`/admin/insights/statistics?${new URLSearchParams({ preset, grain, q: query, page: String(page), order, ...(kind ? { kind } : {}) })}`);
    result.then(body => { if (active) setData(body); }).catch((problem: unknown) => {
      if (active) setError(problem instanceof ApiError ? problem.message : "통계를 불러오지 못했습니다.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo, preset, kind, grain, query, page, order]);

  const totalPages = Math.max(1, Math.ceil((data?.articles.total ?? 0) / 6));
  return <div className="space-y-4 p-4 md:p-5">
    <div className={styles.statsBar}>
      <PeriodToolbar inline preset={preset} onChange={value => update({ viewPreset: value }, true)} note={data ? `${data.range.start} ~ ${data.range.end} · ${data.range.timezone}` : "Asia/Seoul"} onRefresh={() => update({})} />
      <div className={styles.statsFilters}>
        <label className={styles.statsField}>유형<select aria-label="통계 유형" className={`${styles.control} ${styles.kindControl}`} value={kind} onChange={event => update({ statsKind: event.target.value }, true)}><option value="">사례·트렌드 전체</option><option value="case">협업사례</option><option value="trend">AI 트렌드</option></select></label>
        <label className={styles.statsField}>집계 단위<select aria-label="조회 추이 단위" className={`${styles.control} ${styles.grainControl}`} value={grain} onChange={event => update({ grain: event.target.value })}>{GRAINS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <div className={admin.viewSwitch} aria-label="통계 데이터 모드"><button type="button" aria-pressed={!demo} onClick={() => update({ statsDemo: null })}>실데이터</button><button type="button" aria-pressed={demo} onClick={() => update({ statsDemo: "1" }, true)}>디자인 데모</button></div>
      </div>
    </div>
    {demo ? <p className={admin.demoNotice}><strong>디자인 데모 · 가상 데이터 · 서버에 저장하지 않음</strong><span>가상 기준일 2026-10-26. 후보 등록·편집·승인과는 섞이지 않습니다.</span></p> : null}
    {data ? <p className={styles.filterNote}>측정 시작 {data.collection.started_at ? data.collection.started_at.slice(0, 10) : "아직 없음"} · 조회 {data.collection.generated_at.slice(0, 16).replace("T", " ")} · {data.collection.note} {data.range.note}</p> : null}
    {loading ? <p role="status">통계를 불러오고 있습니다…</p> : null}
    {error ? <p role="alert" className="rounded-card bg-danger-soft p-4 text-sm">{error}</p> : null}
    {data ? <>
      <div className={`${admin.stats} ${styles.statGrid}`}>
        <StatCard label="현재 공개 게시글" card={data.cards.published} unit="건" icon="insights" />
        <StatCard label="선택 기간 조회수" card={data.cards.period_views} unit="회" icon="chart" extra="PV · 방문자 수가 아닙니다" />
        <StatCard label="측정 이후 누적 조회수" card={data.cards.cumulative_views} unit="회" icon="chart" extra="기간 필터와 무관" />
        <StatCard label="조회가 있던 글" card={data.cards.viewed_articles} unit="건" icon="insights" extra="콘텐츠 수 · 방문자 수가 아닙니다" />
      </div>
      <div className={admin.charts}>
        <ChartPanel title="조회 추이" subtitle={`${grain === "day" ? "일" : grain === "week" ? "주(월요일 시작)" : "월"} 단위 PV`} label="PV"><TrendChart title="조회 추이" points={data.series} unit="회" readout="구간별 조회수(PV). 0회도 숨기지 않습니다." /></ChartPanel>
        <ChartPanel title="사례·트렌드 비중" subtitle="선택 기간 조회수 기준" label="PV"><DistributionChart items={data.kinds} unit="회" note="색 대신 이름과 숫자로 구분합니다. 인기 5개의 합이 전체 조회수는 아닙니다." /></ChartPanel>
      </div>
      <section className={`${admin.panel} ${admin.panelBody}`}>
        <div className={admin.panelHead}><div><h2>인기 글</h2><p>같은 기간·유형의 상위 5개</p></div></div>
        <ol className="space-y-3">{data.top.length ? data.top.map((item, index) => <li key={item.content_id}><div className={admin.distLabel}><span>{index + 1}. <Link href={statisticHref(item.content_id, params)} className="text-ink hover:text-brand" title={item.title}>{item.title}</Link></span><strong>{viewText(item.period_views)}회<small>{shareText(item.share)}</small></strong></div><div className={admin.track}><div className={item.kind === "trend" ? styles.trendFill : admin.fill} style={{ width: `${Math.min(100, (item.share ?? 0) * 100)}%` }} /></div></li>) : <li className={admin.distEmpty}>표시할 인기 글이 없습니다.</li>}</ol>
      </section>
      <section className={styles.panel}>
        <form className={styles.toolbar} onSubmit={event => { event.preventDefault(); update({ statsQ: draftQuery }, true); }}>
          <p className={styles.filterNote}>검색은 아래 성과 목록에만 적용됩니다. 위 카드와 그래프는 검색 전 전체입니다.</p>
          <div className={styles.searchRow}><input aria-label="성과 목록 제목 검색" className={styles.control} value={draftQuery} maxLength={80} onChange={event => setDraftQuery(event.target.value)} placeholder="성과 목록에서 제목 검색" /><button className={`${ADMIN_BUTTON} bg-ink text-white`}>검색</button><label className={styles.filterLabel}>정렬<select aria-label="성과 정렬" className={styles.control} value={order} onChange={event => update({ statsOrder: event.target.value }, true)}><option value="period">기간 조회수순</option><option value="cumulative">누적 조회수순</option><option value="newest">최신 게시순</option></select></label></div>
        </form>
        <p className={styles.scrollHint}>표를 좌우로 밀면 누적 조회수와 통계 보기를 확인할 수 있습니다.</p>
        <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="글별 성과 가로 스크롤">
          <table className={styles.table} aria-label="글별 성과">
            <thead><tr><th>제목</th><th>유형</th><th>공개일</th><th className={styles.number}>기간 조회수</th><th className={styles.number}>누적 조회수</th><th>통계</th></tr></thead>
            <tbody>{data.articles.items.map(item => <ArticleRow key={item.content_id} item={item} params={params} />)}</tbody>
          </table>
        </div>
        {!data.articles.items.length ? <p className="px-5 py-8 text-center text-sm text-muted">조건에 맞는 글이 없습니다.</p> : null}
        <nav className={styles.pagination} aria-label="성과 목록 페이지">{visiblePageNumbers(page, totalPages).map(number => <button key={number} type="button" className={styles.pageButton} aria-current={number === page ? "page" : undefined} onClick={() => update({ statsPage: String(number) })}>{number}</button>)}</nav>
      </section>
    </> : null}
  </div>;
}

function editorItem(data: { candidate_id?: unknown; content_id: string; title: string; kind: "case" | "trend"; published_at: string }): WorkspaceItem {
  const candidateId = typeof data.candidate_id === "string" ? data.candidate_id : "";
  return { id: candidateId, kind: data.kind, status: "published", version: 1, current_revision: 1, approved_revision: 1, scheduled_for: null, publication_id: data.content_id, title: data.title, summary: "", research_field: "", keywords: [], is_published: true, has_correction: false, registered_at: data.published_at, published_at: data.published_at, source_title: "", doi: null };
}

function ArticleRow({ item, params }: { item: ViewArticle; params: URLSearchParams }) {
  return <tr><td><span className={styles.ellipsis} title={item.title}>{item.title}</span></td><td>{KIND_LABELS[item.kind]}</td><td>{item.published_at.slice(0, 10)}</td><td className={styles.number} title={item.period_views.note}>{viewText(item.period_views)}</td><td className={styles.number} title={item.cumulative_views.note}>{viewText(item.cumulative_views)}</td><td><Link className="font-semibold text-brand" href={statisticHref(item.content_id, params)}>통계 보기</Link></td></tr>;
}

export function statisticHref(contentId: string, params: URLSearchParams): string {
  const next = new URLSearchParams();
  next.set("preset", params.get("viewPreset") || "30d");
  if (params.get("statsKind")) next.set("kind", params.get("statsKind") || "");
  if (params.get("grain")) next.set("grain", params.get("grain") || "");
  if (params.get("statsDemo") === "1") next.set("statsDemo", "1");
  next.set("from", "stats");
  return `/admin/insights/statistics/${contentId}?${next}`;
}

export function InsightStatisticDetail({ contentId }: { contentId: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const demo = params.get("statsDemo") === "1";
  const preset = params.get("preset") || "30d";
  const grain = (params.get("grain") as Grain) || "day";
  const [data, setData] = useState<Awaited<ReturnType<typeof demoDetail>> | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    let active = true;
    const result = demo ? Promise.resolve(demoDetail(contentId, preset, grain)) : requestApi<NonNullable<ReturnType<typeof demoDetail>>>(`/admin/insights/statistics/${contentId}?preset=${preset}&grain=${grain}`);
    result.then(body => { if (active) setData(body); }).catch((problem: unknown) => { if (active) setError(problem instanceof ApiError ? problem.message : "통계를 불러오지 못했습니다."); });
    return () => { active = false; };
  }, [contentId, demo, grain, preset]);
  const back = params.get("from") === "published"
    ? `/admin/insights?tab=published&viewPreset=${preset}`
    : `/admin/insights?tab=stats&viewPreset=${preset}${params.get("kind") ? `&statsKind=${params.get("kind")}` : ""}${grain ? `&grain=${grain}` : ""}${demo ? "&statsDemo=1" : ""}`;
  return <OperationsFrame title={data && "title" in data ? data.title : "글별 통계"} description="공개 글 상세가 보인 횟수입니다. 이 통계 화면은 조회수에 포함되지 않습니다.">
    <Link href={back} className="text-sm font-semibold text-brand">목록으로</Link>
    {demo ? <p className={`${admin.demoNotice} mt-4`}><strong>디자인 데모 · 가상 데이터 · 서버에 저장하지 않음</strong></p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {!data && !error ? <p role="status">통계를 불러오고 있습니다…</p> : null}
    {data && "period_views" in data ? <div className="mt-4 space-y-4">
      <p className={styles.filterNote}>{KIND_LABELS[data.kind]} · 공개 {String(data.published_at).slice(0, 10)} · {data.link_state === "linked" ? "공개 경로 연결됨" : "연결 확인 필요"} · 측정 {data.collection.started_at ? data.collection.started_at.slice(0, 10) : "시작 전"}</p>
      <PeriodToolbar preset={preset} onChange={value => router.replace(`?preset=${value}&grain=${grain}${demo ? "&statsDemo=1" : ""}`)} />
      <div className={admin.viewSwitch} aria-label="추이 단위">{GRAINS.map(item => <button key={item.id} type="button" aria-pressed={grain === item.id} onClick={() => router.replace(`?preset=${preset}&grain=${item.id}${demo ? "&statsDemo=1" : ""}`)}>{item.label}</button>)}</div>
      <div className={`${admin.stats} ${styles.statGrid}`}>
        <StatCard label="선택 기간 조회수" card={data.period_views} unit="회" icon="chart" />
        <StatCard label="측정 이후 누적 조회수" card={data.cumulative_views} unit="회" icon="chart" extra="기간과 무관" />
      </div>
      <ChartPanel title="날짜별 조회" subtitle="PV" label="PV"><TrendChart title="글별 조회 추이" points={data.series} unit="회" readout="이 글의 구간별 조회수" /></ChartPanel>
      <div className="flex flex-wrap gap-2">
        {"candidate_id" in data && data.candidate_id ? <button type="button" className={`${ADMIN_BUTTON} bg-white`} onClick={() => setEditing(true)}>원고 편집</button> : null}
        {data.public_path ? <a className={`${ADMIN_BUTTON} bg-ink text-white`} href={data.public_path}>공개 글 보기</a> : <span className="text-sm text-muted">공개 사이트 경로는 주소·유형이 연결된 글만 엽니다.</span>}
      </div>
      {editing && "candidate_id" in data && data.candidate_id ? <InsightEditorDialog item={editorItem(data)} onClose={() => setEditing(false)} onChanged={() => undefined} /> : null}
    </div> : null}
  </OperationsFrame>;
}
