"use client";

import { ReactNode, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import type { Point, ReadyCount } from "@/lib/operations-admin";
import { PRESETS, statusText } from "@/lib/operations-admin";
import { ADMIN_BUTTON } from "./admin-ui";
import { AdminIcon, AdminIconName } from "./admin-shell";
import styles from "./admin-workspace.module.css";

export function StatCard({ label, card, unit = "명", icon = "members", href, extra }: { label: string; card: ReadyCount; unit?: string; icon?: AdminIconName; href?: string; extra?: string }) {
  const available = (card.status === "ready" || card.status === "paused") && card.value !== null;
  const body = <><div className={styles.statTop}><span>{label}</span><span className={styles.statIcon}><AdminIcon name={icon} size={17} /></span></div><div className={styles.statValue}>{available ? card.value!.toLocaleString("ko-KR") : <span className="text-base font-semibold">{statusText(card.status)}</span>}{available ? <small>{unit}</small> : null}</div><div className={styles.statNote}>{extra || card.note || "현재 상태 기준"}</div></>;
  return href ? <Link href={href} className={styles.stat}>{body}</Link> : <section className={styles.stat}>{body}</section>;
}

export function PeriodToolbar({ preset, onChange, onRefresh, note, inline = false }: { preset: string; onChange: (value: string) => void; onRefresh?: () => void; note?: string; inline?: boolean }) {
  return <div className={inline ? styles.periodBar : styles.toolbar}><div className={styles.periods} aria-label="집계 기간">{PRESETS.map(item => <button key={item.id} type="button" aria-pressed={preset === item.id} onClick={() => onChange(item.id)}>{item.label}</button>)}</div><div className={styles.periodAside}>{note ? <span className={styles.meta}>{note}</span> : null}{onRefresh ? <button type="button" className={`${ADMIN_BUTTON} bg-white`} onClick={onRefresh}>새로고침</button> : null}</div></div>;
}

export function ChartPanel({ title, subtitle, label, children }: { title: string; subtitle: string; label?: string; children: ReactNode }) {
  return <section className={`${styles.panel} ${styles.panelBody}`}><div className={styles.panelHead}><div><h2>{title}</h2><p>{subtitle}</p></div>{label ? <span className={styles.pill}>{label}</span> : null}</div>{children}</section>;
}

/** 화면 폭을 직접 측정해 모바일에서도 축 글자 크기가 줄어들지 않게 합니다. */
export function TrendChart({ title, points, unit = "건", readout }: { title: string; points: Point[]; unit?: string; readout?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(500);
  const [selected, setSelected] = useState<number | null>(null);
  const gradient = useId().replaceAll(":", "");
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(180, entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const max = Math.max(4, Math.ceil(Math.max(0, ...points.map(point => point.count)) / 4) * 4);
  const left = 34, right = width - 12, top = 16, bottom = 174;
  const coordinates = points.map((point, index) => ({ x: points.length === 1 ? (left + right) / 2 : left + index / (points.length - 1) * (right - left), y: bottom - point.count / max * (bottom - top) }));
  const line = coordinates.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const ticks = width < 350 ? 3 : 5;
  const chosen = selected === null ? null : points[selected];
  const chosenPoint = selected === null ? null : coordinates[selected];
  return <div ref={ref} className={styles.chart}>
    {!points.length ? <div className={styles.distEmpty}>표시할 추이 데이터가 없습니다.</div> : <svg viewBox={`0 0 ${width} 210`} role="img" aria-label={`${title}. ${points.length}개 구간, 총 ${points.reduce((sum, point) => sum + point.count, 0).toLocaleString("ko-KR")}${unit}`} onPointerLeave={() => setSelected(null)}>
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-brand)" stopOpacity=".16" /><stop offset="100%" stopColor="var(--color-brand)" stopOpacity=".015" /></linearGradient></defs>
      {[0, .5, 1].map(value => <g key={value}><line x1={left} x2={right} y1={bottom - value * (bottom - top)} y2={bottom - value * (bottom - top)} className={styles.chartGrid} /><text x={left - 9} y={bottom - value * (bottom - top) + 4} textAnchor="end">{Math.round(max * value)}</text></g>)}
      <path d={`${line} L${coordinates[coordinates.length - 1].x},${bottom} L${coordinates[0].x},${bottom} Z`} fill={`url(#${gradient})`} />
      <path d={line} className={styles.chartLine} />
      {coordinates.length === 1 ? <circle cx={coordinates[0].x} cy={coordinates[0].y} r="4" fill="var(--color-brand)" /> : null}
      {Array.from({ length: Math.min(points.length, ticks) }, (_, index) => Math.round(index * (points.length - 1) / Math.max(1, Math.min(points.length, ticks) - 1))).map(index => <text key={index} x={coordinates[index].x} y="201" textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}>{points[index].date.length > 7 ? points[index].date.slice(5).replace("-", ".") : points[index].date}</text>)}
      {chosenPoint ? <g><line x1={chosenPoint.x} x2={chosenPoint.x} y1={top} y2={bottom} stroke="var(--color-brand)" strokeOpacity=".25" /><circle cx={chosenPoint.x} cy={chosenPoint.y} r="4" fill="var(--color-brand)" stroke="var(--color-card)" strokeWidth="2" /></g> : null}
      <rect x={left} y={top} width={right - left} height={bottom - top} fill="transparent" onPointerMove={event => { const bounds = event.currentTarget.ownerSVGElement!.getBoundingClientRect(); const x = event.clientX - bounds.left; setSelected(Math.max(0, Math.min(points.length - 1, Math.round((x - left) / (right - left) * (points.length - 1))))); }} />
    </svg>}
    <div className={styles.chartReadout}>{chosen ? <>{chosen.date}<strong>{chosen.count.toLocaleString("ko-KR")}{unit}</strong></> : <>{readout ?? "일별 생성 건수 · 그래프에서 날짜별 수치를 확인하세요"}</>}</div>
    <details className={styles.chartData}><summary>수치 표로 확인</summary><table><caption className="sr-only">{title} 상세 수치</caption><thead><tr><th>날짜</th><th>건수</th></tr></thead><tbody>{points.map(point => <tr key={point.date}><td>{point.date}</td><td>{point.count}</td></tr>)}</tbody></table></details>
  </div>;
}

export function DistributionChart({ items, unit = "명", denominator, note }: { items: { label: string; value: number }[]; unit?: string; denominator?: number; note?: string }) {
  const total = denominator ?? items.reduce((sum, item) => sum + item.value, 0);
  return <><div className={styles.distribution}>{!total ? <div className={styles.distEmpty}>아직 표시할 분포가 없습니다.</div> : items.map((item, index) => <div key={item.label}><div className={styles.distLabel}><span>{item.label}</span><strong>{item.value.toLocaleString()}{unit}<small>{Math.round(item.value / total * 100)}%</small></strong></div><div className={styles.track}><div className={styles.fill} style={{ width: `${Math.min(100, item.value / total * 100)}%`, opacity: Math.max(.4, 1 - index * .12) }} /></div></div>)}</div>{note ? <p className={`${styles.meta} mt-5`}>{note}</p> : null}</>;
}
