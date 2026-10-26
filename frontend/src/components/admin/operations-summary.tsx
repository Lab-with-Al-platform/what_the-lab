"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, requestApi } from "@/lib/api";
import { Summary, comparisonText, formatWhen, statusText } from "@/lib/operations-admin";
import { demoSummary } from "@/lib/admin-demo";
import { AdminIcon, adminHref, useAdminDemo } from "./admin-shell";
import { ChartPanel, DistributionChart, PeriodToolbar, StatCard, TrendChart } from "./admin-charts";
import { OperationsFrame, ScreenTabs, screenView } from "./operations-frame";
import styles from "./admin-workspace.module.css";

export function OperationsSummaryScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const demo = useAdminDemo();
  const preset = params.get("preset") ?? "7d";
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const query = new URLSearchParams({ preset });
    if (preset === "custom" && params.get("start") && params.get("end")) {
      query.set("start", params.get("start")!); query.set("end", params.get("end")!);
    }
    let active = true;
    setLoading(true); setError(""); setData(null);
    // 데모는 별도 자료를 읽으며 운영 API에 가상 데이터를 보내지 않습니다.
    const result = demo ? Promise.resolve(demoSummary(preset)) : requestApi<Summary>("/admin/operations/summary?" + query);
    result.then(body => { if (active) setData(body); })
      .catch((problem: unknown) => { if (active) setError(problem instanceof ApiError ? problem.message : "요약을 불러오지 못했습니다."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params, preset, reload, demo]);

  function changePeriod(value: string) {
    const next = new URLSearchParams(params); next.set("preset", value); next.delete("start"); next.delete("end");
    router.replace("/admin?" + next, { scroll: false });
  }
  const range = data?.range;
  const memberQuery = range ? "created_start=" + range.start + "&created_end=" + range.end + "&status=any&view=list" : "view=list";
  const view = screenView(params);
  function changeView(next: "dashboard" | "list") {
    const query = new URLSearchParams(params); query.set("view", next);
    router.replace("/admin?" + query, { scroll: false });
  }
  return <OperationsFrame title="운영 요약" description="플랫폼의 현재 상태와 변화의 흐름을 한눈에 확인하세요." tools={<PeriodToolbar inline preset={preset} onChange={changePeriod} onRefresh={() => setReload(value => value + 1)} />}>
    <ScreenTabs value={view} onChange={changeView} />
    {loading ? <p role="status" className={styles.meta}>운영 현황을 불러오고 있습니다…</p> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {data && view === "dashboard" ? <>
      <div className={styles.stats}>
        <StatCard href={adminHref("/admin/members?signup_step=done&view=list", demo)} label="가입 완료 회원" card={data.members.completed} extra={"정상 " + (data.members.completed.active ?? 0) + "명 · 정지 " + (data.members.completed.suspended ?? 0) + "명"} />
        <StatCard href={adminHref("/admin/members?" + memberQuery, demo)} label="기간 계정 생성" card={data.members.accounts_created} icon="chart" extra={comparisonText(data.members.accounts_created.comparison)} />
        <StatCard href={adminHref("/admin/projects?status=registered&view=list", demo)} label="등록된 연구" card={data.researches.registered} unit="건" icon="research" />
        <StatCard href="/admin/insights" label="검토 대기 원고" card={demo ? { status: "ready", value: 7, note: "디자인 평가용 가상 건수" } : { status: "not_linked", value: null, note: "인사이트 관리에서 확인하세요" }} unit="건" icon="insights" />
      </div>
      <div className={styles.charts + " " + styles.equalCharts}>
        <ChartPanel title="계정 생성 추이" subtitle="선택 기간의 새 계정 · 가입 완료와는 구분" label={(data.members.accounts_created.value?.toLocaleString() ?? "—") + "건"}><TrendChart title="계정 생성 추이" points={data.members.accounts_created.series ?? []} /></ChartPanel>
        <ChartPanel title="연구 레코드 생성 추이" subtitle="선택 기간에 만들어진 연구 · 임시저장 포함" label={(data.researches.created.value?.toLocaleString() ?? "—") + "건"}><TrendChart title="연구 레코드 생성 추이" points={data.researches.created.series ?? []} /></ChartPanel>
      </div>
    </> : null}
    {data && view === "list" ? <>
      <div className={styles.quickLinks}>
        <Link href={adminHref("/admin/members?signup_step=info&view=list", demo)} className={styles.quickLink}><AdminIcon name="members" /><div><strong>가입 진행 상태 살펴보기</strong><small>미완료 계정의 현재 단계 확인</small></div><AdminIcon name="arrow" size={15} /></Link>
        <Link href={adminHref("/admin/projects?tab=abandonment&view=list", demo)} className={styles.quickLink}><AdminIcon name="research" /><div><strong>연구 작성 흐름 확인</strong><small>임시저장과 작성 중단은 구분해서</small></div><AdminIcon name="arrow" size={15} /></Link>
        <Link href="/admin/insights" className={styles.quickLink}><AdminIcon name="insights" /><div><strong>인사이트 관리로 이동</strong><small>수집후보·게시글·원고 검토</small></div><AdminIcon name="arrow" size={15} /></Link>
      </div>
      <div className={styles.charts}>
        <ChartPanel title="현재 회원 구성" subtitle={data.members.roles.note} label="현재 상태"><DistributionChart items={[{ label: "연구자", value: data.members.roles.counts.researcher }, { label: "AI 전문가", value: data.members.roles.counts.expert }, { label: "역할 미선택", value: data.members.roles.counts.unset }]} /></ChartPanel>
        <ChartPanel title="데이터 연결 현황" subtitle="준비되지 않은 지표는 0으로 표시하지 않습니다"><div className="space-y-4">{data.unavailable.map(item => {
          const row = <div className="flex items-start justify-between gap-3 border-b border-line pb-3 text-xs"><div><strong className="font-semibold">{item.label}</strong><p className="mt-1 leading-6 text-muted">{item.note}</p></div><span className={styles.pill}>{statusText(item.status)}</span></div>;
          return item.id === "visits" || item.id === "traffic" ? <Link key={item.id} href={adminHref("/admin/analytics", demo)} className="block hover:text-brand">{row}</Link> : item.id === "collaboration" || item.id === "projects" ? <Link key={item.id} href={adminHref("/admin/projects?tab=requests&view=list", demo)} className="block hover:text-brand">{row}</Link> : <div key={item.id}>{row}</div>;
        })}</div><div className={styles.insightBox}><AdminIcon name="lock" /><div><strong>연구 정보는 필요한 범위만</strong>연구 본문·연락처·원자료는 운영 통계에 포함하지 않습니다.</div></div></ChartPanel>
      </div>
    </> : null}
    {data ? <p className={styles.generatedAt}>한국 시간 · {formatWhen(data.generated_at)}</p> : null}
  </OperationsFrame>;
}
