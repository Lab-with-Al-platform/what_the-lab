"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, requestApi } from "@/lib/api";
import { CollaborationReport, demoCollaborationReport } from "@/lib/collaboration-admin";
import { formatWhen } from "@/lib/operations-admin";
import { ChartPanel, DistributionChart, StatCard } from "./admin-charts";
import { adminHref, useAdminDemo } from "./admin-shell";
import { ADMIN_BUTTON } from "./admin-ui";
import styles from "./admin-workspace.module.css";

const FILTERS = [
  ["", "전체"],
  ["pending", "답변 대기"],
  ["accepted", "전문가 수락"],
  ["started", "협업 시작"],
  ["rejected", "거절"],
  ["expired", "기한 만료"],
  ["canceled", "취소"],
] as const;

/** 연구 등록 화면의 협업 요청 탭. 요청 상태를 연구 진행 상태로 바꾸지 않습니다. */
export function CollaborationPanel() {
  const params = useSearchParams();
  const router = useRouter();
  const demo = useAdminDemo();
  const preset = params.get("preset") ?? "30d";
  const status = FILTERS.some(([code]) => code === params.get("request_status")) ? params.get("request_status") ?? "" : "";
  const page = Number(params.get("page") ?? 1);
  const report = useCollaborationReport(demo, preset, status, page);

  function setQuery(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.set("page", "1");
    router.replace("/admin/projects?" + next, { scroll: false });
  }

  return (
    <section>
      <p className={styles.meta}>협업 요청의 지금 상태입니다. 참여 신청·마일스톤·완료는 없고, 시작 건수를 성공률로 나누지 않습니다.</p>
      {report.loading ? <p role="status" className={styles.meta}>협업 요청을 불러오고 있습니다…</p> : null}
      {report.error ? <p role="alert" className={styles.error}>{report.error}</p> : null}
      {report.data ? <CollaborationBody report={report.data} status={status} onStatus={(value) => setQuery("request_status", value)} onPage={(value) => setQuery("page", String(value))} demo={demo} /> : null}
    </section>
  );
}

function useCollaborationReport(demo: boolean, preset: string, status: string, page: number) {
  const [data, setData] = useState<CollaborationReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const path = `/admin/operations/collaboration?preset=${preset}&status=${status}&page=${page}`;
    const result = demo ? Promise.resolve(demoCollaborationReport()) : requestApi<CollaborationReport>(path);
    result
      .then((body) => { if (active) setData(body); })
      .catch((problem: unknown) => { if (active) setError(problem instanceof ApiError ? problem.message : "협업 요청을 불러오지 못했습니다."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo, preset, status, page]);
  return { data, error, loading };
}

function CollaborationBody({
  report,
  status,
  onStatus,
  onPage,
  demo,
}: {
  report: CollaborationReport;
  status: string;
  onStatus: (value: string) => void;
  onPage: (value: number) => void;
  demo: boolean;
}) {
  const countable = report.table_ready;
  const pages = Math.max(1, Math.ceil(report.total / report.page_size));
  return (
    <>
      <div className={styles.stats}>
        <StatCard label="기간에 생긴 요청" card={report.created_in_period} unit="건" icon="chart" />
        {report.missing.map((item) => <StatCard key={item.id} label={item.label} card={item} unit="" icon="overview" />)}
      </div>
      {countable ? (
        <ChartPanel title="지금 요청은 어느 상태인가요?" subtitle={report.note} label="현재 상태">
          <DistributionChart unit="건" items={report.counts.map((item) => ({ label: item.label, value: item.value ?? 0 }))} note="기간을 바꿔도 이 분포는 현재 남은 요청입니다. 협업 시작은 완료가 아닙니다." />
        </ChartPanel>
      ) : <p className={styles.meta}>협업 요청 표를 읽지 못했습니다. 없는 요청을 0건으로 채우지 않습니다.</p>}
      <div className="mb-4 flex flex-wrap gap-2" aria-label="요청 상태">
        {FILTERS.map(([code, label]) => (
          <button key={code || "all"} type="button" aria-pressed={status === code} className={ADMIN_BUTTON + (status === code ? " bg-ink text-white" : "")} onClick={() => onStatus(code)}>{label}</button>
        ))}
      </div>
      <RequestTable report={report} demo={demo} />
      <nav className={styles.pagination} aria-label="협업 요청 페이지">
        <button type="button" className={ADMIN_BUTTON} disabled={report.page <= 1} onClick={() => onPage(report.page - 1)}>이전</button>
        <span>{report.page} / {pages}</span>
        <button type="button" className={ADMIN_BUTTON} disabled={report.page >= pages} onClick={() => onPage(report.page + 1)}>다음</button>
      </nav>
      {demo ? <p className={styles.meta}>가상 요청 1건의 상태는 협업 시작입니다. 연구 목록의 진행 상태는 이 값으로 바뀌지 않습니다.</p> : null}
    </>
  );
}

function RequestTable({ report, demo }: { report: CollaborationReport; demo: boolean }) {
  if (!report.items.length) return <p className={styles.meta}>{report.table_ready ? "조건에 맞는 요청이 없습니다." : "요청 목록을 표시하지 않습니다."}</p>;
  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <caption className="sr-only">협업 요청 목록</caption>
        <thead><tr><th>요청</th><th>연구</th><th>전문가</th><th>상태</th><th>생성</th><th>응답</th><th>시작</th></tr></thead>
        <tbody>
          {report.items.map((item) => (
            <tr key={item.request_id}>
              <td>#{item.request_id}</td>
              <td><Link href={adminHref("/admin/projects/researches/" + item.research_id, demo)}>{item.title}</Link><span className={styles.meta}> {item.owner_nickname}</span></td>
              <td><Link href={adminHref("/admin/members/" + item.expert_id, demo)}>{item.expert_nickname}</Link></td>
              <td>{item.status_label}</td>
              <td className="whitespace-nowrap">{formatWhen(item.created_at)}</td>
              <td className="whitespace-nowrap">{item.responded_at ? formatWhen(item.responded_at) : "—"}</td>
              <td className="whitespace-nowrap">{item.started_at ? formatWhen(item.started_at) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
