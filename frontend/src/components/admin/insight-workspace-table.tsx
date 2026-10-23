import { KIND_LABELS, STATUS_LABELS, formatAdminDate, formatAdminTime, type WorkspaceItem } from "@/lib/admin-insights";
import styles from "./insight-workspace.module.css";

/** 한 줄 표에는 비교할 정보만 두고, 긴 원고는 기존 편집 모달에서 확인합니다. */
export function InsightWorkspaceTable({ items, loading, onSelect }: {
  items: WorkspaceItem[]; loading: boolean; onSelect: (item: WorkspaceItem) => void;
}) {
  return <>
    <p className={styles.scrollHint}>표를 좌우로 밀면 분야·키워드·날짜를 볼 수 있습니다.</p>
    <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="인사이트 목록 가로 스크롤">
      <table className={styles.table} aria-label="인사이트 통합 목록" aria-busy={loading}>
        <colgroup><col /><col className={styles.statusColumn} /><col className={styles.kindColumn} /><col className={styles.fieldColumn} /><col className={styles.keywordColumn} /><col className={styles.dateColumn} /></colgroup>
        <thead><tr>{["제목", "상태", "유형", "연구 분야", "키워드", "등록·수집일"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{items.map((item) => <tr key={item.id} aria-disabled={loading} onClick={() => { if (!loading) onSelect(item); }}>
          <td><button type="button" disabled={loading} className={styles.titleButton} title={item.title} onClick={(event) => { event.stopPropagation(); onSelect(item); }}>{item.title}</button></td>
          <td><div className={styles.badges}>
            <span className={`${styles.badge} ${item.is_published ? styles.published : item.status === "approved" ? styles.approved : item.status === "pending_review" ? styles.pending : styles.draft}`}>{item.is_published ? "게시 중" : item.status === "draft" ? item.content_stage === "collection_note" ? "수집 메모" : "게시용 초안" : STATUS_LABELS[item.status]}</span>
            {item.has_correction ? <span className={`${styles.badge} ${styles.correction}`} title={`공개본 유지 · 수정본 ${STATUS_LABELS[item.status]}`}>수정 {STATUS_LABELS[item.status]}</span> : null}
          </div></td>
          <td><span className={`${styles.kind} ${item.kind === "trend" ? styles.trend : ""}`}>{KIND_LABELS[item.kind ?? "case"]}</span></td>
          <td><span className={styles.ellipsis} title={item.research_field}>{item.research_field}</span></td>
          <td><div className={styles.keywords} title={item.keywords.join(" · ")}>{item.keywords.length ? <>{item.keywords.slice(0, 2).map((keyword) => <span key={keyword} className={styles.keyword}>{keyword}</span>)}{item.keywords.length > 2 ? <span className={styles.more} aria-label={`키워드 ${item.keywords.length - 2}개 더 있음`}>+{item.keywords.length - 2}</span> : null}</> : <span className="text-faint">—</span>}</div></td>
          <td><time dateTime={item.registered_at} title={formatAdminTime(item.registered_at)}>{formatAdminDate(item.registered_at)}</time></td>
        </tr>)}</tbody>
      </table>
    </div>
  </>;
}
