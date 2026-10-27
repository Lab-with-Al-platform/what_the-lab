"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, requestApi } from "@/lib/api";
import { AnalyticsReport, demoAnalyticsReport } from "@/lib/analytics-admin";
import { formatWhen, statusText } from "@/lib/operations-admin";
import { ChartPanel, DistributionChart, PeriodToolbar, StatCard, TrendChart } from "./admin-charts";
import { adminHref, useAdminDemo } from "./admin-shell";
import { ADMIN_BUTTON } from "./admin-ui";
import { OperationsFrame, ScreenTabs, screenView } from "./operations-frame";
import styles from "./admin-workspace.module.css";

export function OperationsAnalyticsScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const demo = useAdminDemo();
  const preset = params.get("preset") ?? "7d";
  const requested = params.get("grain");
  const grain = requested === "week" || requested === "month" ? requested : "day";
  const report = useAnalyticsReport(demo, preset, grain);

  function changePeriod(value: string) {
    const next = new URLSearchParams(params);
    next.set("preset", value);
    router.replace("/admin/analytics?" + next, { scroll: false });
  }

  const view = screenView(params);
  function changeView(next: "dashboard" | "list") {
    const query = new URLSearchParams(params); query.set("view", next);
    router.replace("/admin/analytics?" + query, { scroll: false });
  }
  return (
    <OperationsFrame title="방문 통계" description="페이지를 연 세션과 조회만 보여 줍니다. 사람 수와 협업 확정은 이 화면의 숫자가 아닙니다." tools={<>
      <PeriodToolbar inline preset={preset} onChange={changePeriod} note={report.data ? formatWhen(report.data.generated_at) + " 조회" : "Asia/Seoul"} />
      <div className={styles.periods} aria-label="추이 단위">
        {[["day", "일"], ["week", "주"], ["month", "월"]].map(([id, label]) => (
          <button key={id} type="button" aria-pressed={grain === id} onClick={() => {
            const next = new URLSearchParams(params);
            next.set("grain", id);
            router.replace("/admin/analytics?" + next, { scroll: false });
          }}>{label}</button>
        ))}
      </div>
    </>}>
      <ScreenTabs value={view} onChange={changeView} />
      {report.loading ? <p role="status" className={styles.meta}>방문 통계를 불러오고 있습니다…</p> : null}
      {report.error ? <p role="alert" className={styles.error}>{report.error}</p> : null}
      {report.data ? <AnalyticsBody report={report.data} demo={demo} view={view} /> : null}
    </OperationsFrame>
  );
}

/** 연구 등록 화면의 등록 과정 탭. 방문 기간 필터와 관찰 기간을 섞지 않습니다. */
export function RegistrationPanel() {
  const report = useAnalyticsReport(false, "7d", "day");
  if (report.loading) return <p role="status" className={styles.meta}>등록 과정을 불러오고 있습니다…</p>;
  if (report.error) return <p role="alert" className={styles.error}>{report.error}</p>;
  if (!report.data) return null;
  return <RegistrationBody report={report.data} />;
}

function useAnalyticsReport(demo: boolean, preset: string, grain: string) {
  const [data, setData] = useState<AnalyticsReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const result = demo
      ? Promise.resolve(demoAnalyticsReport())
      : requestApi<AnalyticsReport>(`/admin/operations/analytics?preset=${preset}&grain=${grain}`);
    result
      .then((body) => { if (active) setData(body); })
      .catch((problem: unknown) => { if (active) setError(problem instanceof ApiError ? problem.message : "통계를 불러오지 못했습니다."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo, preset, grain]);
  return { data, error, loading };
}

function AnalyticsBody({ report, demo, view }: { report: AnalyticsReport; demo: boolean; view: "dashboard" | "list" }) {
  const countable = report.collection.status === "ready" || report.collection.status === "paused";
  const pagePoints = report.visits.series.map((point) => ({ date: point.date, count: point.page_views }));
  return (
    <>
      <p className={styles.meta}>{report.collection.note}{report.collection.started_at ? " 측정 시작 " + formatWhen(report.collection.started_at) : ""}</p>
      {view === "dashboard" ? <div className={styles.stats}>
        <StatCard label="사람 수" card={report.visits.visitors} unit="명" />
        <StatCard label="방문 세션" card={report.visits.sessions} unit="세션" icon="chart" />
        <StatCard label="페이지 조회" card={report.visits.page_views} unit="회" icon="chart" />
        <StatCard label="유입 주소" card={report.visits.referrer} unit="" icon="overview" />
        <StatCard label="기기" card={report.visits.device} unit="" icon="overview" />
      </div> : null}
      {view === "dashboard" && countable ? (
        <ChartPanel title="페이지 조회 추이" subtitle="이 그래프는 조회수라서 기간을 더할 수 있습니다. 세션 카드와 막대 합은 다릅니다." label={report.range?.grain ?? "day"}>
          <TrendChart title="페이지 조회 추이" points={pagePoints} unit="회" readout="하루·주·월 묶음의 조회수입니다." />
        </ChartPanel>
      ) : null}
      {view === "list" && countable ? <ChartPanel title="방문 페이지" subtitle="세션 열은 그 페이지를 연 세션입니다. 페이지 세션을 모두 더하면 전체 세션보다 커질 수 있습니다."><PageTable pages={report.visits.pages} /></ChartPanel> : null}
      {view === "list" ? <><ArticleTable articles={report.articles} countable={countable} /><RegistrationBody report={report} /></> : null}
      {demo ? <p className={styles.meta}>이 데모의 세션 128은 하루 세션을 더한 160이 아닙니다. 기간 세션은 같은 세션을 한 번만 셉니다.</p> : null}
    </>
  );
}

function PageTable({ pages }: { pages: AnalyticsReport["visits"]["pages"] }) {
  if (!pages.length) return <p className={styles.meta}>이 기간에 기록된 페이지가 없습니다.</p>;
  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <caption className="sr-only">방문 페이지</caption>
        <thead><tr><th>페이지</th><th className={styles.number}>조회</th><th className={styles.number}>세션</th></tr></thead>
        <tbody>
          {pages.map((page) => (
            <tr key={page.target}><td>{page.label}</td><td className={styles.number}>{page.page_views}</td><td className={styles.number}>{page.sessions}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ArticleTable({ articles, countable }: { articles: AnalyticsReport["articles"]; countable: boolean }) {
  return (
    <section className={styles.panel + " " + styles.panelBody}>
      <div className={styles.panelHead}><div><h2>글별 성과</h2><p>읽은 세션은 그 글을 연 세션 수입니다. 전문가 찾기 클릭은 협업이 확정된 건수가 아닙니다.</p></div><Link href="/admin/insights" className="text-sm font-semibold text-brand">원고 관리</Link></div>
      {!countable || !articles.length ? <p className={styles.meta}>{countable ? "이 기간에 글 기록이 없습니다." : "수집 전에는 글별 수를 만들지 않습니다. 인사이트 통계 탭의 조회수와 수집 스위치가 다릅니다."}</p> : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <caption className="sr-only">글별 조회와 클릭</caption>
            <thead><tr><th>글</th><th className={styles.number}>표시</th><th className={styles.number}>읽은 세션</th><th className={styles.number}>전문가 찾기</th><th className={styles.number}>관련 글</th></tr></thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.target}>
                  <td><Link href={article.kind === "trend" ? `/trends/${article.slug}` : `/cases/${article.slug}`}>{article.slug}</Link></td>
                  <td className={styles.number}>{article.page_views}</td>
                  <td className={styles.number}>{article.read_sessions}</td>
                  <td className={styles.number}>{article.expert_clicks}</td>
                  <td className={styles.number}>{article.related_opens}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RegistrationBody({ report }: { report: AnalyticsReport }) {
  const registration = report.registration;
  const hidden = registration.status === "not_collected" || report.collection.status === "unavailable" || report.collection.status === "not_collected";
  if (hidden || !registration.create) {
    return (
      <section className={styles.panel + " " + styles.panelBody}>
        <div className={styles.panelHead}><div><h2>등록 과정</h2><p>{registration.note || report.collection.note}</p></div><span className={styles.pill}>{statusText(report.collection.status)}</span></div>
        <p className={styles.meta}>저장 전 작성과 임시저장, 이미 등록된 연구의 수정은 따로 봅니다. 연구 본문은 수집하지 않습니다.</p>
        <Link href={adminHref("/admin/projects?tab=abandonment", true)} className={ADMIN_BUTTON + " mt-4 inline-flex bg-brand text-white"}>가상 데이터로 화면 살펴보기</Link>
      </section>
    );
  }
  const answers = registration.reasons.filter((item) => item.kind === "answer");
  return (
    <div className={styles.charts}>
      <ChartPanel title="신규 작성은 어디쯤 갔나요?" subtitle={"창을 연 시도 " + registration.create.opened + "건 · 24시간이 안 된 시도 " + registration.create.watching + "건은 미완료에 넣지 않습니다"} label="신규">
        <DistributionChart denominator={registration.create.opened || undefined} unit="건" items={registration.create.reached.map((step) => ({ label: step.label, value: step.count }))} note={"등록 완료 " + registration.create.completed + "건. 확인 단계 도달과 등록 완료는 다릅니다. 비율은 " + rateText(registration.create.completion_rate) + "입니다."} />
      </ChartPanel>
      <ChartPanel title="직접 고른 이유와 관찰 신호" subtitle="사용자가 고른 답만 이유로 봅니다. 검증 실패와 마지막 단계는 관찰입니다.">
        <DistributionChart unit="건" items={answers.map((item) => ({ label: item.label, value: item.count }))} note={registration.resume ? "임시저장 " + registration.resume.saved + "건 중 7일이 지난 미완료 " + registration.resume.incomplete + "건. 수정 창 " + (registration.edit?.opened ?? 0) + "건은 신규 모수가 아닙니다." : ""} />
        <ul className="mt-4 space-y-2 text-xs text-muted">
          {registration.signals.map((item) => <li key={item.kind + item.code}>관찰 · {item.label} {item.count}건</li>)}
        </ul>
      </ChartPanel>
    </div>
  );
}

function rateText(rate: number | null): string {
  if (rate === null) return "계산 불가(모수 0)";
  return Math.round(rate * 100) + "%";
}
