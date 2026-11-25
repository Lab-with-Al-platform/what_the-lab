"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { KIND_LABELS, STATUS_LABELS, formatAdminDate, formatAdminTime, type WorkspaceItem } from "@/lib/admin-insights";
import { PRESETS } from "@/lib/operations-admin";
import { viewText, type ViewMetric } from "./insight-statistics";
import styles from "./insight-workspace.module.css";

const COLUMNS = [
  { label: "제목", width: "titleColumn" },
  { label: "상태", width: "statusColumn" },
  { label: "유형", width: "kindColumn" },
  { label: "연구 분야", width: "fieldColumn" },
  { label: "키워드", width: "keywordColumn" },
  { label: "등록·수집일", width: "dateColumn" },
  { label: "기간/누적", width: "viewColumn" },
  { label: "통계", width: "statColumn" },
] as const;

const PERIOD_SHORT = { today: "오늘", "7d": "7일", "30d": "30일", month: "이번 달" } as const;

function visibleColumns(showViews: boolean) {
  return COLUMNS.filter((column) => showViews || (column.width !== "viewColumn" && column.width !== "statColumn"));
}

type Choice = { value: string; label: string };

/** 세 목록이 같은 헤더에서 거르고 정렬합니다. 표 위에 줄을 더하지 않습니다. */
export function InsightWorkspaceTable({ items, loading, onSelect, views, statHref, kind, status, category, keyword, order, viewPreset, categories, keywords, onKind, onStatus, onCategory, onKeyword, onOrder, onPreset }: {
  items: WorkspaceItem[]; loading: boolean; onSelect: (item: WorkspaceItem) => void;
  views?: Record<string, { period_views: ViewMetric; cumulative_views: ViewMetric }>;
  statHref?: (publicationId: string) => string;
  kind: string; status: string; category: string; keyword: string; order: string; viewPreset: string;
  categories: string[]; keywords: string[];
  onKind: (value: string) => void; onStatus: (value: string) => void; onCategory: (value: string) => void; onKeyword: (value: string) => void;
  onOrder: (value: string) => void; onPreset: (value: string) => void;
}) {
  const showViews = views !== undefined;
  const columns = visibleColumns(showViews);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const dateDirection = order === "oldest" ? "asc" : order === "newest" ? "desc" : "off";
  const periodLabel = PERIOD_SHORT[viewPreset as keyof typeof PERIOD_SHORT] ?? "30일";
  return <>
    <p className={styles.scrollHint}>표를 좌우로 밀면 분야·키워드·날짜{showViews ? "·조회수" : ""}를 볼 수 있습니다.</p>
    <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="인사이트 목록 가로 스크롤">
      <table className={styles.table} aria-label="인사이트 통합 목록" aria-busy={loading}>
        <colgroup>{columns.map((column) => <col key={column.label} className={styles[column.width]} />)}</colgroup>
        <thead><tr>
          <th scope="col" className={styles.titleColumn}>제목</th>
          <th scope="col" className={styles.statusColumn}><span className={styles.head}><span className={styles.headLabel}>상태</span><ChoiceMenu id="status" openMenu={openMenu} setOpenMenu={setOpenMenu} label={status ? `상태 필터, 현재 ${STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}` : "상태 필터"} active={Boolean(status)} icon="filter" choices={[{ value: "", label: "모든 상태" }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))]} value={status} onChange={onStatus} /></span></th>
          <th scope="col" className={styles.kindColumn}><span className={styles.head}><span className={styles.headLabel}>유형</span><ChoiceMenu id="kind" openMenu={openMenu} setOpenMenu={setOpenMenu} label={kind ? `유형 필터, 현재 ${KIND_LABELS[kind as keyof typeof KIND_LABELS] ?? kind}` : "유형 필터"} active={Boolean(kind)} icon="filter" choices={[{ value: "", label: "사례·트렌드 전체" }, { value: "case", label: "협업사례" }, { value: "trend", label: "AI 트렌드" }]} value={kind} onChange={onKind} /></span></th>
          <th scope="col" className={styles.fieldColumn}><span className={styles.head}><span className={styles.headLabel}>연구 분야</span><ChoiceMenu id="field" openMenu={openMenu} setOpenMenu={setOpenMenu} label={category ? `연구 분야 필터, 현재 ${category}` : "연구 분야 필터"} active={Boolean(category)} icon="filter" note="게시된 원고에 있는 분야만 고를 수 있습니다." choices={[{ value: "", label: "모든 분야" }, ...categories.map((value) => ({ value, label: value }))]} value={category} onChange={onCategory} /></span></th>
          <th scope="col" className={styles.keywordColumn}><span className={styles.head}><span className={styles.headLabel}>키워드</span><ChoiceMenu id="keyword" openMenu={openMenu} setOpenMenu={setOpenMenu} label={keyword ? `키워드 필터, 현재 ${keyword}` : "키워드 필터"} active={Boolean(keyword)} icon="filter" note="게시된 원고에 있는 키워드만 고를 수 있습니다." choices={[{ value: "", label: "모든 키워드" }, ...keywords.map((value) => ({ value, label: value }))]} value={keyword} onChange={onKeyword} /></span></th>
          <th scope="col" className={styles.dateColumn}><span className={styles.head}><span className={styles.headLabel}>등록·수집일</span><button type="button" className={dateDirection === "off" ? styles.headIcon : styles.headIconActive} aria-label={dateDirection === "asc" ? "등록·수집일 오래된순. 누르면 최신순" : dateDirection === "desc" ? "등록·수집일 최신순. 누르면 오래된순" : "등록·수집일 정렬. 누르면 최신순"} onClick={() => { setOpenMenu(null); onOrder(order === "newest" ? "oldest" : "newest"); }}><SortIcon direction={dateDirection} /></button></span></th>
          {showViews ? <th scope="col" className={styles.viewColumn}><span className={`${styles.head} ${styles.headCenter}`}><span className={styles.headLabel}>기간/누적</span><ChoiceMenu id="view-sort" openMenu={openMenu} setOpenMenu={setOpenMenu} label={order === "period" ? "조회수 정렬, 현재 기간 높은 순" : order === "cumulative" ? "조회수 정렬, 현재 누적 높은 순" : "조회수 정렬"} active={order === "period" || order === "cumulative"} icon="sort" choices={[{ value: "period", label: "기간 높은 순" }, { value: "cumulative", label: "누적 높은 순" }]} value={order} onChange={onOrder} /><ChoiceMenu id="period" openMenu={openMenu} setOpenMenu={setOpenMenu} label={`조회 기간, 현재 ${periodLabel}`} active={viewPreset !== "30d"} icon="period" periodText={periodLabel} choices={PRESETS.map((item) => ({ value: item.id, label: item.label }))} value={viewPreset || "30d"} onChange={onPreset} /></span></th> : null}
          {showViews ? <th scope="col" className={styles.statColumn}>통계</th> : null}
        </tr></thead>
        <tbody>{items.map((item) => <tr key={item.id} aria-disabled={loading} onClick={() => { if (!loading) onSelect(item); }}>
          <td><button type="button" disabled={loading} className={styles.titleButton} title={item.title} onClick={(event) => { event.stopPropagation(); onSelect(item); }}>{item.title}</button></td>
          <td><div className={styles.badges}>
            <span className={`${styles.badge} ${item.is_published ? styles.published : item.status === "approved" ? styles.approved : item.status === "pending_review" ? styles.pending : styles.draft}`}>{item.is_published ? "게시 중" : item.status === "draft" ? item.content_stage === "collection_note" ? "수집 메모" : "게시용 초안" : STATUS_LABELS[item.status]}</span>
            {item.has_correction ? <span className={`${styles.badge} ${styles.correction}`} title={`공개본 유지 · 수정본 ${STATUS_LABELS[item.status]}`}>수정 {STATUS_LABELS[item.status]}</span> : null}
            {item.agent_run ? <span className={`${styles.badge} ${item.agent_run.status === "needs_revision" || item.agent_run.status === "held" || item.agent_run.status === "failed" ? styles.pending : styles.run}`} title={`작업 회차 ${item.agent_run.run_id}`}>{item.agent_run.status_label}</span> : null}
          </div></td>
          <td><span className={`${styles.kind} ${item.kind === "trend" ? styles.trend : ""}`}>{KIND_LABELS[item.kind ?? "case"]}</span></td>
          <td><span className={styles.ellipsis} title={item.research_field}>{item.research_field}</span></td>
          <td><div className={styles.keywords} title={item.keywords.join(" · ")}>{item.keywords.length ? <>{item.keywords.slice(0, 2).map((word) => <span key={word} className={styles.keyword}>{word}</span>)}{item.keywords.length > 2 ? <span className={styles.more} aria-label={`키워드 ${item.keywords.length - 2}개 더 있음`}>+{item.keywords.length - 2}</span> : null}</> : <span className="text-faint">—</span>}</div></td>
          <td><time dateTime={item.registered_at} title={formatAdminTime(item.registered_at)}>{formatAdminDate(item.registered_at)}</time></td>
          {showViews ? <ViewCells item={item} views={views} statHref={statHref} /> : null}
        </tr>)}</tbody>
      </table>
    </div>
  </>;
}

function ChoiceMenu({ id, openMenu, setOpenMenu, label, active, icon, periodText, note, choices, value, onChange }: {
  id: string; openMenu: string | null; setOpenMenu: (id: string | null) => void; label: string; active: boolean;
  icon: "filter" | "sort" | "period"; periodText?: string; note?: string; choices: Choice[]; value: string; onChange: (value: string) => void;
}) {
  const open = openMenu === id;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [box, setBox] = useState({ top: 0, left: 0 });
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const place = () => {
      const rect = buttonRef.current!.getBoundingClientRect();
      const width = 220;
      const height = menuRef.current?.offsetHeight ?? 220;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      const below = rect.bottom + 6;
      const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 6) : below;
      setBox({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, choices.length]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpenMenu(null);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpenMenu(null); buttonRef.current?.focus(); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", onKey); };
  }, [open, setOpenMenu]);
  const buttonClass = icon === "period" ? `${styles.periodChip} ${active ? styles.periodChipActive : ""}` : active ? styles.headIconActive : styles.headIcon;
  return <>
    <button ref={buttonRef} type="button" className={buttonClass} aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={menuId} data-active={active ? "true" : "false"} onClick={() => setOpenMenu(open ? null : id)}>
      {icon === "filter" ? <FilterIcon active={active} /> : icon === "sort" ? <SortIcon direction={value === "period" || value === "cumulative" ? "desc" : "off"} /> : <CalendarIcon />}
      {periodText ? <span>{periodText}</span> : null}
    </button>
    {open ? createPortal(<div ref={menuRef} id={menuId} role="listbox" aria-label={label} className={styles.headMenu} style={{ top: box.top, left: box.left }}>
      {note ? <p className={styles.headMenuNote}>{note}</p> : null}
      {choices.length ? choices.map((choice) => <button key={choice.value || "all"} type="button" role="option" aria-selected={choice.value === value} className={styles.headOption} title={choice.label} onClick={() => { onChange(choice.value); setOpenMenu(null); }}><span>{choice.label}</span>{choice.value === value ? <CheckIcon /> : null}</button>) : <p className={styles.headMenuNote}>아직 고를 값이 없습니다.</p>}
    </div>, document.body) : null}
  </>;
}

function ViewCells({ item, views, statHref }: { item: WorkspaceItem; views?: Record<string, { period_views: ViewMetric; cumulative_views: ViewMetric }>; statHref?: (publicationId: string) => string }) {
  if (!item.is_published || !item.publication_id) {
    return <><td className={styles.viewColumn} title="게시 전 원고에는 공개 조회수를 붙이지 않습니다.">— / —</td><td className={styles.statColumn} /></>;
  }
  const metric = views?.[item.publication_id];
  const period = metric?.period_views;
  const cumulative = metric?.cumulative_views;
  const note = [period?.note, cumulative?.note].filter(Boolean).join(" · ");
  return <>
    <td className={styles.viewColumn} title={note || "앞은 선택 기간, 뒤는 측정 이후 누적입니다."}>{viewText(period)} / {viewText(cumulative)}</td>
    <td className={styles.statColumn}>{statHref ? <a className={styles.statLink} href={statHref(item.publication_id)} aria-label="통계 보기" title="통계 보기" onClick={event => event.stopPropagation()}><ChartIcon /></a> : null}</td>
  </>;
}

function FilterIcon({ active }: { active: boolean }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6.2 7.2V19l-3.6 2v-8.8L4 5z" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
}

function SortIcon({ direction }: { direction: "asc" | "desc" | "off" }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10 12 6l4 4" fill="none" stroke="currentColor" strokeWidth={direction === "asc" ? "2.4" : "1.6"} strokeLinecap="round" strokeLinejoin="round" opacity={direction === "desc" ? ".35" : "1"} /><path d="M8 14l4 4 4-4" fill="none" stroke="currentColor" strokeWidth={direction === "desc" ? "2.4" : "1.6"} strokeLinecap="round" strokeLinejoin="round" opacity={direction === "asc" ? ".35" : "1"} /></svg>;
}

function CalendarIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>;
}

function CheckIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7" /></svg>;
}

function ChartIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18 M7 14l4-5 4 3 5-7" /></svg>;
}
